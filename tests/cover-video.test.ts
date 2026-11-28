import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MODELS } from "@/lib/models";

const pub = (p: string) => join(process.cwd(), "public", p);

describe("model card videos", () => {
  const withVideo = MODELS.filter((m) => m.coverVideo);
  it("has the Qwen 4 MAX and Gemma 4 uncensored loops", () => {
    expect(withVideo.map((m) => m.id).sort()).toEqual(expect.arrayContaining(["gemma4-uncensored", "qwen4-max"]));
  });
  it("ships mp4, webm and a poster for each, and the poster is the card cover", () => {
    for (const m of withVideo) {
      expect(existsSync(pub(`${m.coverVideo}.mp4`))).toBe(true);
      expect(existsSync(pub(`${m.coverVideo}.webm`))).toBe(true);
      expect(m.cover && existsSync(pub(m.cover))).toBe(true);
    }
  });
  it("keeps copy free of vendor names and 'unlimited'", () => {
    for (const m of withVideo) expect(`${m.coverAlt} ${m.summary}`).not.toMatch(/unlimited|no limits/i);
  });
});
