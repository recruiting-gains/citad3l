import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { checkoutRenewalLine, holidayIntroEligible, LIST_PRICE_USD } from "@/lib/holiday";
import { planCatalog } from "@/lib/plans";
import { publicFaqItems } from "@/lib/faq";
import { systemPrompt } from "@/lib/prompt";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("MEDIA_GENERATION_ENABLED", () => {
  it("is off unless the env is exactly true, and then hides image and video from every public list", async () => {
    delete process.env.MEDIA_GENERATION_ENABLED;
    vi.resetModules();
    const off = await import("@/lib/media");
    const models = await import("@/lib/models");
    expect(off.mediaGenerationEnabled()).toBe(false);
    const catalog = ["citad3l-v1", "citad3l-private", "gemma4-uncensored", "uncensored-1.2", "glm5.3-flash-uncensored", "roleplay-uncensored", "inkling2-mini", "qwen3.8-27b", "qwen4-max", "grok-4.7", "kimi-k3.1-pro", "kimi-k2.7-code"];
    const marketing = ["citad3l-v1", "qwen4-max", "citad3l-private", "gemma4-uncensored", "uncensored-1.2", "glm5.3-flash-uncensored", "roleplay-uncensored", "inkling2-mini", "qwen3.8-27b", "grok-4.7", "kimi-k3.1-pro", "kimi-k2.7-code"];
    expect(models.visibleModels().map((m) => m.id)).toEqual(catalog);
    expect(models.pickerModels(true, true).map((m) => m.id)).toEqual(catalog);
    expect(models.marketingModels().map((m) => m.id)).toEqual(marketing);
    expect(models.isSelectableModelId("citad3l-image", true, true)).toBe(false);
    expect(models.isSelectableModelId("citad3l-video", true, true)).toBe(false);

    vi.stubEnv("MEDIA_GENERATION_ENABLED", "false");
    expect((await import("@/lib/media")).mediaGenerationEnabled()).toBe(false);

    vi.stubEnv("MEDIA_GENERATION_ENABLED", "true");
    vi.resetModules();
    const on = await import("@/lib/models");
    expect((await import("@/lib/media")).mediaGenerationEnabled()).toBe(true);
    expect(on.marketingModels().map((m) => m.id)).toEqual([
      "citad3l-v1", "qwen4-max", "citad3l-private", "gemma4-uncensored", "uncensored-1.2", "glm5.3-flash-uncensored", "roleplay-uncensored", "inkling2-mini", "qwen3.8-27b", "grok-4.7", "kimi-k3.1-pro", "kimi-k2.7-code", "citad3l-image", "citad3l-video",
    ]);
    expect(on.pickerModels(true, true).some((m) => m.id === "citad3l-video")).toBe(true);
  });

  it("leaves saved-image and saved-video playback routes off the generation flag", () => {
    const imageGet = readFileSync(new URL("../app/api/images/[id]/route.ts", import.meta.url), "utf8");
    const videoGet = readFileSync(new URL("../app/api/videos/[id]/route.ts", import.meta.url), "utf8");
    expect(imageGet).not.toMatch(/mediaGenerationEnabled/);
    expect(videoGet).not.toMatch(/mediaGenerationEnabled/);
    expect(imageGet).toMatch(/Sign in to view this image/);
    expect(videoGet).toMatch(/Sign in to view this video/);
  });

  it("drops image and video generation from the public FAQ, plans, and system prompt", async () => {
    delete process.env.MEDIA_GENERATION_ENABLED;
    const faq = publicFaqItems().map((i) => `${i.q} ${i.a}`).join("\n");
    expect(faq).not.toMatch(/Citad3L Image|Citad3L Video|Can I make videos|generate images/i);
    expect(faq).toMatch(/not end-to-end encrypted from your device/i);
    expect(planCatalog().flatMap((p) => p.features).join(" ")).not.toMatch(/Citad3L Image|Citad3L Video/);
    expect(systemPrompt("Citad3L V1")).toMatch(/Image and video generation are turned off/);
    expect(systemPrompt("Citad3L V1")).not.toMatch(/Citad3L Image/);

    vi.stubEnv("MEDIA_GENERATION_ENABLED", "true");
    vi.resetModules();
    const faqOn = await import("@/lib/faq");
    const shown = faqOn.publicFaqItems().map((i) => i.q);
    expect(shown).toContain("Can I generate images?");
    expect(shown).toContain("Can I make videos?");
    expect((await import("@/lib/prompt")).systemPrompt("Citad3L V1")).toMatch(/Citad3L Image/);
  });

  it("states the real list prices and the holiday first month, and hides it after any subscription", () => {
    expect(planCatalog().map((p) => p.priceUsd)).toEqual([0, LIST_PRICE_USD.pro, LIST_PRICE_USD.max]);
    expect(checkoutRenewalLine("pro", true)).toBe("First-time buyers: Pro $10 first month, then $20/month.");
    expect(checkoutRenewalLine("max", true)).toBe("First-time buyers: Max $25 first month, then $50/month.");
    expect(checkoutRenewalLine("pro", false)).toBe("Pro: $20/month. Cancel anytime.");
    expect(holidayIntroEligible(null)).toBe(true);
    expect(holidayIntroEligible({ plan: "trial", status: "trialing" })).toBe(true);
    expect(holidayIntroEligible({ plan: "pro", status: "active" })).toBe(false);
    expect(holidayIntroEligible({ plan: "trial", status: "canceled" })).toBe(false);
    expect(holidayIntroEligible({ plan: "max", status: "past_due" })).toBe(false);
  });
});
