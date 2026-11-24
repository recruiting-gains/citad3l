/**
 * Browser-only: turn picked files into chat attachments. PDF text via pdf.js, Word via mammoth, images downsized
 * on a canvas. Libraries load on first use, so the chat bundle doesn't grow for people who never attach anything.
 */
import { IMAGE_MAX_SIDE, MAX_FILE_CHARS, MAX_IMAGE_BYTES, MAX_UPLOAD_BYTES, cleanName, fileKind, type Attachment } from "./attachments";

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

async function shrinkImage(file: File): Promise<string> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, IMAGE_MAX_SIDE / Math.max(bmp.width, bmp.height));
  const w = Math.max(1, Math.round(bmp.width * scale));
  const h = Math.max(1, Math.round(bmp.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new AttachError("Your browser couldn't read that image.");
  ctx.fillStyle = "#ffffff"; // JPEG has no transparency
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bmp, 0, 0, w, h);
  bmp.close?.();
  for (const q of [0.86, 0.72, 0.58]) {
    const url = canvas.toDataURL("image/jpeg", q);
    if ((url.length - url.indexOf(",") - 1) * 0.75 <= MAX_IMAGE_BYTES) return url;
  }
  throw new AttachError(`${cleanName(file.name)} is too large to send.`);
}

/** One picked file → one attachment, or a friendly error. `allowImages` is false for models that can't see. */
export async function readAttachment(file: File, allowImages: boolean): Promise<Attachment> {
  const name = cleanName(file.name);
  if (file.size > MAX_UPLOAD_BYTES) throw new AttachError(`${name} is over 15 MB.`);
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
