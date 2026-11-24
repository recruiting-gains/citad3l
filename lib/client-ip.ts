/**
 * Client IP for rate limits and guest caps.
 *
 * On Cloudflare, cf-connecting-ip is set by the edge and cannot be forged by the client, while the
 * FIRST X-Forwarded-For entry is whatever the client sent. So in production only cf-connecting-ip
 * is trusted. X-Forwarded-For / X-Real-IP are honoured only outside production (local dev, tests).
 */
export function clientIpFrom(headers: Headers, opts: { prod?: boolean } = {}): string {
  const prod = opts.prod ?? process.env.NODE_ENV === "production";
  const cf = headers.get("cf-connecting-ip")?.trim();
  if (cf) return cf.slice(0, 128);
  if (!prod) {
    const xff = headers.get("x-forwarded-for");
    const first = xff?.split(",")[0]?.trim();
    if (first) return first.slice(0, 128);
    const real = headers.get("x-real-ip")?.trim();
    if (real) return real.slice(0, 128);
  }
  return "unknown";
}
