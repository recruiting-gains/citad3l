import type { ChatTurn, InferenceProvider } from "./index";
import { MAX_AUTO_CONTINUATIONS } from "../config";

const OVERLAP_MIN = 12;
const OVERLAP_MAX = 240;
const CONTINUATION_BUFFER_CHARS = 180;

/**
 * Returns the active unclosed fenced-code-block marker if `text` ends inside an open fence.
 */
export function openCodeFence(text: string): { char: string; len: number } | null {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  let openChar: string | null = null;
  let openLen = 0;
  for (const line of lines) {
    if (!openChar) {
      const m = /^[ \t]{0,3}(`{3,}|~{3,})(.*)$/.exec(line);
      if (m && !(m[1][0] === "`" && m[2].includes("`"))) {
        openChar = m[1][0];
        openLen = m[1].length;
      }
    } else {
      const closeRe = openChar === "`"
        ? new RegExp(`^[ \\t]{0,3}\`{${openLen},}[ \\t]*$`)
        : new RegExp(`^[ \\t]{0,3}~{${openLen},}[ \\t]*$`);
      if (closeRe.test(line)) {
        openChar = null;
        openLen = 0;
      }
    }
  }
  return openChar ? { char: openChar, len: openLen } : null;
}

/**
 * Strip a redundant re-opened code fence (when `existing` is already inside an open fence)
 * and any repeated tail/head overlap at the continuation seam.
 */
export function cleanContinuationChunk(existing: string, incoming: string): string {
  if (!incoming) return "";
  let out = incoming;

  const open = openCodeFence(existing);
  if (open) {
    const fenceRe = open.char === "`"
      ? /^[ \t]*`{3,}[^\n]*\r?\n/
      : /^[ \t]*~{3,}[^\n]*\r?\n/;
    if (fenceRe.test(out)) {
      out = out.replace(fenceRe, "");
    }
  }

  // Exact tail/head overlap check
  const maxCheck = Math.min(OVERLAP_MAX, existing.length, out.length);
  for (let len = maxCheck; len >= OVERLAP_MIN; len--) {
    if (existing.endsWith(out.slice(0, len))) {
      return out.slice(len);
    }
  }

  // Also check if the model started with extra leading newlines before repeating the end of `existing`
  const leadNl = /^(\r?\n)+/.exec(out);
  if (leadNl) {
    const trimmed = out.slice(leadNl[0].length);
    const maxTrim = Math.min(OVERLAP_MAX, existing.length, trimmed.length);
    for (let len = maxTrim; len >= OVERLAP_MIN; len--) {
      if (existing.endsWith(trimmed.slice(0, len))) {
        return trimmed.slice(len);
      }
    }
  }

  return out;
}

export function buildContinuationPrompt(existing: string): string {
  const open = openCodeFence(existing);
  return [
    "Continue from the exact character where your previous response stopped.",
    "Output ONLY the continuation — do not repeat anything already written, and do not add preamble or apologies.",
    open ? "You are still inside an open code block; continue the code directly without writing a new opening fence." : "",
  ].filter(Boolean).join(" ");
}

export async function streamWithAutoContinue(opts: {
  provider: InferenceProvider;
  messages: ChatTurn[];
  signal: AbortSignal;
  maxContinuations?: number;
  checkSafety?: (fullText: string) => Promise<void> | void;
  onDelta: (text: string) => void;
  onContinue?: (info: { continuation: number; maxContinuations: number }) => void;
}): Promise<{ text: string; continuations: number; truncated: boolean }> {
  const maxContinuations = Math.max(0, opts.maxContinuations ?? MAX_AUTO_CONTINUATIONS);
  let fullText = "";
  let continuations = 0;
  let lastFinishReason: string | null = null;

  for (let pass = 0; pass <= maxContinuations; pass++) {
    const passMessages: ChatTurn[] = pass === 0
      ? opts.messages
      : [
          ...opts.messages,
          { role: "assistant", content: fullText },
          { role: "user", content: buildContinuationPrompt(fullText) },
        ];

    let passFinishReason: string | null = null;
    let passRawChars = 0;
    let passEmittedChars = 0;
    let headBuf = "";
    let headFlushed = pass === 0;

    const emitClean = async (delta: string) => {
      if (!delta) return;
      fullText += delta;
      passEmittedChars += delta.length;
      if (opts.checkSafety) await opts.checkSafety(fullText);
      opts.onDelta(delta);
    };

    const iter = opts.provider.streamChunks
      ? opts.provider.streamChunks(passMessages, opts.signal)
      : (async function* () {
          for await (const t of opts.provider.stream(passMessages, opts.signal)) {
            yield { type: "delta" as const, text: t };
          }
          yield { type: "finish" as const, finishReason: null };
        })();

    for await (const chunk of iter) {
      if (chunk.type === "finish") {
        passFinishReason = chunk.finishReason;
        continue;
      }
      const t = chunk.text;
      if (!t) continue;
      passRawChars += t.length;

      if (headFlushed) {
        await emitClean(t);
      } else {
        headBuf += t;
        if (headBuf.length >= CONTINUATION_BUFFER_CHARS) {
          const cleaned = cleanContinuationChunk(fullText, headBuf);
          headBuf = "";
          headFlushed = true;
          await emitClean(cleaned);
        }
      }
    }

    if (!headFlushed && headBuf) {
      const cleaned = cleanContinuationChunk(fullText, headBuf);
      headBuf = "";
      headFlushed = true;
      await emitClean(cleaned);
    }

    lastFinishReason = passFinishReason;
    if (passFinishReason !== "length" || pass >= maxContinuations || passRawChars === 0 || passEmittedChars === 0) {
      break;
    }

    continuations += 1;
    opts.onContinue?.({ continuation: continuations, maxContinuations });
  }

  return {
    text: fullText,
    continuations,
    truncated: lastFinishReason === "length",
  };
}
