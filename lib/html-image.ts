/**
 * "Save as image" for code blocks in chat replies.
 *
 * HTML/SVG blocks are drawn as the page they describe; any other code block is drawn as a plain code card. The
 * model's HTML is untrusted, so the render never runs it:
 *  1. DOMParser builds an inert document (scripts in a parsed document never execute).
 *  2. sanitizeDocument() removes scripts, frames, plugins, <base>, <link>, meta refresh and every on* handler, and drops
 *     any URL that is not an inline data: image/font or a #fragment (no network requests, no tracking pixels).
 *  3. The page is laid out once in an offscreen <iframe sandbox="allow-same-origin"> with NO allow-scripts, only so we
 *     can measure its size. Nothing in it can run, submit, navigate or open popups.
 *  4. The sanitized markup is wrapped in an SVG <foreignObject>, loaded as an <img> (SVG images never run scripts or
 *     fetch anything) and painted to a <canvas>, which becomes the PNG. The SVG viewBox cuts out each `data-slide`
 *     (carousels) or the single top-level graphic, so designs export at their native size, not the visible viewport.
 * The only fetches are the user's own `/api/images/<id>` results (same origin, their session), inlined before
 * sanitizing so a design can reuse a generated picture; photos they pick go in `data-photo` slots as data: URLs.
 * No site CSP or sandbox setting is relaxed for this.
 */

export const PAGE_LANGS = new Set(["html", "htm", "xhtml", "svg"]);
export const DEFAULT_PAGE_WIDTH = 1080;
export const MIN_SIDE = 64;
export const MAX_CSS_WIDTH = 2400;
export const MAX_CSS_HEIGHT = 12000;
/** Full page layout height (a 10-slide carousel stacked vertically is ~14k px). */
export const MAX_DOC_HEIGHT = 40000;
/** iOS Safari refuses canvases above ~16.7M pixels; stay under it. */
export const MAX_CANVAS_AREA = 16_000_000;
export const MAX_CANVAS_SIDE = 8192;

export type ImageKind = "page" | "code";

export function imageKindFor(lang: string | undefined, code: string): ImageKind {
  const l = (lang ?? "").trim().toLowerCase();
  if (PAGE_LANGS.has(l)) return "page";
  // Untagged blocks that are clearly a whole HTML document still render as a page.
  if ((l === "" || l === "text" || l === "plaintext") && /^\s*(<!doctype html|<html[\s>])/i.test(code)) return "page";
  return "code";
}

/** PNG filename that matches the code block's own download name (code-02.html → code-02.png). */
export function pngFilename(sourceFilename: string | undefined, kind: ImageKind): string {
  const base = (sourceFilename ?? "").split("/").pop() ?? "";
  const stem = base.replace(/\.[A-Za-z0-9]+$/, "").replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  // Generic download names ("snippet.html") get a friendlier image name.
  const useStem = stem && stem.toLowerCase() !== "snippet" ? stem : "";
  return `${useStem || (kind === "page" ? "citad3l-graphic" : "citad3l-code")}.png`;
}

/** Only inline images/fonts and in-page anchors survive; everything else would be a network request. */
export function isInlineSafeUrl(raw: string | null | undefined): boolean {
  const v = (raw ?? "").trim();
  if (!v) return true;
  if (v.startsWith("#")) return true;
  return /^data:(image\/(png|jpe?g|gif|webp|avif|bmp|svg\+xml)|font\/[a-z0-9.+-]+|application\/(font-woff2?|x-font-[a-z0-9]+|vnd\.ms-fontobject))[;,]/i.test(v);
}

/** Drop @import rules and point non-inline url(...) references at nothing. */
export function stripExternalCss(css: string): string {
  return css
    .replace(/@import\s+(?:url\()?[^;]*;?/gi, "")
    .replace(/url\(\s*(['"]?)(.*?)\1\s*\)/gi, (m, _q: string, u: string) => (isInlineSafeUrl(u) ? m : "none"))
    .replace(/expression\s*\(/gi, "(");
}

export interface CanvasSize { width: number; height: number; scale: number }

/** Pixel size for a CSS-size render at the wanted scale, shrunk to fit the canvas limits. */
export function fitCanvasSize(cssWidth: number, cssHeight: number, wantScale = 2): CanvasSize {
  const w = Math.max(MIN_SIDE, Math.min(MAX_CSS_WIDTH, Math.ceil(cssWidth || 0)));
  const h = Math.max(MIN_SIDE, Math.min(MAX_CSS_HEIGHT, Math.ceil(cssHeight || 0)));
  let scale = Math.max(0.1, wantScale);
  scale = Math.min(scale, MAX_CANVAS_SIDE / w, MAX_CANVAS_SIDE / h, Math.sqrt(MAX_CANVAS_AREA / (w * h)));
  return { width: Math.max(1, Math.floor(w * scale)), height: Math.max(1, Math.floor(h * scale)), scale };
}

export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** A self-contained HTML card for a plain code block (no external fonts or images). */
export function codeCardHtml(code: string, lang: string): string {
  const label = escapeHtml((lang || "code").toLowerCase().slice(0, 24));
  return `<!doctype html><html><head><meta charset="utf-8"><style>
html,body{margin:0;background:#0b0e12;}
.card{margin:24px;border-radius:14px;background:#0d1014;border:1px solid #1c2128;overflow:hidden;display:inline-block;min-width:480px;max-width:1040px;}
.head{padding:10px 16px;background:#141920;border-bottom:1px solid #1c2128;color:#8a96a8;font:12px/1.4 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;letter-spacing:.04em;}
pre{margin:0;padding:16px 18px 18px;color:#dfe5ee;font:14px/1.6 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;white-space:pre-wrap;word-break:break-word;tab-size:2;}
</style></head><body><div class="card" data-fit="24"><div class="head">${label}</div><pre>${escapeHtml(code)}</pre></div></body></html>`;
}

/** Wrap a bare SVG or HTML fragment so it parses as a full document. */
export function pageDocumentHtml(code: string, lang: string): string {
  if (/^\s*(<!doctype|<html[\s>])/i.test(code)) return code;
  if ((lang || "").toLowerCase() === "svg" || /^\s*(<\?xml[^>]*>\s*)?<svg[\s>]/i.test(code)) {
    const svg = code.replace(/^\s*<\?xml[^>]*>/i, "");
    return `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;background:#fff}</style></head><body>${svg}</body></html>`;
  }
  return `<!doctype html><html><head><meta charset="utf-8"></head><body>${code}</body></html>`;
}

const DROP_TAGS = ["script", "noscript", "iframe", "frame", "frameset", "object", "embed", "applet", "base", "link", "portal", "template"];
const URL_ATTRS = ["src", "href", "xlink:href", "action", "formaction", "poster", "background", "data", "ping", "lowsrc", "dynsrc", "manifest", "cite"];

/** Make a parsed document inert and offline. Mutates and returns it. Browser only. */
export function sanitizeDocument(doc: Document): Document {
  for (const tag of DROP_TAGS) doc.querySelectorAll(tag).forEach((el) => el.remove());
  doc.querySelectorAll("meta").forEach((m) => { if (m.hasAttribute("http-equiv")) m.remove(); });
  doc.querySelectorAll("style").forEach((s) => { s.textContent = stripExternalCss(s.textContent ?? ""); });
  doc.querySelectorAll("*").forEach((el) => {
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase();
      if (name.startsWith("on")) el.removeAttribute(attr.name);
      else if (name === "style") el.setAttribute("style", stripExternalCss(attr.value));
      else if (name === "srcset" || name === "imagesrcset") el.removeAttribute(attr.name);
      else if (URL_ATTRS.includes(name) && !isInlineSafeUrl(attr.value)) el.removeAttribute(attr.name);
    }
  });
  doc.querySelectorAll("video, audio, source, track").forEach((el) => el.remove());
  return doc;
}

/** The user's own Citad3L Image results (`/api/images/<id>`, session-checked, same origin) can be used in a design. */
export const OWN_IMAGE_RE = /^\/api\/images\/[A-Za-z0-9_-]{1,80}$/;
export const MAX_OWN_IMAGES = 12;
export const MAX_SLIDES = 20;

/** How many slides an HTML design declares (`data-slide` elements). Pure, for UI hints. */
export function countSlides(html: string): number {
  return Math.min(MAX_SLIDES, (html.match(/<[a-z][^>]*\sdata-slide\b/gi) ?? []).length);
}
/** How many photo slots (`data-photo`) a design has. */
export function countPhotoSlots(html: string): number {
  return (html.match(/<[a-z][^>]*\sdata-photo\b/gi) ?? []).length;
}

/** carousel.png → carousel-01.png … when there are several slides. */
export function slideFilename(baseName: string, index: number, total: number): string {
  if (total <= 1) return baseName;
  const stem = baseName.replace(/\.png$/i, "");
  return `${stem}-${String(index + 1).padStart(2, "0")}.png`;
}

function blobToDataUrl(b: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("read_failed"));
    r.readAsDataURL(b);
  });
}

/** Swap `/api/images/<id>` sources for inline copies (fetched with the user's own session). Browser only. */
async function inlineOwnImages(doc: Document): Promise<void> {
  const imgs = Array.from(doc.querySelectorAll("img")).filter((i) => OWN_IMAGE_RE.test((i.getAttribute("src") ?? "").trim())).slice(0, MAX_OWN_IMAGES);
  await Promise.all(imgs.map(async (img) => {
    try {
      const res = await fetch((img.getAttribute("src") ?? "").trim(), { credentials: "same-origin", cache: "force-cache" });
      const type = res.headers.get("content-type") ?? "";
      if (!res.ok || !/^image\/(png|jpe?g|webp|gif)/i.test(type)) return;
      const blob = await res.blob();
      if (blob.size > 8_000_000) return;
      img.setAttribute("src", await blobToDataUrl(blob));
    } catch { /* leave it; the sanitizer drops it */ }
  }));
}

/** Put the user's picked photos (data: URLs) into `data-photo` slots, in order. */
export function fillPhotoSlots(doc: Document, photos: string[]): void {
  const slots = Array.from(doc.querySelectorAll<HTMLElement>("[data-photo]"));
  slots.forEach((el, i) => {
    const url = photos.length ? photos[i % photos.length] : "";
    if (!url || !isInlineSafeUrl(url)) return;
    if (el.tagName.toLowerCase() === "img") el.setAttribute("src", url);
    else el.setAttribute("style", `${el.getAttribute("style") ?? ""};background-image:url("${url}");background-size:cover;background-position:center;`);
  });
}

function waitFor<T>(p: Promise<T>, ms: number): Promise<T | undefined> {
  return Promise.race([p, new Promise<undefined>((r) => setTimeout(() => r(undefined), ms))]);
}

export interface Crop { x: number; y: number; width: number; height: number }
interface Layout { docWidth: number; docHeight: number; crops: Crop[] }

/**
 * Lay the sanitized page out offscreen (no scripts allowed) and decide what to cut out:
 * every `data-slide` (a carousel), else a `data-fit` card, else a single top-level graphic at its own size
 * (so a 1080×1350 post exports at exactly 1080×1350), else the whole page. Browser only.
 */
async function layout(html: string, width: number): Promise<Layout> {
  const frame = document.createElement("iframe");
  // allow-same-origin WITHOUT allow-scripts: we can read the layout; the page itself can run nothing.
  frame.setAttribute("sandbox", "allow-same-origin");
  frame.setAttribute("aria-hidden", "true");
  frame.tabIndex = -1;
  frame.style.cssText = `position:fixed;left:-30000px;top:0;width:${width}px;height:900px;border:0;opacity:0;pointer-events:none;`;
  const loaded = new Promise<void>((resolve) => frame.addEventListener("load", () => resolve(), { once: true }));
  frame.srcdoc = html;
  document.body.appendChild(frame);
  try {
    await waitFor(loaded, 5000);
    const d = frame.contentDocument;
    if (!d) return { docWidth: width, docHeight: 900, crops: [{ x: 0, y: 0, width, height: 900 }] };
    const fonts = (d as Document & { fonts?: { ready: Promise<unknown> } }).fonts;
    if (fonts?.ready) await waitFor(fonts.ready, 1500);
    await Promise.all(Array.from(d.images).map((im) => (im.complete ? null : waitFor(new Promise((r) => { im.onload = im.onerror = r; }), 3000))));
    const de = d.documentElement;
    const b = d.body;
    const docWidth = Math.min(MAX_CSS_WIDTH, Math.max(de.scrollWidth, b?.scrollWidth ?? 0, width));
    const docHeight = Math.min(MAX_DOC_HEIGHT, Math.max(de.scrollHeight, b?.scrollHeight ?? 0, MIN_SIDE));
    const rectOf = (el: Element, pad = 0): Crop => {
      const r = el.getBoundingClientRect();
      return {
        x: Math.max(0, Math.floor(r.left - pad)),
        y: Math.max(0, Math.floor(r.top - pad)),
        width: Math.min(MAX_CSS_WIDTH, Math.ceil(r.width + pad * 2)),
        height: Math.min(MAX_CSS_HEIGHT, Math.ceil(r.height + pad * 2)),
      };
    };
    const slides = Array.from(d.querySelectorAll("[data-slide]")).slice(0, MAX_SLIDES).map((el) => rectOf(el)).filter((c) => c.width >= MIN_SIDE && c.height >= MIN_SIDE);
    if (slides.length) return { docWidth, docHeight, crops: slides };
    const fit = d.querySelector<HTMLElement>("[data-fit]");
    if (fit) return { docWidth, docHeight, crops: [rectOf(fit, Number(fit.dataset.fit) || 0)] };
    const kids = Array.from(b?.children ?? []).filter((el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    });
    if (kids.length === 1) {
      const c = rectOf(kids[0]);
      if (c.width >= 200 && c.height >= 200) return { docWidth, docHeight, crops: [c] };
    }
    return { docWidth, docHeight, crops: [{ x: 0, y: 0, width: docWidth, height: Math.min(MAX_CSS_HEIGHT, docHeight) }] };
  } finally {
    frame.remove();
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "sync";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("render_failed"));
    img.src = src;
  });
}

export class ImageRenderError extends Error {}

export interface RenderedImage { blob: Blob; width: number; height: number; name: string }

/**
 * Render a code block to PNG(s), browser only. HTML/SVG designs come out at their native size (scale 1, so a
 * 1080×1350 post is a 1080×1350 PNG, not a screenshot of the visible part); carousels give one PNG per slide;
 * other code gives a 2× code card.
 */
export async function renderGraphic(code: string, lang: string, opts: { baseName?: string; photos?: string[]; width?: number; scale?: number } = {}): Promise<RenderedImage[]> {
  const kind = imageKindFor(lang, code);
  const source = kind === "page" ? pageDocumentHtml(code, lang) : codeCardHtml(code, lang);
  const doc = new DOMParser().parseFromString(source, "text/html");
  if (kind === "page") {
    await inlineOwnImages(doc);
    fillPhotoSlots(doc, opts.photos ?? []);
  }
  sanitizeDocument(doc);
  if (!doc.querySelector("meta[charset]")) {
    const m = doc.createElement("meta");
    m.setAttribute("charset", "utf-8");
    doc.head.prepend(m);
  }
  const startWidth = Math.min(MAX_CSS_WIDTH, Math.max(320, opts.width ?? (kind === "page" ? DEFAULT_PAGE_WIDTH : 1100)));
  const { docWidth, docHeight, crops } = await layout("<!doctype html>" + doc.documentElement.outerHTML, startWidth);

  doc.documentElement.setAttribute("style", `${doc.documentElement.getAttribute("style") ?? ""};width:${docWidth}px;min-height:${docHeight}px;`);
  const xhtml = new XMLSerializer().serializeToString(doc.documentElement);
  const wantScale = opts.scale ?? (kind === "page" ? 1 : 2);
  const baseName = opts.baseName ?? pngFilename(undefined, kind);
  const out: RenderedImage[] = [];
  for (let i = 0; i < crops.length; i++) {
    const c = crops[i];
    // The viewBox cuts this slide (or graphic) out of the full page; only that region is painted.
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${c.width}" height="${c.height}" viewBox="${c.x} ${c.y} ${c.width} ${c.height}"><foreignObject x="0" y="0" width="${docWidth}" height="${docHeight}">${xhtml}</foreignObject></svg>`;
    const img = await loadImage("data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg));
    const px = fitCanvasSize(c.width, c.height, wantScale);
    const canvas = document.createElement("canvas");
    canvas.width = px.width;
    canvas.height = px.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new ImageRenderError("no_canvas");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, px.width, px.height);
    ctx.drawImage(img, 0, 0, px.width, px.height);
    // Safari can paint a blank first frame for foreignObject images; a second paint fixes it.
    await new Promise((r) => setTimeout(r, 30));
    ctx.drawImage(img, 0, 0, px.width, px.height);
    const blob = await new Promise<Blob | null>((resolve) => {
      try { canvas.toBlob((b) => resolve(b), "image/png"); } catch { resolve(null); }
    });
    if (!blob) throw new ImageRenderError("export_blocked");
    out.push({ blob, width: px.width, height: px.height, name: slideFilename(baseName, i, crops.length) });
  }
  return out;
}

/** First image only (kept for simple callers). */
export async function renderCodeBlockToPng(code: string, lang: string, opts: { width?: number; scale?: number } = {}): Promise<Blob> {
  return (await renderGraphic(code, lang, opts))[0].blob;
}

/** Shrink a picked photo so designs stay light (long side ≤ 1600 px, JPEG). Browser only. */
export async function photoToDataUrl(file: File, maxSide = 1600): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const k = Math.min(1, maxSide / Math.max(img.naturalWidth || 1, img.naturalHeight || 1));
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(img.naturalWidth * k));
    c.height = Math.max(1, Math.round(img.naturalHeight * k));
    c.getContext("2d")?.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.9);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Phones/tablets that can hand a file to the share sheet ("Save Image" to Photos on iPhone). */
export function prefersShareSheet(file: File): boolean {
  if (typeof navigator === "undefined") return false;
  const coarse = typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches;
  const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean };
  return coarse && typeof nav.share === "function" && typeof nav.canShare === "function" && nav.canShare({ files: [file] });
}

export function supportsDownloadAttribute(): boolean {
  return typeof document !== "undefined" && "download" in document.createElement("a");
}
