import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { checkoutRenewalLine, LIST_PRICE_USD } from "@/lib/holiday";
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
    for (const list of [models.visibleModels(), models.marketingModels(), models.pickerModels(true, true)]) {
      expect(list.map((m) => m.id)).toEqual(["citad3l-v1", "citad3l-fast", "citad3l-private"]);
    }
    expect(models.isSelectableModelId("citad3l-image", true, true)).toBe(false);
    expect(models.isSelectableModelId("citad3l-video", true, true)).toBe(false);

    vi.stubEnv("MEDIA_GENERATION_ENABLED", "false");
    expect((await import("@/lib/media")).mediaGenerationEnabled()).toBe(false);

    vi.stubEnv("MEDIA_GENERATION_ENABLED", "true");
    vi.resetModules();
    const on = await import("@/lib/models");
    expect((await import("@/lib/media")).mediaGenerationEnabled()).toBe(true);
    expect(on.marketingModels().map((m) => m.id)).toEqual([
      "citad3l-v1", "citad3l-fast", "citad3l-private", "citad3l-image", "citad3l-video",
    ]);
    expect(on.pickerModels(true, true).some((m) => m.id === "citad3l-video")).toBe(true);
  });

  it("refuses image and video generation at the start of the POST routes, and leaves playback routes alone", () => {
    const imagePost = readFileSync(new URL("../app/api/image/route.ts", import.meta.url), "utf8");
    const videoPost = readFileSync(new URL("../app/api/video/route.ts", import.meta.url), "utf8");
    const head = (src: string) => src.slice(src.indexOf("export async function POST"), src.indexOf("export async function POST") + 280);
    expect(head(imagePost)).toMatch(/if \(!mediaGenerationEnabled\(\)\) return jerr\(403, "media_disabled", "Image generation is turned off."\)/);
    expect(head(videoPost)).toMatch(/if \(!mediaGenerationEnabled\(\)\) return jerr\(403, "media_disabled", "Video generation is turned off."\)/);
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

  it("states the real list prices and the holiday first month", () => {
    expect(planCatalog().map((p) => p.priceUsd)).toEqual([0, LIST_PRICE_USD.pro, LIST_PRICE_USD.max]);
    expect(checkoutRenewalLine(true)).toBe("Pro: $10 first month, then $20/month. Max: $25 first month, then $50/month. Cancel anytime.");
    expect(checkoutRenewalLine(false)).toBe("Pro: $20/month. Max: $50/month. Cancel anytime.");
  });
});
