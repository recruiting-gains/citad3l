import { z } from "zod";
import { BadJson, BodyTooLarge, jerr, readJsonLimited, tooMany } from "@/lib/http";
import { addWaitlistSignup, ipFromRequest, prismaWaitlistStore, WAITLIST_EMAIL_MAX, WAITLIST_SOURCE_MAX } from "@/lib/waitlist";
import { LIMITS, limitDurable, rule } from "@/lib/ratelimit";
import { verifyTurnstile } from "@/lib/turnstile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  email: z.string().max(WAITLIST_EMAIL_MAX),
  source: z.string().max(WAITLIST_SOURCE_MAX).optional(),
  website: z.string().max(200).optional(),
  turnstileToken: z.string().max(2048).optional(),
});

export async function POST(req: Request) {
  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await readJsonLimited(req, 4_096));
  } catch (e) {
    if (e instanceof BodyTooLarge) return jerr(413, "too_large", "Request too large.");
    if (!(e instanceof BadJson) && !(e instanceof z.ZodError)) throw e;
    return jerr(400, "invalid_email", "Enter a valid email address.");
  }
  const ip = ipFromRequest(req);
  const limited = await limitDurable([rule(LIMITS.waitlistIpHour, ip), rule(LIMITS.waitlistIpDay, ip)]);
  if (!limited.ok) return tooMany("Too many tries from this network. Please wait and try again.", limited.retryAfterSec);

  // Honeypot hits are answered as success without a Turnstile call (handled in addWaitlistSignup).
  if (!body.website) {
    const ts = await verifyTurnstile(body.turnstileToken, { ip, action: "waitlist" });
    if (!ts.ok) return jerr(400, "bot_check_failed", "Please complete the quick check and try again.");
  }

  const store = await prismaWaitlistStore();
  const result = await addWaitlistSignup({ email: body.email, source: body.source, website: body.website, ip }, store);
  if (!result.ok) {
    return jerr(result.code === "rate_limited" ? 429 : 400, result.code, result.message);
  }
  return Response.json({ ok: true });
}
