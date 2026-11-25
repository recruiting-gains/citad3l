/**
 * Lightweight, privacy-friendly UTM / tagged-link attribution.
 *
 * - Stores only the link's own campaign tags (utm_source, utm_medium, utm_campaign, utm_content)
 *   in a first-party cookie (`c3_utm`, 30 days, first-touch wins).
 * - Never stores IP addresses, cross-site trackers, user IDs, or chat text.
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
