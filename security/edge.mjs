// Edge guards applied in custom-worker.js (Cloudflare Worker entry), before/after the OpenNext handler.
// Plain ESM so the Worker bundle and the vitest suite both import it.

const UNSAFE = new Set(["POST", "PUT", "PATCH", "DELETE"]);
// Exact paths that must accept cross-site POSTs (server-to-server, signed).
const CSRF_EXEMPT = new Set(["/api/stripe/webhook", "/api/csp-report"]);

/** Fixed allowlist: APP_URL's origin plus ALLOWED_ORIGINS (comma-separated). Never the request Host. */
export function allowedOrigins(env = {}) {
  const out = new Set();
  for (const raw of [env.APP_URL, ...String(env.ALLOWED_ORIGINS ?? "").split(",")]) {
    const v = String(raw ?? "").trim();
    if (!v) continue;
    try { out.add(new URL(v).origin); } catch { /* ignore bad entries */ }
  }
  return out;
}

/**
 * CSRF guard for state-changing API calls. Returns a reason string if the request must be refused,
 * else null. Browsers always send Origin on cross-origin POSTs; a request with no Origin and no
 * cross-site Sec-Fetch-Site is a non-browser client, which can't ride a user's cookies anyway.
 */
export function csrfBlockReason(request, env = {}) {
  if (!UNSAFE.has(request.method)) return null;
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/api/")) return null;
  if (CSRF_EXEMPT.has(url.pathname)) return null;
  const origin = request.headers.get("origin");
  const site = request.headers.get("sec-fetch-site");
  if (origin) {
    if (origin === "null") return "opaque_origin";
    if (!allowedOrigins(env).has(origin)) return "foreign_origin";
    return null;
  }
  if (site === "cross-site") return "cross_site";
  return null;
}

export const TURNSTILE_ORIGIN = "https://challenges.cloudflare.com";

export function contentSecurityPolicy({ enforce = false } = {}) {
  const parts = [
    "default-src 'self'",
    // Next.js App Router emits inline bootstrap scripts (and app/layout.tsx has the theme boot script),
    // so 'unsafe-inline' is needed until nonces are wired. Turnstile loads from challenges.cloudflare.com.
    `script-src 'self' 'unsafe-inline' ${TURNSTILE_ORIGIN}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "media-src 'self' blob:",
    `connect-src 'self' ${TURNSTILE_ORIGIN}`,
    `frame-src ${TURNSTILE_ORIGIN}`,
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    "report-uri /api/csp-report",
  ];
  // Ignored (with a console warning) in Report-Only, so only sent when enforcing.
  if (enforce) parts.splice(parts.length - 1, 0, "upgrade-insecure-requests");
  return parts.join("; ");
}

/**
 * Security headers for every Worker response. CSP ships as Report-Only by default; set
 * CITAD3L_CSP=enforce once the browser shows no violations, or CITAD3L_CSP=off to drop it.
 */
export function securityHeaders(env = {}, url) {
  const h = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
    "Cross-Origin-Opener-Policy": "same-origin",
  };
  if (url && url.protocol === "https:") h["Strict-Transport-Security"] = "max-age=31536000";
  const mode = String(env.CITAD3L_CSP ?? "report-only").toLowerCase();
  if (mode === "enforce") h["Content-Security-Policy"] = contentSecurityPolicy({ enforce: true });
  else if (mode !== "off") h["Content-Security-Policy-Report-Only"] = contentSecurityPolicy();
  return h;
}

/** Copy a response with security headers added (existing values for the same header are kept). */
export function withSecurityHeaders(res, env, url) {
  const headers = new Headers(res.headers);
  for (const [k, v] of Object.entries(securityHeaders(env, url))) if (!headers.has(k)) headers.set(k, v);
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}

/** Max request body per path for state-changing /api/* calls (checked at the Worker, before Next/Auth.js parse it). */
export function bodyLimitFor(pathname) {
  if (pathname.startsWith("/api/auth/")) return 16_384; // Auth.js callbacks + request-code: tiny forms
  if (pathname === "/api/stripe/webhook") return 1_000_000;
  return 262_144;
}

function tooLarge() {
  return new Response(JSON.stringify({ error: { code: "too_large", message: "Request too large." } }), {
    status: 413,
    headers: { "content-type": "application/json", "X-Robots-Tag": "noindex, nofollow" },
  });
}

/**
 * Enforce a byte cap on unsafe /api/* bodies. Returns { response } to short-circuit with 413, or
 * { request } to forward (wrapped in a counting stream when there's no Content-Length).
 */
export function capRequestBody(request) {
  if (!UNSAFE.has(request.method) || !request.body) return { request };
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/api/")) return { request };
  const max = bodyLimitFor(url.pathname);
  const declared = Number(request.headers.get("content-length") ?? "");
  if (request.headers.has("content-length") && Number.isFinite(declared)) {
    return declared > max ? { response: tooLarge() } : { request };
  }
  let seen = 0;
  const counter = new TransformStream({
    transform(chunk, controller) {
      seen += chunk.byteLength;
      if (seen > max) controller.error(new Error("request body too large"));
      else controller.enqueue(chunk);
    },
  });
  return { request: new Request(request, { body: request.body.pipeThrough(counter), duplex: "half" }) };
}
