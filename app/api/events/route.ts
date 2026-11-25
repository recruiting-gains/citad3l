import { z } from "zod";
import { clientIpFrom } from "@/lib/client-ip";
import { BodyTooLarge, jerr, readJsonLimited } from "@/lib/http";
import { rateLimit } from "@/lib/ratelimit";
import { readUtmCookieHeader, utmMetadata } from "@/lib/utm";

export const dynamic = "force-dynamic";

const ALLOWED_EVENTS = [
  "utm_landing",
  "guest_message_sent",
  "soft_save_shown",
  "soft_save_clicked",
  "image_upgrade_shown",
  "image_upgrade_clicked",
  "referral_public_viewed",
] as const;

const Body = z.object({
  event: z.enum(ALLOWED_EVENTS),
  path: z.string().max(80).regex(/^\/[a-z0-9/_-]*$/i).optional(),
});

/**
 * Lightweight, privacy-friendly funnel + UTM event log (Worker logs only; no DB writes, no IP, no chat text).
 */
export async function POST(req: Request) {
  const ip = clientIpFrom(req.headers);
  if (!rateLimit(`evt:${ip}`, 30, 60_000)) return new Response(null, { status: 204 });

  let raw: unknown;
  try {
    raw = await readJsonLimited(req, 512);
  } catch (e) {
    if (e instanceof BodyTooLarge) return jerr(413, "too_large", "Request too large.");
    return new Response(null, { status: 204 });
  }
  const parsed = Body.safeParse(raw);
  if (!parsed.success) return new Response(null, { status: 204 });

  const utm = readUtmCookieHeader(req.headers.get("cookie"));
  console.info("[funnel]", JSON.stringify({
    event: parsed.data.event,
    path: parsed.data.path ?? "/",
    ...utmMetadata(utm),
  }));
  return new Response(null, { status: 204 });
}
