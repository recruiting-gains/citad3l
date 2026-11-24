import "server-only";
import { createHmac, randomInt, timingSafeEqual } from "node:crypto";

export const CODE_LENGTH = 6;
export const CODE_EXPIRY_MS = 10 * 60 * 1000;
export const MAX_CODE_ATTEMPTS = 5;
export const MAX_CODES_PER_EMAIL = 5;
export const MAX_CODES_PER_IP = 10;
export const CODE_WINDOW_MS = 15 * 60 * 1000;
export const RESEND_COOLDOWN_MS = 30_000;

const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{1,32}$/;

export function normalizeEmail(raw: unknown): string | null {
  const email = String(raw ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(email) || email.length > 254) return null;
  return email;
}

export function generateCode(): string {
  return randomInt(0, 10 ** CODE_LENGTH).toString().padStart(CODE_LENGTH, "0");
}

export function isCodeFormat(code: string): boolean {
  return new RegExp(`^\\d{${CODE_LENGTH}}$`).test(code);
}

export function hashCode(email: string, code: string, secret = process.env.AUTH_SECRET): string {
  if (!secret) throw new Error("AUTH_SECRET is required to hash email login codes");
  return createHmac("sha256", secret).update(`email-otp:${email}:${code}`).digest("hex");
}

/** Constant-time comparison of two hex (or other same-alphabet) strings. */
export function timingSafeEqualStr(a: string, b: string): boolean {
  const aa = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (aa.length !== bb.length) {
    timingSafeEqual(aa, Buffer.alloc(aa.length));
    return false;
  }
  return timingSafeEqual(aa, bb);
}

export function hashesMatch(left: string, right: string): boolean {
  return timingSafeEqualStr(left, right);
}
