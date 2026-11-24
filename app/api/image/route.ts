import { z } from "zod";
import { requireUserId } from "@/auth";
import { prisma } from "@/lib/db";
import { BodyTooLarge, jerr, MAX_JSON_BYTES, readJsonLimited, tooMany } from "@/lib/http";
import { MAX_MESSAGE_CHARS } from "@/lib/config";
import { LIMITS, limitDurable, rateLimit, rule } from "@/lib/ratelimit";
import { reserve, settle, getUsage, UsageError, userIsAdmin } from "@/lib/usage";
import { ProviderUnavailable } from "@/lib/inference";
import { generateImage } from "@/lib/inference/image";
import { putGeneratedImage } from "@/lib/images-r2";
import { titleFrom } from "@/lib/prompt";
import { reviewImagePrompt } from "@/lib/filter-llm";
import { bannedMessage } from "@/lib/banned";
import { logFilterRefusal } from "@/lib/filter-log";
import { checkAccess } from "@/lib/access";
import { spendGuard } from "@/lib/spend-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  conversationId: z.string().max(40).optional().nullable(),
  projectId: z.string().max(40).optional().nullable(),
  message: z.string().max(MAX_MESSAGE_CHARS * 2),
  model: z.string().max(40).optional().nullable(),
  retryAssistantMessageId: z.string().max(40).optional().nullable(),
});

export async function POST(req: Request) {
  const userId = await requireUserId();
  if (!userId) return jerr(401, "unauthorized", "Sign in to generate images.");
  // Citad3L Image: active Pro or Max plan (admins always), checked here on the server for every request.
  const denied = await checkAccess(userId, "citad3l-image");
  if (denied) return jerr(denied.status, denied.code, denied.message, { upgrade: "/pricing" });
  const admin = await userIsAdmin(userId);
  const suspended = await bannedMessage(userId);
  if (suspended) return jerr(403, "suspended", suspended);

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await readJsonLimited(req, MAX_JSON_BYTES));
  } catch (e) {
    if (e instanceof BodyTooLarge) return jerr(413, "too_large", "Request too large.");
    return jerr(400, "bad_request", "Invalid request.");
  }
  const message = body.message.trim();
  if (message.length > MAX_MESSAGE_CHARS) return jerr(413, "too_large", `Messages are limited to ${MAX_MESSAGE_CHARS.toLocaleString()} characters.`);
  if (!body.retryAssistantMessageId && !message) return jerr(400, "bad_request", "Message is empty.");
  if (!rateLimit(`image:${userId}`)) return tooMany("Slow down — too many images this minute.");
  const lim = await limitDurable([rule(LIMITS.imageUserMin, userId), rule(LIMITS.imageUserHour, userId)]);
  if (!lim.ok) return tooMany("Slow down — too many images right now.", lim.retryAfterSec);

  let conversation = body.conversationId
    ? await prisma.conversation.findFirst({ where: { id: body.conversationId, userId }, include: { project: true } })
    : null;
  if (body.conversationId && !conversation) return jerr(404, "not_found", "Conversation not found.");
  if (!conversation && body.projectId) {
    const p = await prisma.project.findFirst({ where: { id: body.projectId, userId } });
    if (!p) return jerr(404, "not_found", "Project not found.");
  }
  let retryTarget: { id: string; createdAt: Date } | null = null;
  if (body.retryAssistantMessageId) {
    if (!conversation) return jerr(400, "bad_request", "Retry needs a conversation.");
    retryTarget = await prisma.message.findFirst({
      where: { id: body.retryAssistantMessageId, conversationId: conversation.id, userId, role: "assistant" },
      select: { id: true, createdAt: true },
    });
    if (!retryTarget) return jerr(404, "not_found", "Message not found.");
  }

  let prompt = message;
  if (retryTarget && conversation && !prompt) {
    const priorUser = await prisma.message.findFirst({
      where: { conversationId: conversation.id, userId, role: "user", createdAt: { lt: retryTarget.createdAt } },
      orderBy: { createdAt: "desc" },
      select: { content: true },
    });
    prompt = priorUser?.content ?? "";
  }
  if (!prompt) return jerr(400, "bad_request", "Message is empty.");

  const inputFilter = await reviewImagePrompt(prompt, req.signal);
  if (!inputFilter.allowed) {
    await logFilterRefusal({ userId, direction: "input", verdict: inputFilter, modelId: "citad3l-image" });
    return jerr(400, "content_policy", inputFilter.message);
  }

  // Daily image caps (per user + global) protect the shared provider key. Counted only once the prompt passed the filter.
  const capped = await spendGuard("image", userId, { admin });
  if (capped) return jerr(capped.status, capped.code, capped.message, { retryAfterSec: capped.retryAfterSec });

  let reservationId: string;
  try {
    ({ reservationId } = await reserve(userId, 1));
  } catch (e) {
    if (e instanceof UsageError) {
      const usage = await getUsage(userId);
      return jerr(e.code === "busy" ? 429 : 402, e.code, e.message, { usage });
    }
    throw e;
  }

  try {
    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: { userId, projectId: body.projectId ?? null, title: titleFrom(prompt) },
        include: { project: true },
      });
    }
    let userMessageId = "";
    let assistantId: string;
    if (retryTarget) {
      await prisma.message.update({ where: { id: retryTarget.id }, data: { content: "", status: "streaming" } });
      assistantId = retryTarget.id;
    } else {
      const um = await prisma.message.create({ data: { conversationId: conversation.id, userId, role: "user", content: prompt } });
      userMessageId = um.id;
      const am = await prisma.message.create({ data: { conversationId: conversation.id, userId, role: "assistant", content: "", status: "streaming" } });
      assistantId = am.id;
    }
    await prisma.conversation.update({ where: { id: conversation.id }, data: { updatedAt: new Date() } });

    const conv = conversation;
    const ac = new AbortController();
    req.signal.addEventListener("abort", () => ac.abort(), { once: true });
    const enc = new TextEncoder();
    const send = (c: ReadableStreamDefaultController, event: string, data: unknown) => {
      try { c.enqueue(enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)); } catch { /* client gone */ }
    };

    const stream = new ReadableStream({
      async start(c) {
        send(c, "meta", { conversationId: conv.id, userMessageId, assistantMessageId: assistantId, title: conv.title });
        let text = "";
        let outcome: "complete" | "stopped" | "error" = "complete";
        let errMsg = "";
        try {
          const image = await generateImage(prompt, ac.signal);
          text = image.markdown;
          // Prefer R2 when the binding is present so Neon does not store ~340 KB data URIs.
          if (image.bytes && !image.mock) {
            const stored = await putGeneratedImage({ userId, messageId: assistantId, bytes: image.bytes, mime: image.mime }).catch(() => null);
            if (stored) text = stored.markdown;
          }
          send(c, "delta", { text });
        } catch (e) {
          if (ac.signal.aborted) outcome = "stopped";
          else {
            outcome = "error";
            errMsg = e instanceof ProviderUnavailable ? "Image generation is unavailable right now." : "Something went wrong generating this image.";
          }
        }
        await settle(reservationId, outcome === "complete", assistantId);
        await prisma.message.update({ where: { id: assistantId }, data: { content: text, status: outcome } }).catch(() => {});
        const usage = await getUsage(userId);
        if (outcome === "complete") send(c, "done", { usage });
        else if (outcome === "error") send(c, "error", { code: "provider_unavailable", message: errMsg, usage });
        try { c.close(); } catch { /* closed */ }
      },
      cancel() { ac.abort(); },
    });
    return new Response(stream, {
      headers: { "content-type": "text/event-stream; charset=utf-8", "cache-control": "no-cache, no-transform", "x-accel-buffering": "no" },
    });
  } catch (e) {
    await settle(reservationId, false);
    console.error("[image] internal error", (e as Error).name);
    return jerr(500, "internal", "Something went wrong.");
  }
}
