import { readFileSync } from "node:fs";
import { describe, it, expect, vi } from "vitest";
import { LEAK_RE, LEAK_WORDS } from "./leak-words";

/* 2026-11-19 7:18 PM CT: Image → test-image-model, Video → test-video-t2v. */
describe("Citad3L Image request body for test-image-model", () => {
  it("sends aspect_ratio 1:1 + resolution 1K (no width/height), webp, safe_mode, 1 variant, JSON", async () => {
    const saved = { key: process.env.PROVIDER_API_KEY, prov: process.env.INFERENCE_PROVIDER };
    process.env.PROVIDER_API_KEY = "test-key-not-real";
    process.env.MEDIA_GENERATION_ENABLED = "true";
    delete process.env.INFERENCE_PROVIDER;
    const webp = Buffer.from("RIFF\0\0\0\0WEBPVP8 ", "latin1").toString("base64");
    const bodies: any[] = [];
    const urls: string[] = [];
    const orig = globalThis.fetch;
    globalThis.fetch = vi.fn(async (u: any, init: any) => { urls.push(String(u)); bodies.push(JSON.parse(init.body)); return Response.json({ id: "x", images: [webp] }); }) as any;
    try {
      const { generateImage } = await import("@/lib/inference/image");
      const r = await generateImage("Q4 Revenue Forecast", new AbortController().signal);
      expect(r.mime).toBe("image/webp");
      expect(r.markdown.startsWith("![Generated image](<data:image/webp;base64,")).toBe(true);
      expect(r.markdown).not.toMatch(LEAK_RE);
    } finally {
      globalThis.fetch = orig;
      if (saved.key === undefined) delete process.env.PROVIDER_API_KEY; else process.env.PROVIDER_API_KEY = saved.key;
      if (saved.prov === undefined) delete process.env.INFERENCE_PROVIDER; else process.env.INFERENCE_PROVIDER = saved.prov;
      delete process.env.MEDIA_GENERATION_ENABLED;
    }
    expect(urls[0]).toMatch(/\/image\/generate$/);
    expect(bodies[0]).toEqual({ model: "test-image-model", prompt: "Q4 Revenue Forecast", aspect_ratio: "1:1", resolution: "1K", format: "webp", safe_mode: true, variants: 1, return_binary: false });
  });
  it("sniffs the real image type from bytes", async () => {
    const { sniffMime } = await import("@/lib/inference/image");
    expect(sniffMime(new Uint8Array([0x89, 0x50, 0x4e, 0x47]), "image/webp")).toBe("image/png");
    expect(sniffMime(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]), "image/webp")).toBe("image/jpeg");
    expect(sniffMime(new Uint8Array([1, 2, 3]), "image/webp")).toBe("image/webp");
  });
});

describe("no provider IDs or stale prices in client-facing copy", () => {
  const files = ["components/model/ModelView.tsx", "components/chat/ChatWorkspace.tsx", "components/chat/ModelPicker.tsx", "components/marketing/PricingView.tsx", "lib/models.ts", "lib/faq.ts"];
  it.each(files)("%s", (f) => {
    const s = readFileSync(new URL(`../${f}`, import.meta.url), "utf8");
    for (const bad of [...LEAK_WORDS, "$0.64"]) expect(s, `${f}: ${bad}`).not.toContain(bad);
  });
  it("public launch: customer-facing Video copy names the daily limit but never our cost or provider", () => {
    const mv = readFileSync(new URL("../components/model/ModelView.tsx", import.meta.url), "utf8");
    const ws = readFileSync(new URL("../components/chat/ChatWorkspace.tsx", import.meta.url), "utf8");
    expect(mv).toContain("with a daily clip limit");
    expect(ws).toContain("Max plan, a few clips per day");
    for (const s of [mv, ws]) { expect(s).not.toContain("$1.44"); expect(s).not.toMatch(LEAK_RE); }
  });
});
