import { describe, it, expect, vi, beforeEach } from "vitest";
import type { R2Bucket, R2Object, R2Range } from "@/lib/images-r2";

/* R2 for images AND videos (one private bucket, IMAGES → citad3l-images), owner-only serving, Range, isolation. */
class MemoryR2 implements R2Bucket {
  store = new Map<string, { body: Uint8Array; contentType: string }>();
  gets: { key: string; range?: R2Range }[] = [];
  async put(key: string, value: any, opts?: { httpMetadata?: { contentType: string } }) {
    this.store.set(key, { body: Uint8Array.from(value as Uint8Array), contentType: opts?.httpMetadata?.contentType ?? "application/octet-stream" });
  }
  async head(key: string) {
    const r = this.store.get(key);
    return r ? { size: r.body.byteLength, httpMetadata: { contentType: r.contentType } } : null;
  }
  async get(key: string, opts?: { range?: R2Range }): Promise<R2Object | null> {
    this.gets.push({ key, range: opts?.range });
    const r = this.store.get(key);
    if (!r) return null;
    let body = r.body;
    if (opts?.range && "offset" in opts.range) body = body.subarray(opts.range.offset, opts.range.length === undefined ? undefined : opts.range.offset + opts.range.length);
    return { size: r.body.byteLength, httpMetadata: { contentType: r.contentType }, arrayBuffer: async () => body.slice().buffer as ArrayBuffer };
  }
  async delete(key: string | string[]) { for (const k of Array.isArray(key) ? key : [key]) this.store.delete(k); }
  async list(o: { prefix?: string }) { return { objects: [...this.store.keys()].filter((k) => k.startsWith(o.prefix ?? "")).map((key) => ({ key })), truncated: false }; }
}

const rows: { id: string; userId: string; role: string; content: string; status?: string }[] = [];
vi.mock("@/lib/db", () => ({
  prisma: {
    message: {
      findFirst: async (q: any) => rows.find((r) => r.id === q.where.id && (q.where.userId === undefined || r.userId === q.where.userId) && (q.where.role === undefined || r.role === q.where.role)) ?? null,
      update: async (q: any) => { const r = rows.find((x) => x.id === q.where.id)!; Object.assign(r, q.data); return r; },
      updateMany: async (q: any) => {
        const w = q.where ?? {};
        let count = 0;
        for (const r of rows) {
          if (w.id && r.id !== w.id) continue;
          if (w.status && typeof w.status === "string" && r.status !== w.status) continue;
          if (w.status?.not && r.status === w.status.not) continue;
          if (w.content?.contains && !(r.content ?? "").includes(w.content.contains)) continue;
          Object.assign(r, q.data);
          count++;
        }
        return { count };
      },
    },
  },
}));
const providerDl = vi.fn();
const CLIP = new Uint8Array(Array.from({ length: 1000 }, (_, i) => i % 251));
const pollState: { result: { status: "done"; bytes: Uint8Array; mime: string; downloadUrl: string | null; downloadUrlVerified: boolean } } = {
  result: { status: "done", bytes: CLIP, mime: "video/mp4", downloadUrl: null, downloadUrlVerified: false },
};
vi.mock("@/lib/inference/video", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/inference/video")>();
  return {
    ...real,
    pollVideo: async () => pollState.result,
    downloadVideo: async (...a: unknown[]) => { providerDl(...a); return { bytes: CLIP, mime: "video/mp4" }; },
  };
});

const { videoContent } = await import("@/lib/video-content");
const { finalizeVideo, serveVideo, videoObjectKey } = await import("@/lib/video-store");
const { putGeneratedImage, loadImageForUser, deleteGeneratedImage, deleteImagesForUser } = await import("@/lib/images-r2");
const job = { queueId: "q1", downloadUrl: "https://private-share.media.provider.test/q1.mp4" };

beforeEach(() => {
  rows.length = 0;
  providerDl.mockClear();
  pollState.result = { status: "done", bytes: CLIP, mime: "video/mp4", downloadUrl: null, downloadUrlVerified: false };
  rows.push({ id: "vcruz", userId: "u-cruz", role: "assistant", content: videoContent("vcruz", job, { pending: true }) });
  rows.push({ id: "vcousin", userId: "u-cousin", role: "assistant", content: videoContent("vcousin", job) });
});

describe("videos in R2", () => {
  it("finished render is copied to R2 at videos/{user}/{message} and the message records the R2 copy (no 24 h expiry)", async () => {
    const b = new MemoryR2();
    const r = await finalizeVideo({ userId: "u-cruz", messageId: "vcruz", bucket: b });
    expect(r.status).toBe("ready");
    expect(b.store.get("videos/u-cruz/vcruz")?.body.byteLength).toBe(1000);
    expect(rows[0].content).toBe('![Generated video](/api/videos/vcruz "c3l-video:r2")');
    expect(rows[0].status).toBe("complete");
  });
  it("serves from R2 with Range: 200 full, 206 slice read straight from R2, 416 out of range", async () => {
    const b = new MemoryR2();
    await finalizeVideo({ userId: "u-cruz", messageId: "vcruz", bucket: b });
    const full = (await serveVideo({ userId: "u-cruz", messageId: "vcruz", range: null, bucket: b })) as Response;
    expect(full.status).toBe(200);
    expect(full.headers.get("accept-ranges")).toBe("bytes");
    expect(full.headers.get("content-length")).toBe("1000");
    const part = (await serveVideo({ userId: "u-cruz", messageId: "vcruz", range: "bytes=0-1", bucket: b })) as Response;
    expect(part.status).toBe(206);
    expect(part.headers.get("content-range")).toBe("bytes 0-1/1000");
    expect(Array.from(new Uint8Array(await part.arrayBuffer()))).toEqual([0, 1]);
    expect(b.gets.at(-1)!.range).toEqual({ offset: 0, length: 2 }); // only the slice was read
    const tail = (await serveVideo({ userId: "u-cruz", messageId: "vcruz", range: "bytes=990-", bucket: b })) as Response;
    expect(tail.headers.get("content-range")).toBe("bytes 990-999/1000");
    expect(((await serveVideo({ userId: "u-cruz", messageId: "vcruz", range: "bytes=5000-", bucket: b })) as Response).status).toBe(416);
    expect(providerDl).not.toHaveBeenCalled(); // never goes back to the provider once it's in R2
  });
  it("isolation: one admin can't load the other's clip (not_found), even with R2 holding both", async () => {
    const b = new MemoryR2();
    await b.put(videoObjectKey("u-cousin", "vcousin"), CLIP, { httpMetadata: { contentType: "video/mp4" } });
    expect(await serveVideo({ userId: "u-cruz", messageId: "vcousin", range: null, bucket: b })).toEqual({ error: "not_found" });
    expect(await serveVideo({ userId: "u-cousin", messageId: "vcruz", range: null, bucket: b })).toEqual({ error: "not_found" });
    expect(await finalizeVideo({ userId: "u-cruz", messageId: "vcousin", bucket: b })).toEqual({ status: "not_found" });
  });
  it("a clip finished before R2 existed is backfilled into R2 the first time it's played", async () => {
    const b = new MemoryR2();
    const r = (await serveVideo({ userId: "u-cousin", messageId: "vcousin", range: "bytes=0-9", bucket: b })) as Response;
    expect(r.status).toBe(206);
    expect(providerDl).toHaveBeenCalledTimes(1);
    expect(b.store.has("videos/u-cousin/vcousin")).toBe(true);
    expect(rows[1].content).toContain('"c3l-video:r2"');
  });
  it("without R2 (binding missing) it still works from the provider's link", async () => {
    const r = (await serveVideo({ userId: "u-cousin", messageId: "vcousin", range: "bytes=0-1", bucket: null })) as Response;
    expect(r.status).toBe(206);
    expect(rows[1].content).not.toContain('"c3l-video:r2"');
  });
  it("persists a retrieve-time download_url when queue had none, and stays ready without R2 via that 24h link", async () => {
    const late = "https://private-share.media.provider.test/late.mp4";
    rows[0].content = videoContent("vcruz", { queueId: "q1", downloadUrl: null }, { pending: true });
    pollState.result = { status: "done", bytes: CLIP, mime: "video/mp4", downloadUrl: late, downloadUrlVerified: true };
    const r = await finalizeVideo({ userId: "u-cruz", messageId: "vcruz", bucket: null });
    expect(r.status).toBe("ready");
    expect(rows[0].status).toBe("complete");
    expect(rows[0].content).not.toContain('"c3l-video:r2"');
    expect(rows[0].content).toContain("/api/videos/vcruz");
    const served = (await serveVideo({ userId: "u-cruz", messageId: "vcruz", range: "bytes=0-1", bucket: null })) as Response;
    expect(served.status).toBe(206);
    expect(providerDl).toHaveBeenCalled();
  });
  it("marks the message error (not ready) when bytes were fetched but there is no R2 and no download URL to serve later", async () => {
    rows[0].content = videoContent("vcruz", { queueId: "q1", downloadUrl: null }, { pending: true });
    pollState.result = { status: "done", bytes: CLIP, mime: "video/mp4", downloadUrl: null, downloadUrlVerified: false };
    const r = await finalizeVideo({ userId: "u-cruz", messageId: "vcruz", bucket: null });
    expect(r.status).toBe("error");
    expect(rows[0].status).toBe("error");
    expect(rows[0].content).toContain("pending=1"); // still the pending markdown, not a dead ready player
    const served = await serveVideo({ userId: "u-cruz", messageId: "vcruz", range: null, bucket: null });
    expect(served).toEqual({ error: "pending" });
  });
  it("treats an unverified queue-time URL as not serveable when R2 put fails (direct retrieve bytes)", async () => {
    const failing: R2Bucket = {
      async put() { throw new Error("R2 down"); },
      async get() { return null; },
      async delete() {},
    };
    pollState.result = { status: "done", bytes: CLIP, mime: "video/mp4", downloadUrl: job.downloadUrl, downloadUrlVerified: false };
    const r = await finalizeVideo({ userId: "u-cruz", messageId: "vcruz", bucket: failing });
    expect(r.status).toBe("error");
    expect(rows[0].status).toBe("error");
    expect(rows[0].content).toContain("pending=1");
  });
  it("stays ready from a just-fetched retrieve URL when R2 put fails", async () => {
    const late = "https://private-share.media.provider.test/late.mp4";
    const failing: R2Bucket = {
      async put() { throw new Error("R2 down"); },
      async get() { return null; },
      async delete() {},
    };
    rows[0].content = videoContent("vcruz", { queueId: "q1", downloadUrl: null }, { pending: true });
    pollState.result = { status: "done", bytes: CLIP, mime: "video/mp4", downloadUrl: late, downloadUrlVerified: true };
    const r = await finalizeVideo({ userId: "u-cruz", messageId: "vcruz", bucket: failing });
    expect(r.status).toBe("ready");
    expect(rows[0].status).toBe("complete");
    expect(rows[0].content).not.toContain('"c3l-video:r2"');
  });
  it("a failed second finalizer cannot overwrite a completed R2 copy", async () => {
    const b = new MemoryR2();
    let puts = 0;
    const orig = b.put.bind(b);
    b.put = async (key, value, opts) => {
      puts++;
      if (puts > 1) throw new Error("second put fails");
      return orig(key, value, opts);
    };
    const first = await finalizeVideo({ userId: "u-cruz", messageId: "vcruz", bucket: b });
    expect(first.status).toBe("ready");
    expect(rows[0].status).toBe("complete");
    const saved = rows[0].content;
    pollState.result = { status: "done", bytes: CLIP, mime: "video/mp4", downloadUrl: null, downloadUrlVerified: false };
    // content is no longer pending, so the second call should report ready and leave the R2 record
    const second = await finalizeVideo({ userId: "u-cruz", messageId: "vcruz", bucket: b });
    expect(second.status).toBe("ready");
    expect(rows[0].status).toBe("complete");
    expect(rows[0].content).toBe(saved);
    expect(rows[0].content).toContain('"c3l-video:r2"');
    // simulate a racer that already read pending content and now tries the error write
    const { prisma } = await import("@/lib/db");
    await prisma.message.updateMany({
      where: { id: "vcruz", status: { not: "complete" }, content: { contains: "?pending=1" } },
      data: { status: "error" },
    });
    expect(rows[0].status).toBe("complete");
  });
});

describe("images in R2 (backward compatible) and cleanup", () => {
  it("new images go to R2 and are served only to their owner; old inline data-URI images still load", async () => {
    const b = new MemoryR2();
    const png = new Uint8Array([137, 80, 78, 71]);
    const put = await putGeneratedImage({ userId: "u-cruz", messageId: "img1", bytes: png, mime: "image/png", bucket: b });
    expect(put?.markdown).toBe("![Generated image](/api/images/img1)");
    const rowsI = new Map([
      ["img1", { id: "img1", userId: "u-cruz", content: put!.markdown }],
      ["old1", { id: "old1", userId: "u-cruz", content: "![Generated image](data:image/png;base64,iVBORw==)" }],
    ]);
    const getMessage = async (id: string) => rowsI.get(id) ?? null;
    expect(await loadImageForUser({ userId: "u-cruz", messageId: "img1", getMessage, bucket: b })).toEqual({ body: png, mime: "image/png" });
    expect(await loadImageForUser({ userId: "u-cousin", messageId: "img1", getMessage, bucket: b })).toEqual({ error: "not_found" });
    const old = await loadImageForUser({ userId: "u-cruz", messageId: "old1", getMessage, bucket: b });
    expect("body" in old && old.mime).toBe("image/png");
    expect(await loadImageForUser({ userId: "u-cousin", messageId: "old1", getMessage, bucket: b })).toEqual({ error: "not_found" });
  });
  it("deleting a chat or account removes its images and videos from R2", async () => {
    const b = new MemoryR2();
    await b.put("images/u-cruz/m1", new Uint8Array([1]));
    await b.put("videos/u-cruz/m2", new Uint8Array([1]));
    await b.put("videos/u-cousin/m3", new Uint8Array([1]));
    await deleteGeneratedImage({ userId: "u-cruz", messageId: "m2", bucket: b });
    expect(b.store.has("videos/u-cruz/m2")).toBe(false);
    expect(await deleteImagesForUser({ userId: "u-cruz", bucket: b })).toBe(1);
    expect([...b.store.keys()]).toEqual(["videos/u-cousin/m3"]);
  });
});

describe("routes", () => {
  it("isVideoStorageConfigured is true only when a bucket is bound", async () => {
    const { isVideoStorageConfigured } = await import("@/lib/video-store");
    expect(isVideoStorageConfigured(new MemoryR2())).toBe(true);
    expect(isVideoStorageConfigured(null)).toBe(false);
  });
  it("/api/videos and /api/images: signed-in owner only (401 signed out); wrangler binding ready but off until R2 is enabled", async () => {
    const { readFileSync } = await import("node:fs");
    const v = readFileSync(new URL("../app/api/videos/[id]/route.ts", import.meta.url), "utf8");
    const i = readFileSync(new URL("../app/api/images/[id]/route.ts", import.meta.url), "utf8");
    expect(v).toMatch(/jerr\(401/);
    expect(v).toContain("serveVideo({ userId");
    expect(i).toMatch(/jerr\(401/);
    const w = readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8");
    expect(w).toMatch(/"binding": "IMAGES", "bucket_name": "citad3l-images"/);
  });
});
