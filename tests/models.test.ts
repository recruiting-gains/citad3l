import { describe, it, expect, afterEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  DEFAULT_MODEL_ID,
  MODELS,
  VIDEO_MODEL_ENABLED,
  VIDEO_MODEL_ID,
  getPublicModel,
  isSelectableModelId,
  isVideoModelEnabled,
  marketingModels,
  modelAllowsImageUpload,
  visibleModels,
} from "@/lib/models";

afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });

const MODEL_IDS = [
  "test-v1-model",
  "test-fast-model",
  "test-image-model",
  "test-video-t2v",
  "test-video-i2v",
  "e2ee-test-private-model",
];

describe("public model catalog", () => {
  it("public launch: shows V1, Fast and Private; Image and Video stay hidden until media generation is on", () => {
    delete process.env.MEDIA_GENERATION_ENABLED;
    expect(VIDEO_MODEL_ENABLED).toBe(true);
    expect(isVideoModelEnabled()).toBe(true);
    expect(visibleModels().map((m) => m.id)).toEqual(["citad3l-v1", "citad3l-fast", "citad3l-private", "gemma4-uncensored", "uncensored-1.2", "roleplay-uncensored", "inkling2-mini", "qwen3.8-27b", "qwen4-max", "grok-4.7", "kimi-k3.1-pro"]);
    expect(DEFAULT_MODEL_ID).toBe("citad3l-v1");
    expect(visibleModels()[0]?.default).toBe(true);
    expect(isSelectableModelId("citad3l-video")).toBe(false);
    expect(isSelectableModelId("citad3l-v1")).toBe(true);
    // 2026-11-21 public launch: guests get V1/Fast; signed-in accounts can pick everything (server enforces plans).
    expect(isSelectableModelId("citad3l-private")).toBe(false);
    expect(isSelectableModelId("citad3l-private", true)).toBe(true);
    expect(isSelectableModelId("citad3l-video", true)).toBe(false);
    expect(isSelectableModelId("citad3l-image", true)).toBe(false);
    expect(isSelectableModelId("citad3l-image", true, true)).toBe(false);
    const priv = visibleModels().find((m) => m.id === "citad3l-private");
    expect(priv?.description).toBe("Encrypted chat in a verified secure enclave.");
    expect(priv?.requiresClientE2EE).toBe(true);
    expect(priv?.supportsVision).toBe(false);
    expect(modelAllowsImageUpload(priv)).toBe(false);
    expect(modelAllowsImageUpload(visibleModels().find((m) => m.id === "citad3l-v1"))).toBe(true);
    expect(modelAllowsImageUpload(getPublicModel("citad3l-image"))).toBe(false);
  });

  it("CITAD3L_VIDEO_ENABLED=false hides Video again when media generation is on", async () => {
    vi.stubEnv("MEDIA_GENERATION_ENABLED", "true");
    vi.stubEnv("CITAD3L_VIDEO_ENABLED", "false");
    vi.resetModules();
    const m = await import("@/lib/models");
    expect(m.isVideoModelEnabled()).toBe(false);
    expect(m.visibleModels().map((x) => x.id)).not.toContain("citad3l-video");
    expect(m.isSelectableModelId("citad3l-video", true)).toBe(false); // signed-in customers lose it
    expect(m.isSelectableModelId("citad3l-video", true, true)).toBe(true); // admins keep it
    vi.unstubAllEnvs();
  });


  it("hides Image and Video on marketing pages until media generation is on, and Private is available (not coming soon)", () => {
    delete process.env.MEDIA_GENERATION_ENABLED;
    expect(marketingModels().map((m) => m.id)).toEqual([
      "citad3l-v1", "citad3l-fast", "citad3l-private", "gemma4-uncensored", "uncensored-1.2", "roleplay-uncensored", "inkling2-mini", "qwen3.8-27b", "qwen4-max", "grok-4.7", "kimi-k3.1-pro",
    ]);
    const video = getPublicModel(VIDEO_MODEL_ID);
    expect(video?.exclusivePlan).toBe("max");
    expect(video?.comingSoon).toBeFalsy();
    expect(video?.name).toBe("Citad3L Video");
    const priv = marketingModels().find((m) => m.id === "citad3l-private");
    expect(priv?.comingSoon).toBeFalsy();
    expect(isSelectableModelId("citad3l-video")).toBe(false); // guests
  });

  it("does not put provider model IDs in the public catalog or its source", () => {
    const blob = JSON.stringify(MODELS) + marketingModels().map((m) => `${m.id} ${m.name} ${m.description} ${m.role ?? ""} ${m.summary ?? ""}`).join(" ");
    for (const id of MODEL_IDS) expect(blob).not.toContain(id);
    const src = readFileSync(path.resolve(import.meta.dirname, "../lib/models.ts"), "utf8");
    for (const id of MODEL_IDS) expect(src).not.toContain(id);
  });
});

describe("server-only provider mapping", () => {
  it("maps public slugs to provider ids without leaking them through ProviderInfo", async () => {
    vi.stubEnv("MEDIA_GENERATION_ENABLED", "true");
    vi.resetModules();
    const { resolveModel } = await import("@/lib/inference/provider-models");
    expect(resolveModel("citad3l-v1")).toMatchObject({ publicId: "citad3l-v1", name: "Citad3L V1", modality: "chat", providerModelId: "test-v1-model" });
    expect(resolveModel("citad3l-fast")).toMatchObject({ publicId: "citad3l-fast", name: "Citad3L Fast", providerModelId: "test-fast-model" });
    expect(resolveModel("citad3l-private", { admin: true })).toMatchObject({
      publicId: "citad3l-private",
      name: "Citad3L Private",
      modality: "chat",
      providerModelId: "e2ee-test-private-model",
      supportsVision: false,
      requiresClientE2EE: true,
    });
    expect(resolveModel("citad3l-image", { admin: true })).toMatchObject({ publicId: "citad3l-image", name: "Citad3L Image", modality: "image", providerModelId: "test-image-model" });
    expect(resolveModel(undefined).publicId).toBe("citad3l-v1");
    expect(() => resolveModel("citad3l-video")).toThrow(/Sign in to use/);
    expect(() => resolveModel("citad3l-private")).toThrow(/Sign in to use/);
    expect(() => resolveModel("citad3l-image")).toThrow(/Sign in to use/);
    expect(() => resolveModel("not-a-model")).toThrow(/Unknown model/);
  });

  it("resolves Citad3L Video for admins", async () => {
    vi.stubEnv("MEDIA_GENERATION_ENABLED", "true");
    vi.stubEnv("CITAD3L_VIDEO_ENABLED", "true");
    vi.resetModules();
    const { resolveModel } = await import("@/lib/inference/provider-models");
    expect(resolveModel("citad3l-video", { admin: true })).toMatchObject({
      publicId: "citad3l-video",
      name: "Citad3L Video",
      modality: "video",
      providerModelId: "test-video-t2v",
    });
  });
});

describe("provider selection", () => {
  it("uses the mock when no provider key and no inference endpoint are set", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("INFERENCE_PROVIDER", "");
    vi.stubEnv("PROVIDER_API_KEY", "");
    vi.stubEnv("INFERENCE_BASE_URL", "");
    const { getProvider } = await import("@/lib/inference");
    const p = getProvider({ modelId: "citad3l-fast" });
    expect(p.info.mock).toBe(true);
    expect(p.info.model).toBe("Citad3L Fast");
    expect(p.info.label).toBe("Mock provider – not live inference");
    expect(JSON.stringify(p.info)).not.toContain("test-fast-model");
  });

  it("routes Citad3L Private to the provider E2EE path when a key is set, never a plaintext call", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("INFERENCE_PROVIDER", "");
    vi.stubEnv("PROVIDER_API_KEY", "stub-key");
    vi.stubEnv("PROVIDER_BASE_URL", "http://127.0.0.1:8101/v1");
    vi.stubEnv("INFERENCE_BASE_URL", "");
    const { getProvider } = await import("@/lib/inference");
    const p = getProvider({ modelId: "citad3l-private" });
    expect(p.info.mock).toBe(false);
    expect(p.info.model).toBe("Citad3L Private");
    expect(JSON.stringify(p.info)).not.toContain("e2ee-test-private-model");

    vi.resetModules();
    vi.stubEnv("PROVIDER_API_KEY", "");
    const prod = await import("@/lib/inference");
    expect(() => prod.getProvider({ modelId: "citad3l-private" })).toThrow(/isn't configured/);
  });

  it("selects the provider when PROVIDER_API_KEY is set and keeps display names on info", async () => {
    const { spawn } = await import("node:child_process");
    const p = spawn("node", ["scripts/stub-compatible.mjs"], { env: { ...process.env, STUB_PORT: "8101", STUB_KEY: "stub-key" } });
    await new Promise((r) => p.stdout.once("data", r));
    try {
      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv("INFERENCE_PROVIDER", "");
      vi.stubEnv("PROVIDER_API_KEY", "stub-key");
      vi.stubEnv("PROVIDER_BASE_URL", "http://127.0.0.1:8101/v1");
      vi.stubEnv("INFERENCE_BASE_URL", "");
      const { getProvider } = await import("@/lib/inference");
      const prov = getProvider({ modelId: "citad3l-v1" });
      expect(prov.info.mock).toBe(false);
      expect(prov.info.model).toBe("Citad3L V1");
      expect(prov.info.label).toBe("Citad3L V1");
      expect(JSON.stringify(prov.info)).not.toContain("test-v1-model");
      let out = "";
      for await (const t of prov.stream([{ role: "system", content: "s" }, { role: "user", content: "hi" }], new AbortController().signal)) out += t;
      expect(out).toContain("[stub] adapter OK for model=test-v1-model");
      expect(out).toContain("system prompt present=true");
    } finally { p.kill(); }
  });
});
