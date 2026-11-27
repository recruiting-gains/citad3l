import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { checkText } from "@/lib/filter";
import {
  asksForImageOrVideo,
  extractImagePromptBlocks,
  hasImagePromptBlock,
  IMAGE_PROMPT_CARD_LABEL,
  imagePromptCardModel,
  imagePromptPlanFor,
} from "@/lib/image-prompt";
import { buildTurns, IMAGE_PROMPT_GUIDE, systemPrompt, wantsImagePromptGuide } from "@/lib/prompt";
import { shiftChicagoDay, tallyImagePromptCounts } from "@/lib/image-prompt-count";
import { LEAK_RE } from "./leak-words";

const { upsert, findMany, dbConfigured } = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type AnyFn = (...a: any[]) => any;
  return {
    upsert: vi.fn<AnyFn>(async () => ({})),
    findMany: vi.fn<AnyFn>(async () => []),
    dbConfigured: vi.fn<AnyFn>(() => true),
  };
});

vi.mock("@/lib/db", () => ({
  prisma: { imagePromptCount: { upsert, findMany } },
  dbConfigured,
}));

const SAMPLE = [
  "Citad3L doesn't generate images or videos.",
  "",
  "```image-prompt",
  "A white lighthouse on dark granite at blue hour, long exposure, cool sidelight, low horizon, 3:2.",
  "Negative: text, watermark, blur",
  "```",
  "",
  "Paste that into any image tool.",
].join("\n");

describe("image-prompt blocks", () => {
  it("reads a closed fence and ignores other code", () => {
    const blocks = extractImagePromptBlocks(`${SAMPLE}\n\n\`\`\`ts\nconst x = 1;\n\`\`\``);
    expect(blocks).toEqual([
      "A white lighthouse on dark granite at blue hour, long exposure, cool sidelight, low horizon, 3:2.\nNegative: text, watermark, blur",
    ]);
    expect(hasImagePromptBlock(SAMPLE)).toBe(true);
    expect(hasImagePromptBlock("```python\nprint(1)\n```")).toBe(false);
    expect(hasImagePromptBlock("```image-prompts\nnope\n```")).toBe(false);
    expect(hasImagePromptBlock("```image-prompt\n```")).toBe(false);
    expect(hasImagePromptBlock("")).toBe(false);
  });

  it("keeps an unclosed fence at the end of a finished reply, and a second block", () => {
    const open = "Here you go.\n\n```image-prompt\nA red barn, oil paint, golden hour, centered, 4:5";
    expect(extractImagePromptBlocks(open)).toEqual(["A red barn, oil paint, golden hour, centered, 4:5"]);
    const two = [
      "```image-prompt",
      "First scene, noon light, square.",
      "```",
      "or",
      "```image-prompt title",
      "Second scene, dusk, 16:9.",
      "Negative: people",
      "```",
    ].join("\n");
    expect(extractImagePromptBlocks(two)).toHaveLength(2);
    expect(extractImagePromptBlocks(two)[1]).toContain("Second scene");
  });

  it("splits a trailing negative line into the card model and the clipboard text", () => {
    const model = imagePromptCardModel(extractImagePromptBlocks(SAMPLE)[0]);
    expect(model.prompt).toBe("A white lighthouse on dark granite at blue hour, long exposure, cool sidelight, low horizon, 3:2.");
    expect(model.negative).toBe("text, watermark, blur");
    expect(model.copyText).toBe(`${model.prompt}\nNegative: ${model.negative}`);
    expect(IMAGE_PROMPT_CARD_LABEL).toBe("Image prompt — use in your favorite image tool");
    const bare = imagePromptCardModel("Just a fox in snow, soft window light, 1:1.");
    expect(bare.negative).toBeNull();
    expect(bare.copyText).toBe(bare.prompt);
    const mid = imagePromptCardModel("Negative space around a bowl.\nSoft light, 1:1.");
    expect(mid.negative).toBeNull();
    expect(mid.prompt).toContain("Negative space");
    const named = imagePromptCardModel("A bowl of oranges, hard light, 1:1.\nNegative prompt: text");
    expect(named.negative).toBe("text");
  });
});

describe("image and video asks", () => {
  it("detects picture, image, and video requests", () => {
    for (const ask of [
      "/image a minimalist rook",
      "/video a wave hitting a pier",
      "Draw me a logo for my studio",
      "Generate an image of a cyberpunk rook",
      "Make a crisp picture of a mountain cabin",
      "draw a cat on a windowsill",
      "make a video of a paper boat in the rain",
      "I want a picture of a red barn",
      "a picture of a red barn at dusk",
      "write me an image prompt for a glass house",
    ]) {
      expect(asksForImageOrVideo(ask), ask).toBe(true);
    }
  });

  it("leaves graphics, questions, and ordinary chat alone", () => {
    for (const ask of [
      "How does PNG image compression work?",
      "What is the best resolution for web photos?",
      "Plan a focused 4-hour work block today",
      "what's the capital of France?",
      "Can you make this as an image, not code?",
      "design a 5 slide IG carousel",
      "make me a carousel of pictures with a border and background",
      "draw a conclusion from these numbers",
      "make a video call with the team",
      "create a movie night playlist",
    ]) {
      expect(asksForImageOrVideo(ask), ask).toBe(false);
    }
  });
});

describe("system prompt", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("tells the model to write an image-prompt block when generation is off, and not when it is on", () => {
    delete process.env.MEDIA_GENERATION_ENABLED;
    const off = systemPrompt("Citad3L V1");
    expect(off).toMatch(/Image and video generation are turned off/);
    expect(off).toMatch(/fenced image-prompt block/);
    expect(off).toMatch(/don't generate them/);
    expect(off).toMatch(/Negative:/);
    expect(off).toMatch(/Name no tools/);
    expect(off).not.toMatch(/Citad3L Image/);
    expect(off).not.toMatch(LEAK_RE);
    expect(checkText(off).allowed).toBe(true);
    expect(checkText(IMAGE_PROMPT_GUIDE).allowed).toBe(true);
    expect(IMAGE_PROMPT_GUIDE).toMatch(/language tag image-prompt/);
    expect(IMAGE_PROMPT_GUIDE).toMatch(/subject, style, lighting, composition, and aspect ratio/);
    expect(IMAGE_PROMPT_GUIDE).not.toMatch(LEAK_RE);

    const ask = buildTurns([{ role: "user", content: "Draw me a picture of a lighthouse" }], null, "Citad3L V1")[0].content;
    expect(ask).toContain(IMAGE_PROMPT_GUIDE);
    expect(wantsImagePromptGuide([{ role: "user", content: "make a video of a fox" }])).toBe(true);
    expect(buildTurns([{ role: "user", content: "what's the capital of France?" }], null, "Citad3L V1")[0].content).not.toContain(IMAGE_PROMPT_GUIDE);
    expect(buildTurns([{ role: "user", content: "design a 5 slide IG carousel" }], null, "Citad3L V1")[0].content).not.toContain(IMAGE_PROMPT_GUIDE);

    vi.stubEnv("MEDIA_GENERATION_ENABLED", "true");
    const on = systemPrompt("Citad3L V1");
    expect(on).toMatch(/Citad3L Image/);
    expect(on).not.toMatch(/tagged image-prompt/);
    expect(wantsImagePromptGuide([{ role: "user", content: "Draw me a picture of a lighthouse" }])).toBe(false);
    expect(buildTurns([{ role: "user", content: "Draw me a picture of a lighthouse" }], null, "Citad3L V1")[0].content).not.toContain(IMAGE_PROMPT_GUIDE);
  });
});

describe("image prompt counter", () => {
  beforeEach(() => {
    upsert.mockClear();
    findMany.mockClear();
    dbConfigured.mockReturnValue(true);
  });

  it("maps plans and totals the last 7 and 30 Chicago days", () => {
    expect(imagePromptPlanFor("trial")).toBe("free");
    expect(imagePromptPlanFor("pro")).toBe("pro");
    expect(imagePromptPlanFor("max")).toBe("max");
    expect(imagePromptPlanFor("pro", true)).toBe("guest");
    expect(imagePromptPlanFor(null)).toBe("free");
    expect(shiftChicagoDay("2026-11-27", -6)).toBe("2026-11-21");
    expect(shiftChicagoDay("2026-11-27", -29)).toBe("2026-10-29");
    expect(shiftChicagoDay("2026-11-02", -1)).toBe("2026-11-01");
    expect(shiftChicagoDay("2026-11-01", -1)).toBe("2026-10-31");
    expect(shiftChicagoDay("2026-03-09", -1)).toBe("2026-03-08");
    const totals = tallyImagePromptCounts(
      [
        { day: "2026-11-27", plan: "pro", count: 2 },
        { day: "2026-11-21", plan: "guest", count: 1 },
        { day: "2026-11-20", plan: "free", count: 4 },
        { day: "2026-10-28", plan: "max", count: 9 },
        { day: "2026-11-25", plan: "trial", count: 7 },
        { day: "2026-11-22", plan: "max", count: 3 },
      ],
      "2026-11-27",
    );
    expect(totals.days7).toEqual({ guest: 1, free: 0, pro: 2, max: 3 });
    expect(totals.days30).toEqual({ guest: 1, free: 4, pro: 2, max: 3 });
  });

  it("increments a plan/day counter and does not store the prompt", async () => {
    const { noteImagePromptReply, recordImagePromptRequest, imagePromptTotals } = await import("@/lib/image-prompt-count");
    const now = new Date("2026-11-27T18:00:00Z");
    expect(await noteImagePromptReply("no card here", "free", now)).toBe(false);
    expect(upsert).not.toHaveBeenCalled();

    expect(await noteImagePromptReply(SAMPLE, "pro", now)).toBe(true);
    expect(upsert).toHaveBeenCalledTimes(1);
    const args = upsert.mock.calls[0][0] as { where: unknown; create: unknown; update: unknown };
    expect(args).toEqual({
      where: { day_plan: { day: "2026-11-27", plan: "pro" } },
      create: { day: "2026-11-27", plan: "pro", count: 1 },
      update: { count: { increment: 1 } },
    });
    expect(JSON.stringify(args)).not.toContain("lighthouse");
    expect(JSON.stringify(args)).not.toMatch(/prompt|content|text/i);

    upsert.mockRejectedValueOnce(new Error("db down"));
    expect(await recordImagePromptRequest("guest", now)).toBe(false);

    dbConfigured.mockReturnValue(false);
    upsert.mockClear();
    expect(await noteImagePromptReply(SAMPLE, "max", now)).toBe(false);
    expect(upsert).not.toHaveBeenCalled();

    dbConfigured.mockReturnValue(true);
    findMany.mockResolvedValueOnce([
      { day: "2026-11-27", plan: "pro", count: 2 },
      { day: "2026-11-01", plan: "guest", count: 5 },
    ]);
    await expect(imagePromptTotals(now)).resolves.toEqual({
      days7: { guest: 0, free: 0, pro: 2, max: 0 },
      days30: { guest: 5, free: 0, pro: 2, max: 0 },
    });
    const query = findMany.mock.calls[0][0] as { where: { day: { gte: string; lte: string } }; select: Record<string, boolean> };
    expect(query.where.day).toEqual({ gte: "2026-10-29", lte: "2026-11-27" });
    expect(query.select).toEqual({ day: true, plan: true, count: true });
  });
});

describe("wiring", () => {
  it("renders image-prompt fences as the card and leaves other code blocks alone", () => {
    const md = readFileSync(new URL("../components/chat/Markdown.tsx", import.meta.url), "utf8");
    const card = readFileSync(new URL("../components/chat/ImagePromptCard.tsx", import.meta.url), "utf8");
    const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
    expect(md).toContain("ImagePromptCard");
    expect(md).toContain("IMAGE_PROMPT_LANG");
    expect(md).toContain("<CodeBlock");
    expect(card).toContain("IMAGE_PROMPT_CARD_LABEL");
    expect(readFileSync(new URL("../lib/image-prompt.ts", import.meta.url), "utf8")).toContain(IMAGE_PROMPT_CARD_LABEL);
    expect(card).toContain("Copy prompt");
    expect(card).toContain("Copied");
    expect(card).toContain("navigator.clipboard.writeText");
    expect(card).not.toMatch(/midjourney|dall-?e|stable diffusion|ideogram|firefly|leonardo/i);
    expect(css).toContain(".image-prompt-copy");
    expect(css).toMatch(/min-height:\s*44px/);
    expect(css).toMatch(/@media \(max-width: 640px\)[\s\S]*\.image-prompt-copy \{ width: 100%/)
  });

  it("counts on the server when a reply finishes, for signed-in plans and guests", () => {
    const route = readFileSync(new URL("../app/api/chat/route.ts", import.meta.url), "utf8");
    expect(route.match(/noteImagePromptReply\(/g)).toHaveLength(2);
    expect(route).toContain("imagePromptPlanFor(usageNow.plan)");
    expect(route).toContain("imagePromptPlanFor(null, true)");
    const sql = readFileSync(new URL("../prisma/migrations/20261127120000_image_prompt_count/migration.sql", import.meta.url), "utf8");
    expect(sql).toContain('"ImagePromptCount"');
    expect(sql).toMatch(/"day" TEXT NOT NULL/);
    expect(sql).toMatch(/"plan" TEXT NOT NULL/);
    expect(sql).toMatch(/"count" INTEGER NOT NULL/);
    expect(sql).not.toMatch(/"(prompt|content|userId|text)"/);
    const admin = readFileSync(new URL("../components/admin/AdminView.tsx", import.meta.url), "utf8");
    expect(admin).toContain("Image prompt requests");
    expect(admin).toContain("data-testid=\"admin-image-prompts\"");
    expect(admin).toContain("Prompt text is not stored");
  });

  it("mock chat returns an image-prompt block for a picture ask when generation is off", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("INFERENCE_PROVIDER", "mock");
    vi.stubEnv("MEDIA_GENERATION_ENABLED", "false");
    vi.resetModules();
    const { getProvider } = await import("@/lib/inference");
    const p = getProvider({ modelId: "citad3l-fast" });
    const text = await p.complete(
      [{ role: "user", content: "Draw me a picture of a lighthouse at dusk" }],
      new AbortController().signal,
    );
    expect(hasImagePromptBlock(text)).toBe(true);
    expect(text).toMatch(/doesn't generate images or videos/);
    expect(text).toMatch(/Mock provider/);
    const ordinary = await p.complete([{ role: "user", content: "What is 2 + 2?" }], new AbortController().signal);
    expect(hasImagePromptBlock(ordinary)).toBe(false);
    expect(ordinary).toContain("Mock provider");
    vi.unstubAllEnvs();
  });
});
