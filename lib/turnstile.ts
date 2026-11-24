/**
 * Cloudflare Turnstile (bot check) for the login-code and waitlist forms.
 *
 * OFF by default. It turns on only when BOTH are set on the Worker:
 *   TURNSTILE_SITE_KEY   (plain var, public)  and
 *   TURNSTILE_SECRET_KEY (secret, `wrangler secret put TURNSTILE_SECRET_KEY`).
 * Set CITAD3L_TURNSTILE=off to force it off even with keys present.
 */
export const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export function turnstileSiteKey(): string | null {
  if ((process.env.CITAD3L_TURNSTILE ?? "").toLowerCase() === "off") return null;
  const site = process.env.TURNSTILE_SITE_KEY?.trim();
  const secret = process.env.TURNSTILE_SECRET_KEY?.trim();
  return site && secret ? site : null;
}

export function turnstileEnabled(): boolean {
  return turnstileSiteKey() !== null;
}

export type TurnstileResult = { ok: true; skipped?: boolean } | { ok: false; reason: string };

/** Hostnames a token may have been solved on. Empty = do not check. */
function allowedHostnames(): string[] {
  const out = new Set<string>();
  const app = process.env.APP_URL;
  if (app) { try { out.add(new URL(app).hostname); } catch { /* ignore */ } }
  for (const h of (process.env.TURNSTILE_HOSTNAMES ?? "").split(",")) if (h.trim()) out.add(h.trim().toLowerCase());
  return [...out];
}

/**
 * Verify a Turnstile token server-side. When Turnstile is disabled this returns ok (skipped).
 * Fails closed on network errors once enabled.
 */
export async function verifyTurnstile(
  token: unknown,
  opts: { ip?: string | null; action?: string; fetchImpl?: typeof fetch } = {},
): Promise<TurnstileResult> {
  if (!turnstileEnabled()) return { ok: true, skipped: true };
  if (typeof token !== "string" || !token || token.length > 2048) return { ok: false, reason: "missing_token" };
  const form = new URLSearchParams();
  form.set("secret", process.env.TURNSTILE_SECRET_KEY!.trim());
  form.set("response", token);
  if (opts.ip && opts.ip !== "unknown" && opts.ip !== "0.0.0.0") form.set("remoteip", opts.ip);
  const f = opts.fetchImpl ?? fetch;
  let data: { success?: boolean; hostname?: string; action?: string; "error-codes"?: string[] };
  try {
    const res = await f(SITEVERIFY_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: form.toString(),
      signal: AbortSignal.timeout(8000),
    });
    data = await res.json();
  } catch {
    return { ok: false, reason: "verify_unavailable" };
  }
  if (!data?.success) return { ok: false, reason: (data?.["error-codes"] ?? ["failed"]).join(",") };
  const hosts = allowedHostnames();
  if (hosts.length && (typeof data.hostname !== "string" || !hosts.includes(data.hostname.toLowerCase()))) {
    return { ok: false, reason: "hostname_mismatch" };
  }
  if (opts.action && data.action !== opts.action) return { ok: false, reason: "action_mismatch" };
  return { ok: true };
}
