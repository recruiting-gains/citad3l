import { rateLimit } from "@/lib/ratelimit";
import { clientIpFrom } from "@/lib/client-ip";
import { readJsonLimited } from "@/lib/http";
export const dynamic = "force-dynamic";

/** Collects CSP violation reports (Report-Only rollout) into Worker logs. No data is stored. */
export async function POST(req: Request) {
  const ip = clientIpFrom(req.headers);
  if (!rateLimit(`csp:${ip}`, 30, 60_000)) return new Response(null, { status: 204 });
  try {
    const body = (await readJsonLimited(req, 8_192)) as Record<string, unknown> | null;
    const r = (body?.["csp-report"] ?? body) as Record<string, unknown> | undefined;
    if (r) {
      console.warn("[csp]", JSON.stringify({
        directive: String(r["violated-directive"] ?? r["effective-directive"] ?? "").slice(0, 80),
        blocked: String(r["blocked-uri"] ?? "").slice(0, 200),
        page: String(r["document-uri"] ?? "").replace(/\?.*$/, "").slice(0, 200),
      }));
    }
  } catch { /* ignore malformed reports */ }
  return new Response(null, { status: 204 });
}
