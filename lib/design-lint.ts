/**
 * Fast, dependency-free checks for chat HTML graphics (runs on the server, no DOM). Heuristic by design: each
 * check aims for few false positives on clean layouts. Used by lib/design-check.ts for one critique-and-fix pass.
 */
import type { DesignFormat } from "./design-kit";
import { FORMAT_SIZES } from "./design-kit";

export interface DesignIssue { code: string; message: string }

const FENCE_RE = /(```|~~~)[ \t]*html[^\n]*\n([\s\S]*?)\n?\1/i;

export function extractHtmlBlock(text: string): { html: string; start: number; end: number } | null {
  const m = FENCE_RE.exec(text);
  if (!m || m.index === undefined) return null;
  return { html: m[2], start: m.index, end: m.index + m[0].length };
}

export function replaceHtmlBlock(text: string, html: string): string {
  const b = extractHtmlBlock(text);
  if (!b) return text;
  return text.slice(0, b.start) + "```html\n" + html.trim() + "\n```" + text.slice(b.end);
}

interface Rule { selector: string; body: string; tag?: string; inner?: string }

const ALLOWED_SIZES = new Set(["1080x1350", "1080x1920", "1080x1080", "1600x900"]);
const GENERIC_FONTS = new Set(["serif", "sans-serif", "monospace", "cursive", "fantasy", "inherit", "initial", "unset", "system-ui", "ui-sans-serif", "ui-serif", "-apple-system", "emoji"]);
const TEXT_TAG_RE = /<(h[1-6]|p)\b/i;

function cssRules(html: string): Rule[] {
  const out: Rule[] = [];
  for (const s of html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)) {
    const css = s[1].replace(/\/\*[\s\S]*?\*\//g, "");
    for (const r of css.matchAll(/([^{}@]+)\{([^{}]*)\}/g)) out.push({ selector: r[1].trim(), body: r[2] });
  }
  // Inline styles: remember the tag and a little of what follows, for the text checks.
  for (const m of html.matchAll(/<([a-z][a-z0-9]*)\b[^>]*\sstyle\s*=\s*"([^"]*)"[^>]*>/gi)) {
    out.push({ selector: "inline", body: m[2], tag: m[1].toLowerCase(), inner: html.slice((m.index ?? 0) + m[0].length, (m.index ?? 0) + m[0].length + 400) });
  }
  return out;
}

function px(body: string, prop: string): number | null {
  const m = new RegExp(`(?:^|[;\\s{])${prop}\\s*:\\s*(-?\\d+(?:\\.\\d+)?)px`, "i").exec(body);
  return m ? Number(m[1]) : null;
}

/** Does an element matched by this rule hold headline/body text? */
function holdsText(rule: Rule, html: string): boolean {
  if (rule.selector === "inline") return /^(h[1-6]|p)$/.test(rule.tag ?? "") || TEXT_TAG_RE.test(rule.inner ?? "");
  const sels = rule.selector.split(",").map((s) => s.trim());
  for (const sel of sels) {
    const last = sel.split(/\s+|>/).filter(Boolean).pop() ?? "";
    if (/^(h[1-6]|p)\b/i.test(last)) return true;
    const cls = /\.([\w-]+)/.exec(last)?.[1];
    if (!cls) continue;
    for (const m of html.matchAll(new RegExp(`<([a-z][a-z0-9]*)\\b[^>]*class\\s*=\\s*"[^"]*\\b${cls}\\b[^"]*"[^>]*>`, "gi"))) {
      if (/^(h[1-6]|p)$/i.test(m[1])) return true;
      const after = html.slice((m.index ?? 0) + m[0].length, (m.index ?? 0) + m[0].length + 400);
      if (TEXT_TAG_RE.test(after.split(/<\/div>/i)[0] ?? "")) return true;
    }
  }
  return false;
}

const hasPanel = (body: string) => /(background(-color)?\s*:\s*(?!transparent|none)[^;]+|backdrop-filter\s*:|linear-gradient|radial-gradient)/i.test(body);

function fontSizes(rules: Rule[]): number[] {
  const out: number[] = [];
  for (const r of rules) {
    for (const m of r.body.matchAll(/font-size\s*:\s*(\d+(?:\.\d+)?)px/gi)) out.push(Number(m[1]));
    for (const m of r.body.matchAll(/(?:^|[;\s])font\s*:\s*[^;]*?(\d+(?:\.\d+)?)px/gi)) out.push(Number(m[1]));
  }
  return out;
}

function fontFamilies(rules: Rule[]): Set<string> {
  const fams = new Set<string>();
  const add = (list: string) => {
    const first = list.split(",")[0]?.trim().replace(/^['"]|['"]$/g, "").toLowerCase();
    if (first && !GENERIC_FONTS.has(first)) fams.add(first);
  };
  for (const r of rules) {
    for (const m of r.body.matchAll(/font-family\s*:\s*([^;]+)/gi)) add(m[1]);
    for (const m of r.body.matchAll(/(?:^|[;\s])font\s*:\s*[^;]*?\d+(?:\.\d+)?px(?:\s*\/\s*[\d.]+\w*)?\s+([^;]+)/gi)) add(m[1]);
  }
  return fams;
}

function solidColors(html: string): Set<string> {
  const css = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]).join(" ") + " " + [...html.matchAll(/style\s*=\s*"([^"]*)"/gi)].map((m) => m[1]).join(" ");
  const out = new Set<string>();
  for (const m of css.matchAll(/#([0-9a-f]{3}|[0-9a-f]{6})\b/gi)) {
    let h = m[1].toLowerCase();
    if (h.length === 3) h = h.split("").map((c) => c + c).join("");
    out.add("#" + h);
  }
  for (const m of css.matchAll(/rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)(?:[\s,/]+([\d.]+%?))?\s*\)/gi)) {
    const a = m[4] === undefined ? 1 : m[4].endsWith("%") ? Number(m[4].slice(0, -1)) / 100 : Number(m[4]);
    if (a >= 0.6) out.add(`rgb(${m[1]},${m[2]},${m[3]})`);
  }
  return out;
}

/** The first big fixed-size block (the canvas) and its rule. */
function canvas(rules: Rule[]): { w: number; h: number; rule: Rule } | null {
  for (const r of rules) {
    const w = px(r.body, "width"), h = px(r.body, "height");
    if (w !== null && h !== null && w >= 600 && h >= 600) return { w, h, rule: r };
  }
  return null;
}

/** Up to 8 short, actionable issues, most important first. Empty means it passed. */
export function lintDesign(html: string): DesignIssue[] {
  const rules = cssRules(html);
  const issues: DesignIssue[] = [];
  const add = (code: string, message: string) => { if (!issues.some((i) => i.code === code)) issues.push({ code, message }); };
  const slides = Math.max(1, (html.match(/<[a-z][^>]*\sdata-slide\b/gi) ?? []).length);
  const hasImage = /<img\b|\sdata-photo\b|background(-image)?\s*:[^;"]*url\(/i.test(html);

  // Text over a photo: absolutely placed text with no panel of its own, or text inside a photo background without a scrim.
  if (hasImage) {
    for (const r of rules) {
      const abs = /position\s*:\s*absolute/i.test(r.body);
      const bgPhoto = /background(-image)?\s*:[^;]*url\(/i.test(r.body) && !/gradient/i.test(r.body);
      if ((abs && !hasPanel(r.body) && holdsText(r, html)) || (bgPhoto && holdsText(r, html))) {
        add("text-over-image", "Text sits on the photo. Move it onto a solid panel or add a strong scrim.");
        break;
      }
    }
  }

  const srcs = [...html.matchAll(/<img\b[^>]*\ssrc\s*=\s*"([^"]+)"/gi)].map((m) => m[1].trim()).filter(Boolean);
  const urls = [...html.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/gi)].map((m) => m[1].trim());
  const all = [...srcs, ...urls];
  if (new Set(all).size < all.length) add("repeated-image", "The same image is used more than once. Use each image once.");
  const slots = (html.match(/<img\b/gi) ?? []).length + (html.match(/<(?!img)[a-z][^>]*\sdata-photo\b/gi) ?? []).length + new Set(urls).size;
  if (slots > 2 * slides) add("too-many-images", `Too many photos (${slots}). Keep one focal image, two at most.`);

  const cv = canvas(rules);
  for (const r of rules) {
    const widths = [...r.body.matchAll(/(?:border(?:-(?:top|right|bottom|left))?|outline)\s*:\s*(\d+(?:\.\d+)?)px/gi), ...r.body.matchAll(/(?:border|outline)-width\s*:\s*(\d+(?:\.\d+)?)px/gi)].map((m) => Number(m[1]));
    const limit = cv && r === cv.rule ? 4 : 6;
    if (widths.some((w) => w >= limit)) { add("heavy-frame", "Heavy frame or border. Remove it or use a thin rule."); break; }
  }

  const sizes = fontSizes(rules);
  if (sizes.length && Math.max(...sizes) < 80) add("weak-headline", "Headline is too small. Make it 100px+ and bold.");
  const tiny = sizes.filter((s) => s < 24);
  if (tiny.length) add("tiny-text", `Text at ${Math.min(...tiny)}px is unreadable on a phone. Use 28px+.`);

  if (cv) {
    const pad = /(?:^|[;\s])padding\s*:\s*(\d+)px/i.exec(cv.rule.body);
    if (pad && Number(pad[1]) < 64) add("crowding", "Content is too close to the edge. Use 80px+ margins.");
  }
  for (const r of rules) {
    if (!/position\s*:\s*absolute/i.test(r.body) || !holdsText(r, html)) continue;
    const near = ["top", "left", "right", "bottom"].some((p) => { const v = px(r.body, p); return v !== null && v >= 0 && v < 64; });
    if (near) { add("crowding", "Content is too close to the edge. Use 80px+ margins."); break; }
  }

  const fams = fontFamilies(rules);
  if (fams.size > 2) add("fonts", `${fams.size} fonts used. Use 2 at most.`);
  const colors = solidColors(html);
  if (colors.size > 6) add("colors", `${colors.size} colors used. Stick to 2-3 plus one neutral.`);

  if (cv && !ALLOWED_SIZES.has(`${cv.w}x${cv.h}`)) add("size", `Canvas is ${cv.w}x${cv.h}. Use 1080x1350, 1080x1920, 1080x1080, or 1600x900.`);
  return issues.slice(0, 8);
}

export function canvasSize(html: string): string | null {
  const c = canvas(cssRules(html));
  return c ? `${c.w}x${c.h}` : null;
}

export function shouldCritique(text: string): boolean {
  const b = extractHtmlBlock(text);
  if (!b || b.html.length < 200 || b.html.length > 60000) return false;
  return lintDesign(b.html).length > 0;
}

export function critiqueMessages(html: string, issues: DesignIssue[], format: DesignFormat): { role: "system" | "user"; content: string }[] {
  const s = FORMAT_SIZES[format];
  return [
    {
      role: "system",
      content: "You fix social graphics written as HTML. Keep the same copy, canvas size, data-slide sections and image links; keep data-photo slots, dropping extras only to reach one focal image (keep the first slot, large and uncovered; only a see-through scrim may sit on it); never add new facts, stats or images. Use one focal image, text on a solid panel or strong scrim, max 2 fonts, 2-3 colors, 80px+ margins, no heavy borders, a big headline. Reply with ONLY one complete fenced html block.",
    },
    {
      role: "user",
      content: `A render check of this ${s.label} found:\n${issues.map((i) => "- " + i.message).join("\n")}\nFix only these, then return the full corrected HTML.\n\n\`\`\`html\n${html.trim()}\n\`\`\``,
    },
  ];
}
