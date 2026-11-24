import { z } from "zod";
import { prisma } from "@/lib/db";
import { currentUser } from "@/lib/session";
import { bannedMessage } from "@/lib/banned";
import { BodyTooLarge, jerr, MAX_JSON_BYTES, readJsonLimited, tooMany } from "@/lib/http";
import { limitDurable, rateLimit, rule } from "@/lib/ratelimit";
import { checkText } from "@/lib/filter";
import { reviewOrKeyword } from "@/lib/filter-llm";
import { logFilterRefusal } from "@/lib/filter-log";
import { titleFrom } from "@/lib/prompt";
import { MAX_MESSAGE_CHARS } from "@/lib/config";
import { sameOrigin } from "@/lib/computer/gate";
import { HERMES_BRAIN_KEYS, type HermesBrain, hermesMaxPerDay, hermesPremiumPerDay, HERMES_BRAINS, HERMES_MODEL_ID, HERMES_TITLE_PREFIX, hermesConfig, isHermesEmail, parseHermesChunk, pickBrain, toolStatus } from "@/lib/hermes";

export const dynamic = "force-dynamic";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const HISTORY_TURNS = 16;
const HISTORY_CHARS = 24_000;

const Body = z.object({
  message: z.string().max(MAX_MESSAGE_CHARS * 2),
  conversationId: z.string().max(40).optional().nullable(),
  brain: z.enum(HERMES_BRAIN_KEYS as [HermesBrain, ...HermesBrain[]]).optional().nullable(),
  retryAssistantMessageId: z.string().max(40).optional().nullable(),
});

export async function POST(req: Request) {
  const u = await currentUser();
  if (!u?.id) return jerr(401, "unauthorized", "Sign in first.");
  // Owner-only (HERMES_ALLOWED_EMAILS, default the owner). Other admins get the same 403 as everyone else.
  if (!isHermesEmail(u.email)) return jerr(403, "admin_only", "This isn't available on your account.");
  if (!sameOrigin(req)) return jerr(403, "forbidden", "Bad origin.");
  if (await bannedMessage(u.id).catch(() => null)) return jerr(403, "suspended", "Account suspended.");
  const cfg = hermesConfig();
  if (!cfg) return jerr(503, "provider_unavailable", "Hermes isn't connected yet.");

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await readJsonLimited(req, MAX_JSON_BYTES));
  } catch (e) {
    if (e instanceof BodyTooLarge) return jerr(413, "too_large", "Request too large.");
    return jerr(400, "bad_request", "Invalid request.");
  }
  // Retry: re-run the user message that came before a failed/stopped/last Hermes reply, in place (no duplicate turn).
  let retry: { am: { id: string; createdAt: Date }; um: { id: string; content: string; createdAt: Date } } | null = null;
  if (body.retryAssistantMessageId) {
    if (!body.conversationId) return jerr(400, "bad_request", "Nothing to retry.");
    const am0 = await prisma.message.findFirst({
      where: { id: body.retryAssistantMessageId, conversationId: body.conversationId, userId: u.id, role: "assistant" },
      select: { id: true, createdAt: true },
    });
    const um0 = am0
      ? await prisma.message.findFirst({
          where: { conversationId: body.conversationId, userId: u.id, role: "user", createdAt: { lte: am0.createdAt } },
          orderBy: { createdAt: "desc" },
          select: { id: true, content: true, createdAt: true },
        })
      : null;
    if (!am0 || !um0) return jerr(404, "not_found", "That reply can't be retried. Send your message again.");
    retry = { am: am0, um: um0 };
  }
  const { brain, text } = pickBrain(retry ? retry.um.content.trim() : body.message.trim(), retry ? null : body.brain);
  const message = text.trim();
  if (!message) return jerr(400, "bad_request", "Message is empty.");
  if (message.length > MAX_MESSAGE_CHARS) return jerr(413, "too_large", `Messages are limited to ${MAX_MESSAGE_CHARS.toLocaleString()} characters.`);

  if (!rateLimit(`hermes:${u.id}`, 8)) return tooMany("Slow down — too many Hermes messages this minute.");
  const rules = [rule({ name: "hermes-day", limit: hermesMaxPerDay(), windowMs: DAY }, u.id)];
  if (HERMES_BRAINS[brain].premium) rules.push(rule({ name: "hermes-premium-day", limit: hermesPremiumPerDay(), windowMs: DAY }, u.id));
  const lim = await limitDurable(rules, { onDbError: "closed" });
  if (!lim.ok) {
    return tooMany(HERMES_BRAINS[brain].premium ? `Daily limit for ${HERMES_BRAINS[brain].label} reached. Use V1 or try tomorrow.` : "Daily Hermes limit reached. Try again tomorrow.", lim.retryAfterSec);
  }

  const inputFilter = await reviewOrKeyword(message, req.signal);
  if (!inputFilter.allowed) {
    await logFilterRefusal({ userId: u.id, direction: "input", verdict: inputFilter, modelId: HERMES_MODEL_ID });
    return jerr(400, "content_policy", inputFilter.message);
  }

  let conversation = body.conversationId ? await prisma.conversation.findFirst({ where: { id: body.conversationId, userId: u.id } }) : null;
  if (body.conversationId && !conversation) return jerr(404, "not_found", "Conversation not found.");
  if (!conversation) {
    conversation = await prisma.conversation.create({ data: { userId: u.id, title: (HERMES_TITLE_PREFIX + titleFrom(message)).slice(0, 120) } });
  }
  const prior = await prisma.message.findMany({
    where: { conversationId: conversation.id, OR: [{ role: "user" }, { status: "complete" }], ...(retry ? { createdAt: { lt: retry.um.createdAt } } : {}) },
    orderBy: { createdAt: "desc" },
    take: HISTORY_TURNS,
    select: { role: true, content: true },
  });
  const history: { role: "user" | "assistant"; content: string }[] = [];
  let used = 0;
  for (const m of prior) {
    if (m.role !== "user" && m.role !== "assistant") continue;
    if (used + m.content.length > HISTORY_CHARS) break;
    used += m.content.length;
    history.unshift({ role: m.role, content: m.role === "user" ? pickBrain(m.content, "v1").text : m.content });
  }
  const um = retry
    ? { id: retry.um.id }
    : await prisma.message.create({ data: { conversationId: conversation.id, userId: u.id, role: "user", content: brain === "v1" ? message : `/${brain} ${message}` } });
  const am = retry
    ? await prisma.message.update({ where: { id: retry.am.id }, data: { content: "", status: "streaming" } })
    : await prisma.message.create({ data: { conversationId: conversation.id, userId: u.id, role: "assistant", content: "", status: "streaming" } });
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
      send(c, "meta", { conversationId: conv.id, userMessageId: um.id, assistantMessageId: am.id, title: conv.title });
      if (brain !== "v1") send(c, "status", { detail: `Hermes · ${HERMES_BRAINS[brain].label}` });
      let out = "";
      let outcome: "complete" | "stopped" | "error" | "refused" = "complete";
      let errMsg = "";
      try {
        const res = await fetch(`${cfg.url}/v1/chat/completions`, {
          method: "POST",
          signal: ac.signal,
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${cfg.key}`,
            "x-hermes-session-key": `citad3l-${conv.id}`,
          },
          body: JSON.stringify({ model: HERMES_BRAINS[brain].route, stream: true, messages: [...history, { role: "user", content: message }] }),
        });
        if (!res.ok || !res.body) throw new Error(`upstream ${res.status}`);
        const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
        let buf = "";
        outer: for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += value;
          let i: number;
          while ((i = buf.indexOf("\n\n")) >= 0) {
            const block = buf.slice(0, i);
            buf = buf.slice(i + 2);
            const data = block.split("\n").filter((l) => l.startsWith("data:")).map((l) => l.slice(5).trimStart()).join("\n");
            if (!data) continue;
            const p = parseHermesChunk(data);
            if (p.done) break outer;
            if (p.tool) send(c, "status", { detail: toolStatus(p.tool) });
            if (p.text) {
              out += p.text;
              const chk = checkText(out);
              if (!chk.allowed) {
                await logFilterRefusal({ userId: u.id, direction: "output", verdict: chk, modelId: HERMES_MODEL_ID });
                out = chk.message;
                outcome = "refused";
                errMsg = chk.message;
                ac.abort();
                break outer;
              }
              send(c, "delta", { text: p.text });
            }
          }
        }
        if (outcome === "complete" && !out.trim()) { outcome = "error"; errMsg = "Hermes returned an empty reply."; }
      } catch {
        if (outcome !== "refused") {
          if (req.signal.aborted) outcome = "stopped";
          else { outcome = "error"; errMsg = "Hermes is unavailable right now."; }
        }
      }
      await prisma.message.update({ where: { id: am.id }, data: { content: out, status: outcome === "refused" ? "complete" : outcome } }).catch(() => {});
      if (outcome === "complete") send(c, "done", {});
      else if (outcome === "refused") send(c, "refused", { message: errMsg || out });
      else if (outcome === "error") send(c, "error", { code: "provider_unavailable", message: errMsg });
      try { c.close(); } catch { /* closed */ }
    },
    cancel() { ac.abort(); },
  });
  return new Response(stream, { headers: { "content-type": "text/event-stream; charset=utf-8", "cache-control": "no-cache, no-transform", "x-accel-buffering": "no" } });
}
