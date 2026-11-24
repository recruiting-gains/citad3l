import { describe, expect, it } from "vitest";
import {
  decodeBase64Image,
  deleteGeneratedImage,
  deleteImagesForUser,
  extractInlineImages,
  extractStoredImageIds,
  getGeneratedImage,
  imageMarkdown,
  imageObjectKey,
  imagePublicPath,
  loadImageForUser,
  migrateInlineImages,
  putGeneratedImage,
  replaceInlineImage,
  type MessageRow,
  type R2Bucket,
  type R2Object,
} from "@/lib/images-r2";

class MemoryR2 implements R2Bucket {
  store = new Map<string, { body: Uint8Array; contentType: string }>();
  async put(key: string, value: ArrayBuffer | ArrayBufferView | string, opts?: { httpMetadata?: { contentType: string } }) {
    let body: Uint8Array;
    if (typeof value === "string") body = Buffer.from(value);
    else if (value instanceof ArrayBuffer) body = new Uint8Array(value);
    else body = Uint8Array.from(value as Uint8Array);
    this.store.set(key, { body, contentType: opts?.httpMetadata?.contentType || "application/octet-stream" });
  }
  async get(key: string): Promise<R2Object | null> {
    const row = this.store.get(key);
    if (!row) return null;
    const body = row.body;
    return {
      size: body.byteLength,
      httpMetadata: { contentType: row.contentType },
      arrayBuffer: async () => body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength) as ArrayBuffer,
    };
  }
  async delete(key: string | string[]) {
    for (const k of Array.isArray(key) ? key : [key]) this.store.delete(k);
  }
  async list(opts: { prefix?: string; cursor?: string; limit?: number }) {
    const keys = [...this.store.keys()].filter((k) => !opts.prefix || k.startsWith(opts.prefix)).sort();
    const limit = opts.limit ?? 1000;
    const start = opts.cursor ? Number(opts.cursor) || 0 : 0;
    const slice = keys.slice(start, start + limit);
    const next = start + slice.length;
    return {
      objects: slice.map((key) => ({ key })),
      truncated: next < keys.length,
      cursor: next < keys.length ? String(next) : undefined,
    };
  }
}

const tinyPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

function dataMarkdown(b64 = tinyPng.toString("base64"), mime = "image/png", alt = "Generated image") {
  return `![${alt}](<data:${mime};base64,${b64}>)`;
}

describe("image keys and markdown", () => {
  it("builds a stable per-user key and an authenticated path", () => {
    expect(imageObjectKey("user1", "msg1")).toBe("images/user1/msg1");
    expect(imagePublicPath("msg1")).toBe("/api/images/msg1");
    expect(imageMarkdown("msg1")).toBe("![Generated image](/api/images/msg1)");
    expect(() => imageObjectKey("user/1", "msg1")).toThrow(/invalid/);
  });

  it("extracts angled and bare data URIs and stored API paths", () => {
    const angled = dataMarkdown();
    const bare = "![alt](data:image/webp;base64,AAAA)";
    const stored = "See ![Generated image](/api/images/abc123) please";
    const a = extractInlineImages(angled);
    expect(a).toHaveLength(1);
    expect(a[0].mime).toBe("image/png");
    expect(a[0].bytes.byteLength).toBe(tinyPng.byteLength);
    expect(Buffer.from(a[0].bytes).equals(tinyPng)).toBe(true);
    expect(extractInlineImages(bare)[0].mime).toBe("image/webp");
    expect(extractStoredImageIds(stored)).toEqual(["abc123"]);
    expect(extractStoredImageIds(angled)).toEqual([]);
  });

  it("replaces an inline URI with the short markdown URL", () => {
    const md = `Here you go.\n\n${dataMarkdown()}\n`;
    const [img] = extractInlineImages(md);
    expect(replaceInlineImage(md, img, "m1")).toContain("![Generated image](/api/images/m1)");
    expect(replaceInlineImage(md, img, "m1")).not.toMatch(/data:image/);
  });
});

describe("R2 put/get/delete", () => {
  it("round-trips bytes and skips work when no bucket is bound", async () => {
    const bucket = new MemoryR2();
    const bytes = Uint8Array.from(tinyPng);
    const stored = await putGeneratedImage({ userId: "u1", messageId: "m1", bytes, mime: "image/png", bucket });
    expect(stored?.url).toBe("/api/images/m1");
    expect(stored?.key).toBe("images/u1/m1");
    const got = await getGeneratedImage({ userId: "u1", messageId: "m1", bucket });
    expect(got?.mime).toBe("image/png");
    expect(Buffer.from(got!.body).equals(tinyPng)).toBe(true);
    await deleteGeneratedImage({ userId: "u1", messageId: "m1", bucket });
    expect(await getGeneratedImage({ userId: "u1", messageId: "m1", bucket })).toBeNull();
    expect(await putGeneratedImage({ userId: "u1", messageId: "m1", bytes, mime: "image/png", bucket: null })).toBeNull();
  });

  it("lists and deletes every object under a user prefix", async () => {
    const bucket = new MemoryR2();
    await putGeneratedImage({ userId: "u1", messageId: "a", bytes: Uint8Array.from(tinyPng), mime: "image/png", bucket });
    await putGeneratedImage({ userId: "u1", messageId: "b", bytes: Uint8Array.from(tinyPng), mime: "image/png", bucket });
    await putGeneratedImage({ userId: "u2", messageId: "c", bytes: Uint8Array.from(tinyPng), mime: "image/png", bucket });
    expect(await deleteImagesForUser({ userId: "u1", bucket })).toBe(2);
    expect(await getGeneratedImage({ userId: "u1", messageId: "a", bucket })).toBeNull();
    expect(await getGeneratedImage({ userId: "u2", messageId: "c", bucket })).not.toBeNull();
  });
});

describe("authenticated load", () => {
  it("returns R2 bytes for the owner and hides other users' images", async () => {
    const bucket = new MemoryR2();
    await putGeneratedImage({ userId: "u1", messageId: "m1", bytes: Uint8Array.from(tinyPng), mime: "image/png", bucket });
    const rows: Record<string, MessageRow> = {
      m1: { id: "m1", userId: "u1", content: imageMarkdown("m1") },
    };
    const getMessage = async (id: string) => rows[id] ?? null;
    const ok = await loadImageForUser({ userId: "u1", messageId: "m1", getMessage, bucket });
    expect("body" in ok && Buffer.from(ok.body).equals(tinyPng)).toBe(true);
    const hidden = await loadImageForUser({ userId: "u2", messageId: "m1", getMessage, bucket });
    expect(hidden).toEqual({ error: "not_found" });
  });

  it("falls back to an inline data URI still stored on the row", async () => {
    const rows: Record<string, MessageRow> = {
      m2: { id: "m2", userId: "u1", content: dataMarkdown() },
    };
    const got = await loadImageForUser({
      userId: "u1",
      messageId: "m2",
      getMessage: async (id) => rows[id] ?? null,
      bucket: new MemoryR2(),
    });
    expect("body" in got && Buffer.from(got.body).equals(tinyPng)).toBe(true);
    if ("body" in got) expect(got.mime).toBe("image/png");
  });
});

describe("migration", () => {
  it("dry-run counts inline bytes and does not write", async () => {
    const bucket = new MemoryR2();
    const md = dataMarkdown();
    const rows: MessageRow[] = [
      { id: "m1", userId: "u1", content: md },
      { id: "m2", userId: "u1", content: "just text" },
      { id: "m3", userId: "u1", content: imageMarkdown("m3") },
    ];
    const updates: string[] = [];
    const result = await migrateInlineImages({
      list: async ({ offset, limit }) => rows.slice(offset, offset + limit),
      updateContent: async (id) => { updates.push(id); },
      bucket,
      dryRun: true,
    });
    expect(result.scanned).toBe(3);
    expect(result.migrated).toBe(1);
    expect(result.skipped).toBe(2);
    expect(result.bytesMoved).toBe(tinyPng.byteLength);
    expect(updates).toEqual([]);
    expect(bucket.store.size).toBe(0);
    expect(rows[0].content).toBe(md);
  });

  it("apply mode uploads to R2 and rewrites the row", async () => {
    const bucket = new MemoryR2();
    const rows: MessageRow[] = [{ id: "m1", userId: "u1", content: `ok\n${dataMarkdown()}` }];
    const result = await migrateInlineImages({
      list: async ({ offset, limit }) => rows.slice(offset, offset + limit),
      updateContent: async (id, content) => {
        const row = rows.find((r) => r.id === id);
        if (row) row.content = content;
      },
      bucket,
      dryRun: false,
    });
    expect(result.migrated).toBe(1);
    expect(result.errors).toEqual([]);
    expect(rows[0].content).toBe("ok\n![Generated image](/api/images/m1)");
    const got = await getGeneratedImage({ userId: "u1", messageId: "m1", bucket });
    expect(got && Buffer.from(got.body).equals(tinyPng)).toBe(true);
  });

  it("records an error when the bucket is missing in apply mode", async () => {
    const rows: MessageRow[] = [{ id: "m1", userId: "u1", content: dataMarkdown() }];
    const result = await migrateInlineImages({
      list: async ({ offset, limit }) => rows.slice(offset, offset + limit),
      updateContent: async () => {},
      bucket: null,
      dryRun: false,
    });
    expect(result.migrated).toBe(0);
    expect(result.errors[0]?.id).toBe("m1");
    expect(rows[0].content).toMatch(/data:image/);
  });

  it("shows why Neon free storage fills up with inline images", () => {
    // Current live size is about 340 KB per generated image in Message.content.
    const perImage = 340_000;
    const neonFreeBytes = 0.5 * 1024 * 1024 * 1024;
    const room = Math.floor(neonFreeBytes / perImage);
    expect(room).toBeLessThan(1600);
    expect(decodeBase64Image(tinyPng.toString("base64")).byteLength).toBe(tinyPng.byteLength);
  });
});
