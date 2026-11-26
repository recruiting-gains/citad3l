import { createHmac } from "node:crypto";
import { prisma, dbConfigured } from "./db";
import { chicagoDateKey } from "./chicago-day";
import { cleanReferrerHost, cleanUtmValue, effectiveSource, readFirstTouchCookieHeader, type FirstTouch, type UtmTags } from "./utm";

/**
 * First-party visitor source tracking (where landings, guest starts, signups and payments come from).
 *
 * Privacy: no IP addresses, no full URLs, no message text, no device fingerprinting. The only id is a keyed
 * hash of the random first-touch id the browser keeps in the c3_utm cookie. Every write here is best-effort:
 * a failure is logged and swallowed, so tracking can never break a page, a chat, a sign-in or a payment.
 */

export type ConversionKind = "guest_start" | "signup" | "payment";

export interface LandingInput {
  tags: UtmTags | null;
  referrerHost?: string;
  path?: string;
  visitorId?: string;
}

/** Never throws (a missing/broken DB config just means "skip"). */
function dbReady(): boolean {
  try {
    return dbConfigured();
  } catch {
    return false;
  }
}

function hashSecret(): string {
  const s = process.env.AUTH_SECRET || process.env.GUEST_COOKIE_SECRET || "";
  if (s) return s;
  if (process.env.NODE_ENV === "production") throw new Error("AUTH_SECRET is required for visitor hashes.");
  return "dev-visitor-hash-secret-not-for-production";
}

/** Keyed, one-way hash of the random first-touch id. Not reversible and not linkable without the server secret. */
export function hashVisitorId(visitorId: string | undefined): string | null {
  if (!visitorId) return null;
  return createHmac("sha256", hashSecret()).update(`visitor:${visitorId}`).digest("hex").slice(0, 32);
}

export function cleanLandingPath(raw: unknown): string {
  if (typeof raw !== "string") return "/";
  const p = raw.split(/[?#]/)[0].replace(/[^a-zA-Z0-9/_-]/g, "").slice(0, 80);
  return p.startsWith("/") ? p : "/";
}

function sourceFields(ft: FirstTouch | null) {
  const tags = ft?.tags ?? null;
  const referrerHost = cleanReferrerHost(ft?.referrerHost);
  return {
    source: effectiveSource(tags, referrerHost),
    medium: tags?.medium ?? null,
    campaign: tags?.campaign ?? null,
    content: tags?.content ?? null,
    referrerHost: referrerHost ?? null,
    visitorHash: hashVisitorId(ft?.visitorId),
  };
}

/** Row data for one landing. Exported for tests. */
export function landingRow(input: LandingInput, now = new Date()) {
  const f = sourceFields({ tags: input.tags, referrerHost: input.referrerHost, visitorId: input.visitorId });
  return {
    day: chicagoDateKey(now),
    ...f,
    landingPath: cleanLandingPath(input.path),
    tagged: !!input.tags?.source,
  };
}

export async function recordLanding(input: LandingInput, now = new Date()): Promise<boolean> {
  if (!dbReady()) return false;
  try {
    await prisma.visitSource.create({ data: landingRow(input, now) });
    return true;
  } catch (e) {
    console.error("[sources] landing write failed", e instanceof Error ? e.message : "error");
    return false;
  }
}

/** Row data for one conversion. Exported for tests. */
export function attributionRow(
  kind: ConversionKind,
  who: { userId?: string; guestId?: string },
  ft: FirstTouch | null,
  extra: { plan?: string | null; amountCents?: number | null } = {},
  now = new Date(),
) {
  return {
    kind,
    day: chicagoDateKey(now),
    userId: who.userId ?? null,
    guestId: who.guestId ?? null,
    ...sourceFields(ft),
    plan: extra.plan ?? null,
    amountCents: extra.amountCents ?? null,
  };
}

/** First one wins: a repeat for the same guest/account and kind is ignored (unique index + skipDuplicates). */
async function recordAttribution(row: ReturnType<typeof attributionRow>): Promise<boolean> {
  if (!dbReady()) return false;
  try {
    const r = await prisma.sourceAttribution.createMany({ data: [row], skipDuplicates: true });
    return r.count > 0;
  } catch (e) {
    console.error("[sources] attribution write failed", row.kind, e instanceof Error ? e.message : "error");
    return false;
  }
}

/** A guest's first message (trial start). */
export async function recordGuestStart(guestId: string, cookieHeader: string | null | undefined, now = new Date()) {
  if (!guestId) return false;
  return recordAttribution(attributionRow("guest_start", { guestId }, readFirstTouchCookieHeader(cookieHeader), {}, now));
}

/** Only brand-new accounts (created in the last 30 minutes), so an old account signing in again isn't a "signup". */
export const SOURCE_SIGNUP_WINDOW_MS = 30 * 60 * 1000;

export async function recordSignupSource(userId: string, cookieHeader: string | null | undefined, now = new Date()) {
  if (!userId || !dbReady()) return false;
  try {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { createdAt: true } });
    if (!user || now.getTime() - user.createdAt.getTime() > SOURCE_SIGNUP_WINDOW_MS) return false;
  } catch (e) {
    console.error("[sources] signup lookup failed", e instanceof Error ? e.message : "error");
    return false;
  }
  return recordAttribution(attributionRow("signup", { userId }, readFirstTouchCookieHeader(cookieHeader), {}, now));
}

/** First-touch tags carried on Stripe metadata by /api/billing/checkout (utm_* keys). */
export function firstTouchFromMetadata(meta: Record<string, string> | null | undefined): FirstTouch | null {
  if (!meta) return null;
  const tags: UtmTags = {};
  const s = cleanUtmValue(meta.utm_source);
  const m = cleanUtmValue(meta.utm_medium);
  const c = cleanUtmValue(meta.utm_campaign);
  const t = cleanUtmValue(meta.utm_content);
  if (s) tags.source = s;
  if (m) tags.medium = m;
  if (c) tags.campaign = c;
  if (t) tags.content = t;
  const ref = cleanReferrerHost(meta.utm_ref);
  if (!s && !m && !c && !t && !ref) return null;
  return { tags: s || m || c || t ? tags : null, referrerHost: ref };
}

/**
 * A paid invoice. Only the account's first payment is kept. Source: the account's signup row (true first touch),
 * else the tags carried on the Stripe metadata, else "direct".
 */
export async function recordPaymentSource(
  userId: string,
  opts: { amountCents: number; plan?: string | null; metadata?: Record<string, string> | null },
  now = new Date(),
) {
  if (!userId || !(opts.amountCents > 0) || !dbReady()) return false;
  try {
    const signup = await prisma.sourceAttribution.findUnique({
      where: { kind_userId: { kind: "signup", userId } },
      select: { source: true, medium: true, campaign: true, content: true, referrerHost: true, visitorHash: true },
    });
    if (signup) {
      return await recordAttribution({
        ...attributionRow("payment", { userId }, null, { plan: opts.plan, amountCents: opts.amountCents }, now),
        ...signup,
      });
    }
  } catch (e) {
    console.error("[sources] payment lookup failed", e instanceof Error ? e.message : "error");
  }
  return recordAttribution(attributionRow("payment", { userId }, firstTouchFromMetadata(opts.metadata), { plan: opts.plan, amountCents: opts.amountCents }, now));
}
