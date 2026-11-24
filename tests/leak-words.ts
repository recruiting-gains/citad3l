/**
 * Words that must never reach the browser or public pages: the configured provider model ids and wire names (from the
 * test env in vitest.config.mts), plus any extra words in LEAK_WORDS (comma-separated; set it locally or in CI from a
 * private source to also check real provider/vendor names, which are deliberately not written in this repo).
 */
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
function words(): string[] {
  const out = new Set<string>();
  try { for (const v of Object.values(JSON.parse(process.env.MODEL_IDS || "{}"))) if (typeof v === "string" && v) out.add(v); } catch { /* none */ }
  try {
    const w = JSON.parse(process.env.PROVIDER_WIRE || "{}") as Record<string, string>;
    for (const k of ["params", "noSystemPrompt", "mediaHost"]) if (w[k]) out.add(w[k]);
  } catch { /* none */ }
  for (const v of (process.env.LEAK_WORDS ?? "").split(",")) if (v.trim()) out.add(v.trim());
  out.add("provider.test");
  return [...out];
}
export const LEAK_WORDS = words();
export const LEAK_RE = new RegExp(LEAK_WORDS.map(esc).join("|"), "i");
