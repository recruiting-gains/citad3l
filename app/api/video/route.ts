import { z } from "zod";
import { requireUserId } from "@/auth";
import { prisma } from "@/lib/db";
import { BodyTooLarge, jerr, readJsonLimited, tooMany } from "@/lib/http";
import { attachCaps, checkAttachments, composeMessage, MAX_IMAGE_DATA_URL_CHARS, MAX_VIDEO_IMAGES, MAX_VIDEO_JSON_BYTES, VIDEO_FROM_PICTURE_ENABLED, VIDEO_PICTURE_OFF_MESSAGE } from "@/lib/attachments";
import { getPublicModel } from "@/lib/models";
import { MAX_MESSAGE_CHARS } from "@/lib/config";
import { LIMITS, limitDurable, rateLimit, rule } from "@/lib/ratelimit";
import { reserve, settle, getUsage, UsageError, userIsAdmin } from "@/lib/usage";
import { ProviderUnavailable } from "@/lib/inference";
import { queueVideo, quoteVideo, videoMaxPerDay, videoMaxUsdPerClip } from "@/lib/inference/video";
import { finalizeVideo, isVideoStorageConfigured, VIDEO_STORAGE_UNAVAILABLE_CODE, VIDEO_STORAGE_UNAVAILABLE_MESSAGE } from "@/lib/video-store";
import { videoContent } from "@/lib/video-content";
import { titleFrom } from "@/lib/prompt";
import { reviewImagePrompt } from "@/lib/filter-llm";
import { bannedMessage } from "@/lib/banned";
import { logFilterRefusal } from "@/lib/filter-log";
import { checkAccess } from "@/lib/access";
import { mediaGenerationEnabled } from "@/lib/media";
import { spendGuard } from "@/lib/spend-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  conversationId: z.string().max(40).optional().nullable(),
  projectId: z.string().max(40).optional().nullable(),
  message: z.string().max(MAX_MESSAGE_CHARS),
  attachments: z.array(z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("image"), name: z.string().max(120), dataUrl: z.string().max(MAX_IMAGE_DATA_URL_CHARS) }),
    z.object({ kind: z.literal("file"), name: z.string().max(120), text: z.string() }),
  ])).max(4).optional(),
});

/** How long this request keeps polling the provider before handing off to the chat's own status poll. */
const STREAM_WAIT_MS = 4 * 60_000;
const POLL_MS = 5_000;

const sleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((res) => {
    const t = setTimeout(res, ms);
    signal.addEventListener("abort", () => { clearTimeout(t); res(); }, { once: true });
  });

/** Citad3L Video: Max plan (admins always), quoted and capped (per clip, per user per day, global per day), async on the provider. Streams meta → (status…) → delta → done like /api/image. */
export async function POST(req: Request) {
  if (!mediaGenerationEnabled()) return jerr(403, "media_disabled", "Video generation is turned off.");
  const userId = await requireUserId();
  if (!userId) return jerr(401, "unauthorized", "Sign in to generate videos.");
  const denied = await checkAccess(userId, "citad3l-video");
  if (denied) return jerr(denied.status, denied.code, denied.message, { upgrade: "/pricing" });
  const admin = await userIsAdmin(userId);
  const suspended = await bannedMessage(userId);
  if (suspended) return jerr(403, "suspended", suspended);

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await readJsonLimited(req, MAX_VIDEO_JSON_BYTES));
  } catch (e) {
    if (e instanceof BodyTooLarge) return jerr(413, "too_large", "Request too large.");
    return jerr(400, "bad_request", "Invalid request.");
  }
  const prompt = body.message.trim();
  if (!prompt) return jerr(400, "bad_request", "Describe the video you want.");
  // Picture-to-video is off until start frames get a photo safety check (see VIDEO_FROM_PICTURE_ENABLED).
  if (!VIDEO_FROM_PICTURE_ENABLED && body.attachments?.some((a) => a.kind === "image")) {
    return jerr(403, "picture_video_off", VIDEO_PICTURE_OFF_MESSAGE);
  }
  const pub = getPublicModel("citad3l-video");
  const att = checkAttachments(body.attachments, attachCaps(pub), { modelName: pub?.name ?? "Citad3L Video" });
  if (!att.ok) return jerr(att.status, att.code, att.message);
  if (att.images.length > MAX_VIDEO_IMAGES) return jerr(413, "too_large", "Attach one picture as the starting frame.");
  const imageUrl = att.images[0] ?? null;
  const storedPrompt = body.attachments?.length ? composeMessage(prompt, body.attachments) : prompt;
  // Fail closed before quote/queue/reserve: without R2 the clip cannot be kept or played (bytes would be discarded).
  if (!isVideoStorageConfigured()) return jerr(503, VIDEO_STORAGE_UNAVAILABLE_CODE, VIDEO_STORAGE_UNAVAILABLE_MESSAGE);
  if (!rateLimit(`video:${userId}`, 3)) return tooMany("Slow down — too many videos this minute.");
  const lim = await limitDurable([rule(LIMITS.imageUserMin, userId), rule(LIMITS.imageUserHour, userId)]);
  if (!lim.ok) return tooMany("Slow down — too many requests right now.", lim.retryAfterSec);

  // Rolling 24 h clip cap per user, counted from stored video replies.
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const today = await prisma.message.count({ where: { userId, role: "assistant", createdAt: { gte: since }, content: { contains: '"c3l-video:' } } });
  if (today >= videoMaxPerDay()) return jerr(429, "daily_cap", `Video limit reached (${videoMaxPerDay()} per 24 hours). It resets 24 hours after your first clip.`);

  let conversation = body.conversationId ? await prisma.conversation.findFirst({ where: { id: body.conversationId, userId } }) : null;
  if (body.conversationId && !conversation) return jerr(404, "not_found", "Conversation not found.");
  if (!conversation && body.projectId) {
    const p = await prisma.project.findFirst({ where: { id: body.projectId, userId } });
    if (!p) return jerr(404, "not_found", "Project not found.");
  }

  const filter = await reviewImagePrompt(prompt, req.signal);
  if (!filter.allowed) {
    await logFilterRefusal({ userId, direction: "input", verdict: filter, modelId: "citad3l-video" });
    return jerr(400, "content_policy", filter.message);
  }

  // Price check before anything is queued (nothing is charged by a quote).
  let quote: number;
  try {
    quote = await quoteVideo(req.signal, fetch, imageUrl);
  } catch (e) {
    return jerr(503, "provider_unavailable", e instanceof ProviderUnavailable ? e.message : "Video pricing is unavailable right now.");
  }
  if (quote > videoMaxUsdPerClip()) {
    return jerr(402, "too_expensive", `This clip would cost about $${quote.toFixed(2)}, above the $${videoMaxUsdPerClip().toFixed(2)} per-clip limit.`);
  }

  // Daily caps (per user + global ceiling across every account), counted only once the clip is quoted and allowed.
  const capped = await spendGuard("video", userId, { admin });
  if (capped) return jerr(capped.status, capped.code, capped.message, { retryAfterSec: capped.retryAfterSec });

  let reservationId: string;
  try {
    ({ reservationId } = await reserve(userId, 1));
  } catch (e) {
    if (e instanceof UsageError) return jerr(e.code === "busy" ? 429 : 402, e.code, e.message, { usage: await getUsage(userId) });
    throw e;
  }

  try {
    if (!conversation) conversation = await prisma.conversation.create({ data: { userId, projectId: body.projectId ?? null, title: titleFrom(prompt) } });
    const conv = conversation;
    const um = await prisma.message.create({ data: { conversationId: conv.id, userId, role: "user", content: storedPrompt } });
    const am = await prisma.message.create({ data: { conversationId: conv.id, userId, role: "assistant", content: "", status: "streaming" } });
    await prisma.conversation.update({ where: { id: conv.id }, data: { updatedAt: new Date() } });

    let job;
    try {
      job = await queueVideo(prompt, req.signal, fetch, imageUrl);
    } catch (e) {
      await settle(reservationId, false, am.id);
      await prisma.message.update({ where: { id: am.id }, data: { status: "error", content: "" } }).catch(() => {});
      return jerr(502, "provider_unavailable", e instanceof ProviderUnavailable ? e.message : "Video generation is unavailable right now.");
    }
    // The job lives in the message itself, so a reload, another device or the status poll can finish it.
    const pending = videoContent(am.id, job, { pending: true });
    await prisma.message.update({ where: { id: am.id }, data: { content: pending } });
    await settle(reservationId, true, am.id); // queued = billed by the provider

    const ac = new AbortController();
    req.signal.addEventListener("abort", () => ac.abort(), { once: true });
    const enc = new TextEncoder();
    const send = (c: ReadableStreamDefaultController, event: string, data: unknown) => {
      try { c.enqueue(enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)); } catch { /* client gone */ }
    };
    const stream = new ReadableStream({
      async start(c) {
        send(c, "meta", { conversationId: conv.id, userMessageId: um.id, assistantMessageId: am.id, title: conv.title });
        send(c, "delta", { text: pending });
        send(c, "status", { detail: `Rendering a 5-second clip (about $${quote.toFixed(2)})…` });
        const deadline = Date.now() + STREAM_WAIT_MS;
        let final: string | null = null;
        let failed = false;
        while (!ac.signal.aborted && Date.now() < deadline) {
          await sleep(POLL_MS, ac.signal);
          if (ac.signal.aborted) break;
          const r = await finalizeVideo({ userId, messageId: am.id }).catch(() => ({ status: "error" as const }));
          if (r.status === "ready") { final = r.content ?? null; break; }
          if (r.status === "error" || r.status === "not_found") { failed = true; break; }
        }
        if (final) {
          send(c, "replace", { text: final });
          send(c, "done", { usage: await getUsage(userId) });
        } else if (failed) {
          send(c, "error", { code: "provider_unavailable", message: "The video service couldn't finish this video." });
        } else {
          // Still rendering: the message keeps the job; the chat's player polls /api/videos/<id>?status=1.
          send(c, "done", { usage: await getUsage(userId), pending: true });
        }
        try { c.close(); } catch { /* closed */ }
      },
      cancel() { ac.abort(); },
    });
    return new Response(stream, { headers: { "content-type": "text/event-stream; charset=utf-8", "cache-control": "no-cache, no-transform", "x-accel-buffering": "no" } });
  } catch (e) {
    await settle(reservationId, false);
    console.error("[video] internal error", (e as Error).name);
    return jerr(500, "internal", "Something went wrong.");
  }
}
