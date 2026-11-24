/** Unit tests for rolling login sessions (no running server required). */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const { loginSession, user } = vi.hoisted(() => ({
  loginSession: {
    create: vi.fn(),
    findUnique: vi.fn(),
    updateMany: vi.fn(),
    findMany: vi.fn(),
  },
  user: { findUnique: vi.fn() },
}));

vi.mock("@/lib/db", () => ({
  prisma: { loginSession, user },
}));

import {
  ADMIN_SESSION_MAX_AGE_SEC,
  ADMIN_SESSION_MS,
  ROLL_MIN_INTERVAL_MS,
  ROLL_WHEN_REMAINING_MS,
  SESSION_MAX_AGE_SEC,
  SESSION_MS,
  applySessionCookieMaxAge,
  checkAndRollSession,
  createLoginSession,
  isSessionActive,
  revokeSession,
  rewriteSessionCookieMaxAge,
  sessionCookieOptions,
  sessionDurationMs,
  sessionMaxAgeSeconds,
  shouldRollSession,
} from "@/lib/sessions";

const day = 24 * 60 * 60 * 1000;
const ADMIN = "admin-owner@example.com";
const MEMBER = "member@example.com";

beforeEach(() => {
  vi.stubEnv("OWNER_EMAIL", ADMIN);
  vi.stubEnv("ADMIN_EMAILS", `${ADMIN}, cousin@example.com`);
  loginSession.create.mockReset();
  loginSession.findUnique.mockReset();
  loginSession.updateMany.mockReset();
  loginSession.findMany.mockReset();
  user.findUnique.mockReset();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("session lengths", () => {
  it("gives regular accounts 30 days and admins 365 days", () => {
    expect(sessionDurationMs(false)).toBe(SESSION_MS);
    expect(sessionDurationMs(true)).toBe(ADMIN_SESSION_MS);
    expect(sessionMaxAgeSeconds(false)).toBe(SESSION_MAX_AGE_SEC);
    expect(sessionMaxAgeSeconds(true)).toBe(ADMIN_SESSION_MAX_AGE_SEC);
    expect(SESSION_MAX_AGE_SEC).toBe(30 * 24 * 60 * 60);
    expect(ADMIN_SESSION_MAX_AGE_SEC).toBe(365 * 24 * 60 * 60);
  });
});

describe("shouldRollSession", () => {
  const now = Date.parse("2026-11-19T12:00:00Z");
  const lastSeenOld = new Date(now - 2 * day);

  it("rolls when less than 20 days remain", () => {
    expect(
      shouldRollSession({
        now,
        expiresAt: new Date(now + ROLL_WHEN_REMAINING_MS - 1000),
        lastSeenAt: lastSeenOld,
        revokedAt: null,
        durationMs: SESSION_MS,
      }),
    ).toBe(true);
  });

  it("does not roll a 30-day session that still has more than 20 days left", () => {
    expect(
      shouldRollSession({
        now,
        expiresAt: new Date(now + 25 * day),
        lastSeenAt: lastSeenOld,
        revokedAt: null,
        durationMs: SESSION_MS,
      }),
    ).toBe(false);
  });

  it("rolls an admin session that is still on a 30-day expiry", () => {
    expect(
      shouldRollSession({
        now,
        expiresAt: new Date(now + 25 * day),
        lastSeenAt: lastSeenOld,
        revokedAt: null,
        durationMs: ADMIN_SESSION_MS,
      }),
    ).toBe(true);
  });

  it("does not write more than once a day", () => {
    expect(
      shouldRollSession({
        now,
        expiresAt: new Date(now + 5 * day),
        lastSeenAt: new Date(now - ROLL_MIN_INTERVAL_MS + 60_000),
        revokedAt: null,
        durationMs: SESSION_MS,
      }),
    ).toBe(false);
  });

  it("does not roll a revoked or already-expired session", () => {
    const base = { now, lastSeenAt: lastSeenOld, durationMs: SESSION_MS };
    expect(shouldRollSession({ ...base, expiresAt: new Date(now + 5 * day), revokedAt: new Date(now - 1000) })).toBe(false);
    expect(shouldRollSession({ ...base, expiresAt: new Date(now - 1000), revokedAt: null })).toBe(false);
  });
});

describe("session cookie flags", () => {
  it("keeps HttpOnly, Secure, SameSite=Lax and Path=/", () => {
    const prod = sessionCookieOptions(SESSION_MAX_AGE_SEC, { secure: true });
    expect(prod).toEqual({ httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: SESSION_MAX_AGE_SEC });
    const dev = sessionCookieOptions(ADMIN_SESSION_MAX_AGE_SEC, { secure: false });
    expect(dev.httpOnly).toBe(true);
    expect(dev.secure).toBe(false);
    expect(dev.sameSite).toBe("lax");
    expect(dev.path).toBe("/");
    expect(dev.maxAge).toBe(ADMIN_SESSION_MAX_AGE_SEC);
  });

  it("rewrites Max-Age on the Auth.js session cookie and leaves flags and other cookies alone", () => {
    const session = "__Secure-authjs.session-token=abc.def; Path=/; Expires=Wed, 19 Dec 2026 12:00:00 GMT; HttpOnly; Secure; SameSite=Lax";
    const csrf = "__Host-authjs.csrf-token=xyz; Path=/; HttpOnly; Secure; SameSite=Lax";
    const out = rewriteSessionCookieMaxAge(session, SESSION_MAX_AGE_SEC);
    expect(out).toContain("__Secure-authjs.session-token=abc.def");
    expect(out).toMatch(/Max-Age=2592000/);
    expect(out).not.toMatch(/Expires=/i);
    expect(out).toMatch(/HttpOnly/i);
    expect(out).toMatch(/Secure/i);
    expect(out).toMatch(/SameSite=Lax/i);
    expect(out).toMatch(/Path=\//i);
    expect(rewriteSessionCookieMaxAge(csrf, SESSION_MAX_AGE_SEC)).toBe(csrf);
    expect(applySessionCookieMaxAge([session, csrf], ADMIN_SESSION_MAX_AGE_SEC)[0]).toMatch(/Max-Age=31536000/);
    expect(applySessionCookieMaxAge([session, csrf], ADMIN_SESSION_MAX_AGE_SEC)[1]).toBe(csrf);
  });
});

describe("createLoginSession", () => {
  it("creates a 30-day session for regular users and a 365-day session for admins", async () => {
    const t0 = Date.now();
    loginSession.create.mockImplementation(async ({ data }: { data: { expiresAt: Date } }) => ({ id: "s1", ...data }));

    await createLoginSession("u-member", { email: MEMBER });
    const regularExpires = loginSession.create.mock.calls[0][0].data.expiresAt as Date;
    expect(regularExpires.getTime()).toBeGreaterThanOrEqual(t0 + SESSION_MS - 1000);
    expect(regularExpires.getTime()).toBeLessThanOrEqual(Date.now() + SESSION_MS + 1000);

    await createLoginSession("u-admin", { email: ADMIN });
    const adminExpires = loginSession.create.mock.calls[1][0].data.expiresAt as Date;
    expect(adminExpires.getTime()).toBeGreaterThanOrEqual(t0 + ADMIN_SESSION_MS - 2000);
    expect(adminExpires.getTime()).toBeLessThanOrEqual(Date.now() + ADMIN_SESSION_MS + 1000);

    await createLoginSession("u-cousin", { email: "cousin@example.com" });
    const cousinExpires = loginSession.create.mock.calls[2][0].data.expiresAt as Date;
    expect(cousinExpires.getTime()).toBeGreaterThanOrEqual(t0 + ADMIN_SESSION_MS - 2000);
  });
});

describe("checkAndRollSession", () => {
  const now = new Date("2026-11-19T12:00:00Z");

  it("returns inactive when missing, revoked, or expired — and does not write", async () => {
    loginSession.findUnique.mockResolvedValueOnce(null);
    expect(await checkAndRollSession("missing")).toEqual({ active: false });

    loginSession.findUnique.mockResolvedValueOnce({ revokedAt: now, expiresAt: new Date(now.getTime() + 10 * day), lastSeenAt: now, userId: "u1" });
    expect(await checkAndRollSession("revoked")).toEqual({ active: false });

    loginSession.findUnique.mockResolvedValueOnce({ revokedAt: null, expiresAt: new Date(now.getTime() - 1000), lastSeenAt: new Date(now.getTime() - 40 * day), userId: "u1" });
    expect(await checkAndRollSession("expired", { now })).toEqual({ active: false });

    expect(loginSession.updateMany).not.toHaveBeenCalled();
    expect(await isSessionActive(null)).toBe(false);
  });

  it("extends a regular session with under 20 days left, at most once a day", async () => {
    loginSession.findUnique.mockResolvedValue({
      revokedAt: null,
      expiresAt: new Date(now.getTime() + 10 * day),
      lastSeenAt: new Date(now.getTime() - 2 * day),
      userId: "u1",
    });
    loginSession.updateMany.mockResolvedValue({ count: 1 });

    const rolled = await checkAndRollSession("sid-1", { email: MEMBER, now });
    expect(rolled.active).toBe(true);
    if (!rolled.active) throw new Error("expected active");
    expect(rolled.rolled).toBe(true);
    expect(rolled.maxAgeSec).toBe(SESSION_MAX_AGE_SEC);
    expect(rolled.expiresAt.getTime()).toBe(now.getTime() + SESSION_MS);
    expect(loginSession.updateMany).toHaveBeenCalledTimes(1);
    const arg = loginSession.updateMany.mock.calls[0][0];
    expect(arg.where.id).toBe("sid-1");
    expect(arg.where.revokedAt).toBeNull();
    expect(arg.data.lastSeenAt).toEqual(now);

    // Same session, lastSeenAt already updated today → no second write.
    loginSession.findUnique.mockResolvedValue({
      revokedAt: null,
      expiresAt: new Date(now.getTime() + SESSION_MS),
      lastSeenAt: now,
      userId: "u1",
    });
    const again = await checkAndRollSession("sid-1", { email: MEMBER, now });
    expect(again.active && !again.rolled).toBe(true);
    expect(loginSession.updateMany).toHaveBeenCalledTimes(1);
  });

  it("upgrades an admin's existing 30-day session to 365 days", async () => {
    loginSession.findUnique.mockResolvedValue({
      revokedAt: null,
      expiresAt: new Date(now.getTime() + 25 * day),
      lastSeenAt: new Date(now.getTime() - 5 * day),
      userId: "u-admin",
    });
    loginSession.updateMany.mockResolvedValue({ count: 1 });
    const r = await checkAndRollSession("sid-admin", { email: ADMIN, now });
    expect(r.active).toBe(true);
    if (!r.active) throw new Error("expected active");
    expect(r.rolled).toBe(true);
    expect(r.maxAgeSec).toBe(ADMIN_SESSION_MAX_AGE_SEC);
    expect(r.expiresAt.getTime()).toBe(now.getTime() + ADMIN_SESSION_MS);
  });

  it("leaves a revoked session revoked even if it would otherwise roll", async () => {
    loginSession.findUnique.mockResolvedValue({
      revokedAt: new Date(now.getTime() - 1000),
      expiresAt: new Date(now.getTime() + 5 * day),
      lastSeenAt: new Date(now.getTime() - 5 * day),
      userId: "u1",
    });
    expect(await checkAndRollSession("sid-revoked", { email: MEMBER, now })).toEqual({ active: false });
    expect(loginSession.updateMany).not.toHaveBeenCalled();
  });
});

describe("revokeSession", () => {
  it("revokes only the caller's active session row", async () => {
    loginSession.updateMany.mockResolvedValue({ count: 1 });
    expect(await revokeSession("u1", "sid-1")).toBe(true);
    expect(loginSession.updateMany).toHaveBeenCalledWith({
      where: { id: "sid-1", userId: "u1", revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
    loginSession.updateMany.mockResolvedValue({ count: 0 });
    expect(await revokeSession("u1", "sid-missing")).toBe(false);
  });
});
