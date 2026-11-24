import "server-only";
import { prisma } from "@/lib/db";
import type { MailSender } from "@/lib/mail/sender";
import { MailNotConfigured, MailSendFailed } from "@/lib/mail/sender";
import {
  CODE_EXPIRY_MS,
  CODE_WINDOW_MS,
  generateCode,
  hashCode,
  hashesMatch,
  isCodeFormat,
  MAX_CODE_ATTEMPTS,
  MAX_CODES_PER_EMAIL,
  MAX_CODES_PER_IP,
  normalizeEmail,
  RESEND_COOLDOWN_MS,
} from "./otp";
import { LIMITS, limitDurable, rule } from "@/lib/ratelimit";

export type IssueCodeError = "invalid_email" | "rate_limited" | "send_failed" | "not_configured";
export type VerifyCodeError = "invalid_email" | "invalid_code" | "expired_code" | "locked";

export interface EmailCodeRecord {
  id: string;
  email: string;
  codeHash: string;
  expiresAt: Date;
  attempts: number;
  consumedAt: Date | null;
  requestIp: string | null;
  createdAt: Date;
}

export interface EmailCodeStore {
  invalidateOpen(email: string, now: Date): Promise<void>;
  create(row: Omit<EmailCodeRecord, "id"> & { id?: string }): Promise<EmailCodeRecord>;
  countSince(email: string, since: Date): Promise<number>;
  countIpSince(ip: string, since: Date): Promise<number>;
  latestOpen(email: string): Promise<EmailCodeRecord | null>;
  /** Atomically add one attempt and return the new count. */
  incrementAttempts(id: string): Promise<number>;
  /** Mark consumed only if still open. Returns false if another request consumed it first. */
  consume(id: string, now: Date): Promise<boolean | void>;
}

export interface UserRecord {
  id: string;
  email: string | null;
  name: string | null;
}

export interface UserDirectory {
  upsertByEmail(email: string, now: Date): Promise<UserRecord>;
}

export function loginCodeEmail(code: string) {
  const subject = "Your Citad3L sign-in code";
  const text = `Your Citad3L sign-in code is ${code}.\n\nIt expires in 10 minutes. If you didn't request this, you can ignore this email.`;
  const html = `<p style="font-family:Georgia,serif;font-size:16px;line-height:1.5;color:#171717">Your Citad3L sign-in code is</p>
<p style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:32px;letter-spacing:0.2em;font-weight:600;color:#171717">${code}</p>
<p style="font-family:Georgia,serif;font-size:14px;line-height:1.5;color:#525252">It expires in 10 minutes. If you didn't request this, you can ignore this email.</p>`;
  return { subject, text, html };
}

export function prismaEmailCodeStore(): EmailCodeStore {
  return {
    async invalidateOpen(email, now) {
      await prisma.emailLoginCode.updateMany({ where: { email, consumedAt: null }, data: { consumedAt: now } });
    },
    async create(row) {
      return prisma.emailLoginCode.create({
        data: {
          email: row.email,
          codeHash: row.codeHash,
          expiresAt: row.expiresAt,
          attempts: row.attempts,
          consumedAt: row.consumedAt,
          requestIp: row.requestIp,
          createdAt: row.createdAt,
        },
      });
    },
    async countSince(email, since) {
      return prisma.emailLoginCode.count({ where: { email, createdAt: { gte: since } } });
    },
    async countIpSince(ip, since) {
      return prisma.emailLoginCode.count({ where: { requestIp: ip, createdAt: { gte: since } } });
    },
    async latestOpen(email) {
      return prisma.emailLoginCode.findFirst({
        where: { email, consumedAt: null },
        orderBy: { createdAt: "desc" },
      });
    },
    async incrementAttempts(id) {
      const row = await prisma.emailLoginCode.update({ where: { id }, data: { attempts: { increment: 1 } }, select: { attempts: true } });
      return row.attempts;
    },
    async consume(id, now) {
      const r = await prisma.emailLoginCode.updateMany({ where: { id, consumedAt: null }, data: { consumedAt: now } });
      return r.count === 1;
    },
  };
}

export function prismaUserDirectory(): UserDirectory {
  return {
    async upsertByEmail(email, now) {
      return prisma.user.upsert({
        where: { email },
        create: { email, name: email.split("@")[0], emailVerified: now },
        update: { emailVerified: now },
        select: { id: true, email: true, name: true },
      });
    },
  };
}

export async function issueEmailCode(opts: {
  email: unknown;
  ip?: string | null;
  sender: MailSender;
  store?: EmailCodeStore;
  now?: Date;
  from?: string;
}): Promise<{ ok: true } | { ok: false; error: IssueCodeError; retryAfterSec?: number }> {
  const email = normalizeEmail(opts.email);
  if (!email) return { ok: false, error: "invalid_email" };
  const now = opts.now ?? new Date();
  const store = opts.store ?? prismaEmailCodeStore();
  const ip = opts.ip?.trim() || null;

  const since = new Date(now.getTime() - CODE_WINDOW_MS);
  const [emailCount, ipCount, latest] = await Promise.all([
    store.countSince(email, since),
    ip && ip !== "unknown" ? store.countIpSince(ip, since) : Promise.resolve(0),
    store.latestOpen(email),
  ]);
  if (emailCount >= MAX_CODES_PER_EMAIL) return { ok: false, error: "rate_limited", retryAfterSec: 60 };
  if (ip && ip !== "unknown" && ipCount >= MAX_CODES_PER_IP) return { ok: false, error: "rate_limited", retryAfterSec: 60 };
  if (latest && now.getTime() - latest.createdAt.getTime() < RESEND_COOLDOWN_MS) {
    const retryAfterSec = Math.ceil((RESEND_COOLDOWN_MS - (now.getTime() - latest.createdAt.getTime())) / 1000);
    return { ok: false, error: "rate_limited", retryAfterSec };
  }

  const code = generateCode();
  const expiresAt = new Date(now.getTime() + CODE_EXPIRY_MS);
  await store.invalidateOpen(email, now);
  await store.create({
    email,
    codeHash: hashCode(email, code),
    expiresAt,
    attempts: 0,
    consumedAt: null,
    requestIp: ip,
    createdAt: now,
  });

  const tmpl = loginCodeEmail(code);
  const from = opts.from || process.env.AUTH_EMAIL_FROM || "Citad3L <login@localhost>";
  try {
    await opts.sender.send({ to: email, from, ...tmpl });
  } catch (err) {
    await store.invalidateOpen(email, now);
    if (err instanceof MailNotConfigured) return { ok: false, error: "not_configured" };
    if (err instanceof MailSendFailed || err instanceof Error) return { ok: false, error: "send_failed" };
    return { ok: false, error: "send_failed" };
  }
  return { ok: true };
}

export async function verifyEmailCode(opts: {
  email: unknown;
  code: unknown;
  store?: EmailCodeStore;
  users?: UserDirectory;
  now?: Date;
}): Promise<{ ok: true; user: UserRecord } | { ok: false; error: VerifyCodeError }> {
  const email = normalizeEmail(opts.email);
  if (!email) return { ok: false, error: "invalid_email" };
  const code = String(opts.code ?? "").trim();
  if (!isCodeFormat(code)) return { ok: false, error: "invalid_code" };
  const now = opts.now ?? new Date();
  const store = opts.store ?? prismaEmailCodeStore();
  const row = await store.latestOpen(email);
  if (!row) return { ok: false, error: "invalid_code" };
  if (row.expiresAt.getTime() <= now.getTime()) {
    await store.consume(row.id, now);
    return { ok: false, error: "expired_code" };
  }
  if (row.attempts >= MAX_CODE_ATTEMPTS) return { ok: false, error: "locked" };

  // Reserve the attempt BEFORE comparing, so parallel guesses can't each get a free comparison
  // past the per-code cap (the increment is atomic in the database).
  const attempts = await store.incrementAttempts(row.id);
  if (attempts > MAX_CODE_ATTEMPTS) return { ok: false, error: "locked" };

  const expected = hashCode(email, code);
  if (!hashesMatch(row.codeHash, expected)) {
    return { ok: false, error: attempts >= MAX_CODE_ATTEMPTS ? "locked" : "invalid_code" };
  }

  // Single use: only the request that flips consumedAt wins.
  const won = await store.consume(row.id, now);
  if (won === false) return { ok: false, error: "invalid_code" };
  const users = opts.users ?? prismaUserDirectory();
  const user = await users.upsertByEmail(email, now);
  return { ok: true, user };
}

/**
 * Cross-code limits on code checks (per email and per IP), on top of the 5-attempts-per-code cap.
 * Without these, requesting a fresh code resets the per-code counter. Fails closed if the
 * database is unreachable.
 */
export async function checkVerifyLimits(
  rawEmail: unknown,
  ip: string | null | undefined,
  limit: typeof limitDurable = limitDurable,
): Promise<boolean> {
  const email = normalizeEmail(rawEmail) ?? "";
  const ipId = ip && ip !== "unknown" && ip !== "0.0.0.0" ? ip : "";
  const r = await limit([
    rule(LIMITS.verifyEmailHour, email),
    rule(LIMITS.verifyEmailDay, email),
    rule(LIMITS.verifyIp15m, ipId || "unknown-ip"),
  ]);
  return r.ok;
}

/**
 * Per-IP caps on code requests. Charged BEFORE the Turnstile check so Siteverify and the mailer
 * can't be hammered from one network.
 */
export async function checkIssueIpLimits(ip: string | null | undefined, limit: typeof limitDurable = limitDurable) {
  const ipId = ip && ip !== "unknown" && ip !== "0.0.0.0" ? ip : "unknown-ip";
  return limit([rule(LIMITS.otpIp15m, ipId), rule(LIMITS.otpIpDay, ipId)]);
}

/**
 * Per-email daily cap. Charged only AFTER the bot check passes and the address is valid, so
 * unverified requests can't burn a victim's allowance. (15-minute per-email caps live in
 * issueEmailCode, backed by EmailLoginCode.)
 */
export async function checkIssueEmailLimits(rawEmail: unknown, limit: typeof limitDurable = limitDurable) {
  const email = normalizeEmail(rawEmail);
  if (!email) return { ok: true } as const;
  return limit([rule(LIMITS.otpEmailDay, email)]);
}
