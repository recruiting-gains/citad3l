import { clientIpFrom } from "./client-ip";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import {
  FREE_MESSAGES,
  GUEST_COOKIE,
  GUEST_IP_DAILY_CAP,
  UNIT_LABEL,
  isProd,
} from "./config";
import type { UsageSummary } from "./types";

export const GUEST_COOKIE_MAX_AGE = 30 * 24 * 60 * 60;

export class GuestError extends Error {
  constructor(public code: "limit_reached" | "busy" | "invalid", message: string) {
    super(message);
  }
}

export interface GuestState {
  id: string;
  used: number;
  reserved: number;
}

export interface GuestRecord {
  used: number;
  reserved: number;
  ipHash?: string;
  dayUsed?: number;
  dayStart?: Date;
}

export interface GuestStore {
  get(id: string): Promise<GuestRecord | null>;
  save(id: string, ipHash: string, used: number, reserved: number, dayUsed: number, dayStart: Date): Promise<void>;
  ipDayUsed(ipHash: string, since: Date): Promise<number>;
}

type MemRow = { used: number; reserved: number; ipHash: string; dayUsed: number; dayStart: Date };
const mem = new Map<string, MemRow>();

/** In-memory fallback when the database is not used (tests, preview without Postgres). */
export function memoryGuestStore(): GuestStore & { rows: Map<string, MemRow> } {
  return {
    rows: mem,
    async get(id) {
      const r = mem.get(id);
      return r ? { ...r } : null;
    },
    async save(id, ipHash, used, reserved, dayUsed, dayStart) {
      mem.set(id, { used, reserved, ipHash, dayUsed, dayStart });
    },
    async ipDayUsed(ipHash, since) {
      let n = 0;
      for (const r of mem.values()) {
        if (r.ipHash === ipHash && r.dayStart >= since) n += r.dayUsed;
      }
      return n;
    },
  };
}

function secret(): string {
  const s = process.env.AUTH_SECRET || process.env.GUEST_COOKIE_SECRET || "";
  if (s) return s;
  if (process.env.NODE_ENV === "production") throw new Error("AUTH_SECRET is required to sign guest cookies.");
  return "dev-guest-cookie-secret-not-for-production";
}

export function hashIp(ip: string): string {
  return createHmac("sha256", secret()).update(`ip:${ip}`).digest("hex").slice(0, 32);
}

function b64url(buf: Buffer | string): string {
  const b = Buffer.isBuffer(buf) ? buf : Buffer.from(buf);
  return b.toString("base64url");
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function newGuestId(): string {
  return "g_" + randomBytes(12).toString("hex");
}

export function encodeGuestCookie(state: GuestState): string {
  const payload = b64url(JSON.stringify({ v: 1, id: state.id, used: state.used }));
  return `v1.${payload}.${sign(payload)}`;
}

export function decodeGuestCookie(raw: string | undefined | null): GuestState | null {
  if (!raw) return null;
  const parts = raw.split(".");
  if (parts.length !== 3 || parts[0] !== "v1") return null;
  const [, payload, mac] = parts;
  const expected = sign(payload);
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const j = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { v?: number; id?: string; used?: number };
    if (j.v !== 1 || typeof j.id !== "string" || !/^g_[a-f0-9]{24}$/.test(j.id)) return null;
    const used = Number(j.used);
    if (!Number.isInteger(used) || used < 0) return null;
    return { id: j.id, used, reserved: 0 };
  } catch {
    return null;
  }
}

export function readGuestCookieHeader(cookieHeader: string | null | undefined): GuestState | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    if (k === GUEST_COOKIE) return decodeGuestCookie(decodeURIComponent(part.slice(i + 1).trim()));
  }
  return null;
}

export function serializeGuestCookie(state: GuestState): string {
  const value = encodeGuestCookie(state);
  const parts = [
    `${GUEST_COOKIE}=${value}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${GUEST_COOKIE_MAX_AGE}`,
  ];
  if (isProd()) parts.push("Secure");
  return parts.join("; ");
}

export function clientIp(req: Request): string {
  // Never trust the first X-Forwarded-For entry in production (client-controlled on Cloudflare).
  const ip = clientIpFrom(req.headers);
  return ip === "unknown" ? "0.0.0.0" : ip;
}

export function guestUsageSummary(used: number, reserved = 0): UsageSummary {
  const limit = FREE_MESSAGES;
  return {
    plan: "trial",
    status: "trialing",
    used,
    limit,
    remaining: Math.max(0, limit - used - reserved),
    resetAt: null,
    cancelAtPeriodEnd: false,
    unitLabel: UNIT_LABEL,
    guest: true,
  };
}

const inflight = new Map<string, number>();
const queues = new Map<string, Promise<void>>();

function lock(id: string): Promise<() => void> {
  const prev = queues.get(id) ?? Promise.resolve();
  let release!: () => void;
  const gate = new Promise<void>((res) => {
    release = res;
  });
  queues.set(id, prev.then(() => gate));
  return prev.then(() => release);
}

/**
 * Reserve one guest message. Cookie `used` is authoritative (HMAC-signed).
 * IP daily cap is an anti-abuse backstop when cookies are cleared.
 */
export async function reserveGuest(
  cookie: GuestState | null,
  ip: string,
  store: GuestStore = memoryGuestStore(),
): Promise<{ state: GuestState; setCookie: boolean }> {
  const state = cookie ?? { id: newGuestId(), used: 0, reserved: 0 };
  const unlock = await lock(state.id);
  try {
    const row = await store.get(state.id);
    const used = Math.max(state.used, row?.used ?? 0);
    const reserved = row?.reserved ?? state.reserved;
    if (used + reserved >= FREE_MESSAGES) {
      throw new GuestError("limit_reached", "You've used your 5 free messages. Create a free account for 5 messages every day on Citad3L V1 Fast.");
    }
    const now = new Date();
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const ipHash = hashIp(ip);
    const ipUsed = await store.ipDayUsed(ipHash, dayStart);
    if (ipUsed >= GUEST_IP_DAILY_CAP) {
      throw new GuestError("limit_reached", "You've used your 5 free messages. Create a free account for 5 messages every day on Citad3L V1 Fast.");
    }
    const current = inflight.get(state.id) ?? 0;
    if (current >= 1) throw new GuestError("busy", "A reply is already in progress.");
    inflight.set(state.id, current + 1);
    const next = { id: state.id, used, reserved: reserved + 1 };
    // Keep this row's own count for today (not the IP-wide sum, which double-counted other cookies on the same IP).
    const ownDay = row?.dayStart && sameDay(row.dayStart, dayStart) ? (row.dayUsed ?? 0) : 0;
    await store.save(state.id, ipHash, used, next.reserved, ownDay, dayStart);
    return { state: next, setCookie: !cookie || cookie.used !== used || cookie.id !== state.id };
  } finally {
    unlock();
  }
}

export async function settleGuest(
  state: GuestState,
  ip: string,
  success: boolean,
  store: GuestStore = memoryGuestStore(),
): Promise<GuestState> {
  const unlock = await lock(state.id);
  try {
    const row = await store.get(state.id);
    const used = Math.max(state.used, row?.used ?? 0);
    const reserved = Math.max(0, (row?.reserved ?? state.reserved) - 1);
    const nextUsed = success ? used + 1 : used;
    const now = new Date();
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const ipHash = hashIp(ip);
    const nextDay = (row?.dayStart && sameDay(row.dayStart, dayStart) ? (row.dayUsed ?? 0) : 0) + (success ? 1 : 0);
    inflight.set(state.id, Math.max(0, (inflight.get(state.id) ?? 1) - 1));
    await store.save(state.id, ipHash, nextUsed, reserved, nextDay, dayStart);
    return { id: state.id, used: nextUsed, reserved };
  } finally {
    unlock();
  }
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** Clear in-memory guest state (tests). */
export function resetGuestMemory() {
  mem.clear();
  inflight.clear();
  queues.clear();
}
