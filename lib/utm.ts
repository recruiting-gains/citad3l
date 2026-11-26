/**
 * Lightweight, privacy-friendly UTM / tagged-link attribution.
 *
 * - Stores only the link's own campaign tags (utm_source, utm_medium, utm_campaign, utm_content), the
 *   referring site's host name (e.g. "instagram.com", never the full URL) and a random first-touch id
 *   in a first-party cookie (`c3_utm`, 30 days, first-touch wins). Set only when a visit arrives from a
 *   tagged link or another site; plain direct visits get no cookie.
 * - Never stores IP addresses, cross-site trackers, device fingerprints, user IDs, or chat text.
 */

export const UTM_COOKIE = "c3_utm";
export const UTM_COOKIE_MAX_AGE_SEC = 30 * 24 * 60 * 60;

export interface UtmTags {
  source?: string;
  medium?: string;
  campaign?: string;
  content?: string;
}

const SAFE_TAG_RE = /^[a-z0-9._-]{1,40}$/;

export function cleanUtmValue(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const v = raw.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
  return v && SAFE_TAG_RE.test(v) ? v : undefined;
}

export function parseUtmFromSearch(search: string): UtmTags | null {
  try {
    const p = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
    const out: UtmTags = {};
    const s = cleanUtmValue(p.get("utm_source"));
    const m = cleanUtmValue(p.get("utm_medium"));
    const c = cleanUtmValue(p.get("utm_campaign"));
    const t = cleanUtmValue(p.get("utm_content"));
    if (s) out.source = s;
    if (m) out.medium = m;
    if (c) out.campaign = c;
    if (t) out.content = t;
    return out.source || out.medium || out.campaign || out.content ? out : null;
  } catch {
    return null;
  }
}

/** First touch as kept in the cookie: campaign tags, referring host, random id (no personal data). */
export interface FirstTouch {
  tags: UtmTags | null;
  referrerHost?: string;
  /** Random id made in the browser on first touch. Only ever stored server-side as a keyed hash. */
  visitorId?: string;
}

const HOST_RE = /^(?=.{1,253}$)[a-z0-9-]+(\.[a-z0-9-]+)+$/;
const VISITOR_ID_RE = /^[a-f0-9]{16,32}$/;

/** Bare host name of a referrer ("www." dropped), or undefined for anything else (paths/queries are never kept). */
export function cleanReferrerHost(raw: unknown): string | undefined {
  if (typeof raw !== "string" || !raw) return undefined;
  let host = raw.trim().toLowerCase();
  if (host.includes("/")) {
    try {
      host = new URL(host).hostname;
    } catch {
      return undefined;
    }
  }
  host = host.replace(/^www\./, "").replace(/\.$/, "");
  return HOST_RE.test(host) ? host : undefined;
}

/** Our own hosts never count as a referrer (moving between pages isn't a new source). */
export function isOwnHost(host: string, currentHost?: string): boolean {
  const h = host.replace(/^www\./, "");
  const cur = currentHost?.toLowerCase().replace(/^www\./, "");
  return h === "citad3l.io" || h.endsWith(".citad3l.io") || (!!cur && h === cur) || h === "localhost";
}

/** External referrer host from document.referrer, or undefined (none, our own site, or unparsable). */
export function externalReferrerHost(referrer: string | null | undefined, currentHost?: string): string | undefined {
  const host = cleanReferrerHost(referrer ?? "");
  return host && !isOwnHost(host, currentHost) ? host : undefined;
}

const REFERRER_SOURCES: Array<[RegExp, string]> = [
  [/(^|\.)instagram\.com$/, "instagram"],
  [/(^|\.)threads\.(net|com)$/, "threads"],
  [/(^|\.)(x\.com|twitter\.com|t\.co)$/, "x"],
  [/(^|\.)(facebook\.com|fb\.com|fb\.me)$/, "facebook"],
  [/(^|\.)tiktok\.com$/, "tiktok"],
  [/(^|\.)(youtube\.com|youtu\.be)$/, "youtube"],
  [/(^|\.)reddit\.com$/, "reddit"],
  [/(^|\.)linkedin\.com$|(^|\.)lnkd\.in$/, "linkedin"],
  [/(^|\.)google\.[a-z.]+$/, "google"],
  [/(^|\.)bing\.com$/, "bing"],
  [/(^|\.)duckduckgo\.com$/, "duckduckgo"],
];

/** Short source name for a referring host (l.instagram.com -> instagram); unknown hosts keep their host name. */
export function sourceFromReferrer(host: string | undefined): string | undefined {
  if (!host) return undefined;
  for (const [re, name] of REFERRER_SOURCES) if (re.test(host)) return name;
  return cleanUtmValue(host);
}

/** The one source label used for reports: utm_source, else the referring site, else "direct". */
export function effectiveSource(tags: UtmTags | null | undefined, referrerHost?: string): string {
  return tags?.source ?? sourceFromReferrer(referrerHost) ?? "direct";
}

export function makeVisitorId(): string {
  const b = new Uint8Array(12);
  globalThis.crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}

export function encodeFirstTouchCookieValue(ft: FirstTouch): string {
  const p = new URLSearchParams(encodeUtmCookieValue(ft.tags ?? {}));
  const r = cleanReferrerHost(ft.referrerHost);
  if (r) p.set("r", r);
  if (ft.visitorId && VISITOR_ID_RE.test(ft.visitorId)) p.set("v", ft.visitorId);
  return p.toString();
}

export function decodeFirstTouchCookieValue(raw: string | undefined | null): FirstTouch | null {
  if (!raw || raw.length > 256) return null;
  try {
    const p = new URLSearchParams(raw);
    const tags = decodeUtmCookieValue(raw);
    const r = cleanReferrerHost(p.get("r") ?? "");
    const v = p.get("v") ?? "";
    const out: FirstTouch = { tags };
    if (r) out.referrerHost = r;
    if (VISITOR_ID_RE.test(v)) out.visitorId = v;
    return tags || out.referrerHost || out.visitorId ? out : null;
  } catch {
    return null;
  }
}

function utmCookieRaw(cookieHeader: string | null | undefined): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    if (part.slice(0, i).trim() !== UTM_COOKIE) continue;
    try {
      return decodeURIComponent(part.slice(i + 1).trim());
    } catch {
      return null;
    }
  }
  return null;
}

export function readFirstTouchCookieHeader(cookieHeader: string | null | undefined): FirstTouch | null {
  return decodeFirstTouchCookieValue(utmCookieRaw(cookieHeader));
}

export function encodeUtmCookieValue(tags: UtmTags): string {
  const p = new URLSearchParams();
  if (tags.source) p.set("s", tags.source);
  if (tags.medium) p.set("m", tags.medium);
  if (tags.campaign) p.set("c", tags.campaign);
  if (tags.content) p.set("t", tags.content);
  return p.toString();
}

export function decodeUtmCookieValue(raw: string | undefined | null): UtmTags | null {
  if (!raw || raw.length > 256) return null;
  try {
    const p = new URLSearchParams(raw);
    const out: UtmTags = {};
    const s = cleanUtmValue(p.get("s"));
    const m = cleanUtmValue(p.get("m"));
    const c = cleanUtmValue(p.get("c"));
    const t = cleanUtmValue(p.get("t"));
    if (s) out.source = s;
    if (m) out.medium = m;
    if (c) out.campaign = c;
    if (t) out.content = t;
    return out.source || out.medium || out.campaign || out.content ? out : null;
  } catch {
    return null;
  }
}

export function readUtmCookieHeader(cookieHeader: string | null | undefined): UtmTags | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    if (k !== UTM_COOKIE) continue;
    try {
      return decodeUtmCookieValue(decodeURIComponent(part.slice(i + 1).trim()));
    } catch {
      return null;
    }
  }
  return null;
}

export function utmMetadata(tags: UtmTags | null | undefined): Record<string, string> {
  if (!tags) return {};
  const meta: Record<string, string> = {};
  if (tags.source) meta.utm_source = tags.source;
  if (tags.medium) meta.utm_medium = tags.medium;
  if (tags.campaign) meta.utm_campaign = tags.campaign;
  if (tags.content) meta.utm_content = tags.content;
  return meta;
}
