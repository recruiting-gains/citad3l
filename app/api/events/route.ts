import { z } from "zod";
import { clientIpFrom } from "@/lib/client-ip";
import { BodyTooLarge, jerr, readJsonLimited } from "@/lib/http";
import { rateLimit } from "@/lib/ratelimit";
import { cleanReferrerHost, cleanUtmValue, readFirstTouchCookieHeader, readUtmCookieHeader, utmMetadata, type UtmTags } from "@/lib/utm";
import { recordLanding } from "@/lib/source-tracking";

export const dynamic = "force-dynamic";

const ALLOWED_EVENTS = [
  "landing",
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
  // "landing" only: this visit's own link tags and the referring site's host name (never a full URL).
  src: z.string().max(80).optional(),
  med: z.string().max(80).optional(),
  cmp: z.string().max(80).optional(),
  cnt: z.string().max(80).optional(),
  ref: z.string().max(253).optional(),
});

/**
 * Lightweight, privacy-friendly funnel + UTM event log (Worker logs; no IP, no chat text).
 * "landing" also writes one VisitSource row (see lib/source-tracking.ts): tags, referring host, path, and a
 * keyed hash of the random first-touch id. Nothing else.
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

  if (parsed.data.event === "landing") {
    const d = parsed.data;
    const tags: UtmTags = {};
    const src = cleanUtmValue(d.src), med = cleanUtmValue(d.med), cmp = cleanUtmValue(d.cmp), cnt = cleanUtmValue(d.cnt);
    if (src) tags.source = src;
    if (med) tags.medium = med;
    if (cmp) tags.campaign = cmp;
    if (cnt) tags.content = cnt;
    const ft = readFirstTouchCookieHeader(req.headers.get("cookie"));
    await recordLanding({
      tags: src || med || cmp || cnt ? tags : null,
      referrerHost: cleanReferrerHost(d.ref),
      path: d.path,
      visitorId: ft?.visitorId,
    });
    console.info("[funnel]", JSON.stringify({ event: "landing", path: d.path ?? "/", ...utmMetadata(tags) }));
    return new Response(null, { status: 204 });
  }

  const utm = readUtmCookieHeader(req.headers.get("cookie"));
  console.info("[funnel]", JSON.stringify({
    event: parsed.data.event,
    path: parsed.data.path ?? "/",
    ...utmMetadata(utm),
  }));
  return new Response(null, { status: 204 });
}
