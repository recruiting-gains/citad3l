import { prisma } from "./db";
import { isAdminEmail } from "./config";

/** Signed-in session length for regular accounts. */
export const SESSION_MS = 30 * 24 * 60 * 60 * 1000;
/** Signed-in session length for ADMIN_EMAILS (the owner and one other admin). */
export const ADMIN_SESSION_MS = 365 * 24 * 60 * 60 * 1000;
/** Refresh the DB expiry and cookie when less than this remains. */
export const ROLL_WHEN_REMAINING_MS = 20 * 24 * 60 * 60 * 1000;
/** At most one LoginSession write per day, even inside the 20-day window. */
export const ROLL_MIN_INTERVAL_MS = 24 * 60 * 60 * 1000;

export const SESSION_MAX_AGE_SEC = Math.floor(SESSION_MS / 1000);
export const ADMIN_SESSION_MAX_AGE_SEC = Math.floor(ADMIN_SESSION_MS / 1000);

export function sessionDurationMs(isAdmin: boolean): number {
  return isAdmin ? ADMIN_SESSION_MS : SESSION_MS;
}

export function sessionMaxAgeSeconds(isAdmin: boolean): number {
  return isAdmin ? ADMIN_SESSION_MAX_AGE_SEC : SESSION_MAX_AGE_SEC;
}

/**
 * Cookie flags must stay aligned with Auth.js defaults: HttpOnly, Path=/,
 * SameSite=Lax, and Secure on HTTPS / production.
 */
export function sessionCookieOptions(maxAgeSec: number, opts?: { secure?: boolean }) {
  const secure = opts?.secure ?? process.env.NODE_ENV === "production";
  return {
    httpOnly: true as const,
    secure,
    sameSite: "lax" as const,
    path: "/",
    maxAge: Math.floor(maxAgeSec),
  };
}

/** Rewrite Max-Age on an Auth.js session Set-Cookie, leaving other flags alone. */
export function rewriteSessionCookieMaxAge(setCookie: string, maxAgeSec: number): string {
  const trimmed = setCookie.trim();
  if (!trimmed) return setCookie;
  const parts = trimmed.split(";").map((p) => p.trim()).filter(Boolean);
  const nameValue = parts[0] ?? "";
  const name = nameValue.split("=")[0] ?? "";
  if (!/authjs\.session-token/i.test(name)) return setCookie;
  const attrs: string[] = [];
  for (const p of parts.slice(1)) {
    const key = p.split("=")[0]?.trim().toLowerCase();
    if (key === "max-age" || key === "expires") continue;
    attrs.push(p);
  }
  attrs.push(`Max-Age=${Math.floor(maxAgeSec)}`);
  return [nameValue, ...attrs].join("; ");
}

export function applySessionCookieMaxAge(setCookies: readonly string[], maxAgeSec: number): string[] {
  return setCookies.map((c) => rewriteSessionCookieMaxAge(c, maxAgeSec));
}

export type SessionRollInput = {
  now: number;
  expiresAt: Date;
  lastSeenAt: Date;
  revokedAt: Date | null;
  durationMs: number;
};

/**
 * Roll when less than ~20 days remain, or when the session is still on a
 * shorter policy than this account is entitled to (admin upgrade 30 → 365).
 * Callers must also apply the once-a-day lastSeenAt throttle.
 */
export function shouldRollSession(s: SessionRollInput): boolean {
  if (s.revokedAt) return false;
  if (s.expiresAt.getTime() <= s.now) return false;
  if (s.now - s.lastSeenAt.getTime() < ROLL_MIN_INTERVAL_MS) return false;
  const remaining = s.expiresAt.getTime() - s.now;
  if (remaining < ROLL_WHEN_REMAINING_MS) return true;
  // Admin (or a future longer policy) still sitting on a shorter expiry.
  if (s.durationMs > remaining + ROLL_WHEN_REMAINING_MS) return true;
  return false;
}

async function resolveIsAdmin(opts: { email?: string | null; isAdmin?: boolean; userId?: string }): Promise<boolean> {
  if (typeof opts.isAdmin === "boolean") return opts.isAdmin;
  if (opts.email) return isAdminEmail(opts.email);
  if (opts.userId) {
    const u = await prisma.user.findUnique({ where: { id: opts.userId }, select: { email: true } });
    return isAdminEmail(u?.email);
  }
  return false;
}

export async function createLoginSession(
  userId: string,
  opts: { userAgent?: string | null; ipHash?: string | null; email?: string | null; isAdmin?: boolean } = {},
) {
  const isAdmin = await resolveIsAdmin({ email: opts.email, isAdmin: opts.isAdmin, userId });
  return prisma.loginSession.create({
    data: {
      userId,
      expiresAt: new Date(Date.now() + sessionDurationMs(isAdmin)),
      userAgent: (opts.userAgent ?? "").slice(0, 240) || null,
      ipHash: opts.ipHash ?? null,
    },
  });
}

export type SessionCheck =
  | { active: false }
  | { active: true; rolled: boolean; expiresAt: Date; maxAgeSec: number };

export async function checkAndRollSession(
  id: string | undefined | null,
  opts: { email?: string | null; isAdmin?: boolean; userId?: string; now?: Date } = {},
): Promise<SessionCheck> {
  if (!id) return { active: false };
  const now = opts.now ?? new Date();
  const s = await prisma.loginSession.findUnique({
    where: { id },
    select: { revokedAt: true, expiresAt: true, lastSeenAt: true, userId: true },
  });
  if (!s) return { active: false };
  if (s.revokedAt) return { active: false };
  if (s.expiresAt.getTime() <= now.getTime()) return { active: false };

  const isAdmin = await resolveIsAdmin({ email: opts.email, isAdmin: opts.isAdmin, userId: opts.userId ?? s.userId });
  const durationMs = sessionDurationMs(isAdmin);
  const maxAgeSec = sessionMaxAgeSeconds(isAdmin);
  if (!shouldRollSession({ now: now.getTime(), expiresAt: s.expiresAt, lastSeenAt: s.lastSeenAt, revokedAt: s.revokedAt, durationMs })) {
    return { active: true, rolled: false, expiresAt: s.expiresAt, maxAgeSec };
  }

  const expiresAt = new Date(now.getTime() + durationMs);
  const rolled = await prisma.loginSession.updateMany({
    where: {
      id,
      revokedAt: null,
      expiresAt: { gt: now },
      lastSeenAt: { lte: new Date(now.getTime() - ROLL_MIN_INTERVAL_MS) },
    },
    data: { expiresAt, lastSeenAt: now },
  });
  if (rolled.count === 1) {
    return { active: true, rolled: true, expiresAt, maxAgeSec };
  }
  return { active: true, rolled: false, expiresAt: s.expiresAt, maxAgeSec };
}

export async function isSessionActive(id: string | undefined | null): Promise<boolean> {
  const r = await checkAndRollSession(id);
  return r.active;
}

export async function touchSession(id: string) {
  await prisma.loginSession.updateMany({
    where: { id, revokedAt: null, expiresAt: { gt: new Date() } },
    data: { lastSeenAt: new Date() },
  });
}

export async function listSessions(userId: string, currentId?: string | null) {
  const rows = await prisma.loginSession.findMany({
    where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { lastSeenAt: "desc" },
  });
  return rows.map((s) => ({
    id: s.id,
    createdAt: s.createdAt.toISOString(),
    lastSeenAt: s.lastSeenAt.toISOString(),
    expiresAt: s.expiresAt.toISOString(),
    userAgent: s.userAgent,
    current: currentId === s.id,
  }));
}

export async function revokeSession(userId: string, id: string): Promise<boolean> {
  const r = await prisma.loginSession.updateMany({
    where: { id, userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  return r.count === 1;
}

export async function currentSessionIdFromToken(token: { sid?: unknown } | null | undefined): Promise<string | null> {
  const sid = typeof token?.sid === "string" ? token.sid : null;
  return sid;
}
