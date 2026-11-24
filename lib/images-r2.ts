import { getCloudflareContext } from "@opennextjs/cloudflare";

/**
 * Generated-image storage on Cloudflare R2.
 *
 * Why: assistant Message.content currently inlines data: URIs (~340 KB each).
 * Neon free tier is 0.5 GB, so a few thousand images would fill the database.
 *
 * Design:
 *   - Binding name: IMAGES (see wrangler.jsonc, commented until the bucket exists)
 *   - Object key: images/{userId}/{messageId}
 *   - Serve only through GET /api/images/{messageId} after a session check
 *   - Message.content stores a short markdown URL, not the bytes
 *   - If the binding is missing, callers fall back to the inline data URI
 */

export type R2Object = {
  arrayBuffer(): Promise<ArrayBuffer>;
  httpMetadata?: { contentType?: string };
  /** Size of the whole object (also on ranged reads). */
  size?: number;
};
export type R2Range = { offset: number; length?: number } | { suffix: number };

export type R2Bucket = {
  put(
    key: string,
    value: ArrayBuffer | ArrayBufferView | string,
    opts?: { httpMetadata?: { contentType: string } },
  ): Promise<unknown>;
  get(key: string, opts?: { range?: R2Range }): Promise<R2Object | null>;
  head?(key: string): Promise<{ size: number; httpMetadata?: { contentType?: string } } | null>;
  delete(key: string | string[]): Promise<void>;
  list?(opts: { prefix?: string; cursor?: string; limit?: number }): Promise<{
    objects: { key: string }[];
    truncated: boolean;
    cursor?: string;
  }>;
};

export const IMAGE_KEY_PREFIX = "images/";
/** Videos share the bucket (one binding, IMAGES → citad3l-images) under their own prefix. */
export const VIDEO_KEY_PREFIX = "videos/";

export function imageObjectKey(userId: string, messageId: string): string {
  if (!userId || !messageId || userId.includes("/") || messageId.includes("/")) {
    throw new Error("invalid image key parts");
  }
  return `${IMAGE_KEY_PREFIX}${userId}/${messageId}`;
}

export function imagePublicPath(messageId: string): string {
  return `/api/images/${messageId}`;
}

export function imageMarkdown(messageId: string, alt = "Generated image"): string {
  return `![${alt}](${imagePublicPath(messageId)})`;
}

const DATA_URI_RE =
  /!\[([^\]]*)\]\((?:<)?data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=\s]+)(?:>)?\)/g;
const API_PATH_RE = /!\[([^\]]*)\]\((\/api\/images\/([A-Za-z0-9_-]+))\)/g;

export type InlineImageMatch = { alt: string; mime: string; bytes: Uint8Array; markdown: string };

export function decodeBase64Image(b64: string): Uint8Array {
  const clean = b64.replace(/^data:[^;]+;base64,/, "").replace(/\s+/g, "");
  return Uint8Array.from(Buffer.from(clean, "base64"));
}

export function extractInlineImages(content: string): InlineImageMatch[] {
  const out: InlineImageMatch[] = [];
  if (!content) return out;
  const re = new RegExp(DATA_URI_RE.source, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(content))) {
    out.push({ alt: m[1] || "Generated image", mime: m[2], bytes: decodeBase64Image(m[3]), markdown: m[0] });
  }
  return out;
}

export function extractStoredImageIds(content: string): string[] {
  const ids: string[] = [];
  if (!content) return ids;
  const re = new RegExp(API_PATH_RE.source, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(content))) ids.push(m[3]);
  return ids;
}

export function replaceInlineImage(content: string, match: InlineImageMatch, messageId: string): string {
  return content.replace(match.markdown, imageMarkdown(messageId, match.alt));
}

type CfCtx = { env: Record<string, unknown> };

function cfContext(): CfCtx | undefined {
  try {
    return getCloudflareContext() as unknown as CfCtx;
  } catch {
    return undefined;
  }
}

export function imagesBucket(override?: R2Bucket | null): R2Bucket | null {
  if (override !== undefined) return override;
  const b = cfContext()?.env?.IMAGES as R2Bucket | undefined;
  return b && typeof b.put === "function" && typeof b.get === "function" ? b : null;
}

export async function putGeneratedImage(opts: {
  userId: string;
  messageId: string;
  bytes: Uint8Array;
  mime: string;
  bucket?: R2Bucket | null;
}): Promise<{ key: string; url: string; markdown: string } | null> {
  const bucket = imagesBucket(opts.bucket);
  if (!bucket) return null;
  const key = imageObjectKey(opts.userId, opts.messageId);
  const mime = opts.mime || "image/webp";
  const copy = Uint8Array.from(opts.bytes);
  await bucket.put(key, copy, { httpMetadata: { contentType: mime } });
  return { key, url: imagePublicPath(opts.messageId), markdown: imageMarkdown(opts.messageId) };
}

export async function getGeneratedImage(opts: {
  userId: string;
  messageId: string;
  bucket?: R2Bucket | null;
}): Promise<{ body: Uint8Array; mime: string } | null> {
  const bucket = imagesBucket(opts.bucket);
  if (!bucket) return null;
  const obj = await bucket.get(imageObjectKey(opts.userId, opts.messageId));
  if (!obj) return null;
  const body = new Uint8Array(await obj.arrayBuffer());
  const mime = obj.httpMetadata?.contentType || "application/octet-stream";
  return { body, mime };
}

export async function deleteGeneratedImage(opts: {
  userId: string;
  messageId: string;
  bucket?: R2Bucket | null;
}): Promise<void> {
  const bucket = imagesBucket(opts.bucket);
  if (!bucket) return;
  // A message has at most one of these; deleting a missing key is a no-op in R2.
  await bucket.delete([imageObjectKey(opts.userId, opts.messageId), `${VIDEO_KEY_PREFIX}${opts.userId}/${opts.messageId}`]);
}

export async function deleteImagesForUser(opts: { userId: string; bucket?: R2Bucket | null }): Promise<number> {
  const bucket = imagesBucket(opts.bucket);
  if (!bucket?.list) return 0;
  let deleted = 0;
  for (const root of [IMAGE_KEY_PREFIX, VIDEO_KEY_PREFIX]) {
    const prefix = `${root}${opts.userId}/`;
    let cursor: string | undefined;
    do {
      const page = await bucket.list({ prefix, cursor, limit: 1000 });
      const keys = page.objects.map((o) => o.key);
      if (keys.length) {
        await bucket.delete(keys);
        deleted += keys.length;
      }
      cursor = page.truncated ? page.cursor : undefined;
    } while (cursor);
  }
  return deleted;
}

export type MessageRow = { id: string; userId: string; content: string };

/** Load bytes for the signed-in owner. Falls back to an inline data URI still on the row. */
export async function loadImageForUser(opts: {
  userId: string;
  messageId: string;
  getMessage: (id: string) => Promise<MessageRow | null>;
  bucket?: R2Bucket | null;
}): Promise<{ body: Uint8Array; mime: string } | { error: "not_found" }> {
  const row = await opts.getMessage(opts.messageId);
  if (!row || row.userId !== opts.userId) return { error: "not_found" };
  const fromR2 = await getGeneratedImage({ userId: opts.userId, messageId: opts.messageId, bucket: opts.bucket });
  if (fromR2) return fromR2;
  const inline = extractInlineImages(row.content)[0];
  if (inline) return { body: inline.bytes, mime: inline.mime };
  return { error: "not_found" };
}

export type MigrateResult = {
  scanned: number;
  migrated: number;
  skipped: number;
  bytesMoved: number;
  errors: { id: string; message: string }[];
};

/**
 * Move inline data:image payloads out of Message.content and into R2.
 * Dry-run (default) only counts. Existing short /api/images/ rows are skipped.
 */
export async function migrateInlineImages(opts: {
  list: (args: { offset: number; limit: number }) => Promise<MessageRow[]>;
  updateContent: (id: string, content: string) => Promise<void>;
  bucket?: R2Bucket | null;
  dryRun?: boolean;
  limit?: number;
  pageSize?: number;
}): Promise<MigrateResult> {
  const dryRun = opts.dryRun !== false;
  const pageSize = opts.pageSize ?? 50;
  const cap = opts.limit ?? Infinity;
  const result: MigrateResult = { scanned: 0, migrated: 0, skipped: 0, bytesMoved: 0, errors: [] };
  let offset = 0;
  while (result.scanned < cap) {
    const take = Math.min(pageSize, cap - result.scanned);
    const rows = await opts.list({ offset, limit: take });
    if (!rows.length) break;
    for (const row of rows) {
      result.scanned += 1;
      const inlines = extractInlineImages(row.content);
      if (!inlines.length) {
        result.skipped += 1;
        continue;
      }
      // One generated image per assistant message is the current write path.
      const img = inlines[0];
      result.bytesMoved += img.bytes.byteLength;
      if (dryRun) {
        result.migrated += 1;
        continue;
      }
      try {
        const stored = await putGeneratedImage({
          userId: row.userId,
          messageId: row.id,
          bytes: img.bytes,
          mime: img.mime,
          bucket: opts.bucket,
        });
        if (!stored) throw new Error("R2 bucket is not configured");
        const next = replaceInlineImage(row.content, img, row.id);
        await opts.updateContent(row.id, next);
        result.migrated += 1;
      } catch (e) {
        result.errors.push({ id: row.id, message: e instanceof Error ? e.message : "upload failed" });
      }
    }
    if (rows.length < take) break;
    offset += rows.length;
  }
  return result;
}
