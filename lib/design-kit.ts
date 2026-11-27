/**
 * Design system for chat graphics: a default brand kit and one tested starting layout per format.
 * Only the detected format's layout is added to the system prompt (keeps design turns cheap).
 * Every template must lint clean (tests/design-system.test.ts) so the model starts from a passing layout.
 */
export type DesignFormat = "post" | "story" | "square" | "landscape";

export const FORMAT_SIZES: Record<DesignFormat, { width: number; height: number; label: string }> = {
  post: { width: 1080, height: 1350, label: "Instagram/Threads post" },
  story: { width: 1080, height: 1920, label: "story or reel cover" },
  square: { width: 1080, height: 1080, label: "square post" },
  landscape: { width: 1600, height: 900, label: "X/landscape post" },
};

const STORY_RE = /\b(stor(y|ies)|reels?|status|1080 ?[x×] ?1920|9 ?: ?16)\b/i;
const SQUARE_RE = /\b(square|1 ?: ?1|1080 ?[x×] ?1080)\b/i;
const LANDSCAPE_RE = /\b(twitter|tweets?|x (post|header|banner|graphic)|(on|for) x\b|landscape|linkedin|youtube thumbnail|thumbnail|16 ?: ?9|1600 ?[x×] ?900|1200 ?[x×] ?675|header image|banner)\b/i;

/** Which canvas the user wants. Defaults to the Instagram post. A plain "x" inside "1080x1350" never means X. */
export function detectFormat(text: string): DesignFormat {
  const t = text.slice(0, 4000);
  if (/\b1080 ?[x×] ?1350\b/i.test(t)) return "post";
  if (STORY_RE.test(t)) return "story";
  if (SQUARE_RE.test(t)) return "square";
  if (LANDSCAPE_RE.test(t)) return "landscape";
  return "post";
}

export const BRAND_KIT = [
  "Default brand kit (if the user gave brand colors, fonts, a logo, or a style, use theirs instead):",
  "- Palettes (bg / ink / accent): Warm #F5EFE3 / #1E4A38 / #D9683A. Night #11151C / #F4F1EA / #F2B84B. Fresh #FFFFFF / #1B2430 / #2F6FED.",
  "- Font pairs: Georgia headline + Helvetica body; Futura headline + system-ui body.",
  "- Spacing scale: 16 24 40 64 96 128px. Safe margin 80px+ (stories 250px top and bottom).",
].join("\n");

const BASE = "*{box-sizing:border-box;margin:0;padding:0}";

export const TEMPLATES: Record<DesignFormat, string> = {
  post:
    "<style>" + BASE +
    ".g{width:1080px;height:1350px;background:#F5EFE3;color:#1E4A38;font-family:Helvetica,Arial,sans-serif;padding:88px;display:flex;flex-direction:column;gap:40px}" +
    ".k{font-size:28px;font-weight:700;letter-spacing:6px;color:#D9683A}h1{font-family:Georgia,serif;font-size:112px;line-height:1.02}.s{font-size:44px;margin-top:24px}" +
    ".m{flex:1;display:grid;grid-template-columns:400px 1fr;gap:64px;align-items:center}.p{height:500px;background:#E4DDD0;border-radius:16px}" +
    "ul{list-style:none;font-size:40px;font-weight:700}li{padding:24px 0;border-top:2px solid #D8CFC0}li:first-child{border-top:0}.f{font-size:32px;font-weight:700;color:#D9683A}" +
    "</style><div class=\"g\"><div class=\"k\">KICKER</div><div><h1>Your headline here.</h1><p class=\"s\">One short subline.</p></div>" +
    "<div class=\"m\"><div class=\"p\" data-photo></div><ul><li>Point one</li><li>Point two</li><li>Point three</li></ul></div><div class=\"f\">Call to action</div></div>",
  story:
    "<style>" + BASE +
    ".g{width:1080px;height:1920px;background:#11151C;color:#F4F1EA;font-family:Helvetica,Arial,sans-serif;padding:250px 88px;display:flex;flex-direction:column;gap:48px}" +
    ".k{font-size:30px;font-weight:700;letter-spacing:6px;color:#F2B84B}h1{font-family:Georgia,serif;font-size:128px;line-height:1.02}.s{font-size:48px}" +
    ".p{flex:1;background:#2A303B;border-radius:24px}ul{list-style:none;font-size:42px;font-weight:700}li{padding:16px 0}.f{font-size:36px;font-weight:700;color:#F2B84B}" +
    "</style><div class=\"g\"><div class=\"k\">KICKER</div><h1>Your headline here.</h1><p class=\"s\">One short subline.</p>" +
    "<div class=\"p\" data-photo></div><ul><li>Point one</li><li>Point two</li></ul><div class=\"f\">Swipe up / Link in bio</div></div>",
  square:
    "<style>" + BASE +
    ".g{width:1080px;height:1080px;background:#FFFFFF;color:#1B2430;font-family:system-ui,Helvetica,sans-serif;padding:80px;display:grid;grid-template-columns:1fr 400px;gap:64px}" +
    ".t{display:flex;flex-direction:column;gap:32px;justify-content:center}.k{font-size:28px;font-weight:700;letter-spacing:6px;color:#2F6FED}" +
    "h1{font-family:Futura,'Avenir Next',sans-serif;font-size:100px;line-height:1.02}.s{font-size:40px}.f{font-size:32px;font-weight:700;color:#2F6FED}" +
    ".p{background:#E9EEF6;border-radius:16px}" +
    "</style><div class=\"g\"><div class=\"t\"><div class=\"k\">KICKER</div><h1>Your headline here.</h1><p class=\"s\">One short subline.</p><div class=\"f\">Call to action</div></div><div class=\"p\" data-photo></div></div>",
  landscape:
    "<style>" + BASE +
    ".g{width:1600px;height:900px;background:#F5EFE3;color:#1E4A38;font-family:Helvetica,Arial,sans-serif;padding:80px;display:grid;grid-template-columns:1fr 620px;gap:80px}" +
    ".t{display:flex;flex-direction:column;gap:32px;justify-content:center}.k{font-size:28px;font-weight:700;letter-spacing:6px;color:#D9683A}" +
    "h1{font-family:Georgia,serif;font-size:104px;line-height:1.02}.s{font-size:40px}.f{font-size:32px;font-weight:700;color:#D9683A}.p{background:#E4DDD0;border-radius:16px}" +
    "</style><div class=\"g\"><div class=\"t\"><div class=\"k\">KICKER</div><h1>Your headline here.</h1><p class=\"s\">One short subline.</p><div class=\"f\">Call to action</div></div><div class=\"p\" data-photo></div></div>",
};

/** Brand kit plus the one starting layout for this format. */
export function designGuideFor(format: DesignFormat): string {
  const s = FORMAT_SIZES[format];
  return `${BRAND_KIT}\nStarting layout for a ${s.label} (${s.width}x${s.height}). Adapt it to the content and swap the palette or fonts if it fits better; keep its safe area, text-on-solid structure, and single photo slot:\n${TEMPLATES[format]}`;
}
