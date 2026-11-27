import { z } from "zod";
import { requireUserId } from "@/auth";
import { prisma } from "@/lib/db";
import { BodyTooLarge, jerr, readJsonLimited, tooMany } from "@/lib/http";
import { attachCaps, checkAttachments, composeMessage, MAX_CHAT_JSON_BYTES, MAX_FILE_CHARS, MAX_IMAGE_DATA_URL_CHARS } from "@/lib/attachments";
import {
  FREE_MESSAGES,
  GUEST_GLOBAL_DAILY_CAP,
  GUEST_HISTORY_CHAR_BUDGET,
  GUEST_MAX_MESSAGE_CHARS,
  GUEST_MODEL_ID,
  guestChatEnabled,
  GUEST_MAX_TOKENS,
  GUEST_RATE_LIMIT_PER_MINUTE,
  MAX_AUTO_CONTINUATIONS,
  MAX_MESSAGE_CHARS,
  SWARM_UNITS,
  canUseSwarmWebSearch,
} from "@/lib/config";
import { LIMITS, limitDurable, rateLimit, rule } from "@/lib/ratelimit";
import { reserve, settle, getUsage, UsageError, userIsAdmin, userEmail } from "@/lib/usage";
import { getProvider, ProviderUnavailable } from "@/lib/inference";
import { SignInRequired, resolveModel, UnknownModel } from "@/lib/inference/provider-models";
import { checkAccess } from "@/lib/access";
import { spendGuard } from "@/lib/spend-guard";
import { FilterRefusal, runSwarm } from "@/lib/inference/swarm";
import { streamWithAutoContinue } from "@/lib/inference/continue";
import { buildTurns, designFormatFor, titleFrom, wantsGraphicsGuide } from "@/lib/prompt";
import { critiqueAndFix } from "@/lib/design-check";
import { DESIGN_CHECK_MAX_MS, DISCONNECT_GRACE_MS, HEARTBEAT_MS, STOP_POLL_MS, keepReplyAlive, timeoutSignal } from "@/lib/reply-lifeline";
import { shouldCritique } from "@/lib/design-lint";
import { imagePromptPlanFor } from "@/lib/image-prompt";
import { noteImagePromptReply } from "@/lib/image-prompt-count";
import { checkText, checkTexts } from "@/lib/filter";
import { reviewOrKeyword } from "@/lib/filter-llm";
import { logFilterRefusal } from "@/lib/filter-log";
import { getPublicModel, isGuestModelId } from "@/lib/models";
import { resolveSkills } from "@/lib/skills";
import { canUseModelSettings, getModelSettings } from "@/lib/model-settings";
import { loadActiveInstructions } from "@/lib/custom-instructions";
import { bannedMessage } from "@/lib/banned";
import {
  clientIp,
  GuestError,
  guestUsageSummary,
  readGuestCookieHeader,
  reserveGuest,
  serializeGuestCookie,
  settleGuest,
  type GuestState,
} from "@/lib/guest";
import { guestStore } from "@/lib/guest-store";
import { COMPUTER_CHAT_CODE, computerChatRefusal } from "@/lib/computer/chat-guard";
import { maybeCreateAutoExports } from "@/lib/exports-r2";
import { readUtmCookieHeader, utmMetadata } from "@/lib/utm";
import { recordGuestStart } from "@/lib/source-tracking";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  conversationId: z.string().max(40).optional().nullable(),
  projectId: z.string().max(40).optional().nullable(),
  message: z.string().max(MAX_MESSAGE_CHARS * 2),
  model: z.string().max(40).optional().nullable(),
  retryAssistantMessageId: z.string().max(40).optional().nullable(),
  swarm: z.boolean().optional(),
  skills: z.object({
    webSearch: z.boolean().optional(),
    thinking: z.boolean().optional(),
    coding: z.boolean().optional(),
  }).optional(),
  attachments: z.array(z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("image"), name: z.string().max(200), dataUrl: z.string().max(MAX_IMAGE_DATA_URL_CHARS) }),
    z.object({ kind: z.literal("file"), name: z.string().max(200), text: z.string().max(MAX_FILE_CHARS) }),
  ])).max(8).optional(),
  history: z.array(z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string().max(MAX_MESSAGE_CHARS),
  })).max(20).optional(),
});

function cookieHeader(state: GuestState): Record<string, string> {
  return { "Set-Cookie": serializeGuestCookie({ id: state.id, used: state.used, reserved: 0 }) };
}

export async function POST(req: Request) {
  const userId = await requireUserId();

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await readJsonLimited(req, MAX_CHAT_JSON_BYTES));
  } catch (e) {
    if (e instanceof BodyTooLarge) return jerr(413, "too_large", "That message is too large to send. Try fewer or smaller attachments.");
    return jerr(400, "bad_request", "Invalid request.");
  }
  const message = body.message.trim();
  if (!body.retryAssistantMessageId && !message && !body.attachments?.length) return jerr(400, "bad_request", "Message is empty.");

  // Keyword hard lines are decided before model resolution, so a blocked message still gets a clear
  // explanation even if inference is not configured. The later reviewOrKeyword pass also covers
  // attachments and the optional AI check.
  if (message) {
    const early = checkText(message);
    if (!early.allowed) {
      const cookie = readGuestCookieHeader(req.headers.get("cookie"));
      await logFilterRefusal({ userId: userId ?? undefined, guestId: cookie?.id, direction: "input", verdict: early });
      return jerr(400, "content_policy", early.message);
    }
  }

  // "@computer …" never goes to a chat model (it would claim it can't and make up results). Retries are checked
  // again below once the original user message is loaded.
  if (computerChatRefusal(message, false)) {
    const admin = userId ? await userIsAdmin(userId).catch(() => false) : false;
    return jerr(409, COMPUTER_CHAT_CODE, computerChatRefusal(message, admin)!, admin ? { task: message } : {});
  }
  if (!userId) return guestChat(req, body, message);
  return signedInChat(req, userId, body, message);
}

async function signedInChat(req: Request, userId: string, body: z.infer<typeof Body>, typed: string) {
  let message = typed;
  const suspended = await bannedMessage(userId);
  if (suspended) return jerr(403, "suspended", suspended);

  if (typed.length > MAX_MESSAGE_CHARS) return jerr(413, "too_large", `Messages are limited to ${MAX_MESSAGE_CHARS.toLocaleString()} characters.`);
  if (!rateLimit(`chat:${userId}`)) return tooMany("Slow down — too many messages this minute.");
  const lim = await limitDurable([rule(LIMITS.chatUserMin, userId), rule(LIMITS.chatUserHour, userId)], { onDbError: "memory" });
  if (!lim.ok) return tooMany("Slow down — too many messages right now.", lim.retryAfterSec);

  // Admin = ADMIN_EMAILS match on the signed-in user's stored email (server-side). Plan rules (lib/access.ts):
  // Private and Swarm = any signed-in account; Image = Pro/Max; Video = Max. Enforced here whatever the client sends.
  const admin = await userIsAdmin(userId);
  let resolved;
  try {
    resolved = resolveModel(body.model, { signedIn: true, admin });
  } catch (e) {
    if (e instanceof SignInRequired) return jerr(401, "signup_required", e.message);
    if (e instanceof UnknownModel) return jerr(400, "bad_request", e.message);
    throw e;
  }
  if (resolved.modality !== "chat") {
    return jerr(400, "bad_request", `${resolved.name} isn't available in chat. Use the ${resolved.modality} endpoint.`);
  }
  const deniedModel = await checkAccess(userId, resolved.publicId);
  if (deniedModel) return jerr(deniedModel.status, deniedModel.code, deniedModel.message, { upgrade: "/pricing" });
  const swarm = body.swarm === true;
  if (swarm) {
    const deniedSwarm = await checkAccess(userId, "swarm");
    if (deniedSwarm) return jerr(deniedSwarm.status, deniedSwarm.code, deniedSwarm.message);
  }
  // Swarm fans out to V1 + Fast, which are not E2EE, so it can't run on Private.
  if (swarm && resolved.requiresClientE2EE) return jerr(400, "bad_request", "Swarm isn't available with Citad3L Private.");
  const pub = getPublicModel(resolved.publicId);
  const swarmWebSearch = swarm && canUseSwarmWebSearch(await userEmail(userId));
  const skills = resolveSkills(pub, body.skills, { swarm, swarmWebSearch });
  // Attachments: images only on vision models (V1, Fast); files on any non-Private chat model; ignored on retries
  // (the stored message already carries the file text).
  const att = body.retryAssistantMessageId ? null : checkAttachments(body.attachments, attachCaps(pub), { swarm, modelName: resolved.name });
  if (att && !att.ok) return jerr(att.status, att.code, att.message);
  const attImages = att?.ok ? att.images : [];
  if (body.attachments?.length && !body.retryAssistantMessageId) message = composeMessage(message, body.attachments);
  const usageNow = await getUsage(userId);
  const privileged = usageNow.admin === true || usageNow.owner === true || admin;
  const [settings, customInstructions] = await Promise.all([
    canUseModelSettings(usageNow.plan, privileged) ? getModelSettings(userId, resolved.publicId) : Promise.resolve(null),
    // Account-wide custom instructions (signed-in only; null when off or empty). Never logged.
    loadActiveInstructions(userId),
  ]);

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

  let prompt = message;
  if (retryTarget && conversation) {
    const priorUser = await prisma.message.findFirst({
      where: { conversationId: conversation.id, userId, role: "user", createdAt: { lt: retryTarget.createdAt } },
      orderBy: { createdAt: "desc" },
      select: { content: true },
    });
    prompt = priorUser?.content ?? message;
    if (computerChatRefusal(prompt, false)) {
      const admin = await userIsAdmin(userId).catch(() => false);
      return jerr(409, COMPUTER_CHAT_CODE, computerChatRefusal(prompt, admin)!, admin ? { task: prompt } : {});
    }
  }
  // The filter sees everything the model will see that the user controls: the new message, their saved custom
  // instructions, their custom system prompt and the project instructions (full review), plus every earlier turn of
  // this chat (keyword check).
  const steering = [customInstructions, settings?.systemPrompt, projectInstructions].filter((t): t is string => !!t && !!t.trim());
  const inputFilter = await reviewOrKeyword([...steering, prompt].join("\n\n"), req.signal, { privateMode: resolved.requiresClientE2EE });
  if (!inputFilter.allowed) {
    await logFilterRefusal({ userId, direction: "input", verdict: inputFilter, modelId: resolved.publicId });
    return jerr(400, "content_policy", inputFilter.message);
  }
  if (conversation) {
    const earlier = await prisma.message.findMany({
      where: { conversationId: conversation.id, ...(retryTarget ? { createdAt: { lt: retryTarget.createdAt } } : {}) },
      orderBy: { createdAt: "asc" },
      select: { content: true },
    });
    const historyFilter = checkTexts(earlier.map((m) => m.content));
    if (!historyFilter.allowed) {
      await logFilterRefusal({ userId, direction: "input", verdict: historyFilter, modelId: resolved.publicId });
      return jerr(400, "content_policy", historyFilter.message);
    }
  }

  let provider;
  try {
    provider = getProvider({
      modelId: resolved.publicId,
      temperature: settings?.temperature,
      maxTokens: settings?.maxTokens,
      webSearch: skills.webSearch,
      thinking: skills.thinking,
    });
  } catch (e) {
    return jerr(503, "provider_unavailable", (e as Error).message);
  }

  if (swarm) {
    const capped = await spendGuard("swarm", userId, { admin });
    if (capped) return jerr(capped.status, capped.code, capped.message, { retryAfterSec: capped.retryAfterSec });
  }
  const units = swarm ? SWARM_UNITS : 1;
  let reservationId: string;
  try {
    ({ reservationId } = await reserve(userId, units));
  } catch (e) {
    if (e instanceof UsageError) {
      const usage = await getUsage(userId);
      const msg = swarm && e.code === "limit_reached"
        ? `Swarm mode uses ${SWARM_UNITS} replies of allowance. You don't have enough left.`
        : e.message;
      return jerr(e.code === "busy" ? 429 : 402, e.code, msg, { usage });
    }
    throw e;
  }

  try {
    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: { userId, projectId: body.projectId ?? null, title: titleFrom(typed || body.attachments?.[0]?.name || prompt) },
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
    const turns = buildTurns(history, projectInstructions, resolved.name, {
      coding: skills.coding,
      customSystem: settings?.systemPrompt,
      customInstructions,
    });
    const graphicsTurn = !resolved.requiresClientE2EE && wantsGraphicsGuide(history);
    const lastTurn = turns[turns.length - 1];
    if (attImages.length && lastTurn?.role === "user") lastTurn.images = attImages;

    const conv = conversation;
    const ac = new AbortController();
    const enc = new TextEncoder();
    // A phone can drop the connection mid-reply (app switch, screen lock, network blip). The reply keeps going in the
    // background and is saved so the app can pick it up (lib/reply-lifeline.ts). It ends early only on an explicit
    // Stop (POST /api/chat/stop) or when the disconnect grace runs out (then the partial is saved, not charged).
    let ctrl: ReadableStreamDefaultController | null = null;
    let gone = false; // the response stream was cancelled or a write failed: nobody is reading any more
    let signalAborted = false; // req.signal fired (logged only: it is not proof the reader is gone)
    let stopRequested = false;
    let graceTimer: ReturnType<typeof setTimeout> | undefined;
    const onGone = () => {
      if (gone) return;
      gone = true;
      ctrl = null;
      graceTimer = setTimeout(() => ac.abort(), DISCONNECT_GRACE_MS);
    };
    // Before 2026-11-27 this aborted the model: any abort on the request signal ended the reply with no final
    // event, which the app shows as "Connection lost". Now only a failed write or a cancelled stream counts.
    req.signal.addEventListener("abort", () => { signalAborted = true; }, { once: true });
    const write = (chunk: string) => {
      if (!ctrl) return;
      try { ctrl.enqueue(enc.encode(chunk)); } catch { onGone(); }
    };
    const send = (event: string, data: unknown) => write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    const heartbeat = setInterval(() => write(": ping\n\n"), HEARTBEAT_MS);
    // Stop: the Stop button marks the message "stopped" (POST /api/chat/stop). Checked from inside the reply's own
    // flow (throttled on each delta, and before the design check and the final save): DB calls from timer callbacks
    // did not work on Workers in the preview test.
    let lastStopCheck = Date.now();
    let stopCheckFailed = false;
    const checkStop = async () => {
      lastStopCheck = Date.now();
      try {
        // now() keeps a Hyperdrive query cache (on in some previews) from answering with a stale "streaming".
        const rows = await prisma.$queryRaw<{ status: string }[]>`SELECT "status"::text AS status, now() AS checked_at FROM "Message" WHERE "id" = ${assistantId}`;
        if (rows[0]?.status === "stopped") { stopRequested = true; ac.abort(); }
      } catch (e) {
        if (!stopCheckFailed) console.error("[chat] stop check failed", (e as Error).name);
        stopCheckFailed = true;
      }
    };
    const maybeCheckStop = () => { if (!stopRequested && Date.now() - lastStopCheck >= STOP_POLL_MS) void checkStop(); };

    const stream = new ReadableStream({
      start(c) { ctrl = c; },
      cancel() { onGone(); },
    });
    const work = (async () => {
        send("meta", { conversationId: conv.id, userMessageId, assistantMessageId: assistantId, title: conv.title, swarm: swarm || undefined });
        let text = "";
        let continuations = 0;
        let truncated = false;
        let outcome: "complete" | "stopped" | "error" | "refused" = "complete";
        let errMsg = "";
        try {
          if (swarm) {
            const result = await runSwarm({
              userMessage: prompt,
              history: turns,
              signal: ac.signal,
              webSearch: skills.webSearch,
              onStatus: (s) => send("status", s),
              onDelta: (t) => {
                text += t;
                send("delta", { text: t });
                maybeCheckStop();
              },
            });
            if (!text) text = result.text;
            continuations = result.continuations;
            truncated = result.truncated;
          } else {
            const result = await streamWithAutoContinue({
              provider,
              messages: turns,
              signal: ac.signal,
              maxContinuations: MAX_AUTO_CONTINUATIONS,
              checkSafety: async (fullText) => {
                const out = checkText(fullText);
                if (!out.allowed) {
                  await logFilterRefusal({ userId, direction: "output", verdict: out, modelId: resolved.publicId });
                  throw new FilterRefusal(out.message);
                }
              },
              onContinue: ({ continuation, maxContinuations }) => {
                send("status", {
                  phase: "continuing",
                  detail: `Continuing long reply (${continuation}/${maxContinuations})…`,
                  continuations: continuation,
                });
              },
              onDelta: (t) => {
                text += t;
                send("delta", { text: t });
                maybeCheckStop();
              },
            });
            if (!text) text = result.text;
            continuations = result.continuations;
            truncated = result.truncated;
          }
          if (!text.trim()) {
            outcome = "error";
            errMsg = "The engine returned an empty reply.";
          } else {
            // Design self-check: grade the finished graphic and, if it breaks the layout rules, fix it once.
            await checkStop();
            if (graphicsTurn && !ac.signal.aborted && shouldCritique(text)) {
              send("status", { phase: "design-check", detail: "Checking the design…" });
              const fixer = getProvider({ modelId: resolved.publicId, maxTokens: settings?.maxTokens });
              // Capped: on timeout or a dropped connection's grace running out, the original reply is kept as is.
              const capped = timeoutSignal(ac.signal, DESIGN_CHECK_MAX_MS);
              const checked = await critiqueAndFix({ text, format: designFormatFor(history), complete: (m) => fixer.complete(m, capped.signal) })
                .finally(capped.clear);
              if (checked.changed && checkText(checked.text).allowed) {
                text = checked.text;
                send("replace", { text });
              }
            }
            const exported = await maybeCreateAutoExports({
              userId,
              swarm,
              title: conv.title,
              userMessage: prompt,
              assistantText: text,
            });
            if (exported) {
              text += exported.footer;
              send("delta", { text: exported.footer });
              send("exports", exported.bundle);
            }
          }
        } catch (e) {
          if (e instanceof FilterRefusal) {
            outcome = "refused";
            errMsg = e.messageText;
            text = e.messageText;
            const cat = (e as FilterRefusal & { category?: "csam" | "explosives" | "adult_sexual" }).category;
            if (cat) await logFilterRefusal({ userId, direction: "output", verdict: { allowed: false, category: cat, message: e.messageText }, modelId: resolved.publicId });
          } else if (ac.signal.aborted) outcome = "stopped";
          else { outcome = "error"; errMsg = e instanceof ProviderUnavailable ? "The inference engine is unavailable right now." : "Something went wrong generating this reply."; }
        }
        // The user pressed Stop: never charge, even if the text happened to finish first.
        if (!stopRequested && outcome === "complete") await checkStop();
        if (stopRequested && outcome === "complete") outcome = "stopped";
        try {
          // Successful replies are charged. Filter refusals, stops, and errors are not.
          // No prompt/response content is logged.
          await settle(reservationId, outcome === "complete", assistantId);
          await prisma.message.update({ where: { id: assistantId }, data: { content: text, status: outcome === "refused" ? "complete" : outcome } }).catch(() => {});
          // Count a finished reply that included an image-prompt card. Prompt text is not stored.
          await noteImagePromptReply(text, imagePromptPlanFor(usageNow.plan)).catch(() => false);
          const usage = await getUsage(userId).catch(() => undefined);
          if (outcome === "complete") send("done", { usage, ...(continuations > 0 ? { continuations } : {}), ...(truncated ? { truncated: true } : {}) });
          else if (outcome === "refused") send("refused", { message: errMsg || text, usage });
          else if (outcome === "error") send("error", { code: "provider_unavailable", message: errMsg, usage });
          // Never end a stream silently: the app reads a missing final event as "Connection lost".
          else if (outcome === "stopped") send("error", { code: "interrupted", message: "This reply was stopped before it finished. You weren't charged.", usage });
        } catch (e) {
          console.error("[chat] finalize failed", (e as Error).name);
          send("error", { code: "internal", message: "Something went wrong saving this reply." });
        } finally {
          clearInterval(heartbeat);
          clearTimeout(graceTimer);
          // Shape only, never content: lets a "Connection lost" report be matched to what the server saw.
          console.info("[chat] reply end", JSON.stringify({ outcome, clientGone: gone, signalAborted, stopRequested, chars: text.length, continuations }));
          if (ctrl) { try { (ctrl as ReadableStreamDefaultController).close(); } catch { /* closed */ } }
          ctrl = null;
        }
    })();
    void keepReplyAlive(work);
    return new Response(stream, {
      headers: { "content-type": "text/event-stream; charset=utf-8", "cache-control": "no-cache, no-transform", "x-accel-buffering": "no" },
    });
  } catch (e) {
    await settle(reservationId, false);
    console.error("[chat] internal error", (e as Error).name);
    return jerr(500, "internal", "Something went wrong.");
  }
}

async function guestChat(req: Request, body: z.infer<typeof Body>, message: string) {
  if (!guestChatEnabled()) return jerr(401, "signup_required", "Free messages are paused right now. Enter your email to keep chatting.");
  if (body.retryAssistantMessageId) return jerr(401, "signup_required", "Sign in to retry replies.");
  if (body.attachments?.length) return jerr(401, "signup_required", "Sign in to attach images and files.");
  if (body.swarm) return jerr(401, "signup_required", "Sign in to use Swarm mode.");
  if (message.length > GUEST_MAX_MESSAGE_CHARS) {
    return jerr(413, "too_large", `Free messages are limited to ${GUEST_MAX_MESSAGE_CHARS.toLocaleString()} characters. Create an account for longer messages.`);
  }
  const ip = clientIp(req);
  if (!rateLimit(`guest:${ip}`, GUEST_RATE_LIMIT_PER_MINUTE)) {
    return tooMany("Slow down — too many messages this minute.");
  }
  // Durable per-IP and per-guest-cookie limits (fail closed: guests cost money and have no account).
  const guestId = readGuestCookieHeader(req.headers.get("cookie"))?.id ?? "";
  const glim = await limitDurable([
    rule({ ...LIMITS.guestIpMin, limit: GUEST_RATE_LIMIT_PER_MINUTE }, ip),
    rule(LIMITS.guestIpHour, ip),
    rule(LIMITS.guestIdMin, guestId),
  ]);
  if (!glim.ok) return tooMany("Slow down — too many messages right now.", glim.retryAfterSec);

  // Guests always run on Fast. A missing model or V1 (the signed-in default) is quietly mapped to Fast; anything
  // else (Private, Image, Video, Hermes) needs an account.
  const wanted = !body.model || body.model === "citad3l-v1" ? GUEST_MODEL_ID : body.model;
  let resolved;
  try {
    resolved = resolveModel(wanted);
  } catch (e) {
    if (e instanceof SignInRequired) return jerr(401, "signup_required", "Free messages use Citad3L Fast. Create an account to use the rest of the lineup.");
    if (e instanceof UnknownModel) return jerr(400, "bad_request", e.message);
    throw e;
  }
  if (!isGuestModelId(resolved.publicId) || resolved.modality !== "chat" || resolved.requiresClientE2EE) {
    return jerr(401, "signup_required", "Free messages use Citad3L Fast. Create an account to use the rest of the lineup.");
  }

  const pub = getPublicModel(resolved.publicId);
  const skills = resolveSkills(pub, body.skills, { guest: true });

  const prompt = message;
  // Guests send their own history, so it is untrusted: the filter reviews the clipped history the model will
  // actually get together with the new message, and keyword-checks every history turn that was sent.
  const guestHistory = (body.history ?? []).filter((m) => m.content.trim());
  const guestClipped = clipGuestHistory(guestHistory);
  const keywordAll = checkTexts(guestHistory.map((m) => m.content));
  const inputFilter = keywordAll.allowed ? await reviewOrKeyword([...guestClipped.map((m) => m.content), prompt].join("\n\n"), req.signal) : keywordAll;
  if (!inputFilter.allowed) {
    const cookie = readGuestCookieHeader(req.headers.get("cookie"));
    await logFilterRefusal({ guestId: cookie?.id, direction: "input", verdict: inputFilter, modelId: resolved.publicId });
    return jerr(400, "content_policy", inputFilter.message);
  }

  let provider;
  try {
    provider = getProvider({
      modelId: resolved.publicId,
      maxTokens: GUEST_MAX_TOKENS,
      webSearch: false,
      thinking: false,
    });
  } catch (e) {
    return jerr(503, "provider_unavailable", (e as Error).message);
  }

  const store = await guestStore();
  const cookieIn = readGuestCookieHeader(req.headers.get("cookie"));
  let reserved: { state: GuestState; setCookie: boolean };
  try {
    reserved = await reserveGuest(cookieIn, ip, store);
  } catch (e) {
    if (e instanceof GuestError) {
      const used = e.code === "limit_reached" ? FREE_MESSAGES : (cookieIn?.used ?? 0);
      const usage = guestUsageSummary(used);
      return jerr(e.code === "busy" ? 429 : 402, e.code === "limit_reached" ? "signup_required" : e.code, e.message, { usage });
    }
    throw e;
  }

  // Whole-site daily guest budget (all visitors combined). Counted only once this visitor's own cookie/IP caps
  // passed, so blocked spam can't use it up. Over budget: release the reservation and ask for an email instead.
  const budget = await limitDurable([rule({ ...LIMITS.guestGlobalDay, limit: GUEST_GLOBAL_DAILY_CAP }, "all")]);
  if (!budget.ok) {
    const back = await settleGuest(reserved.state, ip, false, store);
    return jerr(401, "signup_required", "Free messages are busy right now. Enter your email to keep chatting.", { usage: guestUsageSummary(back.used) });
  }

  if (!cookieIn || cookieIn.used === 0) {
    console.info("[funnel]", JSON.stringify({ event: "guest_first_message", ...utmMetadata(readUtmCookieHeader(req.headers.get("cookie"))) }));
    await recordGuestStart(reserved.state.id, req.headers.get("cookie"));
  }
  const turns = buildTurns([...guestClipped, { role: "user", content: prompt }], null, resolved.name, { coding: skills.coding });

  const ac = new AbortController();
  req.signal.addEventListener("abort", () => ac.abort(), { once: true });
  const enc = new TextEncoder();
  const send = (c: ReadableStreamDefaultController, event: string, data: unknown) => {
    try { c.enqueue(enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)); } catch { /* client gone */ }
  };

  const stream = new ReadableStream({
    async start(c) {
      const assistantId = "guest-a";
      send(c, "meta", { conversationId: `guest-${reserved.state.id}`, userMessageId: "guest-u", assistantMessageId: assistantId, title: titleFrom(prompt), guest: true });
      let text = "";
      let outcome: "complete" | "stopped" | "error" | "refused" = "complete";
      let errMsg = "";
      try {
        for await (const t of provider.stream(turns, ac.signal)) {
          text += t;
          const out = checkText(text);
          if (!out.allowed) {
            await logFilterRefusal({ guestId: reserved.state.id, direction: "output", verdict: out, modelId: resolved.publicId });
            text = out.message;
            outcome = "refused";
            errMsg = out.message;
            break;
          }
          send(c, "delta", { text: t });
        }
        if (outcome !== "refused" && !text.trim()) { outcome = "error"; errMsg = "The engine returned an empty reply."; }
      } catch (e) {
        if (ac.signal.aborted) outcome = "stopped";
        else { outcome = "error"; errMsg = e instanceof ProviderUnavailable ? "The inference engine is unavailable right now." : "Something went wrong generating this reply."; }
      }
      const settled = await settleGuest(reserved.state, ip, outcome === "complete", store);
      // Count a finished reply that included an image-prompt card. Prompt text is not stored.
      await noteImagePromptReply(text, imagePromptPlanFor(null, true));
      const usage = guestUsageSummary(settled.used);
      if (outcome === "complete") send(c, "done", { usage });
      else if (outcome === "refused") send(c, "refused", { message: errMsg || text, usage });
      else if (outcome === "error") send(c, "error", { code: "provider_unavailable", message: errMsg, usage });
      // Never end a stream silently: the app reads a missing final event as "Connection lost".
      else if (outcome === "stopped") send(c, "error", { code: "interrupted", message: "This reply was stopped before it finished. You weren't charged.", usage });
      try { c.close(); } catch { /* closed */ }
    },
    cancel() { ac.abort(); },
  });
  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      "x-accel-buffering": "no",
      ...cookieHeader(reserved.state),
    },
  });
}

/** Newest-first clip of guest-sent history to GUEST_HISTORY_CHAR_BUDGET (always keeps at least the latest turn). */
function clipGuestHistory<T extends { content: string }>(history: T[]): T[] {
  let histChars = 0;
  const clipped: T[] = [];
  for (let i = history.length - 1; i >= 0; i--) {
    if (histChars + history[i].content.length > GUEST_HISTORY_CHAR_BUDGET && clipped.length) break;
    histChars += history[i].content.length;
    clipped.unshift(history[i]);
  }
  return clipped;
}
