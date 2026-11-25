import "server-only";
import { MAX_AUTO_CONTINUATIONS, SWARM_MAX_WORKERS } from "../config";

export const SWARM_PLAN_TOKENS = 500;
export const SWARM_WORKER_TOKENS = 2048;
export const SWARM_SYNTH_TOKENS = 6144;
const SWARM_CTX_CHARS = 8000;
const SWARM_WORKER_CHARS = 16000;
const clip = <T extends { content: string }>(t: T): T => ({ ...t, content: t.content.slice(0, SWARM_CTX_CHARS) });
import { checkText } from "../filter";
import { completeText, getProvider, ProviderUnavailable, type ChatTurn } from "./index";
import { streamWithAutoContinue } from "./continue";

export const PLAN_SYSTEM = `You are planning work for a swarm of assistants. Break the user's request into 2 or 3 short, concrete subtasks that can be done in parallel. Reply with JSON only, no markdown, in this exact shape: {"subtasks":["...","..."]}
Each subtask is one sentence. Do not answer the user yet.`;

export type SwarmStatus = {
  phase: "planning" | "workers" | "synthesizing" | "continuing" | "fallback";
  detail: string;
  continuations?: number;
};

export function parseSubtasks(raw: string, cap = SWARM_MAX_WORKERS): string[] {
  const m = raw.match(/\{[\s\S]*\}/);
  if (!m) return [];
  try {
    const j = JSON.parse(m[0]) as { subtasks?: unknown };
    if (!Array.isArray(j.subtasks)) return [];
    return j.subtasks
      .map((s) => String(s).trim())
      .filter(Boolean)
      .slice(0, cap);
  } catch {
    return [];
  }
}

function contextBlock(history: ChatTurn[]): string {
  const recent = history.filter((m) => m.role === "user" || m.role === "assistant").slice(-6);
  if (!recent.length) return "";
  return recent.map((m) => `${m.role}: ${m.content.slice(0, SWARM_CTX_CHARS)}`).join("\n\n");
}

/**
 * V1 plans, Fast workers run up to 3 subtasks in parallel, V1 synthesizes.
 * If planning fails, falls back to a single V1 stream of the original request.
 * Worker or plan text that fails the content filter is dropped; if nothing
 * usable remains, a FilterRefusal is thrown.
 */
export class FilterRefusal extends Error {
  constructor(public messageText: string) {
    super(messageText);
    this.name = "FilterRefusal";
  }
}

export async function runSwarm(opts: {
  userMessage: string;
  history: ChatTurn[];
  signal: AbortSignal;
  onStatus?: (s: SwarmStatus) => void;
  onDelta: (text: string) => void;
}): Promise<{ text: string; usedWorkers: number; fallback: boolean; continuations: number; truncated: boolean }> {
  // Per-request cost caps: ≤3 workers (SWARM_MAX_WORKERS), and token caps on every call. Thinking and web
  // search stay off. Final synthesis allows auto-continuation up to MAX_AUTO_CONTINUATIONS on finish_reason=length.
  const v1Plan = getProvider({ modelId: "citad3l-v1", maxTokens: SWARM_PLAN_TOKENS, temperature: 0.3, thinking: false, webSearch: false });
  const v1 = getProvider({ modelId: "citad3l-v1", maxTokens: SWARM_SYNTH_TOKENS, thinking: false, webSearch: false });
  const fast = getProvider({ modelId: "citad3l-fast", maxTokens: SWARM_WORKER_TOKENS, thinking: false, webSearch: false });
  opts.onStatus?.({ phase: "planning", detail: "Citad3L V1 is planning the swarm." });

  let planRaw = "";
  try {
    planRaw = await completeText(
      v1Plan,
      [
        { role: "system", content: PLAN_SYSTEM },
        ...(opts.history.filter((t) => t.role !== "system").slice(-4).map(clip)),
        { role: "user", content: opts.userMessage },
      ],
      opts.signal,
    );
  } catch (e) {
    if (opts.signal.aborted) throw e;
    if (e instanceof ProviderUnavailable) {
      return fallbackV1(v1, opts);
    }
    throw e;
  }
  const planCheck = checkText(planRaw);
  if (!planCheck.allowed) throw new FilterRefusal(planCheck.message);
  const subtasks = parseSubtasks(planRaw);
  if (!subtasks.length) return fallbackV1(v1, opts);

  opts.onStatus?.({ phase: "workers", detail: `Citad3L Fast is running ${subtasks.length} tasks.` });
  const ctx = contextBlock(opts.history);
  const workerResults = await Promise.all(
    subtasks.map(async (task, i) => {
      const raw = await completeText(
        fast,
        [
          { role: "system", content: "You are a Citad3L Fast worker. Do only this subtask. Be concise and concrete. Do not greet the user." },
          { role: "user", content: [ctx && `Conversation so far:\n${ctx}`, `Original request:\n${opts.userMessage}`, `Subtask ${i + 1} of ${subtasks.length}:\n${task}`].filter(Boolean).join("\n\n") },
        ],
        opts.signal,
      );
      const check = checkText(raw);
      if (!check.allowed) return null;
      return { task, text: raw };
    }),
  );
  const usable = workerResults.filter((x): x is { task: string; text: string } => !!x);
  if (!usable.length) throw new FilterRefusal("This request isn't allowed.");

  opts.onStatus?.({ phase: "synthesizing", detail: "Citad3L V1 is writing the answer." });
  const synthTurns: ChatTurn[] = [
    { role: "system", content: "You are Citad3L V1. Synthesize the worker results into one clear, complete answer for the user. Use Markdown and fenced code blocks with complete code. Do not mention the swarm, workers, or that this was planned. Do not invent sources." },
    {
      role: "user",
      content: [
        `Original request:\n${opts.userMessage}`,
        ...usable.map((w, i) => `Worker ${i + 1} (${w.task}):\n${w.text.slice(0, SWARM_WORKER_CHARS)}`),
      ].join("\n\n"),
    },
  ];
  const out = await streamWithAutoContinue({
    provider: v1,
    messages: synthTurns,
    signal: opts.signal,
    maxContinuations: MAX_AUTO_CONTINUATIONS,
    checkSafety: (fullText) => {
      const check = checkText(fullText);
      if (!check.allowed) throw new FilterRefusal(check.message);
    },
    onContinue: ({ continuation, maxContinuations }) => {
      opts.onStatus?.({
        phase: "continuing",
        detail: `Continuing long reply (${continuation}/${maxContinuations})…`,
        continuations: continuation,
      });
    },
    onDelta: opts.onDelta,
  });
  if (!out.text.trim()) throw new ProviderUnavailable("The engine returned an empty reply.");
  return { text: out.text, usedWorkers: usable.length, fallback: false, continuations: out.continuations, truncated: out.truncated };
}

async function fallbackV1(
  v1: ReturnType<typeof getProvider>,
  opts: { userMessage: string; history: ChatTurn[]; signal: AbortSignal; onStatus?: (s: SwarmStatus) => void; onDelta: (text: string) => void },
): Promise<{ text: string; usedWorkers: number; fallback: boolean; continuations: number; truncated: boolean }> {
  opts.onStatus?.({ phase: "fallback", detail: "Swarm planning didn't parse; answering with Citad3L V1." });
  const turns: ChatTurn[] = [
    ...opts.history,
  ];
  if (!turns.some((t) => t.role === "user" && t.content === opts.userMessage)) {
    turns.push({ role: "user", content: opts.userMessage });
  }
  const out = await streamWithAutoContinue({
    provider: v1,
    messages: turns,
    signal: opts.signal,
    maxContinuations: MAX_AUTO_CONTINUATIONS,
    checkSafety: (fullText) => {
      const check = checkText(fullText);
      if (!check.allowed) throw new FilterRefusal(check.message);
    },
    onContinue: ({ continuation, maxContinuations }) => {
      opts.onStatus?.({
        phase: "continuing",
        detail: `Continuing long reply (${continuation}/${maxContinuations})…`,
        continuations: continuation,
      });
    },
    onDelta: opts.onDelta,
  });
  if (!out.text.trim()) throw new ProviderUnavailable("The engine returned an empty reply.");
  return { text: out.text, usedWorkers: 0, fallback: true, continuations: out.continuations, truncated: out.truncated };
}
