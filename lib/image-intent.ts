/**
 * Detects when a user's prompt is asking to generate a new picture/image,
 * so free/guest accounts see an inline upgrade card for Citad3L Image (Pro & Max)
 * instead of hitting a dead end.
 */

const SLASH_IMAGE_RE = /^\/image(?:\s+|$)/i;
const IMAGE_CREATE_RE =
  /\b(?:generate|create|make|draw|paint|sketch|render|design)\s+(?:me\s+)?(?:a\s+|an\s+|some\s+|the\s+)?(?:[\w-]+\s+){0,2}(?:image|picture|photo|portrait|logo|illustration|artwork|poster|wallpaper|icon|avatar|graphic)\b/i;

export function isSlashImageCommand(text: string): boolean {
  return SLASH_IMAGE_RE.test(text.trim());
}

export function looksLikeImageRequest(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  if (SLASH_IMAGE_RE.test(t)) return true;
  return IMAGE_CREATE_RE.test(t);
}
