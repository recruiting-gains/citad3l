import { readFileSync } from "node:fs";
import { describe, it, expect, vi, afterEach } from "vitest";
vi.mock("server-only", () => ({}));

import {
  DEFAULT_MAX_TOKENS,
  GUEST_MAX_TOKENS,
  MAX_AUTO_CONTINUATIONS,
  MAX_SETTINGS_TOKENS,
} from "@/lib/config";
import {
  buildAnswerZip,
  buildZip,
  codeBlockFilename,
  extractCodeBlocks,
  extractFilenameHint,
  extForLang,
  sanitizeRelPath,
} from "@/lib/downloads";
import { buildChatPdf, toPdfText } from "@/lib/pdf-export";
import {
  cleanContinuationChunk,
  openCodeFence,
  streamWithAutoContinue,
} from "@/lib/inference/continue";
import { getProvider, type ChatTurn, type InferenceProvider } from "@/lib/inference";
import {
  runSwarm,
  SWARM_PLAN_TOKENS,
  SWARM_SYNTH_TOKENS,
  SWARM_WORKER_TOKENS,
} from "@/lib/inference/swarm";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("downloads helper", () => {
  it("maps language tags to file extensions", () => {
    expect(extForLang("python").ext).toBe("py");
    expect(extForLang("py").ext).toBe("py");
    expect(extForLang("typescript").ext).toBe("ts");
    expect(extForLang("bash").ext).toBe("sh");
    expect(extForLang("dockerfile").exact).toBe("Dockerfile");
    expect(extForLang("unknown-lang").ext).toBe("txt");
    expect(codeBlockFilename("python", "print(1)")).toBe("snippet.py");
  });

  it("extracts safe filename hints and rejects path traversal", () => {
    expect(sanitizeRelPath("../../etc/passwd")).toBeNull();
    expect(sanitizeRelPath("/abs/secret.py")).toBe("abs/secret.py");
    expect(extractFilenameHint("# bot/trader.py\nprint(1)", "python")).toBe("bot/trader.py");
    expect(extractFilenameHint("// ../../bad.ts\nconst x = 1;", "ts")).toBeNull();
    expect(codeBlockFilename("ts", "// src/app.ts\nexport const a = 1;")).toBe("src/app.ts");
  });

  it("extracts multiple fenced code blocks including nested fences and deduplicates names", () => {
    const md = [
      "Here is the code:",
      "",
      "```python",
      "# main.py",
      "print('hi')",
      "```",
      "",
      "````markdown",
      "Example:",
      "```bash",
      "echo nested",
      "```",
      "````",
      "",
      "```python",
      "# main.py",
      "print('second')",
      "```",
    ].join("\n");

    const blocks = extractCodeBlocks(md);
    expect(blocks).toHaveLength(3);
    expect(blocks[0]).toMatchObject({ lang: "python", filename: "main.py" });
    expect(blocks[1]).toMatchObject({ lang: "markdown", filename: "code-02.md" });
    expect(blocks[1].code).toContain("```bash");
    expect(blocks[2]).toMatchObject({ lang: "python", filename: "main-2.py" });
  });

  it("builds a valid zip readable by JSZip containing answer.md and all code blocks", async () => {
    const md = [
      "# Bot Kit",
      "",
      "```python",
      "# bot.py",
      "def run():\n    return 'ok'",
      "```",
      "",
      "```json",
      '{"cap": 50}',
      "```",
    ].join("\n");

    const { bytes, fileCount, codeCount } = buildAnswerZip(md);
    expect(fileCount).toBe(3);
    expect(codeCount).toBe(2);

    const JSZip = (await import("jszip")).default;
    const loaded = await JSZip.loadAsync(bytes);
    expect(Object.keys(loaded.files).sort()).toEqual(["answer.md", "bot.py", "code-02.json"]);
    expect(await loaded.file("answer.md")!.async("string")).toContain("# Bot Kit");
    expect(await loaded.file("bot.py")!.async("string")).toContain("def run():");
    expect(await loaded.file("code-02.json")!.async("string")).toContain('"cap": 50');
  });

  it("handles UTF-8 filenames in zip", async () => {
    const bytes = buildZip([{ name: "notes-café.txt", content: "hello" }]);
    const JSZip = (await import("jszip")).default;
    const loaded = await JSZip.loadAsync(bytes);
    expect(await loaded.file("notes-café.txt")!.async("string")).toBe("hello");
  });
});

describe("client-side PDF export", () => {
  it("normalizes Unicode symbols without mojibake", () => {
    expect(toPdfText("A — B → C “ok” ✅")).toBe('A -- B -> C "ok" [ok]');
  });

  it("builds a valid multi-page PDF readable by pdf.js with headings and code blocks", async () => {
    const longCode = Array.from({ length: 95 }, (_, i) => `def line_${i}(x): return x + ${i}  # padding ${"a".repeat(45)}`).join("\n");
    const md = [
      "# Kalshi Bot Guide",
      "",
      "This guide explains the setup and includes the full code.",
      "",
      "- Step 1: Set daily limit",
      "- Step 2: Run tests",
      "",
      "```python",
      longCode,
      "```",
    ].join("\n");

    const pdfBytes = buildChatPdf(md, { title: "Kalshi Bot Guide", createdAt: "2026-11-24T23:30:00Z" });
    const header = new TextDecoder().decode(pdfBytes.slice(0, 8));
    expect(header).toBe("%PDF-1.4");
    const tail = new TextDecoder().decode(pdfBytes.slice(-16));
    expect(tail).toContain("%%EOF");

    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const doc = await pdfjs.getDocument({ data: pdfBytes }).promise;
    expect(doc.numPages).toBeGreaterThanOrEqual(2);
    let allText = "";
    for (let p = 1; p <= doc.numPages; p++) {
      const tc = await (await doc.getPage(p)).getTextContent();
      allText += tc.items.map((i: any) => i.str).join(" ") + "\n";
    }
    expect(allText).toContain("Kalshi Bot Guide");
    expect(allText).toContain("Step 1: Set daily limit");
    expect(allText).toContain("def line_0");
    expect(allText).toContain("def line_94");
    expect(allText).toContain(`Page 1 of ${doc.numPages}`);
    expect(allText).toContain(`Page ${doc.numPages} of ${doc.numPages}`);
  });
});

describe("output caps and auto-continue", () => {
  it("raises signed-in & Swarm caps while keeping guest cap low", () => {
    expect(GUEST_MAX_TOKENS).toBeLessThanOrEqual(512);
    expect(DEFAULT_MAX_TOKENS).toBe(4096);
    expect(MAX_SETTINGS_TOKENS).toBe(8192);
    expect(MAX_AUTO_CONTINUATIONS).toBe(3);
    expect(SWARM_PLAN_TOKENS).toBeGreaterThanOrEqual(400);
    expect(SWARM_WORKER_TOKENS).toBeGreaterThanOrEqual(2048);
    expect(SWARM_SYNTH_TOKENS).toBeGreaterThanOrEqual(4096);
    expect(SWARM_SYNTH_TOKENS).toBeLessThanOrEqual(8192);
  });

  it("detects unclosed fences and strips duplicated overlap or re-opened fences", () => {
    const existing = "Intro\n\n```python\ndef compute_edge(p):\n    return 1.0 - p";
    expect(openCodeFence(existing)).toEqual({ char: "`", len: 3 });

    const messy = "```python\ndef compute_edge(p):\n    return 1.0 - p\n\ndef next_fn():\n    return 2\n```";
    const cleaned = cleanContinuationChunk(existing, messy);
    expect(cleaned).toBe("\n\ndef next_fn():\n    return 2\n```");
  });

  it("auto-continues on finish_reason=length and stops seamlessly on stop", async () => {
    let calls = 0;
    const provider: InferenceProvider = {
      info: { mock: true, label: "test", model: "Citad3L V1" },
      async *stream() { yield ""; },
      async *streamChunks() {
        calls++;
        if (calls === 1) {
          yield { type: "delta", text: "```python\ndef part1():\n    return 1" };
          yield { type: "finish", finishReason: "length" };
        } else if (calls === 2) {
          yield { type: "delta", text: "```python\n    return 1\n\ndef part2():\n    return 2\n```" };
          yield { type: "finish", finishReason: "stop" };
        }
      },
      async complete() { return ""; },
    };

    const deltas: string[] = [];
    const contEvents: number[] = [];
    const res = await streamWithAutoContinue({
      provider,
      messages: [{ role: "user", content: "write code" }],
      signal: new AbortController().signal,
      maxContinuations: 3,
      onDelta: (t) => deltas.push(t),
      onContinue: (c) => contEvents.push(c.continuation),
    });

    expect(calls).toBe(2);
    expect(contEvents).toEqual([1]);
    expect(res.continuations).toBe(1);
    expect(res.truncated).toBe(false);
    expect(res.text).toBe("```python\ndef part1():\n    return 1\n\ndef part2():\n    return 2\n```");
    expect(deltas.join("")).toBe(res.text);
  });

  it("caps continuations at maxContinuations and marks truncated=true", async () => {
    let calls = 0;
    const provider: InferenceProvider = {
      info: { mock: true, label: "test", model: "Citad3L V1" },
      async *stream() { yield ""; },
      async *streamChunks() {
        calls++;
        yield { type: "delta", text: `chunk-${calls} ` };
        yield { type: "finish", finishReason: "length" };
      },
      async complete() { return ""; },
    };

    const res = await streamWithAutoContinue({
      provider,
      messages: [{ role: "user", content: "forever" }],
      signal: new AbortController().signal,
      maxContinuations: 2,
      onDelta: () => {},
    });

    expect(calls).toBe(3); // initial + 2 continuations
    expect(res.continuations).toBe(2);
    expect(res.truncated).toBe(true);
    expect(res.text).toBe("chunk-1 chunk-2 chunk-3 ");
  });

  it("reads finish_reason=length from compatible SSE streams", async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("INFERENCE_PROVIDER", "compatible");
    vi.stubEnv("PROVIDER_BASE_URL", "http://127.0.0.1:9999/v1");
    vi.stubEnv("INFERENCE_BASE_URL", "http://127.0.0.1:9999/v1");
    vi.stubEnv("INFERENCE_API_KEY", "test-key");

    const fetchMock = vi.fn(async () => {
      const sse = [
        'data: {"choices":[{"delta":{"content":"hello "},"finish_reason":null}]}\n\n',
        'data: {"choices":[{"delta":{"content":"world"},"finish_reason":"length"}]}\n\n',
        "data: [DONE]\n\n",
      ].join("");
      return new Response(sse, { status: 200, headers: { "content-type": "text/event-stream" } });
    });
    vi.stubGlobal("fetch", fetchMock);

    const p = getProvider({ modelId: "citad3l-v1" });
    const chunks: Array<{ type: string; text?: string; finishReason?: string | null }> = [];
    for await (const c of p.streamChunks!([{ role: "user", content: "hi" }], new AbortController().signal)) {
      chunks.push(c);
    }
    expect(chunks).toEqual([
      { type: "delta", text: "hello " },
      { type: "delta", text: "world" },
      { type: "finish", finishReason: "length" },
    ]);
  });

  it("runs Swarm synthesis with auto-continue on finish_reason=length", async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("INFERENCE_PROVIDER", "mock");
    const statuses: string[] = [];
    const deltas: string[] = [];
    const res = await runSwarm({
      userMessage: "Build a trading script [[mock-long]]",
      history: [] as ChatTurn[],
      signal: new AbortController().signal,
      onStatus: (s) => statuses.push(s.phase),
      onDelta: (t) => deltas.push(t),
    });

    expect(res.fallback).toBe(false);
    expect(res.continuations).toBe(1);
    expect(res.truncated).toBe(false);
    expect(statuses).toContain("continuing");
    expect(res.text).toContain("def compute_edge");
    expect(res.text).toContain("def should_enter");
    expect(res.text).toContain('"max_trade_usd": 5');
  });
});

describe("UI wiring for downloads and continued indicator", () => {
  it("exposes download buttons in Markdown and ChatWorkspace without vendor leaks", () => {
    const md = readFileSync("components/chat/Markdown.tsx", "utf8");
    const ws = readFileSync("components/chat/ChatWorkspace.tsx", "utf8");
    expect(md).toContain('data-testid="code-download"');
    expect(ws).toContain('data-testid="msg-download-zip"');
    expect(ws).toContain('data-testid="msg-download-pdf"');
    expect(ws).toContain('data-testid="msg-continued"');
  });
});
