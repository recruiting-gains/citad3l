/**
 * Light, cheap content filter for Citad3L.
 *
 * Hard lines (never disable): sexual content involving minors, and
 * instructional help for bombs or explosives.
 * Adult sexual content is banned by default (see legal/drafts/acceptable-use.md)
 * and can only be relaxed with CITAD3L_ALLOW_ADULT=true — hard lines stay on.
 *
 * This is a keyword/regex pass. An optional Fast-model classifier can be
 * enabled with CITAD3L_FILTER_LLM=true (see reviewContent).
 */

export type FilterCategory = "csam" | "explosives" | "adult_sexual" | "check_failed";

export type FilterVerdict =
  | { allowed: true }
  | { allowed: false; category: FilterCategory; message: string };

export const REFUSAL: Record<FilterCategory, string> = {
  csam: "This request isn't allowed. Citad3L doesn't allow sexual content involving minors.",
  explosives: "This request isn't allowed. Citad3L doesn't provide instructions for bombs or explosives.",
  adult_sexual: "This request isn't allowed. Sexually explicit content isn't permitted on Citad3L.",
  // Fail-closed: the AI safety check could not give a clear answer, so nothing is sent to the model.
  check_failed: "We couldn't finish the safety check on this message. Please try again in a moment.",
};

export function adultContentAllowed(): boolean {
  return process.env.CITAD3L_ALLOW_ADULT === "true";
}

export function filterLlmEnabled(): boolean {
  return process.env.CITAD3L_FILTER_LLM === "true";
}

export function normalizeForFilter(input: string): string {
  return input
    .normalize("NFKC")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .toLowerCase()
    .replace(/[_*~`"'“”‘’]/g, " ")
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function refused(category: FilterCategory): FilterVerdict {
  return { allowed: false, category, message: REFUSAL[category] };
}

function includesAny(text: string, phrases: readonly string[]): boolean {
  return phrases.some((p) => text.includes(p));
}

function anyRegex(text: string, patterns: readonly RegExp[]): boolean {
  return patterns.some((re) => re.test(text));
}

/** True when a and b both match within `window` characters of each other. */
function near(text: string, a: RegExp, b: RegExp, window = 72): boolean {
  const flags = "gi";
  const ra = new RegExp(a.source, flags);
  const rb = new RegExp(b.source, flags);
  let m: RegExpExecArray | null;
  const aHits: Array<{ start: number; end: number }> = [];
  while ((m = ra.exec(text))) aHits.push({ start: m.index, end: m.index + m[0].length });
  if (!aHits.length) return false;
  let n: RegExpExecArray | null;
  while ((n = rb.exec(text))) {
    for (const h of aHits) {
      const gap = n.index >= h.end ? n.index - h.end : h.start - (n.index + n[0].length);
      if (gap <= window) return true;
    }
  }
  return false;
}

const CSAM_PHRASES = [
  "child porn",
  "child pornography",
  "child sexual",
  "children sexual",
  "sexual content involving a minor",
  "sexual content involving minors",
  "sexual content involving a child",
  "sexual content involving children",
  "sexual content involving kids",
  "underage porn",
  "underage sexual",
  "underage nude",
  "underage naked",
  "under age porn",
  "under age sexual",
  "under age nude",
  "minor porn",
  "minors porn",
  "child nude",
  "children nude",
  "kid porn",
  "kids porn",
  "preteen porn",
  "pre-teen porn",
  "csam",
] as const;

const CSAM_RE = [
  /\b(child|children|kid|kids|minor|minors|underage|under-age|preteen|pre-teen)\b[\s\S]{0,48}\b(pornography|porn|erotica|nude|nudes|naked|sexualized|sexualised)\b/,
  /\b(pornography|porn|erotica|nude|nudes|naked|sexualized|sexualised)\b[\s\S]{0,48}\b(child|children|kid|kids|minor|minors|underage|under-age|preteen|pre-teen)\b/,
  /\b(pedophil|paedophil|pedosex|child-sex)/,
  /\b(loli|lolita|shota)\b/,
  /\bage\s*play\b/,
  /\baged[\s-]?up\b[\s\S]{0,40}\b(child|children|kid|kids|minor|minors|underage|teen)\b/,
] as const;

const EXPLOSIVE_NOUN = /\b((pipe|car|letter|suicide|dirty)\s+)?bombs?\b|\bieds?\b|\bimprovised explosive\b|\bexplosive devices?\b|\bexplosives?\b|\bc-4\b|\banfo\b|\bdetonators?\b|\bthermite\b|\bnapalm\b|\bmolotov\b|\bplastic explosive\b|\b(tatp|hmtd|rdx|petn|semtex|nitroglycerin|dynamite)\b/;
const INSTRUCTION = /\b(how to|how do i|how can i|how would i|steps? to|step by step|recipe for|instructions? (for|to|on)|tutorial (for|on)|guide to|walk me through|teach me (how )?to|give me (the )?instructions)\b/;
const BUILD = /\b(make|build|assemble|construct|manufacture|craft|cook up|prepare|wire|detonate)\b/;

const EXPLOSIVE_PHRASES = [
  "bomb making",
  "bomb-making",
  "bomb recipe",
  "bomb instructions",
  "make a bomb",
  "make an bomb",
  "build a bomb",
  "build an ied",
  "making explosives",
  "make explosives",
  "build an explosive",
] as const;

const ADULT_PHRASES = [
  "sexually explicit",
  "explicit erotic",
  "erotic story",
  "erotic roleplay",
  "erotic role play",
  "write a sex scene",
  "write an explicit",
  "porn story",
  "pornographic story",
] as const;

const ADULT_RE = [
  /\b(write|generate|create|draw|make me|roleplay|role-play)\b[\s\S]{0,60}\b(erotic|porn|pornographic|xxx|nsfw sex)\b/,
  /\b(erotic|porn|pornographic)\b[\s\S]{0,40}\b(story|scene|roleplay|role-play|chat|image|photo|picture)\b/,
] as const;

const MEDICAL_HINT = /\b(cancer|infection|symptom|symptoms|treatment|doctor|physician|clinic|diagnosis|std|sti|contraception|pregnancy|menopause|therapy|health|medical)\b/;

/** Minor-indicating terms (not bare "teen", which is also used for 18-19). */
const MINOR_TERM = /\b(child|children|childs|kid|kids|minor|minors|underage|under-age|under 18|preteen|pre-teen|toddler|toddlers|infant|infants|little (girl|boy)s?|young (girl|boy)s?|schoolchild|grade-?schooler|elementary school(er)?|middle school(er)?|(1[0-7]|[1-9]|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen)[\s-]?(years?[\s-]?old|yrs?[\s-]?old|yo|y\/o))\b/;
/** Sexual-content terms. */
const SEXUAL_TERM = /\b(sex|sexual|sexually|sexy|erotic|erotica|explicit|nsfw|lewd|horny|aroused|arousing|orgasm|intercourse|molest|molesting|fondle|fondling|seduce|seducing|seduction|naked|nude|nudes|undress|undressing|genitals?|penis|vagina|breasts?|porn|pornographic|hentai|r34|rule 34)\b/;
/** Safety / education / reporting contexts that mention both without asking for sexual content. */
const CSAM_SAFE_CONTEXT = /\b(sex ed|sex education|abuse prevention|prevent(ing)? (child )?(sexual )?abuse|protect(ing)? (my |our )?(kid|kids|child|children)|report(ing)? (child )?(sexual )?abuse|signs of (child )?(sexual )?abuse|grooming signs|talk to (my|our) (kid|kids|child|children)|puberty|pediatrician|diaper|breastfeed|breast-?feeding|baby food|bath time)\b/;
const CSAM_GENERATIVE = /\b(write|story|stories|roleplay|role-play|role play|scene|describe|fantasy|fanfic|fan fiction|image|picture|photo|pic|pics|draw|generate|render|show me|send me|chat as|pretend)\b/;
/** Stating the site's own hard-line rules, not requesting prohibited content.
 *  Apostrophes are stripped by normalizeForFilter ("doesn't" → "doesn t"). */
const CSAM_POLICY_CONTEXT = /\b(hard lines?|isn t allowed|isn'?t allowed|is not allowed|not allowed|don t allow|don'?t allow|do not allow|doesn t allow|doesn'?t allow|does not allow|site policy|acceptable use|what s not allowed|what'?s not allowed|what is not allowed)\b/;
/** Request verbs immediately before a hard-line phrase: still refuse, even in a policy sentence. */
const CSAM_POLICY_REQUEST = /\b(write|generate|create|draw|render|describe|show me|send me|roleplay|role-play|role play|pretend|chat as)\b[\s\S]{0,80}\b(csam|sexual content involving|child porn|children porn|underage porn|(child|children|kid|kids|minor|minors|underage)\b[\s\S]{0,40}\b(porn|nude|naked|sexual))/;

function isPolicyRestatement(text: string): boolean {
  return CSAM_POLICY_CONTEXT.test(text) && !CSAM_POLICY_REQUEST.test(text);
}

function hitsCsam(text: string): boolean {
  if (anyRegex(text, CSAM_RE)) return true;
  // Phrase list, or a sexual term within a short window of a minor term (either order).
  if (includesAny(text, CSAM_PHRASES) || near(text, SEXUAL_TERM, MINOR_TERM, 48)) {
    if (CSAM_SAFE_CONTEXT.test(text) && !CSAM_GENERATIVE.test(text)) return false;
    if (isPolicyRestatement(text)) return false;
    return true;
  }
  return false;
}

function hitsExplosives(text: string): boolean {
  if (includesAny(text, EXPLOSIVE_PHRASES)) return true;
  if (near(text, INSTRUCTION, EXPLOSIVE_NOUN, 80)) return true;
  // "make/build a bomb" and close variants, but not historical discussion.
  if (near(text, BUILD, /\b((pipe|car|letter|suicide|dirty)\s+)?bombs?\b|\bieds?\b|\bimprovised explosive\b|\bexplosive devices?\b|\bplastic explosive\b/, 40)) {
    return true;
  }
  return false;
}

function hitsAdult(text: string): boolean {
  if (includesAny(text, ADULT_PHRASES) || anyRegex(text, ADULT_RE)) {
    if (MEDICAL_HINT.test(text) && !/\b(erotic|porn|pornographic|xxx)\b/.test(text)) return false;
    return true;
  }
  return false;
}

/** Synchronous keyword/regex check. Safe to run on every prompt and reply. */
export function checkText(input: string): FilterVerdict {
  const text = normalizeForFilter(input);
  if (!text) return { allowed: true };
  if (hitsCsam(text)) return refused("csam");
  if (hitsExplosives(text)) return refused("explosives");
  if (!adultContentAllowed() && hitsAdult(text)) return refused("adult_sexual");
  return { allowed: true };
}

/**
 * Keyword check, then an optional AI classifier when CITAD3L_FILTER_LLM=true (or opts.force) and a reviewer is
 * provided. The reviewer is skipped on keyword hits. FAIL-CLOSED: if the reviewer throws (provider down, timeout,
 * unreadable answer), the request is refused with "check_failed" instead of falling back to keywords only.
 */
export async function reviewContent(
  input: string,
  reviewer?: (text: string) => Promise<FilterVerdict>,
  opts: { force?: boolean } = {},
): Promise<FilterVerdict> {
  const first = checkText(input);
  if (!first.allowed) return first;
  if (!reviewer || (!filterLlmEnabled() && !opts.force)) return first;
  try {
    return await reviewer(input);
  } catch {
    return refused("check_failed");
  }
}

/**
 * Keyword check over a whole chat history: each turn on its own, then all of them together (so a blocked phrase can't
 * hide across turns). Used for guest-sent history, a signed-in chat's earlier turns, and imported chats.
 */
export function checkTexts(contents: readonly string[]): FilterVerdict {
  for (const c of contents) {
    if (!c) continue;
    const v = checkText(c);
    if (!v.allowed) return v;
  }
  return checkText(contents.join("\n"));
}
