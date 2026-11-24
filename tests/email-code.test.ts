/** Unit tests for email OTP sign-in (no running server required). */
import { describe, it, expect, afterEach, vi } from "vitest";
import {
  CODE_EXPIRY_MS,
  CODE_LENGTH,
  generateCode,
  hashCode,
  hashesMatch,
  isCodeFormat,
  MAX_CODE_ATTEMPTS,
  MAX_CODES_PER_EMAIL,
  normalizeEmail,
  timingSafeEqualStr,
} from "@/lib/auth/otp";
import {
  issueEmailCode,
  loginCodeEmail,
  verifyEmailCode,
  type EmailCodeRecord,
  type EmailCodeStore,
  type UserDirectory,
} from "@/lib/auth/email-code";
import {
  consoleSender,
  getMailSender,
  parseFrom,
  type MailMessage,
  type MailSender,
  MailSendFailed,
} from "@/lib/mail/sender";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

const SECRET = "test-auth-secret-not-for-production";

function memStore(seed: EmailCodeRecord[] = []): EmailCodeStore & { rows: EmailCodeRecord[] } {
  const rows = seed;
  let n = 0;
  return {
    rows,
    async invalidateOpen(email, now) {
      for (const r of rows) if (r.email === email && !r.consumedAt) r.consumedAt = now;
    },
    async create(row) {
      const rec: EmailCodeRecord = { id: row.id ?? `c${++n}`, ...row };
      rows.push(rec);
      return rec;
    },
    async countSince(email, since) {
      return rows.filter((r) => r.email === email && r.createdAt >= since).length;
    },
    async countIpSince(ip, since) {
      return rows.filter((r) => r.requestIp === ip && r.createdAt >= since).length;
    },
    async latestOpen(email) {
      return rows.filter((r) => r.email === email && !r.consumedAt).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0] ?? null;
    },
    async incrementAttempts(id) {
      const r = rows.find((x) => x.id === id)!;
      r.attempts += 1;
      return r.attempts;
    },
    async consume(id, now) {
      const r = rows.find((x) => x.id === id)!;
      r.consumedAt = now;
    },
  };
}

function memUsers(): UserDirectory & { users: { id: string; email: string | null; name: string | null }[] } {
  const users: { id: string; email: string | null; name: string | null }[] = [];
  return {
    users,
    async upsertByEmail(email) {
      let u = users.find((x) => x.email === email);
      if (!u) {
        u = { id: `u_${users.length + 1}`, email, name: email.split("@")[0] };
        users.push(u);
      }
      return u;
    },
  };
}

function recordingSender(sent: MailMessage[] = []): MailSender {
  return {
    name: "console",
    async send(message) {
      sent.push(message);
    },
  };
}

describe("otp helpers", () => {
  it("normalizes and rejects bad emails", () => {
    expect(normalizeEmail("  Owner@Example.COM ")).toBe("owner@example.com");
    expect(normalizeEmail("not-an-email")).toBeNull();
    expect(normalizeEmail("a@" + "b".repeat(200) + ".com")).toBeNull();
    expect(normalizeEmail("")).toBeNull();
  });

  it("generates 6-digit numeric codes, including leading zeros", () => {
    vi.stubEnv("AUTH_SECRET", SECRET);
    const codes = new Set(Array.from({ length: 40 }, () => generateCode()));
    for (const c of codes) {
      expect(c).toHaveLength(CODE_LENGTH);
      expect(isCodeFormat(c)).toBe(true);
    }
    expect(isCodeFormat("12345")).toBe(false);
    expect(isCodeFormat("1234567")).toBe(false);
    expect(isCodeFormat("12a456")).toBe(false);
  });

  it("hashes with HMAC and compares in constant time; codes are not stored in the hash as plaintext", () => {
    vi.stubEnv("AUTH_SECRET", SECRET);
    const email = "you@example.com";
    const hash = hashCode(email, "123456", SECRET);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain("123456");
    expect(hashesMatch(hash, hashCode(email, "123456", SECRET))).toBe(true);
    expect(hashesMatch(hash, hashCode(email, "000000", SECRET))).toBe(false);
    expect(hashesMatch(hash, hashCode("other@example.com", "123456", SECRET))).toBe(false);
    expect(timingSafeEqualStr("abcd", "ab")).toBe(false);
    expect(timingSafeEqualStr("abcd", "abcd")).toBe(true);
  });

  it("refuses to hash without AUTH_SECRET", () => {
    vi.stubEnv("AUTH_SECRET", "");
    expect(() => hashCode("a@example.net", "123456", process.env.AUTH_SECRET)).toThrow(/AUTH_SECRET/);
  });
});

describe("issue and verify email codes", () => {
  it("emails a 6-digit code, stores only the hash, and signs the user in", async () => {
    vi.stubEnv("AUTH_SECRET", SECRET);
    const store = memStore();
    const users = memUsers();
    const sent: MailMessage[] = [];
    const issued = await issueEmailCode({ email: "You@Example.com", ip: "1.2.3.4", sender: recordingSender(sent), store });
    expect(issued).toEqual({ ok: true });
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe("you@example.com");
    const code = sent[0].text.match(/\b(\d{6})\b/)![1]!;
    expect(store.rows[0].codeHash).toBe(hashCode("you@example.com", code, SECRET));
    expect(store.rows[0].codeHash).not.toContain(code);
    expect(JSON.stringify(store.rows)).not.toContain(code);

    const verified = await verifyEmailCode({ email: "you@example.com", code, store, users });
    expect(verified.ok).toBe(true);
    if (verified.ok) {
      expect(verified.user.email).toBe("you@example.com");
      expect(verified.user.id).toBeTruthy();
    }
    expect(store.rows[0].consumedAt).toBeInstanceOf(Date);
    const replay = await verifyEmailCode({ email: "you@example.com", code, store, users });
    expect(replay).toEqual({ ok: false, error: "invalid_code" });
  });

  it("rejects an expired code and a wrong code, and locks after 5 attempts", async () => {
    vi.stubEnv("AUTH_SECRET", SECRET);
    const store = memStore();
    const users = memUsers();
    const sent: MailMessage[] = [];
    const t0 = new Date("2026-11-19T06:00:00Z");
    await issueEmailCode({ email: "a@example.net", sender: recordingSender(sent), store, now: t0 });
    const code = sent[0].text.match(/\b(\d{6})\b/)![1]!;

    const expired = await verifyEmailCode({
      email: "a@example.net",
      code,
      store,
      users,
      now: new Date(t0.getTime() + CODE_EXPIRY_MS + 1),
    });
    expect(expired).toEqual({ ok: false, error: "expired_code" });

    const store2 = memStore();
    const sent2: MailMessage[] = [];
    await issueEmailCode({ email: "a@example.net", sender: recordingSender(sent2), store: store2, now: t0 });
    const good = sent2[0].text.match(/\b(\d{6})\b/)![1]!;
    for (let i = 0; i < MAX_CODE_ATTEMPTS - 1; i++) {
      const r = await verifyEmailCode({ email: "a@example.net", code: "000000", store: store2, users, now: t0 });
      expect(r).toEqual({ ok: false, error: "invalid_code" });
    }
    const locked = await verifyEmailCode({ email: "a@example.net", code: "000000", store: store2, users, now: t0 });
    expect(locked).toEqual({ ok: false, error: "locked" });
    const evenGood = await verifyEmailCode({ email: "a@example.net", code: good, store: store2, users, now: t0 });
    expect(evenGood).toEqual({ ok: false, error: "locked" });
  });

  it("rate-limits by email and IP, and invalidates a previous unused code", async () => {
    vi.stubEnv("AUTH_SECRET", SECRET);
    const store = memStore();
    const sent: MailMessage[] = [];
    const sender = recordingSender(sent);
    const t0 = new Date("2026-11-19T06:00:00Z");

    const first = await issueEmailCode({ email: "a@example.net", ip: "9.9.9.9", sender, store, now: t0 });
    expect(first.ok).toBe(true);
    const firstCode = sent[0].text.match(/\b(\d{6})\b/)![1]!;

    const tooSoon = await issueEmailCode({
      email: "a@example.net",
      ip: "9.9.9.9",
      sender,
      store,
      now: new Date(t0.getTime() + 5_000),
    });
    expect(tooSoon).toEqual({ ok: false, error: "rate_limited", retryAfterSec: 25 });

    // After the 30s cooldown, a new code is issued and the old one no longer works.
    const later = new Date(t0.getTime() + 31_000);
    const second = await issueEmailCode({ email: "a@example.net", ip: "9.9.9.9", sender, store, now: later });
    expect(second.ok).toBe(true);
    const secondCode = sent[1].text.match(/\b(\d{6})\b/)![1]!;
    expect(secondCode).not.toBe(firstCode);
    const users = memUsers();
    expect(await verifyEmailCode({ email: "a@example.net", code: firstCode, store, users, now: later })).toEqual({
      ok: false,
      error: "invalid_code",
    });
    const ok = await verifyEmailCode({ email: "a@example.net", code: secondCode, store, users, now: later });
    expect(ok.ok).toBe(true);

    const store3 = memStore();
    const t1 = new Date("2026-11-19T07:00:00Z");
    for (let i = 0; i < MAX_CODES_PER_EMAIL; i++) {
      const r = await issueEmailCode({
        email: "rate@example.net",
        ip: "8.8.8.8",
        sender: recordingSender(),
        store: store3,
        now: new Date(t1.getTime() + i * 31_000),
      });
      expect(r.ok).toBe(true);
    }
    const limited = await issueEmailCode({
      email: "rate@example.net",
      ip: "8.8.8.8",
      sender: recordingSender(),
      store: store3,
      now: new Date(t1.getTime() + MAX_CODES_PER_EMAIL * 31_000),
    });
    expect(limited.ok).toBe(false);
    if (!limited.ok) expect(limited.error).toBe("rate_limited");
  });

  it("does not leave a usable code if sending fails", async () => {
    vi.stubEnv("AUTH_SECRET", SECRET);
    const store = memStore();
    const failing: MailSender = {
      name: "resend",
      async send() {
        throw new MailSendFailed("boom");
      },
    };
    const r = await issueEmailCode({ email: "a@example.net", sender: failing, store });
    expect(r).toEqual({ ok: false, error: "send_failed" });
    expect(store.rows[0].consumedAt).toBeInstanceOf(Date);
    const v = await verifyEmailCode({ email: "a@example.net", code: "000000", store, users: memUsers() });
    expect(v.ok).toBe(false);
  });

  it("builds an email that contains the code as text, not a magic link", () => {
    const m = loginCodeEmail("042189");
    expect(m.subject).toMatch(/sign-in code/i);
    expect(m.text).toContain("042189");
    expect(m.html).toContain("042189");
    expect(m.text.toLowerCase()).not.toMatch(/https?:\/\//);
    expect(m.html.toLowerCase()).not.toMatch(/https?:\/\//);
  });
});

describe("mail sender selection", () => {
  it("parses a named from-address for Cloudflare Email Sending", () => {
    expect(parseFrom("Citad3L <login@citad3l.io>")).toEqual({ name: "Citad3L", email: "login@citad3l.io" });
    expect(parseFrom("login@citad3l.io")).toBe("login@citad3l.io");
  });

  it("prefers the Cloudflare binding, then Resend, then a dev console sender", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("AUTH_EMAIL_FROM", "Citad3L <login@example.com>");
    vi.stubEnv("RESEND_API_KEY", "re_test");
    const binding = { send: async () => ({ messageId: "x" }) };
    expect(getMailSender(binding).name).toBe("cloudflare");
    expect(getMailSender(undefined).name).toBe("resend");
    vi.stubEnv("RESEND_API_KEY", "");
    vi.stubEnv("AUTH_RESEND_KEY", "");
    expect(getMailSender(undefined).name).toBe("console");
  });

  it("refuses to use the console sender in production when nothing is configured", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AUTH_EMAIL_FROM", "");
    vi.stubEnv("RESEND_API_KEY", "");
    vi.stubEnv("AUTH_RESEND_KEY", "");
    expect(() => getMailSender(undefined)).toThrow(/No email sender is configured/);
  });

  it("console sender is the development fallback", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const log = vi.spyOn(console, "info").mockImplementation(() => {});
    const sender = consoleSender();
    await sender.send({
      to: "dev@example.com",
      from: "Citad3L <login@localhost>",
      subject: "Your Citad3L sign-in code",
      text: "Your Citad3L sign-in code is 654321.",
      html: "<p>654321</p>",
    });
    expect(log).toHaveBeenCalled();
    expect(String(log.mock.calls[0][0])).toContain("654321");
    log.mockRestore();
  });
});
