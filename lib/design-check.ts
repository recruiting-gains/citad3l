import type { DesignFormat } from "./design-kit";
import { canvasSize, critiqueMessages, extractHtmlBlock, lintDesign, replaceHtmlBlock, type DesignIssue } from "./design-lint";

type Msg = { role: "system" | "user"; content: string };

const count = (html: string, re: RegExp) => (html.match(re) ?? []).length;
const PHOTO_RE = /\sdata-photo\b/gi;
const SLIDE_RE = /\sdata-slide\b/gi;

/**
 * One critique-and-fix pass on a finished design reply. Grades the html against the design rules; if it fails,
 * asks the same chat model once for a fix and keeps the fix only when it is strictly better and keeps the same
 * canvas and slides and still has a photo slot when the original did. Never throws; on any problem the original text comes back.
 */
export async function critiqueAndFix(opts: {
  text: string;
  format: DesignFormat;
  complete: (messages: Msg[]) => Promise<string>;
}): Promise<{ text: string; changed: boolean; before: DesignIssue[]; after: DesignIssue[] }> {
  const block = extractHtmlBlock(opts.text);
  if (!block) return { text: opts.text, changed: false, before: [], after: [] };
  const before = lintDesign(block.html);
  if (!before.length) return { text: opts.text, changed: false, before, after: before };
  try {
    const reply = await opts.complete(critiqueMessages(block.html, before, opts.format));
    const fixed = extractHtmlBlock(reply ?? "");
    if (!fixed || fixed.html.length < 200) return { text: opts.text, changed: false, before, after: before };
    const same =
      // Photo slots may drop (to reach one focal image) but never vanish or grow.
      count(fixed.html, PHOTO_RE) <= count(block.html, PHOTO_RE) &&
      (count(block.html, PHOTO_RE) === 0 || count(fixed.html, PHOTO_RE) >= 1) &&
      count(fixed.html, SLIDE_RE) === count(block.html, SLIDE_RE) &&
      canvasSize(fixed.html) === canvasSize(block.html);
    const after = lintDesign(fixed.html);
    if (!same || after.length >= before.length) return { text: opts.text, changed: false, before, after: before };
    return { text: replaceHtmlBlock(opts.text, fixed.html), changed: true, before, after };
  } catch {
    return { text: opts.text, changed: false, before, after: before };
  }
}
