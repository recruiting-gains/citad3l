import { describe, it, expect, afterEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { MODELS, chatModelsForPlan, getPublicModel, isGuestModelId, modelTier, planIncludesModel, pickerModels } from "@/lib/models";
import { accessFor } from "@/lib/access";

afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });

const FREE = ["citad3l-v1"];
const PRO_ADDS = ["citad3l-private", "gemma4-uncensored", "uncensored-1.2", "glm5.3-flash-uncensored", "roleplay-uncensored", "inkling2-mini", "qwen3.8-27b"];
const MAX_ADDS = ["qwen4-max", "grok-4.7", "kimi-k3.1-pro", "kimi-k2.7-code"];

describe("lineup v2 (2026-11-27)", () => {
  it("Free has V1 Fast only, Pro 8, Max 12 (Fast merged into V1 Fast)", () => {
    expect(chatModelsForPlan("trial").map((m) => m.id)).toEqual(FREE);
    expect(chatModelsForPlan("pro").map((m) => m.id)).toEqual([...FREE, ...PRO_ADDS]);
    expect(chatModelsForPlan("max").map((m) => m.id)).toEqual([...FREE, ...PRO_ADDS, ...MAX_ADDS]);
    expect(chatModelsForPlan("trial")).toHaveLength(1);
    expect(chatModelsForPlan("pro")).toHaveLength(8);
    expect(chatModelsForPlan("max")).toHaveLength(12);
    expect(getPublicModel("max-slot-12")).toBeUndefined();
    expect(getPublicModel("citad3l-v1")?.name).toBe("Citad3L V1 Fast");
    expect(getPublicModel("citad3l-v1")?.role).toBe("Uncensored chat");
    expect(getPublicModel("citad3l-fast")?.hidden).toBe(true);
    expect(pickerModels(true, true).filter((m) => m.modality === "chat")).toHaveLength(12);
  });

  it("tiers: only V1 Fast is free; other models need Pro or Max", () => {
    expect(modelTier("citad3l-v1")).toBe("guest"); expect(isGuestModelId("citad3l-v1")).toBe(true);
    for (const id of ["citad3l-private", "gemma4-uncensored", "uncensored-1.2", "glm5.3-flash-uncensored"]) { expect(modelTier(id)).toBe("pro"); expect(isGuestModelId(id)).toBe(false); }
    for (const id of PRO_ADDS) expect(modelTier(id)).toBe("pro");
    for (const id of MAX_ADDS) expect(modelTier(id)).toBe("max");
    const ctx = (plan: string) => ({ admin: false, plan, paidActive: plan !== "trial" });
    for (const id of PRO_ADDS) {
      expect(accessFor("pro", ctx("trial"))?.code).toBe("upgrade_required");
      expect(accessFor("pro", ctx("pro"))).toBeNull();
      expect(planIncludesModel("trial", id)).toBe(false);
      expect(planIncludesModel("pro", id)).toBe(true);
    }
    for (const id of MAX_ADDS) {
      expect(planIncludesModel("pro", id)).toBe(false);
      expect(planIncludesModel("max", id)).toBe(true);
    }
    expect(accessFor("max", ctx("pro"))?.code).toBe("upgrade_required");
    expect(accessFor("max", ctx("max"))).toBeNull();
    expect(accessFor("swarm", ctx("trial"))?.code).toBe("upgrade_required");
    expect(accessFor("swarm", ctx("pro"))).toBeNull();
  });

  it("every new model maps to its own MODEL_IDS key, reads images, and only Private is E2EE", async () => {
    const { resolveModel } = await import("@/lib/inference/provider-models");
    const ids = new Set<string>();
    for (const id of [...PRO_ADDS.filter((id) => id !== "citad3l-private"), ...MAX_ADDS]) {
      const r = resolveModel(id, { signedIn: true });
      expect(r.providerModelId, id).toMatch(/^test-/);
      expect(r.supportsVision, id).toBe(true);
      expect(r.requiresClientE2EE, id).toBe(false);
      ids.add(r.providerModelId);
    }
    expect(ids.size).toBe(10);
    expect(() => resolveModel("gemma4-uncensored")).toThrow();
    expect(resolveModel("gemma4-uncensored", { signedIn: true }).publicId).toBe("gemma4-uncensored");
    expect(resolveModel("citad3l-v1").publicId).toBe("citad3l-v1"); // guests, V1 Fast only
    expect(MODELS.filter((m) => m.requiresClientE2EE).map((m) => m.id)).toEqual(["citad3l-private"]);
  });

  it("a missing MODEL_IDS key fails safe", async () => {
    vi.stubEnv("MODEL_IDS", JSON.stringify({ "citad3l-v1": "x" }));
    vi.resetModules();
    const { resolveModel, UnknownModel } = await import("@/lib/inference/provider-models");
    expect(() => resolveModel("grok-4.7", { admin: true })).toThrow(UnknownModel);
  });

  it("marketing copy has no provider brand, no E2EE claim on non-Private models", () => {
    const blob = MODELS.map((m) => `${m.id} ${m.name} ${m.description} ${m.role ?? ""} ${m.summary ?? ""} ${(m.specs ?? []).join(" ")}`).join("\n");
    expect(blob).not.toMatch(/venice/i);
    for (const m of MODELS.filter((x) => !x.requiresClientE2EE)) {
      expect(`${m.description} ${m.summary ?? ""}`, m.id).not.toMatch(/end-to-end|e2ee|encrypt/i);
    }
    const plans = readFileSync(path.resolve(import.meta.dirname, "../lib/plans.ts"), "utf8");
    expect(plans).not.toMatch(/venice/i);
  });

  it("MODEL_IDS_V2 fills new slugs and MODEL_IDS wins on a conflict", async () => {
    const { providerModelIdFor } = await import("@/lib/inference/provider-models");
    expect(providerModelIdFor("glm5.3-flash-uncensored")).toBe("test-glm5.3-flash-uncensored");
    expect(providerModelIdFor("v2-only-probe")).toBe("test-v2-only");
    expect(providerModelIdFor("citad3l-v1")).toBe("test-v1-model");
  });
});
