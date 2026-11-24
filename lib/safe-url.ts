/**
 * URL filters for model-generated Markdown. Model output is untrusted (prompt injection can make
 * it emit attacker URLs), so:
 *  - images: only inline data:image/(png|jpeg|webp|gif) under a size cap, or same-origin paths.
 *    No remote images, so a reply can't leak chat contents through an image URL / tracking pixel.
 *  - links: http(s), mailto, same-origin paths and #anchors only.
 */
export const MAX_DATA_IMAGE_CHARS = 12_000_000; // ~9 MB decoded; generated images are well under

const DATA_IMAGE_RE = /^data:image\/(png|jpeg|jpg|webp|gif);base64,[A-Za-z0-9+/=\s]+$/;

function hasControlOrBackslash(u: string): boolean {
  // eslint-disable-next-line no-control-regex
  return /[\u0000-\u001f\u007f\\]/.test(u);
}

function isSameOriginPath(u: string): boolean {
  return u.startsWith("/") && !u.startsWith("//") && !hasControlOrBackslash(u);
}

export function safeImageSrc(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const u = raw.trim();
  if (!u) return null;
  if (u.startsWith("data:")) {
    if (u.length > MAX_DATA_IMAGE_CHARS) return null;
    return DATA_IMAGE_RE.test(u) ? u : null;
  }
  if (isSameOriginPath(u)) return u;
  return null;
}

export function safeLinkHref(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const u = raw.trim();
  if (!u || hasControlOrBackslash(u)) return null;
  if (u.startsWith("#")) return u;
  if (isSameOriginPath(u)) return u;
  let parsed: URL;
  try { parsed = new URL(u); } catch { return null; }
  if (parsed.protocol === "https:" || parsed.protocol === "http:" || parsed.protocol === "mailto:") return parsed.toString();
  return null;
}
