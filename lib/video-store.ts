import "server-only";
import { prisma } from "@/lib/db";
import { imagesBucket, VIDEO_KEY_PREFIX, type R2Bucket, type R2Range } from "@/lib/images-r2";
import { parseVideoContent, videoContent, VIDEO_PATH } from "@/lib/video-content";
import { isProviderMediaUrl } from "@/lib/inference/provider-models";
import { downloadVideo, pollVideo, resolveVideoDownloadUrl } from "@/lib/inference/video";

/**
 * Durable copy in R2 (the IMAGES bucket, key videos/{userId}/{messageId}) when the binding exists. Without R2 the
 * clip is streamed from the provider's pre-signed link, which the provider keeps for 24 hours only.
 */
export function videoObjectKey(userId: string, messageId: string): string {
  if (!userId || !messageId || userId.includes("/") || messageId.includes("/")) throw new Error("invalid video key parts");
  return `${VIDEO_KEY_PREFIX}${userId}/${messageId}`;
}

/** True when generated-media R2 is bound (IMAGES). Video generation must not queue without this. */
export function isVideoStorageConfigured(bucket?: R2Bucket | null): boolean {
  return !!imagesBucket(bucket);
}

export const VIDEO_STORAGE_UNAVAILABLE_CODE = "storage_unavailable";
export const VIDEO_STORAGE_UNAVAILABLE_MESSAGE = "Video storage isn't configured.";

export type VideoStatus = "processing" | "ready" | "error" | "not_found";


/** Update only while the message is still the pending job, so a failed poll cannot overwrite a completed clip. */
async function markVideoError(messageId: string): Promise<void> {
  await prisma.message.updateMany({
    where: { id: messageId, status: { not: "complete" }, content: { contains: "?pending=1" } },
    data: { status: "error" },
  }).catch(() => {});
}

async function markVideoReady(messageId: string, content: string): Promise<boolean> {
  const r = await prisma.message.updateMany({
    where: { id: messageId, content: { contains: "?pending=1" } },
    data: { content, status: "complete" },
  });
  return (r.count ?? 0) > 0;
}

/**
 * Check a pending video once and, if the provider finished, mark the message complete (and copy it to R2 if possible).
 * Idempotent; safe to call from the generating stream, the status poll, or a reload.
 */
export async function finalizeVideo(opts: { userId: string; messageId: string; signal?: AbortSignal; bucket?: R2Bucket | null }): Promise<{ status: VideoStatus; content?: string }> {
  const msg = await prisma.message.findFirst({ where: { id: opts.messageId, userId: opts.userId, role: "assistant" }, select: { id: true, content: true, status: true } });
  const parsed = parseVideoContent(msg?.content, isProviderMediaUrl);
  if (!msg || !parsed) return { status: "not_found" };
  if (!parsed.pending) return { status: "ready", content: msg.content };
  if (!parsed.job) return { status: "error" };
  let poll;
  try {
    poll = await pollVideo(parsed.job, opts.signal);
  } catch {
    await markVideoError(msg.id);
    return { status: "error" };
  }
  if (poll.status === "processing") return { status: "processing" };
  // Only a URL we actually fetched this poll is a safe 24h fallback. A queue-time URL on a direct mp4 retrieve is unverified.
  const job = {
    queueId: parsed.job.queueId,
    downloadUrl: poll.downloadUrlVerified ? resolveVideoDownloadUrl(poll.downloadUrl) : null,
  };
  const bucket = imagesBucket(opts.bucket);
  let stored = false;
  if (bucket) {
    stored = await bucket
      .put(videoObjectKey(opts.userId, msg.id), poll.bytes, { httpMetadata: { contentType: poll.mime } })
      .then(() => true)
      .catch((e) => {
        console.error("[video] r2 put failed", e instanceof Error ? e.name : "error");
        return false;
      });
  }
  // Ready only when we can serve the clip later: an R2 copy, or a just-fetched provider link.
  if (!stored && !job.downloadUrl) {
    await markVideoError(msg.id);
    return { status: "error" };
  }
  const content = videoContent(msg.id, job, { stored });
  const wrote = await markVideoReady(msg.id, content);
  if (!wrote) {
    const again = await prisma.message.findFirst({ where: { id: msg.id, userId: opts.userId, role: "assistant" }, select: { content: true } });
    const parsedAgain = parseVideoContent(again?.content, isProviderMediaUrl);
    if (again && parsedAgain && !parsedAgain.pending) return { status: "ready", content: again.content };
    return { status: "error" };
  }
  return { status: "ready", content };
}

/** Bytes for GET /api/videos/<id>: R2 copy, else the provider's 24 h link (copied into R2 on the way if the bucket exists). */
export async function loadVideoBytes(opts: { userId: string; messageId: string; signal?: AbortSignal; bucket?: R2Bucket | null }): Promise<{ bytes: Uint8Array; mime: string } | { error: "not_found" | "pending" | "expired" }> {
  const msg = await prisma.message.findFirst({ where: { id: opts.messageId, userId: opts.userId, role: "assistant" }, select: { id: true, content: true } });
  const parsed = parseVideoContent(msg?.content, isProviderMediaUrl);
  if (!msg || !parsed) return { error: "not_found" };
  if (parsed.pending) return { error: "pending" };
  const bucket = imagesBucket(opts.bucket);
  if (bucket) {
    const obj = await bucket.get(videoObjectKey(opts.userId, msg.id)).catch(() => null);
    if (obj) return { bytes: new Uint8Array(await obj.arrayBuffer()), mime: obj.httpMetadata?.contentType ?? "video/mp4" };
  }
  if (!parsed.job?.downloadUrl) return { error: "expired" };
  let v: { bytes: Uint8Array; mime: string };
  try {
    v = await downloadVideo(parsed.job.downloadUrl, opts.signal);
  } catch {
    return { error: "expired" };
  }
  // Lazy backfill: a clip finished before R2 existed gets its permanent copy the first time it's played (within 24 h).
  if (bucket && parsed.job) {
    const job = parsed.job;
    await bucket
      .put(videoObjectKey(opts.userId, msg.id), v.bytes, { httpMetadata: { contentType: v.mime } })
      .then(() => prisma.message.update({ where: { id: msg.id }, data: { content: videoContent(msg.id, job, { stored: true }) } }))
      .catch(() => null);
  }
  return v;
}

/** Parse a single `bytes=` range against a known size. null = no/invalid header (send all); "unsatisfiable" = 416. */
export function parseRange(range: string | null, total: number): { start: number; end: number } | null | "unsatisfiable" {
  const m = range ? /^bytes=(\d*)-(\d*)$/.exec(range.trim()) : null;
  if (!m || (m[1] === "" && m[2] === "")) return null;
  let start: number, end: number;
  if (m[1] === "") { start = Math.max(0, total - Number(m[2])); end = total - 1; }
  else { start = Number(m[1]); end = m[2] === "" ? total - 1 : Math.min(Number(m[2]), total - 1); }
  if (start >= total || start > end) return "unsatisfiable";
  return { start, end };
}

const BASE_HEADERS = (mime: string) => ({ "content-type": mime, "accept-ranges": "bytes", "cache-control": "private, max-age=3600", "x-content-type-options": "nosniff" });

/**
 * Owner-only video response. With R2, a Range request reads just that slice from R2 (no full download per seek);
 * otherwise falls back to loadVideoBytes + rangeResponse.
 */
export async function serveVideo(opts: { userId: string; messageId: string; range: string | null; signal?: AbortSignal; bucket?: R2Bucket | null }): Promise<Response | { error: "not_found" | "pending" | "expired" }> {
  const bucket = imagesBucket(opts.bucket);
  if (bucket?.head) {
    const msg = await prisma.message.findFirst({ where: { id: opts.messageId, userId: opts.userId, role: "assistant" }, select: { id: true, content: true } });
    const parsed = parseVideoContent(msg?.content, isProviderMediaUrl);
    if (!msg || !parsed) return { error: "not_found" };
    if (parsed.pending) return { error: "pending" };
    const key = videoObjectKey(opts.userId, msg.id);
    const head = await bucket.head(key).catch(() => null);
    if (head) {
      const mime = head.httpMetadata?.contentType ?? "video/mp4";
      const total = head.size;
      const r = parseRange(opts.range, total);
      if (r === "unsatisfiable") return new Response(null, { status: 416, headers: { ...BASE_HEADERS(mime), "content-range": `bytes */${total}` } });
      const range: R2Range | undefined = r ? { offset: r.start, length: r.end - r.start + 1 } : undefined;
      const obj = await bucket.get(key, range ? { range } : undefined);
      if (!obj) return { error: "not_found" };
      const body = Buffer.from(await obj.arrayBuffer());
      if (!r) return new Response(body, { headers: { ...BASE_HEADERS(mime), "content-length": String(total) } });
      return new Response(body, { status: 206, headers: { ...BASE_HEADERS(mime), "content-length": String(body.byteLength), "content-range": `bytes ${r.start}-${r.end}/${total}` } });
    }
  }
  const v = await loadVideoBytes(opts);
  if ("error" in v) return v;
  return rangeResponse(v.bytes, v.mime, opts.range);
}

/** Range support: Safari won't play <video> without 206 partial responses. */
export function rangeResponse(bytes: Uint8Array, mime: string, range: string | null): Response {
  const total = bytes.byteLength;
  const r = parseRange(range, total);
  if (r === "unsatisfiable") return new Response(null, { status: 416, headers: { ...BASE_HEADERS(mime), "content-range": `bytes */${total}` } });
  if (!r) return new Response(Buffer.from(bytes), { headers: { ...BASE_HEADERS(mime), "content-length": String(total) } });
  const part = bytes.subarray(r.start, r.end + 1);
  return new Response(Buffer.from(part), { status: 206, headers: { ...BASE_HEADERS(mime), "content-length": String(part.byteLength), "content-range": `bytes ${r.start}-${r.end}/${total}` } });
}

export { VIDEO_PATH };
