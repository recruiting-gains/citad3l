import "server-only";
import type { ProviderInfo } from "../types";
import { isProd } from "../config";
import { DEFAULT_MODEL_ID, defaultModel, getPublicModel } from "../models";
import { resolveModel, providerApiKey, providerBaseUrl, providerWire } from "./provider-models";
/** Access (admin-only models) is enforced by the API route before a provider is built; this is only the id lookup. */
const ROUTE_CHECKED = { admin: true } as const;
import { E2EEError, e2eeRequest } from "./enclave";

export interface ChatTurn {
  role: "system" | "user" | "assistant";
  content: string;
  /** Data-URL images for this turn (vision models only; set by the chat route on the current user turn). */
  images?: string[];
}

/** Chat-completions wire format: a turn with images becomes [text, image_url…] parts; everything else stays a string. */
export function wireMessages(messages: ChatTurn[]) {
  return messages.map((m) =>
    m.images?.length
      ? { role: m.role, content: [{ type: "text", text: m.content || "(see attached image)" }, ...m.images.map((url) => ({ type: "image_url", image_url: { url } }))] }
      : { role: m.role, content: m.content },
  );
}
export interface InferenceProvider {
  info: ProviderInfo;
  stream(messages: ChatTurn[], signal: AbortSignal): AsyncGenerator<string>;
  complete(messages: ChatTurn[], signal: AbortSignal): Promise<string>;
}

/** Collect a full completion, preferring the non-streaming complete() path. */
export async function completeText(provider: InferenceProvider, messages: ChatTurn[], signal: AbortSignal): Promise<string> {
  return provider.complete(messages, signal);
}
export class ProviderUnavailable extends Error {}

export const ENGINE_NAME = "Citad3L V1";

export type ProviderOptions = {
  modelId?: string | null;
  temperature?: number | null;
  maxTokens?: number | null;
  webSearch?: boolean;
  thinking?: boolean;
};


function displayName(modelId?: string | null): string {
  return getPublicModel(modelId ?? DEFAULT_MODEL_ID)?.name ?? defaultModel().name;
}

/**
 * Selects the server-side provider.
 * - Mock when INFERENCE_PROVIDER=mock, or when neither the provider key nor
 *   INFERENCE_BASE_URL is set. Refused in production.
 * - The configured provider (PROVIDER_BASE_URL + key) unless INFERENCE_PROVIDER=compatible
 *   (legacy / test chat-completions adapter).
 * - Otherwise the plain chat-completions adapter at INFERENCE_BASE_URL.
 */
export function getProvider(opts: ProviderOptions = {}): InferenceProvider {
  const publicId = opts.modelId?.trim() || DEFAULT_MODEL_ID;
  const name = displayName(publicId);
  const providerKey = providerApiKey();
  const base = process.env.INFERENCE_BASE_URL;
  const forceCompatible = process.env.INFERENCE_PROVIDER === "compatible";
  // Citad3L Private: provider E2EE (attest → encrypt in the Worker → decrypt in the Worker). Never falls back to a
  // plaintext call. Dev/tests without a key use the labelled mock.
  if (getPublicModel(publicId)?.requiresClientE2EE && !forceCompatible) {
    if (providerKey && process.env.INFERENCE_PROVIDER !== "mock") {
      return enclaveProvider(providerBaseUrl(), resolveModel(publicId, ROUTE_CHECKED).providerModelId, providerKey, { label: name, model: name }, opts);
    }
    if (isProd()) throw new ProviderUnavailable(`${name} isn't configured.`);
    return mockProvider(name);
  }
  const wantMock = process.env.INFERENCE_PROVIDER === "mock" || (!providerKey && !base);
  if (wantMock) {
    if (isProd()) throw new ProviderUnavailable("Mock provider is disabled in production and no inference endpoint is configured.");
    return mockProvider(name);
  }
  if (providerKey && !forceCompatible) {
    const resolved = resolveModel(publicId, ROUTE_CHECKED);
    if (resolved.modality !== "chat") {
      throw new ProviderUnavailable(`${resolved.name} isn't available in chat yet.`);
    }
    return compatibleProvider(providerBaseUrl(), resolved.providerModelId, providerKey, { label: name, model: name }, opts);
  }
  if (base) {
    return compatibleProvider(base, process.env.INFERENCE_MODEL ?? "citad3l-v1", process.env.INFERENCE_API_KEY, { label: name, model: name }, opts);
  }
  if (isProd()) throw new ProviderUnavailable("Inference is not configured.");
  return mockProvider(name);
}

export function providerInfo(): ProviderInfo {
  try {
    return getProvider().info;
  } catch {
    return { mock: false, offline: true, label: "Inference not configured", model: ENGINE_NAME };
  }
}

function providerExtras(opts: ProviderOptions) {
  // Never let the provider prepend its own system prompt: it names the vendor ("powered by ...") to our users.
  // The Private (E2EE) and @computer paths already set this; this covers V1, Fast, Swarm and the filter classifier.
  const wire = providerWire();
  const params: Record<string, unknown> = { [wire.noSystemPrompt]: false };
  if (opts.webSearch) params[wire.webSearch] = "on";
  // Thinking is off unless the user asked for it, to keep cost predictable.
  if (opts.thinking === false || opts.thinking === undefined) params[wire.noThinking] = true;
  else params[wire.noThinking] = false;
  return { [wire.params]: params };
}

function completionBody(model: string, messages: ChatTurn[], stream: boolean, opts: ProviderOptions) {
  const temperature = typeof opts.temperature === "number" && Number.isFinite(opts.temperature) ? opts.temperature : 0.7;
  const max_tokens = typeof opts.maxTokens === "number" && opts.maxTokens > 0
    ? opts.maxTokens
    : Number(process.env.INFERENCE_MAX_TOKENS ?? 2048);
  return { model, messages: wireMessages(messages), stream, temperature, max_tokens, ...providerExtras(opts) };
}

function compatibleProvider(
  baseUrl: string,
  model: string,
  apiKey: string | undefined,
  info: { label: string; model: string },
  opts: ProviderOptions = {},
): InferenceProvider {
  const url = baseUrl.replace(/\/$/, "") + "/chat/completions";
  return {
    info: { mock: false, label: info.label, model: info.model },
    async *stream(messages, signal) {
      let res: Response;
      try {
        res = await fetch(url, {
          method: "POST",
          signal,
          headers: { "content-type": "application/json", ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}) },
          body: JSON.stringify(completionBody(model, messages, true, opts)),
        });
      } catch (e) {
        if (signal.aborted) throw e;
        throw new ProviderUnavailable("Inference host unreachable");
      }
      if (!res.ok || !res.body) throw new ProviderUnavailable(`Inference host returned ${res.status}`);
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let idx: number;
        while ((idx = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, idx).trim();
          buf = buf.slice(idx + 1);
          if (!line.startsWith("data:")) continue;
          const data = line.slice(5).trim();
          if (data === "[DONE]") return;
          try {
            const j = JSON.parse(data);
            const t = j.choices?.[0]?.delta?.content;
            if (t) yield t as string;
          } catch {
            /* ignore keep-alives / malformed chunks */
          }
        }
      }
    },
    async complete(messages, signal) {
      let res: Response;
      try {
        res = await fetch(url, {
          method: "POST",
          signal,
          headers: { "content-type": "application/json", ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}) },
          body: JSON.stringify(completionBody(model, messages, false, opts)),
        });
      } catch (e) {
        if (signal.aborted) throw e;
        throw new ProviderUnavailable("Inference host unreachable");
      }
      if (!res.ok) throw new ProviderUnavailable(`Inference host returned ${res.status}`);
      const body = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
      const text = body.choices?.[0]?.message?.content;
      if (typeof text !== "string" || !text) throw new ProviderUnavailable("The engine returned an empty reply.");
      return text;
    },
  };
}

/** Citad3L Private. Text only; no web search or other provider tools (they would run outside the enclave). */
function enclaveProvider(baseUrl: string, model: string, apiKey: string, info: { label: string; model: string }, opts: ProviderOptions = {}): InferenceProvider {
  const temperature = typeof opts.temperature === "number" && Number.isFinite(opts.temperature) ? opts.temperature : 0.7;
  const maxTokens = typeof opts.maxTokens === "number" && opts.maxTokens > 0 ? opts.maxTokens : Number(process.env.INFERENCE_MAX_TOKENS ?? 2048);
  async function* run(messages: ChatTurn[], signal: AbortSignal): AsyncGenerator<string> {
    let r: Awaited<ReturnType<typeof e2eeRequest>>;
    try {
      r = await e2eeRequest({ baseUrl, apiKey, model, turns: messages, stream: true, signal, temperature, maxTokens, wire: providerWire() });
    } catch (e) {
      if (signal.aborted) throw e;
      if (e instanceof E2EEError) throw new ProviderUnavailable(`Private couldn't verify the secure enclave (${e.message}). Nothing was sent.`);
      throw new ProviderUnavailable("Inference host unreachable");
    }
    const res = r.res;
    if (!res.ok || !res.body) throw new ProviderUnavailable(`Inference host returned ${res.status}`);
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let idx: number;
      while ((idx = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, idx).trim();
        buf = buf.slice(idx + 1);
        if (!line.startsWith("data:")) continue;
        const data = line.slice(5).trim();
        if (data === "[DONE]") return;
        let c: unknown;
        try { c = JSON.parse(data)?.choices?.[0]?.delta?.content; } catch { continue; }
        if (typeof c !== "string" || !c) continue;
        let t: string;
        try { t = await r.decrypt(c); } catch { throw new ProviderUnavailable("Private got a reply that wasn't encrypted to this session, so it was discarded."); }
        if (t) yield t;
      }
    }
  }
  return {
    info: { mock: false, label: info.label, model: info.model },
    stream: run,
    async complete(messages, signal) {
      let text = "";
      for await (const t of run(messages, signal)) text += t;
      if (!text) throw new ProviderUnavailable("The engine returned an empty reply.");
      return text;
    },
  };
}

const sleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((res, rej) => {
    const t = setTimeout(res, ms);
    signal.addEventListener("abort", () => { clearTimeout(t); rej(new DOMException("Aborted", "AbortError")); }, { once: true });
  });

/** Explicitly labelled canned output. Never presented as live inference (UI shows a Mock badge). */
function mockProvider(modelName: string): InferenceProvider {
  return {
    info: { mock: true, label: "Mock provider – not live inference", model: modelName },
    async *stream(messages, signal) {
      const last = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
      if (last.includes("[[mock-fail]]")) {
        await sleep(150, signal);
        yield "Partial output before a simulated failure…";
        throw new ProviderUnavailable("Simulated provider failure (mock)");
      }
      const slow = last.includes("[[mock-slow]]");
      const reply = mockReply(modelName, messages);
      const tokens = reply.match(/\S+\s*|\s+/g) ?? [reply];
      for (const t of tokens) {
        await sleep(slow ? 120 : 18, signal);
        yield t;
      }
    },
    async complete(messages, signal) {
      await sleep(1, signal);
      return mockReply(modelName, messages);
    },
  };
}

function isSwarmPlanRequest(messages: ChatTurn[]): boolean {
  const blob = messages.map((m) => m.content).join("\n");
  return /"subtasks"/i.test(blob) && /break the user'?s request/i.test(blob);
}

function mockReply(modelName: string, messages: ChatTurn[]): string {
  const last = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
  if (last.includes("[[mock-fail]]")) {
    throw new ProviderUnavailable("Simulated provider failure (mock)");
  }
  if (isSwarmPlanRequest(messages)) {
    return JSON.stringify({
      subtasks: [
        "Clarify the objective and the outcome the user wants.",
        "List the main constraints, risks, and leverage points.",
        "Propose the next three concrete moves.",
      ],
    });
  }
  return [
    `**Mock provider – not live inference.** This canned reply exercises streaming, storage and usage accounting until a live ${modelName} endpoint is connected.`,
    ``,
    `You asked: _${last.slice(0, 160).replace(/[_*`]/g, "")}${last.length > 160 ? "…" : ""}_`,
    ``,
    `A strategic answer would normally cover:`,
    ``,
    `1. **Objective** — what outcome you actually want.`,
    `2. **Terrain** — constraints, risks and leverage points.`,
    `3. **Moves** — the next three concrete steps.`,
    ``,
    "```ts",
    "// example code block rendered by the client",
    `const engine = ${JSON.stringify(modelName)}; // served via a chat-completions adapter`,
    "```",
  ].join("\n");
}
