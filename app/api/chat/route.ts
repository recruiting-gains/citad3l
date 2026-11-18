import { z } from "zod";
import { requireUserId } from "@/auth";
import { prisma } from "@/lib/db";
import { jerr } from "@/lib/http";
import { MAX_MESSAGE_CHARS } from "@/lib/config";
import { rateLimit } from "@/lib/ratelimit";
import { reserve, settle, getUsage, UsageError } from "@/lib/usage";
import { getProvider, ProviderUnavailable } from "@/lib/inference";
import { buildTurns, titleFrom } from "@/lib/prompt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  conversationId: z.string().max(40).optional().nullable(),
  projectId: z.string().max(40).optional().nullable(),
  message: z.string().max(MAX_MESSAGE_CHARS * 2),
  retryAssistantMessageId: z.string().max(40).optional().nullable(),
});

export async function POST(req: Request) {
  const userId = await requireUserId();
  if (!userId) return jerr(401, "unauthorized", "Sign in to chat.");

  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > 64_000) return jerr(413, "too_large", "Request too large.");
  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch {
    return jerr(400, "bad_request", "Invalid request.");
  }
  const message = body.message.trim();
  if (message.length > MAX_MESSAGE_CHARS) return jerr(413, "too_large", `Messages are limited to ${MAX_MESSAGE_CHARS.toLocaleString()} characters.`);
  if (!body.retryAssistantMessageId && !message) return jerr(400, "bad_request", "Message is empty.");
  if (!rateLimit(`chat:${userId}`)) return jerr(429, "rate_limited", "Slow down — too many messages this minute.");

  // ---- ownership checks ----
  let conversation = body.conversationId
    ? await prisma.conversation.findFirst({ where: { id: body.conversationId, userId }, include: { project: true } })
    : null;
  if (body.conversationId && !conversation) return jerr(404, "not_found", "Conversation not found.");
  let projectInstructions = conversation?.project?.instructions ?? null;
  if (!conversation && body.projectId) {
    const p = await prisma.project.findFirst({ where: { id: body.projectId, userId } });
    if (!p) return jerr(404, "not_found", "Project not found.");
    projectInstructions = p.instructions;
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

  let provider;
  try {
    provider = getProvider();
  } catch (e) {
    return jerr(503, "provider_unavailable", (e as Error).message);
  }

  // ---- atomic usage reservation ----
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
        data: { userId, projectId: body.projectId ?? null, title: titleFrom(message) },
        include: { project: true },
      });
    }
    let userMessageId = "";
    let assistantId: string;
    if (retryTarget) {
      await prisma.message.update({ where: { id: retryTarget.id }, data: { content: "", status: "streaming" } });
      assistantId = retryTarget.id;
    } else {
      const um = await prisma.message.create({ data: { conversationId: conversation.id, userId, role: "user", content: message } });
      userMessageId = um.id;
      const am = await prisma.message.create({ data: { conversationId: conversation.id, userId, role: "assistant", content: "", status: "streaming" } });
      assistantId = am.id;
    }
    await prisma.conversation.update({ where: { id: conversation.id }, data: { updatedAt: new Date() } });

    const prior = await prisma.message.findMany({
      where: { conversationId: conversation.id, id: { not: assistantId }, ...(retryTarget ? { createdAt: { lt: retryTarget.createdAt } } : {}) },
      orderBy: { createdAt: "asc" },
      select: { role: true, content: true, status: true },
    });
    const history = prior.filter((m) => m.role === "user" || m.status === "complete");
    const turns = buildTurns(history, projectInstructions);

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
          for await (const t of provider.stream(turns, ac.signal)) {
            text += t;
            send(c, "delta", { text: t });
          }
          if (!text.trim()) { outcome = "error"; errMsg = "The engine returned an empty reply."; }
        } catch (e) {
          if (ac.signal.aborted) outcome = "stopped";
          else { outcome = "error"; errMsg = e instanceof ProviderUnavailable ? "The inference engine is unavailable right now." : "Something went wrong generating this reply."; }
        }
        // Only successful replies are charged. No prompt/response content is logged.
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
    console.error("[chat] internal error", (e as Error).name);
    return jerr(500, "internal", "Something went wrong.");
  }
}
