import { describe, it, expect, beforeAll } from "vitest";
import { parseVideoContent, videoContent, videoIdFromSrc } from "@/lib/video-content";
import { downloadVideo, pollVideo, queueVideo, quoteVideo, VIDEO_PARAMS, videoMaxPerDay, videoMaxUsdPerClip, videoModelId, videoRequestBody } from "@/lib/inference/video";
import { parseRange, rangeResponse } from "@/lib/video-store";
import { LEAK_RE, LEAK_WORDS } from "./leak-words";
import { isProviderMediaUrl } from "@/lib/inference/provider-models";

beforeAll(() => { process.env.PROVIDER_API_KEY = process.env.PROVIDER_API_KEY || "test-key-not-real"; });

type Call = { url: string; body: any };
function fakeFetch(handler: (url: string, body: any) => Response) {
  const calls: Call[] = [];
  const f = (async (url: any, init?: any) => {
    const body = init?.body ? JSON.parse(init.body) : null;
    calls.push({ url: String(url), body });
    return handler(String(url), body);
  }) as typeof fetch;
  return { f, calls };
}

describe("video content format", () => {
  it("round-trips pending → finished, and keeps https links only", () => {
    const job = { queueId: "abc-123", downloadUrl: "https://private-share.media.provider.test/x/y.mp4?sig=1" };
    const p = videoContent("m1", job, { pending: true });
    expect(videoIdFromSrc("/api/videos/m1?pending=1")).toEqual({ id: "m1", pending: true });
    expect(parseVideoContent(p)).toEqual({ messageId: "m1", pending: true, stored: false, job });
    expect(parseVideoContent(videoContent("m1", job))).toMatchObject({ pending: false, job });
    expect(parseVideoContent(videoContent("m1", job, { stored: true }))).toEqual({ messageId: "m1", pending: false, stored: true, job: null });
    const evil = videoContent("m1", { queueId: "q", downloadUrl: "https://evil.example/v.mp4" });
    expect(parseVideoContent(evil, isProviderMediaUrl)!.job!.downloadUrl).toBeNull();
    expect(parseVideoContent(videoContent("m1", { queueId: "q", downloadUrl: "http://plain.example/v.mp4" }))!.job!.downloadUrl).toBeNull();
    expect(parseVideoContent("plain text")).toBeNull();
    expect(() => videoContent("../x", job)).toThrow();
    expect(videoIdFromSrc("/api/videos/../../etc")).toBeNull();
  });
});

describe("provider async video client", () => {
  it("uses the configured model and 5 s / 720p params; caps default to $1.60 and 2/day (public launch, $20/month provider cap)", async () => {
    expect(videoModelId()).toBe("test-video-t2v");
    expect(VIDEO_PARAMS).toMatchObject({ duration: "5s", resolution: "720p" });
    expect(videoMaxUsdPerClip()).toBe(1.6);
    expect(videoMaxPerDay()).toBe(2);
    const { f, calls } = fakeFetch((url) => url.endsWith("/video/quote") ? Response.json({ quote: 1.44 }) : Response.json({ queue_id: "q-9", download_url: "https://private-share.media.provider.test/q-9.mp4" }));
    expect(await quoteVideo(undefined, f)).toBe(1.44);
    expect(await queueVideo("a rook", undefined, f)).toEqual({ queueId: "q-9", downloadUrl: "https://private-share.media.provider.test/q-9.mp4" });
    expect(calls[0].body).toMatchObject({ model: "test-video-t2v", duration: "5s", resolution: "720p", aspect_ratio: "16:9", audio: true });
    expect(calls[1].body).toMatchObject({ prompt: "a rook", model: "test-video-t2v" });
  });
  it("image-to-video quote and queue use the image model and pass image_url (no live generation)", async () => {
    const frame = "data:image/jpeg;base64,/9j/4AAQ";
    expect(videoModelId("i2v")).toBe("test-video-i2v");
    expect(videoRequestBody({ prompt: "the camera pans", imageUrl: frame })).toMatchObject({
      model: "test-video-i2v",
      prompt: "the camera pans",
      image_url: frame,
      duration: "5s",
      resolution: "720p",
      aspect_ratio: "16:9",
      audio: true,
    });
    expect(videoRequestBody({ prompt: "a rook" }).image_url).toBeUndefined();
    const { f, calls } = fakeFetch((url) => url.endsWith("/video/quote") ? Response.json({ quote: 1.44 }) : Response.json({ queue_id: "q-img", download_url: "https://private-share.media.provider.test/q-img.mp4" }));
    expect(await quoteVideo(undefined, f, frame)).toBe(1.44);
    expect(await queueVideo("the camera pans", undefined, f, frame)).toEqual({ queueId: "q-img", downloadUrl: "https://private-share.media.provider.test/q-img.mp4" });
    expect(calls[0].body).toMatchObject({ model: "test-video-i2v", image_url: frame, duration: "5s" });
    expect(calls[0].url.endsWith("/video/quote")).toBe(true);
    expect(calls[1].body).toMatchObject({ model: "test-video-i2v", prompt: "the camera pans", image_url: frame });
    expect(calls[1].url.endsWith("/video/queue")).toBe(true);
  });
  it("polls PROCESSING → COMPLETED and downloads from the provider link", async () => {
    let n = 0;
    const mp4 = new Uint8Array([0, 0, 0, 24, 102, 116, 121, 112]);
    const { f } = fakeFetch((url) => {
      if (url.endsWith("/video/retrieve")) return Response.json({ status: ++n < 2 ? "PROCESSING" : "COMPLETED", average_execution_time: 20000, execution_duration: 5000 });
      return new Response(mp4, { headers: { "content-type": "video/mp4" } });
    });
    const job = { queueId: "q-9", downloadUrl: "https://private-share.media.provider.test/q-9.mp4" };
    expect(await pollVideo(job, undefined, f)).toEqual({ status: "processing", etaMs: 15000 });
    const done = await pollVideo(job, undefined, f);
    expect(done.status).toBe("done");
    expect(done.status === "done" && Array.from(done.bytes)).toEqual(Array.from(mp4));
  });
  it("accepts an mp4 body straight from /video/retrieve, and refuses non-provider hosts", async () => {
    const { f } = fakeFetch(() => new Response(new Uint8Array([1, 2, 3]), { headers: { "content-type": "video/mp4" } }));
    expect((await pollVideo({ queueId: "q", downloadUrl: null }, undefined, f)).status).toBe("done");
    await expect(downloadVideo("https://evil.example/v.mp4", undefined, f)).rejects.toThrow(/Unexpected video host/);
  });
  it("an over-budget or failed quote throws instead of queueing", async () => {
    const { f } = fakeFetch(() => Response.json({ error: "nope" }, { status: 500 }));
    await expect(quoteVideo(undefined, f)).rejects.toThrow();
  });
});

describe("range responses (Safari needs 206)", () => {
  const bytes = new Uint8Array(Array.from({ length: 100 }, (_, i) => i));
  it("200 full, 206 partial, 416 out of range", async () => {
    const full = rangeResponse(bytes, "video/mp4", null);
    expect(full.status).toBe(200);
    expect(full.headers.get("accept-ranges")).toBe("bytes");
    const part = rangeResponse(bytes, "video/mp4", "bytes=0-1");
    expect(part.status).toBe(206);
    expect(part.headers.get("content-range")).toBe("bytes 0-1/100");
    expect(Array.from(new Uint8Array(await part.arrayBuffer()))).toEqual([0, 1]);
    expect(rangeResponse(bytes, "video/mp4", "bytes=90-").headers.get("content-range")).toBe("bytes 90-99/100");
    expect(rangeResponse(bytes, "video/mp4", "bytes=-10").headers.get("content-range")).toBe("bytes 90-99/100");
    expect(rangeResponse(bytes, "video/mp4", "bytes=200-").status).toBe(416);
  });
});

describe("video route wiring", () => {
  it("accepts a starting-frame image, quotes with it, and keeps provider ids off the route responses", async () => {
    const { readFileSync } = await import("node:fs");
    const route = readFileSync(new URL("../app/api/video/route.ts", import.meta.url), "utf8");
    expect(route).toContain("checkAttachments");
    expect(route).toContain("MAX_VIDEO_JSON_BYTES");
    expect(route).toContain("quoteVideo(req.signal, fetch, imageUrl)");
    expect(route).toContain("queueVideo(prompt, req.signal, fetch, imageUrl)");
    expect(route).toContain("MAX_VIDEO_IMAGES");
    expect(route).not.toMatch(/providerModelId/i);
    expect(route).not.toMatch(LEAK_RE);
    const ws = readFileSync(new URL("../components/chat/ChatWorkspace.tsx", import.meta.url), "utf8");
    expect(ws).toContain("Attach a picture to start the video from");
    expect(ws).not.toMatch(LEAK_RE);
  });
});
