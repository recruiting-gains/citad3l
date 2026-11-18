import { RATE_LIMIT_PER_MINUTE } from "./config";
// Per-process sliding window. For multi-instance Fly deployments move this to Postgres/Redis (documented in README).
const hits = new Map<string, number[]>();
export function rateLimit(key: string, limit = RATE_LIMIT_PER_MINUTE, windowMs = 60_000): boolean {
  const now = Date.now();
  const arr = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (arr.length >= limit) { hits.set(key, arr); return false; }
  arr.push(now); hits.set(key, arr);
  return true;
}
