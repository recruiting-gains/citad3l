/**
 * Browser-only: turn picked files into chat attachments. PDF text via pdf.js, Word via mammoth, images downsized
 * on a canvas. Libraries load on first use, so the chat bundle doesn't grow for people who never attach anything.
 */
import { IMAGE_FALLBACK_SIDES, IMAGE_MAX_SIDE, IMAGE_TARGET_BYTES, MAX_FILE_CHARS, MAX_UPLOAD_BYTES, cleanName, fileKind, type Attachment } from "./attachments";

export const PDF_WORKER_SRC = "/vendor/pdf.worker.min.mjs";
const MAX_PDF_PAGES = 200;

export class AttachError extends Error {}

async function pdfText(buf: ArrayBuffer): Promise<string> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = PDF_WORKER_SRC;
  const task = pdfjs.getDocument({ data: new Uint8Array(buf) });
  const doc = await task.promise;
  const out: string[] = [];
  let chars = 0;
  try {
    for (let p = 1; p <= Math.min(doc.numPages, MAX_PDF_PAGES); p++) {
      const page = await doc.getPage(p);
      const tc = await page.getTextContent();
      const line = tc.items.map((it) => ("str" in it ? it.str + (it.hasEOL ? "\n" : " ") : "")).join("").replace(/[ \t]+\n/g, "\n").trim();
      if (line) out.push(`[Page ${p}]\n${line}`);
      chars += line.length;
      if (chars > MAX_FILE_CHARS) break;
    }
  } finally {
    void task.destroy();
  }
  return out.join("\n\n");
}

async function docxText(buf: ArrayBuffer): Promise<string> {
  // @ts-expect-error mammoth ships no types for its browser build
  const mod = (await import("mammoth/mammoth.browser.js")) as unknown as { default?: Mammoth } & Mammoth;
  const mammoth: Mammoth = mod.default ?? mod;
  const r = await mammoth.extractRawText({ arrayBuffer: buf });
  return r.value;
}
type Mammoth = { extractRawText(o: { arrayBuffer: ArrayBuffer }): Promise<{ value: string }> };

type Decoded = { src: CanvasImageSource; width: number; height: number; close(): void };

/** Decode a picked photo. createImageBitmap first; an <img> fallback covers browsers where it fails (and HEIC on Safari). */
async function decodeImage(file: File): Promise<Decoded> {
  if (typeof createImageBitmap === "function") {
    try {
      const bmp = await createImageBitmap(file);
      if (bmp.width > 0 && bmp.height > 0) return { src: bmp, width: bmp.width, height: bmp.height, close: () => bmp.close?.() };
      bmp.close?.();
    } catch {
      /* fall through to <img> */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    if (!img.naturalWidth || !img.naturalHeight) throw new Error("empty image");
    return { src: img, width: img.naturalWidth, height: img.naturalHeight, close: () => URL.revokeObjectURL(url) };
  } catch {
    URL.revokeObjectURL(url);
    throw new AttachError(
      isHeic(file)
        ? `${cleanName(file.name)} is a HEIC photo this browser can't open. Pick it from your Photos library, or take a screenshot of it and attach that.`
        : `${cleanName(file.name)} couldn't be opened as a picture. Try a JPEG or PNG.`,
    );
  }
}

function isHeic(file: File): boolean {
  return /^image\/hei[cf]/i.test(file.type) || /\.hei[cf]$/i.test(file.name);
}

function dataUrlBytes(url: string): number {
  return Math.floor((url.length - url.indexOf(",") - 1) * 0.75);
}

/**
 * Resize and re-encode a photo as JPEG so it fits IMAGE_TARGET_BYTES. Starts at IMAGE_MAX_SIDE on the long side, then
 * steps down. A phone photo (3-8 MB, 12-48 MP) lands around 0.4-1.2 MB at 2048 px. Safari returns "data:," when a
 * canvas is too big for its memory budget, so that also steps down instead of failing.
 */
async function shrinkImage(file: File): Promise<string> {
  const img = await decodeImage(file);
  const long = Math.max(img.width, img.height);
  const sides = [IMAGE_MAX_SIDE, ...IMAGE_FALLBACK_SIDES].filter((s, i) => i === 0 || s < long);
  const canvas = document.createElement("canvas");
  try {
    for (const side of sides) {
      const scale = Math.min(1, side / long);
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) continue;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.fillStyle = "#ffffff"; // JPEG has no transparency
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img.src, 0, 0, w, h);
      for (const q of [0.85, 0.75, 0.65, 0.55]) {
        const url = canvas.toDataURL("image/jpeg", q);
        if (!url.startsWith("data:image/jpeg;base64,")) break; // canvas too large for this browser: try a smaller side
        if (dataUrlBytes(url) <= IMAGE_TARGET_BYTES) return url;
      }
    }
  } finally {
    img.close();
    canvas.width = 0; // release canvas memory right away (iPhone Safari keeps a tight total budget)
    canvas.height = 0;
  }
  throw new AttachError(`${cleanName(file.name)} is still too large after shrinking. Try a screenshot of it or a smaller photo.`);
}

/** One picked file → one attachment, or a friendly error. `allowImages` is false for models that can't see. */
export async function readAttachment(file: File, allowImages: boolean): Promise<Attachment> {
  const name = cleanName(file.name);
  if (file.size > MAX_UPLOAD_BYTES) throw new AttachError(`${name} is over ${Math.round(MAX_UPLOAD_BYTES / 1_000_000)} MB. Try a smaller photo or a screenshot.`);
  const kind = fileKind(file.name, file.type);
  if (kind === "image") {
    if (!allowImages) throw new AttachError("This model can't read images. Pick Citad3L V1 or Fast.");
    return { kind: "image", name, dataUrl: await shrinkImage(file) };
  }
  if (!kind) throw new AttachError(`${name}: attach images, PDFs, Word (.docx) or text files.`);
  let text = "";
  try {
    if (kind === "pdf") text = await pdfText(await file.arrayBuffer());
    else if (kind === "docx") text = await docxText(await file.arrayBuffer());
    else text = await file.text();
  } catch {
    throw new AttachError(`${name} couldn't be read.`);
  }
  text = text.replace(/\u0000/g, "").trim();
  if (!text) throw new AttachError(kind === "pdf" ? `${name} has no text layer (scanned PDF). Attach it as an image instead.` : `${name} is empty.`);
  if (text.length > MAX_FILE_CHARS) text = text.slice(0, MAX_FILE_CHARS - 80) + "\n[…truncated: only the first part of this file was attached]";
  return { kind: "file", name, text };
}
