/**
 * Paste-ready image prompts.
 *
 * When image and video generation are off, chat replies can include one fenced
 * `image-prompt` block. The chat renders that block as a card. A counter tallies
 * how often a reply includes one. This module is the parser and the request
 * detector. It never stores prompt text.
 */

export const IMAGE_PROMPT_LANG = "image-prompt";

/** Exact label on the chat card. */
export const IMAGE_PROMPT_CARD_LABEL = "Image prompt — use in your favorite image tool";

export const IMAGE_PROMPT_PLANS = ["guest", "free", "pro", "max"] as const;
export type ImagePromptPlan = (typeof IMAGE_PROMPT_PLANS)[number];

export type ImagePromptCardModel = {
  /** Prompt body shown in the card, without the negative line. */
  prompt: string;
  /** Short negative prompt, when the block ends with a Negative: line. */
  negative: string | null;
  /** Text placed on the clipboard. Includes the negative line when there is one. */
  copyText: string;
};

const PLAN_SET = new Set<string>(IMAGE_PROMPT_PLANS);

export function isImagePromptPlan(value: string | null | undefined): value is ImagePromptPlan {
  return !!value && PLAN_SET.has(value);
}

/** guest for signed-out visitors; trial (and anything else signed in) counts as free. */
export function imagePromptPlanFor(plan: string | null | undefined, guest = false): ImagePromptPlan {
  if (guest) return "guest";
  if (plan === "pro" || plan === "max") return plan;
  return "free";
}

const OPEN_FENCE = /^[ ]{0,3}```image-prompt(?![A-Za-z0-9_-])/;
const CLOSE_FENCE = /^[ ]{0,3}```(?![A-Za-z0-9_-])/;

/**
 * Bodies of ```image-prompt fences. A fence left open at the end of a finished
 * reply still counts, because the markdown renderer treats it as a block.
 * Other code fences are ignored. Empty bodies are ignored.
 */
export function extractImagePromptBlocks(markdown: string): string[] {
  const out: string[] = [];
  if (!markdown) return out;
  const lines = markdown.split(/\r\n|\n/);
  for (let i = 0; i < lines.length; i++) {
    if (!OPEN_FENCE.test(lines[i])) continue;
    const body: string[] = [];
    let j = i + 1;
    for (; j < lines.length; j++) {
      if (CLOSE_FENCE.test(lines[j])) break;
      body.push(lines[j]);
    }
    i = j;
    const text = body.join("\n").replace(/[ \t]+$/gm, "").replace(/\n+$/g, "").trim();
    if (text) out.push(text);
  }
  return out;
}

export function hasImagePromptBlock(markdown: string): boolean {
  return extractImagePromptBlocks(markdown).length > 0;
}

const NEGATIVE_LINE = /^\s*negative(?:\s+prompt)?\s*:\s*(.*?)\s*$/i;

/** Split a fence body into the prompt and an optional trailing negative line. */
export function imagePromptCardModel(body: string): ImagePromptCardModel {
  const text = body.replace(/\r\n/g, "\n").replace(/^\n+|\n+$/g, "");
  const lines = text.split("\n");
  let idx = -1;
  for (let i = lines.length - 1; i >= 0; i--) {
    if (!lines[i].trim()) continue;
    if (NEGATIVE_LINE.test(lines[i])) idx = i;
    break;
  }
  if (idx > 0) {
    const prompt = lines.slice(0, idx).join("\n").trim();
    const negative = (NEGATIVE_LINE.exec(lines[idx])?.[1] ?? "").trim();
    if (prompt && negative) {
      return { prompt, negative, copyText: `${prompt}\nNegative: ${negative}` };
    }
  }
  const prompt = text.trim();
  return { prompt, negative: null, copyText: prompt };
}

const SLASH_RE = /^\/(?:image|img|picture|photo|video|vid|draw|imagine)\b/i;
const DESIGN_JOB = /\b(?:carousels?|slides?|slideshow|graphics?|posters?|flyers?|banners?|thumbnails?|infographics?|mockups?|quote cards?)\b/i;
const STILL_NOUN = "images?|pictures?|photos?|photographs?|portraits?|illustrations?|artworks?|drawings?|paintings?|wallpapers?|logos?|icons?|avatars?";
const VIDEO_NOUN = "videos?|clips?|animations?|movies?|films?";
const DRAW_SKIP = "conclusion|line|blank|parallel|distinction|comparison|boundary|chart|diagram|flowchart|graph|analogy|inference|connection|poster|flyer|banner|carousel|slide|graphic|thumbnail|mockup|infographic";

const NOT_A_VIDEO = /^\s+(?:call|calls|conference|meeting|chat|player|editor|game|camera|file|files|night)\b/i;

function mentionsGenerated(text: string, nouns: string, verbs: string): boolean {
  const re = new RegExp(
    `\\b(?:${verbs})\\s+(?:me\\s+|us\\s+)?(?:a\\s+|an\\s+|some\\s+|the\\s+)?(?:[\\w-]+\\s+){0,4}?(?:${nouns})\\b`,
    "gi",
  );
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (DESIGN_JOB.test(m[0])) continue;
    if (/\b(?:as|into)\s+an\s+image\b/i.test(m[0])) continue;
    const after = text.slice(m.index + m[0].length);
    if (NOT_A_VIDEO.test(after) && new RegExp(`\\b(?:${VIDEO_NOUN})\\b`, "i").test(m[0])) continue;
    return true;
  }
  return false;
}

/**
 * True when the user is asking Citad3L to produce an image, picture, or video.
 * Graphic and carousel design ("make this as an image", "5 slide carousel") stays
 * on the HTML graphics path and does not count.
 */
export function asksForImageOrVideo(text: string): boolean {
  const t = text.trim().slice(0, 4000);
  if (!t) return false;
  if (SLASH_RE.test(t)) return true;
  if (/\b(?:write|draft|give)\s+(?:me\s+)?(?:an?\s+)?image prompts?\b/i.test(t)) return true;
  if (mentionsGenerated(t, STILL_NOUN, "generate|create|make|draw|paint|sketch|render|illustrate|design|produce|show|give")) return true;
  if (mentionsGenerated(t, VIDEO_NOUN, "generate|create|make|draw|render|animate|film|shoot|produce|show|give")) return true;
  if (new RegExp(`\\b(?:draw|paint|sketch|illustrate)\\s+(?:me\\s+)?(?:a|an|some)\\s+(?!(?:${DRAW_SKIP})\\b)`, "i").test(t)) return true;
  const want = /\b(?:i\s+(?:want|need|would like|'d like)|please(?:\s+(?:make|draw|create|generate))?|(?:can|could)\s+you(?:\s+please)?(?:\s+(?:make|draw|create|generate))?)\b([\s\S]{0,48}?\b(?:images?|pictures?|photos?|photographs?|portraits?|videos?|clips?|animations?)\b)/i.exec(t);
  if (want && !/\b(?:how|what|why|when|where|explain|difference|between|compress|format|resolution|history|works?)\b/i.test(want[1])) {
    if (!DESIGN_JOB.test(want[0]) && !/\b(?:as|into)\s+an\s+image\b/i.test(want[0])) return true;
  }
  if (t.length <= 240 && !DESIGN_JOB.test(t) && /\b(?:images?|pictures?|photos?|photographs?|videos?|clips?)\s+of\b/i.test(t)) return true;
  return false;
}
