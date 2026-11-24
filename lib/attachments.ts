/**
 * Chat attachments (2026-11-20). Pure helpers shared by the browser and the chat route.
 *
 * - Images go to the model as chat-completions image parts on the current turn only (V1 and Fast read images).
 *   They are not stored: the saved message keeps a short "[Attached image: name]" marker.
 * - PDFs, Word (.docx) and text files are turned into plain text in the browser and stored inside the user
 *   message as <attached-file> blocks, so follow-up questions still see them. The UI folds the blocks into chips.
 * - Citad3L Private (E2EE) and Image are text-only (no attachments). Video accepts one image
 *   as the starting frame (image-to-video); no PDFs or documents.
 */

export const MAX_IMAGES = 4;
/** Video takes a single starting-frame image (image-to-video). */
export const MAX_VIDEO_IMAGES = 1;
/**
 * Picture-to-video is OFF until uploaded start frames get a photo safety check (security audit 2026-11-24: only the
 * text prompt was being checked). Text-to-video still works. Flip to true only together with that check.
 */
export const VIDEO_FROM_PICTURE_ENABLED = false;
export const VIDEO_PICTURE_OFF_MESSAGE =
  "Starting a video from a picture is turned off for now while we add a photo safety check. Describe the video in words and Citad3L Video will make it.";
/** JSON cap for /api/video: one downsized image as a data URL plus the prompt. */
export const MAX_VIDEO_JSON_BYTES = 2_000_000;
export const MAX_IMAGE_BYTES = 1_000_000; // per image, after the browser downsizes it
export const IMAGE_MAX_SIDE = 1568;
export const MAX_FILES = 3;
export const MAX_FILE_CHARS = 30_000; // per file, after text extraction
export const MAX_TOTAL_FILE_CHARS = 40_000;
export const MAX_UPLOAD_BYTES = 15_000_000; // raw file size the browser will try to read
/** JSON body cap for /api/chat: 4 images × ~1.34 MB base64 + 40K chars of file text + the message. */
export const MAX_CHAT_JSON_BYTES = 6_000_000;

export const IMAGE_MIME = ["image/png", "image/jpeg", "image/webp", "image/gif"] as const;
export const TEXT_EXT = ["txt", "md", "markdown", "csv", "tsv", "json", "xml", "html", "htm", "yaml", "yml", "log", "ini", "toml", "js", "jsx", "ts", "tsx", "py", "rb", "go", "rs", "java", "kt", "swift", "c", "h", "cpp", "hpp", "cs", "php", "sh", "sql", "css", "scss"] as const;
export const DOC_ACCEPT = [".pdf", ".docx", ...TEXT_EXT.map((e) => `.${e}`)].join(",");

export type ImageAttachment = { kind: "image"; name: string; dataUrl: string };
export type FileAttachment = { kind: "file"; name: string; text: string };
export type Attachment = ImageAttachment | FileAttachment;

export type AttachCaps = { images: boolean; files: boolean };

/** What the composer may attach for a model. Private (E2EE) and Image are text-only; Video takes one image. */
export function attachCaps(model: { modality?: string; supportsVision?: boolean; requiresClientE2EE?: boolean; comingSoon?: boolean } | null | undefined): AttachCaps {
  if (!model || model.comingSoon || model.requiresClientE2EE) return { images: false, files: false };
  if (model.modality === "video") return { images: VIDEO_FROM_PICTURE_ENABLED, files: false };
  if (model.modality !== "chat") return { images: false, files: false };
  return { images: model.supportsVision === true, files: true };
}

export function extOf(name: string): string {
  const m = /\.([a-z0-9]+)$/i.exec(name.trim());
  return m ? m[1].toLowerCase() : "";
}

export type FileKind = "image" | "pdf" | "docx" | "text" | null;
export function fileKind(name: string, mime: string): FileKind {
  const ext = extOf(name);
  if ((IMAGE_MIME as readonly string[]).includes(mime) || ["png", "jpg", "jpeg", "webp", "gif"].includes(ext)) return "image";
  if (ext === "pdf" || mime === "application/pdf") return "pdf";
  if (ext === "docx" || mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") return "docx";
  if ((TEXT_EXT as readonly string[]).includes(ext) || mime.startsWith("text/")) return "text";
  return null;
}

export function cleanName(name: string): string {
  const n = name.replace(/[\u0000-\u001f"<>\\]/g, "").replace(/\s+/g, " ").trim().slice(0, 120);
  return n || "file";
}

/** Strip things that would let file text forge our block markers. */
function cleanText(text: string): string {
  return text.replace(/\u0000/g, "").replace(/<\/?attached-file\b[^>]*>/gi, "").replace(/\r\n?/g, "\n").trim();
}

const IMAGE_MARK = /^\[Attached image: ([^\]\n]{1,120})\]$/;
const FILE_BLOCK = /<attached-file name="([^"\n]{1,120})">\n([\s\S]*?)\n<\/attached-file>/g;

/** The user message as stored and shown: typed text, then image markers, then file blocks. */
export function composeMessage(text: string, attachments: Attachment[]): string {
  const parts = [text.trim()];
  for (const a of attachments) if (a.kind === "image") parts.push(`[Attached image: ${cleanName(a.name)}]`);
  for (const a of attachments) if (a.kind === "file") parts.push(`<attached-file name="${cleanName(a.name)}">\n${cleanText(a.text)}\n</attached-file>`);
  return parts.filter(Boolean).join("\n\n");
}

/** Split a stored message back into the typed text and attachment chips for display. */
export function splitMessage(content: string): { text: string; images: string[]; files: { name: string; chars: number }[] } {
  const files: { name: string; chars: number }[] = [];
  let rest = content.replace(FILE_BLOCK, (_m, name: string, body: string) => {
    files.push({ name, chars: body.length });
    return "";
  });
  const images: string[] = [];
  rest = rest
    .split("\n")
    .filter((line) => {
      const m = IMAGE_MARK.exec(line.trim());
      if (m) images.push(m[1]);
      return !m;
    })
    .join("\n");
  return { text: rest.trim(), images, files };
}

export type AttachCheck = { ok: true; images: string[]; files: FileAttachment[] } | { ok: false; status: number; code: string; message: string };

const DATA_URL = /^data:(image\/(?:png|jpeg|webp|gif));base64,([A-Za-z0-9+/]+={0,2})$/;

/** Server-side validation. The browser enforces the same limits; this is the authority. */
export function checkAttachments(list: Attachment[] | undefined | null, caps: AttachCaps, ctx: { swarm?: boolean; modelName: string }): AttachCheck {
  const items = list ?? [];
  if (!items.length) return { ok: true, images: [], files: [] };
  const imgs = items.filter((a): a is ImageAttachment => a.kind === "image");
  const files = items.filter((a): a is FileAttachment => a.kind === "file");
  if (files.length && !caps.files) {
    const message = caps.images
      ? `${ctx.modelName} can start from a picture, but not from a document. Attach an image instead.`
      : `${ctx.modelName} is text only. Remove the attachment or pick Citad3L V1 or Fast.`;
    return { ok: false, status: 400, code: "attachments_unsupported", message };
  }
  if (imgs.length && !caps.images) return { ok: false, status: 400, code: "attachments_unsupported", message: `${ctx.modelName} can't read images. Pick Citad3L V1 or Fast.` };
  if (imgs.length && ctx.swarm) return { ok: false, status: 400, code: "attachments_unsupported", message: "Swarm can't read images. Turn Swarm off to send a picture." };
  if (imgs.length > MAX_IMAGES) return { ok: false, status: 413, code: "too_large", message: `Attach up to ${MAX_IMAGES} images per message.` };
  if (files.length > MAX_FILES) return { ok: false, status: 413, code: "too_large", message: `Attach up to ${MAX_FILES} files per message.` };
  const urls: string[] = [];
  for (const im of imgs) {
    const m = DATA_URL.exec(im.dataUrl ?? "");
    if (!m) return { ok: false, status: 400, code: "bad_request", message: "That image couldn't be read. Try a PNG, JPEG, WebP or GIF." };
    const bytes = Math.floor((m[2].length * 3) / 4);
    if (bytes > MAX_IMAGE_BYTES) return { ok: false, status: 413, code: "too_large", message: "That image is too large. Try a smaller one." };
    urls.push(im.dataUrl);
  }
  let total = 0;
  for (const f of files) {
    const t = typeof f.text === "string" ? f.text : "";
    if (!t.trim()) return { ok: false, status: 400, code: "bad_request", message: `No readable text in ${cleanName(f.name ?? "file")}. Scanned PDFs need a text layer.` };
    if (t.length > MAX_FILE_CHARS) return { ok: false, status: 413, code: "too_large", message: `${cleanName(f.name ?? "file")} is too long (max ${MAX_FILE_CHARS.toLocaleString("en-US")} characters of text).` };
    total += t.length;
  }
  if (total > MAX_TOTAL_FILE_CHARS) return { ok: false, status: 413, code: "too_large", message: `Attached files are too long together (max ${MAX_TOTAL_FILE_CHARS.toLocaleString("en-US")} characters).` };
  return { ok: true, images: urls, files };
}
