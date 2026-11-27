import { describe, it, expect, afterEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { parseImageCommand, isChatReady, isImageReady, isSwarmAvailable, getPublicModel } from "@/lib/models";
import { SWARM_MAX_WORKERS, SWARM_UNITS } from "@/lib/config";
import { parseSubtasks, PLAN_SYSTEM } from "@/lib/inference/swarm";
import { mockImageMarkdown, generateImage } from "@/lib/inference/image";

afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });

const MODEL_IDS = [
  "test-v1-model",
  "test-fast-model",
  "test-image-model",
  "test-video-t2v",
  "e2ee-test-private-model",
];

describe("model readiness helpers", () => {
  it("treats V1 and Fast as chat-ready, Private as chat-ready (no Swarm), Image as image-ready", () => {
    expect(isChatReady(getPublicModel("citad3l-v1"))).toBe(true);
    expect(isChatReady(getPublicModel("citad3l-fast"))).toBe(true);
    expect(isChatReady(getPublicModel("citad3l-private"))).toBe(true);
    expect(isImageReady(getPublicModel("citad3l-image"))).toBe(true);
    expect(isImageReady(getPublicModel("citad3l-v1"))).toBe(false);
    expect(isSwarmAvailable(getPublicModel("citad3l-v1"))).toBe(true);
    expect(isSwarmAvailable(getPublicModel("citad3l-fast"))).toBe(true);
    expect(isSwarmAvailable(getPublicModel("citad3l-private"))).toBe(false);
    expect(isSwarmAvailable(getPublicModel("citad3l-image"))).toBe(false);
    expect(SWARM_MAX_WORKERS).toBe(3);
    expect(SWARM_UNITS).toBe(4);
  });

  it("parses /image commands and image-mode prompts", () => {
    expect(parseImageCommand("/image a red rook on a hill", false)).toEqual({ image: true, prompt: "a red rook on a hill" });
    expect(parseImageCommand("/IMAGE\na castle at dusk", false)).toEqual({ image: true, prompt: "a castle at dusk" });
    expect(parseImageCommand("just chat", false)).toEqual({ image: false, prompt: "just chat" });
    expect(parseImageCommand("a red rook", true)).toEqual({ image: true, prompt: "a red rook" });
    expect(parseImageCommand("/image", false)).toEqual({ image: true, prompt: "" });
  });
});

describe("swarm planning parser", () => {
  it("caps workers at 3 and ignores leftover prose", () => {
    const raw = 'Here you go:\n{"subtasks":["A","B","C","D"]}\nThanks';
    expect(parseSubtasks(raw)).toEqual(["A", "B", "C"]);
    expect(parseSubtasks("not json")).toEqual([]);
    expect(PLAN_SYSTEM).toMatch(/subtasks/);
  });
});

describe("image generation", () => {
  it("returns a labelled mock placeholder when no key is set in development", async () => {
    vi.stubEnv("MEDIA_GENERATION_ENABLED", "true");
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("PROVIDER_API_KEY", "");
    const r = await generateImage("a red cube", new AbortController().signal);
    expect(r.mock).toBe(true);
    expect(r.markdown).toContain("Mock image – not live generation");
    expect(r.markdown).toContain("/mock-image.svg");
    expect(mockImageMarkdown("x")).toContain("/mock-image.svg");
  });

  it("refuses the mock in production without a key", async () => {
    vi.stubEnv("MEDIA_GENERATION_ENABLED", "true");
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("PROVIDER_API_KEY", "");
    vi.resetModules();
    const { generateImage: gen } = await import("@/lib/inference/image");
    await expect(gen("a red cube", new AbortController().signal)).rejects.toThrow(/not configured/);
  });

  it("calls the provider /image/generate with the server-side model id and keeps it out of the markdown", async () => {
    const { spawn } = await import("node:child_process");
    const p = spawn("node", ["scripts/stub-compatible.mjs"], { env: { ...process.env, STUB_PORT: "8102", STUB_KEY: "stub-key" } });
    await new Promise((r) => p.stdout.once("data", r));
    try {
      vi.stubEnv("MEDIA_GENERATION_ENABLED", "true");
      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv("PROVIDER_API_KEY", "stub-key");
      vi.stubEnv("PROVIDER_BASE_URL", "http://127.0.0.1:8102/v1");
      vi.resetModules();
      const { generateImage: gen } = await import("@/lib/inference/image");
      const r = await gen("a red cube", new AbortController().signal);
      expect(r.mock).toBe(false);
      expect(r.markdown).toContain("<data:image/webp;base64,");
      expect(r.markdown).toContain("Generated image");
      expect(r.markdown).not.toContain("test-image-model");
    } finally { p.kill(); }
  });
});

describe("provider complete() and no-leak", () => {
  it("uses complete() on the provider path and does not put vendor ids in client files", async () => {
    const { spawn } = await import("node:child_process");
    const p = spawn("node", ["scripts/stub-compatible.mjs"], { env: { ...process.env, STUB_PORT: "8103", STUB_KEY: "stub-key" } });
    await new Promise((r) => p.stdout.once("data", r));
    try {
      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv("INFERENCE_PROVIDER", "");
      vi.stubEnv("PROVIDER_API_KEY", "stub-key");
      vi.stubEnv("PROVIDER_BASE_URL", "http://127.0.0.1:8103/v1");
      vi.stubEnv("INFERENCE_BASE_URL", "");
      const { getProvider, completeText } = await import("@/lib/inference");
      const prov = getProvider({ modelId: "citad3l-fast" });
      const out = await completeText(prov, [{ role: "system", content: "s" }, { role: "user", content: "hi" }], new AbortController().signal);
      expect(out).toContain("[stub] adapter OK for model=test-fast-model");
      expect(JSON.stringify(prov.info)).not.toContain("test-fast-model");
    } finally { p.kill(); }

    for (const rel of ["components/chat/ChatWorkspace.tsx", "components/chat/ModelPicker.tsx", "lib/models.ts"]) {
      const src = readFileSync(path.resolve(import.meta.dirname, "..", rel), "utf8");
      for (const id of MODEL_IDS) expect(src, rel).not.toContain(id);
    }
  });
});
