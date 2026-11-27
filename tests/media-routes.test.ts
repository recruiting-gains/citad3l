import { beforeEach, describe, expect, it, vi } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { modelForFollowUp, pickerModels } from "@/lib/models";
import { safeImageSrc } from "@/lib/safe-url";
import { parseVideoContent, videoIdFromSrc } from "@/lib/video-content";
import { systemPrompt } from "@/lib/prompt";

const calls = vi.hoisted(() => ({ image: 0, quote: 0, queue: 0, who: "admin" as "admin" | "max" }));

vi.mock("@/auth", () => ({ requireUserId: async () => (calls.who === "admin" ? "u-admin" : "u-max") }));
vi.mock("@/lib/banned", () => ({ bannedMessage: async () => null }));
vi.mock("@/lib/filter-log", () => ({ logFilterRefusal: async () => undefined }));
vi.mock("@/lib/images-r2", () => ({ putGeneratedImage: async () => null, imagesBucket: () => null }));
vi.mock("@/lib/filter-llm", () => ({ reviewImagePrompt: async () => ({ allowed: true }) }));
vi.mock("@/lib/spend-guard", () => ({ spendGuard: async () => null }));
vi.mock("@/lib/inference/image", () => ({
  generateImage: async () => {
    calls.image += 1;
    return { markdown: "nope", mock: true, mime: "image/png", bytes: new Uint8Array() };
  },
}));
vi.mock("@/lib/inference/video", () => ({
  quoteVideo: async () => { calls.quote += 1; return 0.1; },
  queueVideo: async () => { calls.queue += 1; return { queueId: "q", downloadUrl: null }; },
  videoMaxPerDay: () => 2,
  videoMaxUsdPerClip: () => 1,
}));
vi.mock("@/lib/video-store", () => ({ finalizeVideo: async () => ({ status: "pending" }), isVideoStorageConfigured: () => true, VIDEO_STORAGE_UNAVAILABLE_CODE: "storage_unavailable", VIDEO_STORAGE_UNAVAILABLE_MESSAGE: "Video storage isn't configured." }));
vi.mock("@/lib/usage", () => ({
  userIsAdmin: async (id: string) => id === "u-admin",
  reserve: async () => { throw new Error("should not reserve"); },
  settle: async () => undefined,
  getUsage: async () => ({ plan: calls.who === "max" ? "max" : "trial", admin: calls.who === "admin" }),
  ensureEntitlement: async () => ({ plan: "max", status: "active" }),
  isPaidActive: () => true,
  UsageError: class UsageError extends Error { code = "limit_reached"; },
}));
vi.mock("@/lib/db", () => ({
  prisma: {
    conversation: { findFirst: async () => null, create: async () => ({ id: "c1" }) },
    message: { count: async () => 0, create: async () => ({ id: "m1" }), findFirst: async () => null },
    project: { findFirst: async () => null },
  },
}));

function post(url: string) {
  return new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ message: "a red rook" }),
  });
}

describe("media generation routes with the flag off", () => {
  beforeEach(() => {
    calls.image = 0;
    calls.quote = 0;
    calls.queue = 0;
    delete process.env.MEDIA_GENERATION_ENABLED;
  });

  it("refuses an admin and a Max user before any provider call", async () => {
    const { POST: image } = await import("@/app/api/image/route");
    const { POST: video } = await import("@/app/api/video/route");
    for (const who of ["admin", "max"] as const) {
      calls.who = who;
      const img = await image(post("https://citad3l.test/api/image"));
      const vid = await video(post("https://citad3l.test/api/video"));
      expect(img.status, who).toBe(403);
      expect(vid.status, who).toBe(403);
      expect((await img.json()).error.code).toBe("media_disabled");
      expect((await vid.json()).error.code).toBe("media_disabled");
    }
    expect(calls.image + calls.quote + calls.queue).toBe(0);
  });
});

describe("generation call sites", () => {
  it("only the image and video routes call the generators, and both check the flag first", () => {
    const root = path.resolve(import.meta.dirname, "..");
    const hits: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        if (name === "node_modules" || name === "tests" || name.startsWith(".")) continue;
        const full = path.join(dir, name);
        if (statSync(full).isDirectory()) { walk(full); continue; }
        if (!/\.(ts|tsx|js|mjs)$/.test(name)) continue;
        const src = readFileSync(full, "utf8");
        if (/generateImage\(|queueVideo\(|quoteVideo\(/.test(src)) hits.push(path.relative(root, full));
      }
    };
    walk(path.join(root, "app"));
    walk(path.join(root, "lib"));
    walk(path.join(root, "components"));
    expect(hits.sort()).toEqual([
      "app/api/image/route.ts",
      "app/api/video/route.ts",
      "lib/inference/image.ts",
      "lib/inference/video.ts",
    ]);
    for (const rel of ["app/api/image/route.ts", "app/api/video/route.ts"]) {
      const src = readFileSync(path.join(root, rel), "utf8");
      const head = src.slice(src.indexOf("export async function POST"), src.indexOf("export async function POST") + 220);
      expect(head, rel).toMatch(/if \(!mediaGenerationEnabled\(\)\) return jerr\(403, "media_disabled"/);
    }
  });
});

describe("old image and video chats", () => {
  it("still renders saved media and sends a text follow-up on the default chat model", () => {
    delete process.env.MEDIA_GENERATION_ENABLED;
    const catalog = pickerModels(true, true);
    expect(catalog.map((m) => m.id)).not.toContain("citad3l-image");
    expect(modelForFollowUp("citad3l-image", catalog)).toBe("citad3l-v1");
    expect(modelForFollowUp("citad3l-video", catalog)).toBe("citad3l-v1");
    expect(modelForFollowUp("citad3l-fast", catalog)).toBe("citad3l-fast");
    const image = "See ![Generated image](/api/images/oldimg)";
    const video = 'Clip ![Generated video](/api/videos/oldvid "c3l-video:r2")';
    expect(safeImageSrc("/api/images/oldimg")).toBe("/api/images/oldimg");
    expect(videoIdFromSrc("/api/videos/oldvid")).toEqual({ id: "oldvid", pending: false });
    expect(parseVideoContent(video.split(" ").slice(1).join(" ") ? video : video)).toBeTruthy();
    expect(image).toContain("/api/images/oldimg");
    expect(video).toContain("/api/videos/oldvid");
  });
});
