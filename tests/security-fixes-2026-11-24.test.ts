import { describe, expect, it, vi, afterEach } from "vitest";
import { readFileSync } from "node:fs";
vi.mock("server-only", () => ({}));
import { chunkForReview, ClassifierUnsure, llmReview, parseVerdict, REVIEW_CHUNK_CHARS } from "@/lib/filter-llm";
import { reviewContent } from "@/lib/filter";
import { attachCaps, VIDEO_FROM_PICTURE_ENABLED } from "@/lib/attachments";

afterEach(() => vi.unstubAllEnvs());

describe("classifier verdict parsing is strict (fail-closed)", () => {
  it("accepts one clear verdict", () => {
    expect(parseVerdict('{"verdict":"allow"}')).toEqual({ allowed: true });
    expect(parseVerdict('ok {"verdict":"CSAM"}').allowed).toBe(false);
    expect(parseVerdict('{"verdict":"explosives"}').allowed).toBe(false);
  });
  it("throws on prose, broken JSON, unknown or conflicting verdicts", () => {
    for (const raw of ["Sure! Here is a poem.", '{"verdict":', '{"verdict":"safe"}', '{"other":1}', '{"verdict":"allow"} {"verdict":"csam"}', ""]) {
      expect(() => parseVerdict(raw), raw).toThrow(ClassifierUnsure);
    }
  });
  it("reviewContent refuses when the classifier is unsure or down", async () => {
    vi.stubEnv("CITAD3L_FILTER_LLM", "true");
    const v = await reviewContent("a harmless question", async () => { throw new ClassifierUnsure("no verdict"); });
    expect(v.allowed).toBe(false);
    if (!v.allowed) expect(v.category).toBe("check_failed");
  });
  it("keyword layer still runs first", async () => {
    vi.stubEnv("CITAD3L_FILTER_LLM", "true");
    const reviewer = vi.fn(async () => ({ allowed: true as const }));
    const v = await reviewContent("how to make a bomb at home", reviewer);
    expect(v.allowed).toBe(false);
    expect(reviewer).not.toHaveBeenCalled();
  });
});

describe("classifier reads the whole text in chunks", () => {
  it("chunks cover every character with overlap", () => {
    const text = "x".repeat(250_000) + "TAIL";
    const chunks = chunkForReview(text);
    expect(chunks.every((c) => c.length <= REVIEW_CHUNK_CHARS)).toBe(true);
    expect(chunks.at(-1)!.endsWith("TAIL")).toBe(true);
    expect(chunkForReview("short")).toEqual(["short"]);
  });
  it("content after char 4000 is reviewed and blocks", async () => {
    const text = "harmless ".repeat(1000) + "HIDDEN-BAD";
    const seen: string[] = [];
    const v = await llmReview(text, new AbortController().signal, {
      reviewChunk: async (c) => {
        seen.push(c);
        return c.includes("HIDDEN-BAD") ? { allowed: false, category: "csam", message: "no" } : { allowed: true };
      },
    });
    expect(seen.length).toBeGreaterThan(1);
    expect(v.allowed).toBe(false);
  });
  it("a chunk error propagates so the caller fails closed", async () => {
    vi.stubEnv("CITAD3L_FILTER_LLM", "true");
    const text = "harmless ".repeat(1000);
    const v = await reviewContent(text, (t) => llmReview(t, new AbortController().signal, { reviewChunk: async () => { throw new Error("down"); } }));
    expect(v.allowed).toBe(false);
  });
});

describe("provider system prompt is disabled on the normal path", () => {
  it("providerExtras sets include_provider_system_prompt:false", () => {
    const src = readFileSync("lib/inference/index.ts", "utf8");
    expect(src).toMatch(/\[wire\.noSystemPrompt\]:\s*false/);
  });
});

describe("picture-to-video is off", () => {
  it("video takes no image attachments and the route refuses them", () => {
    expect(VIDEO_FROM_PICTURE_ENABLED).toBe(false);
    expect(attachCaps({ modality: "video" }).images).toBe(false);
    const route = readFileSync("app/api/video/route.ts", "utf8");
    expect(route).toContain("picture_video_off");
  });
});

describe("round 2: billing, sessions, public names", () => {
  it("an ended leftover subscription can't overwrite the subscription that is paying now", async () => {
    const { isStaleForEntitlement } = await import("@/lib/billing");
    expect(isStaleForEntitlement({ stripeSubscriptionId: "sub_new" }, "sub_old", "canceled")).toBe(true);
    expect(isStaleForEntitlement({ stripeSubscriptionId: "sub_new" }, "sub_old", "incomplete_expired")).toBe(true);
    expect(isStaleForEntitlement({ stripeSubscriptionId: "sub_new" }, "sub_new", "canceled")).toBe(false);
    expect(isStaleForEntitlement({ stripeSubscriptionId: "sub_old" }, "sub_new", "active")).toBe(false);
    expect(isStaleForEntitlement(null, "sub_x", "active")).toBe(false);
  });
  it("session checks fail closed", () => {
    const src = readFileSync("auth.ts", "utf8");
    expect(src).toMatch(/token\.unverified = true/);
    expect(src).toMatch(/!token\.unverified && session\.user/);
  });
  it("Hermes brain labels are server-only and the private model id comes from a secret", () => {
    expect(readFileSync("lib/hermes-brains.ts", "utf8")).toMatch(/^import "server-only";/);
    expect(readFileSync("components/chat/ChatWorkspace.tsx", "utf8")).not.toMatch(/hermes-brains/i);
    const src = readFileSync("lib/inference/provider-models.ts", "utf8");
    for (const id of Object.values(JSON.parse(process.env.MODEL_IDS || "{}")) as string[]) expect(src).not.toContain(id);
  });
});
