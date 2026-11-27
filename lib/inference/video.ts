import "server-only";
import { resolveVideoModelId, providerApiKey, providerBaseUrl, isProviderMediaUrl } from "./provider-models";
import { ProviderUnavailable } from "./index";

/**
 * Citad3L Video through the provider's async video API: POST /video/quote → /video/queue → poll /video/retrieve → download.
 * Admin-only (the route checks). Every clip is quoted first and refused above VIDEO_MAX_USD_PER_CLIP, because the
 * provider key has a $20/month cap (2026-11-21) shared with chat, images and @computer; see lib/spend-guard.ts.
 */
export const VIDEO_PARAMS = { duration: "5s", resolution: "720p", aspect_ratio: "16:9", audio: true } as const;

function envNum(name: string, fallback: number): number {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}
/** Max quoted price for one clip (USD). 5 s 720p with audio quotes $1.44 (checked 2026-11-19). */
export const videoMaxUsdPerClip = () => envNum("VIDEO_MAX_USD_PER_CLIP", 1.6);
/** Clips per user per rolling 24 h (public launch: Max plan). Also capped per day and per 30 days globally in lib/spend-guard.ts. */
export const videoMaxPerDay = () => Math.floor(envNum("VIDEO_MAX_PER_DAY", 2));

type Fetch = typeof fetch;

function auth(): { key: string; base: string } {
  const key = providerApiKey();
  if (!key) throw new ProviderUnavailable("Video generation is not configured.");
  return { key, base: providerBaseUrl() };
}

async function post(f: Fetch, path: string, body: unknown, signal?: AbortSignal): Promise<Response> {
  const { key, base } = auth();
  return f(`${base}${path}`, {
    method: "POST",
    signal,
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify(body),
  });
}

export function videoModelId(kind: "t2v" | "i2v" = "t2v"): string {
  return resolveVideoModelId(kind);
}

/** Shared body for quote/queue. `imageUrl` is a data: or https URL used as the first frame (image-to-video). */
export function videoRequestBody(opts: { prompt?: string; imageUrl?: string | null } = {}): Record<string, unknown> {
  const image = !!opts.imageUrl;
  return {
    model: videoModelId(image ? "i2v" : "t2v"),
    ...VIDEO_PARAMS,
    ...(opts.prompt ? { prompt: opts.prompt } : {}),
    ...(image ? { image_url: opts.imageUrl } : {}),
  };
}

export async function quoteVideo(signal?: AbortSignal, f: Fetch = fetch, imageUrl?: string | null): Promise<number> {
  const r = await post(f, "/video/quote", videoRequestBody({ imageUrl }), signal);
  const j = (await r.json().catch(() => ({}))) as { quote?: number };
  if (!r.ok || typeof j.quote !== "number") throw new ProviderUnavailable("Couldn't price this video.");
  return j.quote;
}

export async function queueVideo(prompt: string, signal?: AbortSignal, f: Fetch = fetch, imageUrl?: string | null): Promise<{ queueId: string; downloadUrl: string | null }> {
  const r = await post(f, "/video/queue", videoRequestBody({ prompt, imageUrl }), signal);
  const j = (await r.json().catch(() => ({}))) as { queue_id?: string; download_url?: string; error?: unknown };
  if (!r.ok || typeof j.queue_id !== "string") {
    throw new ProviderUnavailable(r.status === 400 ? "The video service refused this prompt." : `Video queue failed (${r.status}).`);
  }
  return { queueId: j.queue_id, downloadUrl: typeof j.download_url === "string" ? j.download_url : null };
}

export type VideoPoll =
  | { status: "processing"; etaMs?: number }
  | { status: "done"; bytes: Uint8Array; mime: string; downloadUrl: string | null; downloadUrlVerified: boolean };

/** Keep a provider media URL from retrieve (preferred) or the queue-time fallback. Rejects unexpected hosts. */
export function resolveVideoDownloadUrl(candidate: unknown, fallback: string | null = null): string | null {
  const pick = (v: unknown): string | null => {
    if (typeof v !== "string") return null;
    const url = v.trim();
    return url && isProviderMediaUrl(url) ? url : null;
  };
  return pick(candidate) ?? pick(fallback);
}

/** One poll. COMPLETED uses download_url from retrieve when present, else the queue-time link; otherwise retrieve itself returns the mp4. */
export async function pollVideo(job: { queueId: string; downloadUrl: string | null }, signal?: AbortSignal, f: Fetch = fetch): Promise<VideoPoll> {
  // Retrieve may require the same family used to queue (text vs image). Try text first, then image, on 404 only.
  let r = await post(f, "/video/retrieve", { model: videoModelId("t2v"), queue_id: job.queueId }, signal);
  if (r.status === 404) r = await post(f, "/video/retrieve", { model: videoModelId("i2v"), queue_id: job.queueId }, signal);
  const ct = r.headers.get("content-type") ?? "";
  if (r.ok && ct.startsWith("video/")) {
    return { status: "done", bytes: new Uint8Array(await r.arrayBuffer()), mime: ct.split(";")[0], downloadUrl: resolveVideoDownloadUrl(job.downloadUrl), downloadUrlVerified: false };
  }
  const j = (await r.json().catch(() => ({}))) as { status?: string; download_url?: unknown; average_execution_time?: number; execution_duration?: number; error?: unknown };
  if (!r.ok) throw new ProviderUnavailable(r.status === 404 ? "The video service no longer has this video." : `Video retrieve failed (${r.status}).`);
  if (j.status === "COMPLETED") {
    const downloadUrl = resolveVideoDownloadUrl(j.download_url, job.downloadUrl);
    if (!downloadUrl) throw new ProviderUnavailable("Video finished but no file was returned.");
    return { status: "done", ...(await downloadVideo(downloadUrl, signal, f)), downloadUrl, downloadUrlVerified: true };
  }
  const eta = typeof j.average_execution_time === "number" && typeof j.execution_duration === "number" ? Math.max(0, j.average_execution_time - j.execution_duration) : undefined;
  return { status: "processing", etaMs: eta };
}

export async function downloadVideo(url: string, signal?: AbortSignal, f: Fetch = fetch): Promise<{ bytes: Uint8Array; mime: string }> {
  if (!isProviderMediaUrl(url)) throw new ProviderUnavailable("Unexpected video host.");
  const r = await f(url, { signal, redirect: "follow" });
  // fetch follows redirects; the final URL must still be on the provider media host.
  const finalUrl = r.url || url;
  if (!isProviderMediaUrl(finalUrl)) throw new ProviderUnavailable("Unexpected video host.");
  if (!r.ok) throw new ProviderUnavailable(r.status === 404 || r.status === 403 ? "This video link expired (clips are kept for 24 hours)." : `Video download failed (${r.status}).`);
  return { bytes: new Uint8Array(await r.arrayBuffer()), mime: (r.headers.get("content-type") ?? "video/mp4").split(";")[0] };
}
