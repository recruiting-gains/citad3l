import { NextResponse } from "next/server";
import { BadJson, BodyTooLarge, jerr, readJsonLimited, tooMany } from "@/lib/http";
import { checkIssueEmailLimits, checkIssueIpLimits, issueEmailCode } from "@/lib/auth/email-code";
import { resolveMailSender } from "@/lib/mail/sender";
import { rateLimit } from "@/lib/ratelimit";
import { clientIpFrom } from "@/lib/client-ip";
import { verifyTurnstile } from "@/lib/turnstile";

export const dynamic = "force-dynamic";

const WAIT = "Please wait a minute and try again.";

export async function POST(req: Request) {
  const ip = clientIpFrom(req.headers);
  // Cheap per-isolate cap first; the durable (database) caps below are the source of truth.
  if (!rateLimit(`otp-ip:${ip}`, 20, 15 * 60_000)) return tooMany(WAIT, 60);

  let body: { email?: unknown; turnstileToken?: unknown } | null;
  try {
    body = (await readJsonLimited(req, 4_096)) as typeof body;
  } catch (e) {
    if (e instanceof BodyTooLarge) return jerr(413, "too_large", "Request too large.");
    if (e instanceof BadJson) return jerr(400, "invalid_email", "Enter a valid email address.");
    throw e;
  }

  // IP limits BEFORE the Turnstile check and the email send, so neither can be hammered.
  const ipLimited = await checkIssueIpLimits(ip);
  if (!ipLimited.ok) return tooMany(WAIT, ipLimited.retryAfterSec);

  const ts = await verifyTurnstile(body?.turnstileToken, { ip, action: "login" });
  if (!ts.ok) return jerr(400, "bot_check_failed", "Please complete the quick check and try again.");

  // Per-email allowance is charged only after the bot check passed.
  const emailLimited = await checkIssueEmailLimits(body?.email);
  if (!emailLimited.ok) return tooMany(WAIT, emailLimited.retryAfterSec);

  let sender;
  try {
    sender = await resolveMailSender();
  } catch {
    return jerr(503, "not_configured", "Email sign-in isn't available yet. Try again later.");
  }

  const result = await issueEmailCode({ email: body?.email, ip, sender });
  if (!result.ok) {
    if (result.error === "invalid_email") return jerr(400, "invalid_email", "Enter a valid email address.");
    if (result.error === "rate_limited") return tooMany(WAIT, result.retryAfterSec ?? 60);
    if (result.error === "not_configured") return jerr(503, "not_configured", "Email sign-in isn't available yet. Try again later.");
    return jerr(503, "send_failed", "We couldn't send a code right now. Try again in a moment.");
  }
  // Same success payload whether or not the address has an account.
  return NextResponse.json({ ok: true });
}
