/** Security hardening tests (no server or database needed). */
import { describe, it, expect, afterEach, vi } from "vitest";
import {
  bucketKey,
  LIMITS,
  limitDurable,
  resetRateLimitMemory,
  rule,
  setRateLimitStore,
  type RateLimitStore,
} from "@/lib/ratelimit";
import { clientIpFrom } from "@/lib/client-ip";
import { clientIp as guestClientIp } from "@/lib/guest";
import { BadJson, BodyTooLarge, readJsonLimited, readTextLimited } from "@/lib/http";
import { safeImageSrc, safeLinkHref } from "@/lib/safe-url";
import { turnstileEnabled, turnstileSiteKey, verifyTurnstile } from "@/lib/turnstile";
import { checkIssueEmailLimits, checkIssueIpLimits, checkVerifyLimits, verifyEmailCode, type EmailCodeRecord, type EmailCodeStore } from "@/lib/auth/email-code";
import { hashCode, MAX_CODE_ATTEMPTS } from "@/lib/auth/otp";
import { bodyLimitFor, capRequestBody, csrfBlockReason, contentSecurityPolicy, securityHeaders, withSecurityHeaders } from "@/security/edge.mjs";

const SECRET = "test-auth-secret-not-for-production";

function memLimitStore(): RateLimitStore & { rows: Map<string, number> } {
  const rows = new Map<string, number>();
  return {
    rows,
    async hit(key, ws) {
      const k = `${key}@${ws.getTime()}`;
      const n = (rows.get(k) ?? 0) + 1;
      rows.set(k, n);
      return n;
    },
  };
}

afterEach(() => {
  setRateLimitStore(undefined);
  resetRateLimitMemory();
  vi.unstubAllEnvs();
});

describe("durable rate limiter", () => {
  it("allows up to the limit in a window, then blocks with Retry-After", async () => {
    setRateLimitStore(memLimitStore());
    const r = { name: "t", limit: 3, windowMs: 60_000 };
    const now = 1_000_000_020_000;
    for (let i = 0; i < 3; i++) expect((await limitDurable([rule(r, "u1")], { nowMs: now })).ok).toBe(true);
    const blocked = await limitDurable([rule(r, "u1")], { nowMs: now });
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) {
      expect(blocked.rule).toBe("t");
      expect(blocked.retryAfterSec).toBeGreaterThan(0);
      expect(blocked.retryAfterSec).toBeLessThanOrEqual(60);
    }
    // other identities and the next window are independent
    expect((await limitDurable([rule(r, "u2")], { nowMs: now })).ok).toBe(true);
    expect((await limitDurable([rule(r, "u1")], { nowMs: now + 60_000 })).ok).toBe(true);
  });

  it("checks every rule (minute and hour) and reports the first one over", async () => {
    setRateLimitStore(memLimitStore());
    const min = { name: "m", limit: 100, windowMs: 60_000 };
    const hour = { name: "h", limit: 2, windowMs: 3_600_000 };
    const now = 1_000_000_000_000;
    expect((await limitDurable([rule(min, "x"), rule(hour, "x")], { nowMs: now })).ok).toBe(true);
    expect((await limitDurable([rule(min, "x"), rule(hour, "x")], { nowMs: now + 61_000 })).ok).toBe(true);
    const r = await limitDurable([rule(min, "x"), rule(hour, "x")], { nowMs: now + 122_000 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.rule).toBe("h");
  });

  it("fails CLOSED by default when the database errors", async () => {
    setRateLimitStore({ async hit() { throw new Error("db down"); } });
    const r = await limitDurable([rule(LIMITS.guestIpMin, "1.2.3.4")]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.rule).toContain("unavailable");
  });

  it("falls back to the in-memory limiter when asked (signed-in chat)", async () => {
    setRateLimitStore({ async hit() { throw new Error("db down"); } });
    const def = { name: "c", limit: 2, windowMs: 60_000 };
    expect((await limitDurable([rule(def, "u")], { onDbError: "memory" })).ok).toBe(true);
    expect((await limitDurable([rule(def, "u")], { onDbError: "memory" })).ok).toBe(true);
    expect((await limitDurable([rule(def, "u")], { onDbError: "memory" })).ok).toBe(false);
  });

  it("stores hashed keys, never raw emails or IPs", () => {
    const k = bucketKey("otp-email-day", "victim@example.com");
    expect(k.startsWith("otp-email-day:")).toBe(true);
    expect(k).not.toContain("victim");
    expect(bucketKey("a", "1.2.3.4")).not.toContain("1.2.3.4");
  });

  it("caps code checks per email across codes (10/hour)", async () => {
    setRateLimitStore(memLimitStore());
    for (let i = 0; i < LIMITS.verifyEmailHour.limit; i++) expect(await checkVerifyLimits("a@example.com", `10.0.0.${i}`)).toBe(true);
    expect(await checkVerifyLimits("A@Example.com", "10.0.1.1")).toBe(false); // normalized email, new IP
    expect(await checkVerifyLimits("other@example.com", "10.0.1.2")).toBe(true);
  });

  it("caps code checks per IP (30 / 15 min) across emails", async () => {
    setRateLimitStore(memLimitStore());
    for (let i = 0; i < LIMITS.verifyIp15m.limit; i++) expect(await checkVerifyLimits(`u${i}@example.com`, "9.9.9.9")).toBe(true);
    expect(await checkVerifyLimits("fresh@example.com", "9.9.9.9")).toBe(false);
  });

  it("caps code requests per IP (10 / 15 min)", async () => {
    setRateLimitStore(memLimitStore());
    for (let i = 0; i < LIMITS.otpIp15m.limit; i++) expect((await checkIssueIpLimits("8.8.8.8")).ok).toBe(true);
    expect((await checkIssueIpLimits("8.8.8.8")).ok).toBe(false);
    expect((await checkIssueIpLimits("8.8.4.4")).ok).toBe(true);
  });

  it("caps code requests per email per day (charged separately, after the bot check)", async () => {
    setRateLimitStore(memLimitStore());
    for (let i = 0; i < LIMITS.otpEmailDay.limit; i++) expect((await checkIssueEmailLimits("Me@example.org")).ok).toBe(true);
    expect((await checkIssueEmailLimits("me@example.org")).ok).toBe(false);
    expect((await checkIssueEmailLimits("not-an-email")).ok).toBe(true); // invalid emails aren't charged (rejected later)
  });
});

describe("client IP", () => {
  const h = (o: Record<string, string>) => new Headers(o);
  it("prefers cf-connecting-ip", () => {
    expect(clientIpFrom(h({ "cf-connecting-ip": "1.1.1.1", "x-forwarded-for": "6.6.6.6" }), { prod: true })).toBe("1.1.1.1");
  });
  it("ignores a client-supplied X-Forwarded-For in production", () => {
    expect(clientIpFrom(h({ "x-forwarded-for": "6.6.6.6, 1.1.1.1" }), { prod: true })).toBe("unknown");
  });
  it("uses X-Forwarded-For only outside production", () => {
    expect(clientIpFrom(h({ "x-forwarded-for": "6.6.6.6, 1.1.1.1" }), { prod: false })).toBe("6.6.6.6");
  });
  it("guest IP can no longer be spoofed past the daily cap on Cloudflare", () => {
    vi.stubEnv("NODE_ENV", "production");
    const req = new Request("https://citad3l.io/api/chat", { headers: { "cf-connecting-ip": "2.2.2.2", "x-forwarded-for": "7.7.7.7" } });
    expect(guestClientIp(req)).toBe("2.2.2.2");
  });
});

describe("email code verification races", () => {
  function slowStore(seed: EmailCodeRecord[]): EmailCodeStore {
    const rows = seed;
    const tick = () => new Promise((r) => setTimeout(r, 1));
    return {
      async invalidateOpen() {},
      async create(row) { const rec = { id: "x", ...row } as EmailCodeRecord; rows.push(rec); return rec; },
      async countSince() { return 0; },
      async countIpSince() { return 0; },
      async latestOpen(email) { await tick(); return rows.find((r) => r.email === email && !r.consumedAt) ?? null; },
      async incrementAttempts(id) { const r = rows.find((x) => x.id === id)!; r.attempts += 1; await tick(); return r.attempts; },
      async consume(id, now) { await tick(); const r = rows.find((x) => x.id === id)!; if (r.consumedAt) return false; r.consumedAt = now; return true; },
    };
  }
  const users = { async upsertByEmail(email: string) { return { id: "u1", email, name: null }; } };

  it("a code can be used only once even when submitted in parallel", async () => {
    vi.stubEnv("AUTH_SECRET", SECRET);
    const now = new Date();
    const email = "race@example.com";
    const store = slowStore([{ id: "c1", email, codeHash: hashCode(email, "123456", SECRET), expiresAt: new Date(now.getTime() + 600_000), attempts: 0, consumedAt: null, requestIp: null, createdAt: now }]);
    const results = await Promise.all(Array.from({ length: 4 }, () => verifyEmailCode({ email, code: "123456", store, users, now })));
    expect(results.filter((r) => r.ok)).toHaveLength(1);
  });

  it("parallel guesses can't get more than the per-code attempt cap of comparisons", async () => {
    vi.stubEnv("AUTH_SECRET", SECRET);
    const now = new Date();
    const email = "guess@example.com";
    const store = slowStore([{ id: "c1", email, codeHash: hashCode(email, "999999", SECRET), expiresAt: new Date(now.getTime() + 600_000), attempts: 0, consumedAt: null, requestIp: null, createdAt: now }]);
    // 20 parallel guesses where the LAST one is right: it must be refused (attempt budget spent).
    const guesses = Array.from({ length: 19 }, (_, i) => String(100000 + i)).concat("999999");
    const results = await Promise.all(guesses.map((code) => verifyEmailCode({ email, code, store, users, now })));
    const wins = results.filter((r) => r.ok).length;
    expect(wins).toBe(0);
    expect(results.filter((r) => !r.ok && r.error === "locked").length).toBeGreaterThanOrEqual(20 - MAX_CODE_ATTEMPTS);
  });
});

describe("JSON body cap", () => {
  it("rejects by Content-Length", async () => {
    const req = new Request("http://x/api", { method: "POST", body: "{}", headers: { "content-length": "999999" } });
    await expect(readJsonLimited(req, 100)).rejects.toBeInstanceOf(BodyTooLarge);
  });
  it("rejects a streamed body over the cap without Content-Length", async () => {
    const big = new ReadableStream({ start(c) { for (let i = 0; i < 10; i++) c.enqueue(new TextEncoder().encode("x".repeat(50))); c.close(); } });
    const req = new Request("http://x/api", { method: "POST", body: big, duplex: "half" } as RequestInit);
    await expect(readJsonLimited(req, 100)).rejects.toBeInstanceOf(BodyTooLarge);
  });
  it("reads raw text exactly (webhook signatures) and caps it", async () => {
    expect(await readTextLimited(new Request("http://x", { method: "POST", body: '{"id":"evt_1"}\n' }), 100)).toBe('{"id":"evt_1"}\n');
    const big = new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode("x".repeat(500))); c.close(); } });
    await expect(readTextLimited(new Request("http://x", { method: "POST", body: big, duplex: "half" } as RequestInit), 100)).rejects.toBeInstanceOf(BodyTooLarge);
  });
  it("parses small JSON and rejects bad JSON", async () => {
    expect(await readJsonLimited(new Request("http://x", { method: "POST", body: '{"a":1}' }), 100)).toEqual({ a: 1 });
    await expect(readJsonLimited(new Request("http://x", { method: "POST", body: "{nope" }), 100)).rejects.toBeInstanceOf(BadJson);
  });
});

describe("Markdown URL filters (model output is untrusted)", () => {
  it("allows inline generated images and same-origin paths only", () => {
    expect(safeImageSrc("data:image/png;base64,iVBORw0KGgo=")).toBe("data:image/png;base64,iVBORw0KGgo=");
    expect(safeImageSrc("/mock-image.svg")).toBe("/mock-image.svg");
    expect(safeImageSrc("https://evil.example/p.png?d=secret")).toBeNull();
    expect(safeImageSrc("//evil.example/p.png")).toBeNull();
    expect(safeImageSrc("/\\evil.example/p.png")).toBeNull();
    expect(safeImageSrc("data:image/svg+xml;base64,PHN2Zz4=")).toBeNull();
    expect(safeImageSrc("data:text/html;base64,PGgxPg==")).toBeNull();
    expect(safeImageSrc("javascript:alert(1)")).toBeNull();
  });
  it("allows http(s)/mailto/relative links, blocks script schemes and tricks", () => {
    expect(safeLinkHref("https://citad3l.io/faq")).toBe("https://citad3l.io/faq");
    expect(safeLinkHref("mailto:a@example.com")).toBe("mailto:a@example.com");
    expect(safeLinkHref("/pricing")).toBe("/pricing");
    expect(safeLinkHref("#top")).toBe("#top");
    expect(safeLinkHref("javascript:alert(1)")).toBeNull();
    expect(safeLinkHref(" JaVaScRiPt:alert(1)")).toBeNull();
    expect(safeLinkHref("java\tscript:alert(1)")).toBeNull();
    expect(safeLinkHref("data:text/html,<script>")).toBeNull();
    expect(safeLinkHref("//evil.example")).toBeNull();
  });
});

describe("Turnstile", () => {
  it("is off unless BOTH keys exist", async () => {
    vi.stubEnv("TURNSTILE_SITE_KEY", "site");
    vi.stubEnv("TURNSTILE_SECRET_KEY", "");
    expect(turnstileEnabled()).toBe(false);
    expect(await verifyTurnstile(undefined)).toEqual({ ok: true, skipped: true });
    vi.stubEnv("TURNSTILE_SECRET_KEY", "sec");
    expect(turnstileSiteKey()).toBe("site");
    vi.stubEnv("CITAD3L_TURNSTILE", "off");
    expect(turnstileEnabled()).toBe(false);
  });

  it("verifies server-side and fails closed", async () => {
    vi.stubEnv("TURNSTILE_SITE_KEY", "site");
    vi.stubEnv("TURNSTILE_SECRET_KEY", "sec");
    vi.stubEnv("APP_URL", "https://citad3l.io");
    const ok = vi.fn(async () => new Response(JSON.stringify({ success: true, hostname: "citad3l.io", action: "login" })));
    expect(await verifyTurnstile("tok", { ip: "1.1.1.1", action: "login", fetchImpl: ok as unknown as typeof fetch })).toEqual({ ok: true });
    const sent = String((ok.mock.calls[0] as unknown as [string, RequestInit])[1].body);
    expect(sent).toContain("response=tok");
    expect(sent).toContain("remoteip=1.1.1.1");

    expect((await verifyTurnstile("", { fetchImpl: ok as unknown as typeof fetch })).ok).toBe(false);
    const bad = async () => new Response(JSON.stringify({ success: false, "error-codes": ["invalid-input-response"] }));
    expect(await verifyTurnstile("tok", { fetchImpl: bad as unknown as typeof fetch })).toEqual({ ok: false, reason: "invalid-input-response" });
    const otherHost = async () => new Response(JSON.stringify({ success: true, hostname: "evil.example" }));
    expect((await verifyTurnstile("tok", { fetchImpl: otherHost as unknown as typeof fetch })).ok).toBe(false);
    const wrongAction = async () => new Response(JSON.stringify({ success: true, hostname: "citad3l.io", action: "waitlist" }));
    expect((await verifyTurnstile("tok", { action: "login", fetchImpl: wrongAction as unknown as typeof fetch })).ok).toBe(false);
    const noAction = async () => new Response(JSON.stringify({ success: true, hostname: "citad3l.io" }));
    expect((await verifyTurnstile("tok", { action: "login", fetchImpl: noAction as unknown as typeof fetch })).ok).toBe(false);
    const noHost = async () => new Response(JSON.stringify({ success: true, action: "login" }));
    expect((await verifyTurnstile("tok", { action: "login", fetchImpl: noHost as unknown as typeof fetch })).ok).toBe(false);
    const down = async () => { throw new Error("network"); };
    expect(await verifyTurnstile("tok", { fetchImpl: down as unknown as typeof fetch })).toEqual({ ok: false, reason: "verify_unavailable" });
  });
});

describe("edge guard (custom-worker.js)", () => {
  const env = { APP_URL: "https://citad3l.io", ALLOWED_ORIGINS: "https://citad3l.example.workers.dev" };
  const req = (method: string, path: string, headers: Record<string, string> = {}) => new Request(`https://citad3l.io${path}`, { method, headers });

  it("blocks cross-site state changes on /api/*", () => {
    expect(csrfBlockReason(req("POST", "/api/account/sessions/x", { origin: "https://evil.example" }), env)).toBe("foreign_origin");
    expect(csrfBlockReason(req("DELETE", "/api/account", { origin: "null" }), env)).toBe("opaque_origin");
    expect(csrfBlockReason(req("POST", "/api/chat", { "sec-fetch-site": "cross-site" }), env)).toBe("cross_site");
  });
  it("allows same-origin, allowlisted, safe methods, non-browser clients, and the webhook", () => {
    expect(csrfBlockReason(req("POST", "/api/chat", { origin: "https://citad3l.io" }), env)).toBeNull();
    expect(csrfBlockReason(req("POST", "/api/chat", { origin: "https://citad3l.example.workers.dev" }), env)).toBeNull();
    expect(csrfBlockReason(req("GET", "/api/usage", { origin: "https://evil.example" }), env)).toBeNull();
    expect(csrfBlockReason(req("POST", "/api/chat"), env)).toBeNull();
    expect(csrfBlockReason(req("POST", "/api/stripe/webhook", { origin: "https://evil.example" }), env)).toBeNull();
    expect(csrfBlockReason(req("POST", "/login", { origin: "https://evil.example" }), env)).toBeNull();
  });
  it("does not trust the request Host for the allowlist", () => {
    const r = new Request("https://attacker.example/api/chat", { method: "POST", headers: { origin: "https://attacker.example" } });
    expect(csrfBlockReason(r, env)).toBe("foreign_origin");
  });
  it("adds HSTS on https and CSP Report-Only by default", () => {
    const h = securityHeaders({}, new URL("https://citad3l.io/"));
    expect(h["Strict-Transport-Security"]).toBe("max-age=31536000");
    expect(h["Content-Security-Policy-Report-Only"]).toContain("frame-ancestors 'none'");
    expect(h["Content-Security-Policy"]).toBeUndefined();
    expect(h["X-Frame-Options"]).toBe("DENY");
    expect(securityHeaders({}, new URL("http://localhost/"))["Strict-Transport-Security"]).toBeUndefined();
  });
  it("can enforce or drop CSP via CITAD3L_CSP", () => {
    expect(securityHeaders({ CITAD3L_CSP: "enforce" }, new URL("https://citad3l.io/"))["Content-Security-Policy"]).toBeTruthy();
    const off = securityHeaders({ CITAD3L_CSP: "off" }, new URL("https://citad3l.io/"));
    expect(off["Content-Security-Policy"]).toBeUndefined();
    expect(off["Content-Security-Policy-Report-Only"]).toBeUndefined();
  });
  it("CSP blocks remote images and framing, allows Turnstile", () => {
    const csp = contentSecurityPolicy();
    expect(csp).toContain("img-src 'self' data: blob:");
    expect(csp).not.toMatch(/img-src[^;]*https:/);
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("frame-src https://challenges.cloudflare.com");
  });
  it("caps unsafe /api bodies at the Worker (Auth.js callbacks get a small cap)", async () => {
    expect(bodyLimitFor("/api/auth/callback/email-code")).toBe(16_384);
    const declared = new Request("https://citad3l.io/api/auth/callback/email-code", { method: "POST", body: "x", headers: { "content-length": "50000" } });
    expect(capRequestBody(declared).response?.status).toBe(413);
    const ok = new Request("https://citad3l.io/api/chat", { method: "POST", body: "{}", headers: { "content-length": "2" } });
    expect(capRequestBody(ok).response).toBeUndefined();
    const get = new Request("https://citad3l.io/api/usage");
    expect(capRequestBody(get).request).toBe(get);
    // No Content-Length: forwarded through a counting stream that errors past the cap.
    const stream = new ReadableStream({ start(c) { c.enqueue(new Uint8Array(20_000)); c.close(); } });
    const chunked = new Request("https://citad3l.io/api/auth/callback/email-code", { method: "POST", body: stream, duplex: "half" } as RequestInit);
    const fwd = capRequestBody(chunked);
    expect(fwd.response).toBeUndefined();
    await expect(fwd.request!.text()).rejects.toThrow();
  });
  /* 2026-11-27 (Karli, iPhone): every photo in chat got "too large" because /api/chat fell under the 256 KB default. */
  it("chat and video bodies get room for shrunk photos, matching the route caps", async () => {
    const { CHAT_BODY_LIMIT, VIDEO_BODY_LIMIT } = await import("@/security/edge.mjs");
    const { MAX_CHAT_JSON_BYTES, MAX_VIDEO_JSON_BYTES, MAX_IMAGE_DATA_URL_CHARS } = await import("@/lib/attachments");
    expect(bodyLimitFor("/api/chat")).toBe(MAX_CHAT_JSON_BYTES);
    expect(CHAT_BODY_LIMIT).toBe(MAX_CHAT_JSON_BYTES);
    expect(bodyLimitFor("/api/video")).toBe(MAX_VIDEO_JSON_BYTES);
    expect(VIDEO_BODY_LIMIT).toBe(MAX_VIDEO_JSON_BYTES);
    expect(bodyLimitFor("/api/chat")).toBeGreaterThan(MAX_IMAGE_DATA_URL_CHARS);
    const photo = new Request("https://citad3l.io/api/chat", { method: "POST", body: "x", headers: { "content-length": "1700000" } });
    expect(capRequestBody(photo).response).toBeUndefined();
    const huge = new Request("https://citad3l.io/api/chat", { method: "POST", body: "x", headers: { "content-length": String(MAX_CHAT_JSON_BYTES + 1) } });
    expect(capRequestBody(huge).response?.status).toBe(413);
    // Everything else keeps the small default.
    expect(bodyLimitFor("/api/image")).toBe(262_144);
    expect(bodyLimitFor("/api/account/instructions")).toBe(262_144);
  });
  it("wraps responses without clobbering existing headers", async () => {
    const res = withSecurityHeaders(new Response("hi", { status: 201, headers: { "X-Frame-Options": "SAMEORIGIN" } }), {}, new URL("https://citad3l.io/"));
    expect(res.status).toBe(201);
    expect(res.headers.get("X-Frame-Options")).toBe("SAMEORIGIN");
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(await res.text()).toBe("hi");
  });
});
