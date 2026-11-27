import { describe, it, expect, afterEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { MODELS, chatModelsForPlan, getPublicModel, isGuestModelId, modelTier, planIncludesModel, pickerModels } from "@/lib/models";
import { accessFor } from "@/lib/access";

afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });

const FREE = ["citad3l-v1", "citad3l-fast", "citad3l-private", "gemma4-uncensored", "uncensored-1.2"];
const PRO_ADDS = ["roleplay-uncensored", "inkling2-mini", "qwen3.8-27b"];
const MAX_ADDS = ["qwen4-max", "grok-4.7", "kimi-k3.1-pro", "kimi-k2.7-code"];

describe("lineup v2 (2026-11-27)", () => {
  it("Free has 5 chat models, Pro 8, Max 12", () => {
    expect(chatModelsForPlan("trial").map((m) => m.id)).toEqual(FREE);
    expect(chatModelsForPlan("pro").map((m) => m.id)).toEqual([...FREE, ...PRO_ADDS]);
    expect(chatModelsForPlan("max").map((m) => m.id)).toEqual([...FREE, ...PRO_ADDS, ...MAX_ADDS]);
    expect(chatModelsForPlan("trial")).toHaveLength(5);
    expect(chatModelsForPlan("pro")).toHaveLength(8);
    expect(chatModelsForPlan("max")).toHaveLength(12);
    expect(getPublicModel("max-slot-12")).toBeUndefined();
    expect(pickerModels(true, true).filter((m) => m.modality === "chat")).toHaveLength(12);
  });

  it("tiers: Free extras open to guests (no sign-in wall), Pro adds need Pro/Max, Max adds need Max", () => {
    for (const id of ["gemma4-uncensored", "uncensored-1.2"]) { expect(modelTier(id)).toBe("guest"); expect(isGuestModelId(id)).toBe(true); }
    for (const id of PRO_ADDS) expect(modelTier(id)).toBe("pro");
    for (const id of MAX_ADDS) expect(modelTier(id)).toBe("max");
    expect(modelTier("citad3l-private")).toBe("signin");
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
  });

  it("every new model maps to its own MODEL_IDS key, reads images, and only Private is E2EE", async () => {
    const { resolveModel } = await import("@/lib/inference/provider-models");
    const ids = new Set<string>();
    for (const id of [...FREE.slice(3), ...PRO_ADDS, ...MAX_ADDS]) {
      const r = resolveModel(id, { signedIn: true });
      expect(r.providerModelId, id).toMatch(/^test-/);
      expect(r.supportsVision, id).toBe(true);
      expect(r.requiresClientE2EE, id).toBe(false);
      ids.add(r.providerModelId);
    }
    expect(ids.size).toBe(9);
    expect(resolveModel("gemma4-uncensored").publicId).toBe("gemma4-uncensored"); // guests, no sign-in
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
});
