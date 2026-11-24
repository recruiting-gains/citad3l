/**
 * How a Citad3L Video reply is stored in Message.content (no schema change):
 *
 *   ![Generated video](/api/videos/<messageId> "c3l-video:<queueId>:<b64url(download_url)>")
 *
 * The title is read only by the server (to re-fetch from the provider when there is no R2 copy). The chat renders any
 * `/api/videos/<id>` image as a <video> player. While the provider is still rendering, the src carries `?pending=1`.
 * Client-safe: no secrets here; the download link is a per-video pre-signed URL for the owner's own clip.
 */
export const VIDEO_PATH = "/api/videos/";

export type VideoJob = { queueId: string; downloadUrl: string | null };

const b64url = (s: string) => (typeof Buffer !== "undefined" ? Buffer.from(s, "utf8").toString("base64url") : btoa(unescape(encodeURIComponent(s))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""));
const unb64url = (s: string) => {
  if (typeof Buffer !== "undefined") return Buffer.from(s, "base64url").toString("utf8");
  const p = s.replace(/-/g, "+").replace(/_/g, "/");
  return decodeURIComponent(escape(atob(p + "=".repeat((4 - (p.length % 4)) % 4))));
};

export function videoContent(messageId: string, job: VideoJob, opts: { pending?: boolean; stored?: boolean } = {}): string {
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(messageId) || !/^[A-Za-z0-9_-]{1,80}$/.test(job.queueId)) throw new Error("bad video ids");
  const title = opts.stored ? "c3l-video:r2" : `c3l-video:${job.queueId}:${job.downloadUrl ? b64url(job.downloadUrl) : ""}`;
  const alt = opts.pending ? "Generating video" : "Generated video";
  return `![${alt}](${VIDEO_PATH}${messageId}${opts.pending ? "?pending=1" : ""} "${title}")`;
}

const RE = /!\[[^\]]*\]\(\/api\/videos\/([A-Za-z0-9_-]{1,80})(\?pending=1)?\s+"c3l-video:([^"]*)"\)/;

export type ParsedVideo = { messageId: string; pending: boolean; stored: boolean; job: VideoJob | null };

export function parseVideoContent(content: string | null | undefined, allowUrl?: (url: string) => boolean): ParsedVideo | null {
  const m = RE.exec(content ?? "");
  if (!m) return null;
  if (m[3] === "r2") return { messageId: m[1], pending: !!m[2], stored: true, job: null };
  const [queueId, enc] = m[3].split(":");
  if (!queueId) return null;
  let downloadUrl: string | null = null;
  try {
    downloadUrl = enc ? unb64url(enc) : null;
  } catch {
    downloadUrl = null;
  }
  if (downloadUrl && !/^https:\/\/[a-z0-9.-]+\//i.test(downloadUrl)) downloadUrl = null; // https only
  if (downloadUrl && allowUrl && !allowUrl(downloadUrl)) downloadUrl = null; // server passes the provider media-host check
  return { messageId: m[1], pending: !!m[2], stored: false, job: { queueId, downloadUrl } };
}

/** A pure `/api/videos/<id>` src (from the markdown renderer). */
export function videoIdFromSrc(src: string | undefined): { id: string; pending: boolean } | null {
  const m = /^\/api\/videos\/([A-Za-z0-9_-]{1,80})(\?pending=1)?$/.exec(src ?? "");
  return m ? { id: m[1], pending: !!m[2] } : null;
}
