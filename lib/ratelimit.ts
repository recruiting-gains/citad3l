import { createHash } from "node:crypto";
import { RATE_LIMIT_PER_MINUTE } from "./config";

/**
 * Two layers of rate limiting.
 *
 * 1. rateLimit(): per-isolate sliding window in memory. Cheap first line of defence and the
 *    fallback when the database is unreachable. On Cloudflare Workers each isolate has its own
 *    copy, so on its own it is NOT a real limit.
 * 2. limitDurable(): fixed-window counter in Postgres (Neon via Hyperdrive), table RateLimitBucket.
 *    One atomic upsert per check, shared by every isolate and colo. This is the source of truth.
 *
 * Chosen over the Workers Rate Limiting binding (only 10s/60s periods, per-colo counts) and over a
 * Durable Object (new DO class + migration) because every limit we need is minutes-to-a-day long
 * and the app already talks to Neon on every request.
 */

const hits = new Map<string, number[]>();
const MAX_KEYS = 10_000;

export function rateLimit(key: string, limit = RATE_LIMIT_PER_MINUTE, windowMs = 60_000): boolean {
  const now = Date.now();
  const arr = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (arr.length >= limit) { hits.set(key, arr); return false; }
  arr.push(now);
  hits.set(key, arr);
  if (hits.size > MAX_KEYS) pruneMemory(now);
  return true;
}

function pruneMemory(now: number) {
  // Drop keys whose newest hit is older than a day, then the oldest keys if still too many.
  for (const [k, v] of hits) if (!v.length || now - v[v.length - 1] > 86_400_000) hits.delete(k);
  if (hits.size > MAX_KEYS) {
    const extra = hits.size - MAX_KEYS;
    let i = 0;
    for (const k of hits.keys()) { if (i++ >= extra) break; hits.delete(k); }
  }
}

export function resetRateLimitMemory() { hits.clear(); }

export interface RateLimitRule {
  /** Logical bucket name, e.g. "chat-user-min". */
  name: string;
  /** Who is being limited: user id, email, IP, guest id. Hashed before storage. */
  id: string;
  limit: number;
  windowMs: number;
}

export interface RateLimitStore {
  /** Atomically increment the counter for key/windowStart and return the new count. */
  hit(key: string, windowStart: Date, expiresAt: Date): Promise<number>;
  /** Read the current count without incrementing. Missing row is 0. */
  peek?(key: string, windowStart: Date): Promise<number>;
  /** Best-effort cleanup of expired rows. */
  sweep?(now: Date): Promise<void>;
}

export type LimitResult = { ok: true } | { ok: false; rule: string; retryAfterSec: number };

export function bucketKey(name: string, id: string): string {
  const h = createHash("sha256").update(`${name}\u0000${id}`).digest("hex").slice(0, 40);
  return `${name}:${h}`;
}

export function windowStartFor(now: number, windowMs: number): number {
  return Math.floor(now / windowMs) * windowMs;
}

let storeOverride: RateLimitStore | null | undefined;
/** Tests: inject a store (or null to force the memory fallback). */
export function setRateLimitStore(s: RateLimitStore | null | undefined) { storeOverride = s; }

export async function prismaRateLimitStore(): Promise<RateLimitStore> {
  const { prisma } = await import("./db");
  return {
    async hit(key, windowStart, expiresAt) {
      const rows = await prisma.$queryRaw<{ count: number }[]>`
        INSERT INTO "RateLimitBucket" ("key", "windowStart", "count", "expiresAt")
        VALUES (${key}, ${windowStart}, 1, ${expiresAt})
        ON CONFLICT ("key", "windowStart") DO UPDATE SET "count" = "RateLimitBucket"."count" + 1
        RETURNING "count"`;
      return Number(rows[0]?.count ?? 1);
    },
    async peek(key, windowStart) {
      const row = await prisma.rateLimitBucket.findUnique({
        where: { key_windowStart: { key, windowStart } },
        select: { count: true },
      });
      return row?.count ?? 0;
    },
    async sweep(now) {
      // Bounded batch so one sweep never turns into a long table scan + delete.
      await prisma.$executeRaw`DELETE FROM "RateLimitBucket" WHERE ctid IN (
        SELECT ctid FROM "RateLimitBucket" WHERE "expiresAt" < ${now} LIMIT 500)`;
    },
  };
}

async function resolveStore(): Promise<RateLimitStore | null> {
  if (storeOverride !== undefined) return storeOverride;
  try { return await prismaRateLimitStore(); } catch { return null; }
}

/**
 * Check every rule (all are counted, so a burst is charged to each window). Returns the first
 * rule that is over its limit.
 *
 * If the database fails:
 *  - onDbError "closed" (default): the request is refused (retry in 30 s). Used for anything that
 *    costs money or guards sign-in: guests, login codes, code checks, images, waitlist, billing.
 *  - onDbError "memory": fall back to the per-isolate limiter (degraded). Used for signed-in chat,
 *    which also needs the database for usage accounting, so it can't run long without it anyway.
 */
export async function limitDurable(
  rules: RateLimitRule[],
  opts: { nowMs?: number; onDbError?: "closed" | "memory" } = {},
): Promise<LimitResult> {
  const nowMs = opts.nowMs ?? Date.now();
  const onDbError = opts.onDbError ?? "closed";
  const store = await resolveStore();
  let blocked: LimitResult = { ok: true };
  for (const r of rules) {
    if (!r.id) continue;
    const key = bucketKey(r.name, r.id);
    const ws = windowStartFor(nowMs, r.windowMs);
    const retryAfterSec = Math.max(1, Math.ceil((ws + r.windowMs - nowMs) / 1000));
    let over: boolean;
    try {
      if (!store) throw new Error("no store");
      const count = await store.hit(key, new Date(ws), new Date(ws + r.windowMs * 2));
      over = count > r.limit;
    } catch {
      if (onDbError === "closed") {
        if (blocked.ok) blocked = { ok: false, rule: `${r.name}:unavailable`, retryAfterSec: 30 };
        continue;
      }
      over = !rateLimit(`mem:${key}`, r.limit, r.windowMs);
    }
    if (over && blocked.ok) blocked = { ok: false, rule: r.name, retryAfterSec };
  }
  if (store?.sweep && Math.random() < 0.02) {
    const p = store.sweep(new Date(nowMs)).catch(() => {});
    await keepAlive(p);
  }
  return blocked;
}

/**
 * Read a single rule's current count without incrementing. Returns null if the store
 * cannot be read (no peek, no database), so callers can omit the meter instead of guessing.
 */
export async function peekDurable(rule: RateLimitRule, nowMs = Date.now()): Promise<number | null> {
  if (!rule.id) return null;
  const store = await resolveStore();
  if (!store?.peek) return null;
  try {
    return await store.peek(bucketKey(rule.name, rule.id), new Date(windowStartFor(nowMs, rule.windowMs)));
  } catch {
    return null;
  }
}

/** On Workers, register background work with ctx.waitUntil so it isn't cancelled after the response. */
async function keepAlive(p: Promise<unknown>) {
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const cf = getCloudflareContext() as unknown as { ctx?: { waitUntil?: (p: Promise<unknown>) => void } };
    if (cf?.ctx?.waitUntil) { cf.ctx.waitUntil(p); return; }
  } catch { /* not on Workers (Node/tests) */ }
  void p;
}

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

/** Central limit table. Numbers are per identity per window. */
export const LIMITS = {
  otpEmailDay: { name: "otp-email-day", limit: 20, windowMs: DAY },
  otpIp15m: { name: "otp-ip-15m", limit: 10, windowMs: 15 * MIN },
  otpIpDay: { name: "otp-ip-day", limit: 60, windowMs: DAY },
  verifyEmailHour: { name: "verify-email-hour", limit: 10, windowMs: HOUR },
  verifyEmailDay: { name: "verify-email-day", limit: 30, windowMs: DAY },
  verifyIp15m: { name: "verify-ip-15m", limit: 30, windowMs: 15 * MIN },
  chatUserMin: { name: "chat-user-min", limit: RATE_LIMIT_PER_MINUTE, windowMs: MIN },
  chatUserHour: { name: "chat-user-hour", limit: 300, windowMs: HOUR },
  guestIpMin: { name: "guest-ip-min", limit: 10, windowMs: MIN },
  guestIpHour: { name: "guest-ip-hour", limit: 40, windowMs: HOUR },
  guestIdMin: { name: "guest-id-min", limit: 6, windowMs: MIN },
  /** Whole-site guest budget; id is the constant "all". Limit comes from GUEST_GLOBAL_DAILY_CAP. */
  guestImportHour: { name: "guest-import-hour", limit: 10, windowMs: HOUR },
  guestGlobalDay: { name: "guest-global-day", limit: 300, windowMs: DAY },
  imageUserMin: { name: "image-user-min", limit: 10, windowMs: MIN },
  imageUserHour: { name: "image-user-hour", limit: 60, windowMs: HOUR },
  waitlistIpHour: { name: "waitlist-ip-hour", limit: 5, windowMs: HOUR },
  waitlistIpDay: { name: "waitlist-ip-day", limit: 20, windowMs: DAY },
  billingUser10m: { name: "billing-user-10m", limit: 10, windowMs: 10 * MIN },
  exportUserMin: { name: "export-user-min", limit: 10, windowMs: MIN },
  exportUserHour: { name: "export-user-hour", limit: 40, windowMs: HOUR },
  exportUserDay: { name: "export-user-day", limit: 100, windowMs: DAY },
} as const satisfies Record<string, Omit<RateLimitRule, "id">>;

export function rule(def: Omit<RateLimitRule, "id">, id: string | null | undefined): RateLimitRule {
  return { ...def, id: id ?? "" };
}
