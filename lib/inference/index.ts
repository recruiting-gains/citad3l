import "server-only";
import type { ProviderInfo } from "../types";
import { isProd } from "../config";

export interface ChatTurn { role: "system" | "user" | "assistant"; content: string; }
export interface InferenceProvider {
  info: ProviderInfo;
  stream(messages: ChatTurn[], signal: AbortSignal): AsyncGenerator<string>;
}
export class ProviderUnavailable extends Error {}

export const ENGINE_NAME = "Citad3L V1";
export const ENGINE_SOURCE = "huihui-ai/Huihui-Qwen3.8-27B-abliterated-GGUF";

/**
 * Selects the server-side provider. Mock is used only when explicitly requested (INFERENCE_PROVIDER=mock)
 * or when no endpoint is configured outside production. In production the mock is refused outright.
 */
export function getProvider(): InferenceProvider {
  const base = process.env.INFERENCE_BASE_URL;
  const wantMock = process.env.INFERENCE_PROVIDER === "mock" || !base;
  if (wantMock) {
    if (isProd()) throw new ProviderUnavailable("Mock provider is disabled in production and INFERENCE_BASE_URL is not configured.");
    return mockProvider;
  }
  return openAICompatible(base!, process.env.INFERENCE_MODEL ?? "citad3l-v1", process.env.INFERENCE_API_KEY);
}

export function providerInfo(): ProviderInfo {
  try {
    return getProvider().info;
  } catch {
    return { mock: false, offline: true, label: "Inference not configured", model: ENGINE_NAME };
  }
}

function openAICompatible(baseUrl: string, model: string, apiKey?: string): InferenceProvider {
  const url = baseUrl.replace(/\/$/, "") + "/chat/completions";
  return {
    info: { mock: false, label: ENGINE_NAME, model: ENGINE_NAME },
    async *stream(messages, signal) {
      let res: Response;
      try {
        res = await fetch(url, {
          method: "POST",
          signal,
          headers: { "content-type": "application/json", ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}) },
          body: JSON.stringify({ model, messages, stream: true, temperature: 0.7, max_tokens: Number(process.env.INFERENCE_MAX_TOKENS ?? 2048) }),
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
  };
}

const sleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((res, rej) => {
    const t = setTimeout(res, ms);
    signal.addEventListener("abort", () => { clearTimeout(t); rej(new DOMException("Aborted", "AbortError")); }, { once: true });
  });

/** Explicitly labelled canned output. Never presented as live inference (UI shows a Mock badge). */
const mockProvider: InferenceProvider = {
  info: { mock: true, label: "Mock provider – not live inference", model: ENGINE_NAME },
  async *stream(messages, signal) {
    const last = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
    if (last.includes("[[mock-fail]]")) {
      await sleep(150, signal);
      yield "Partial output before a simulated failure…";
      throw new ProviderUnavailable("Simulated provider failure (mock)");
    }
    const slow = last.includes("[[mock-slow]]");
    const reply = [
      `**Mock provider – not live inference.** This canned reply exercises streaming, storage and usage accounting until the Citad3L V1 endpoint is connected.`,
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
      "const engine = \"Citad3L V1\"; // served via an OpenAI-compatible adapter",
      "```",
    ].join("\n");
    const tokens = reply.match(/\S+\s*|\s+/g) ?? [reply];
    for (const t of tokens) {
      await sleep(slow ? 120 : 18, signal);
      yield t;
    }
  },
};
