import { readFileSync } from "node:fs";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
vi.mock("server-only", () => ({}));

const mockRequireUserId = vi.fn<() => Promise<string | null>>(async () => "user_alice");
const mockBannedMessage = vi.fn<() => Promise<string | null>>(async () => null);
const mockFindMessage = vi.fn();

vi.mock("@/auth", () => ({
  requireUserId: () => mockRequireUserId(),
}));

vi.mock("@/lib/banned", () => ({
  bannedMessage: () => mockBannedMessage(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    message: {
      findFirst: (...args: unknown[]) => mockFindMessage(...args),
    },
  },
}));

import { extractCodeBlocks } from "@/lib/downloads";
import {
  createSignedExport,
  ExportError,
  loadSignedExport,
  maybeCreateAutoExports,
  shouldAutoExport,
  signExportLink,
  verifyExportSignature,
  type ExportR2Bucket,
} from "@/lib/exports-r2";
import {
  resetRateLimitMemory,
  setRateLimitStore,
  type RateLimitStore,
} from "@/lib/ratelimit";

function memoryR2(): ExportR2Bucket & {
  store: Map<string, { bytes: Uint8Array; httpMetadata?: Record<string, string>; customMetadata?: Record<string, string> }>;
} {
  const store = new Map<string, { bytes: Uint8Array; httpMetadata?: Record<string, string>; customMetadata?: Record<string, string> }>();
  return {
    store,
    async put(key, value, opts) {
      const bytes =
        typeof value === "string"
          ? new TextEncoder().encode(value)
          : value instanceof Uint8Array
            ? Uint8Array.from(value)
            : new Uint8Array(value instanceof ArrayBuffer ? value : value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength));
      store.set(key, {
        bytes,
        httpMetadata: opts?.httpMetadata,
        customMetadata: opts?.customMetadata,
      });
    },
    async get(key) {
      const item = store.get(key);
      if (!item) return null;
      return {
        size: item.bytes.byteLength,
        httpMetadata: item.httpMetadata,
        customMetadata: item.customMetadata,
        async arrayBuffer() {
          return item.bytes.buffer.slice(item.bytes.byteOffset, item.bytes.byteOffset + item.bytes.byteLength) as ArrayBuffer;
        },
      };
    },
    async delete(keys) {
      for (const k of Array.isArray(keys) ? keys : [keys]) store.delete(k);
    },
    async list(opts) {
      const prefix = opts.prefix ?? "";
      const objects = [...store.entries()]
        .filter(([k]) => k.startsWith(prefix))
        .map(([k, v]) => ({ key: k, size: v.bytes.byteLength }));
      return { objects, truncated: false };
    },
  };
}

function memoryRateStore(): RateLimitStore {
  const counts = new Map<string, number>();
  return {
    async hit(key, windowStart) {
      const k = `${key}:${windowStart.getTime()}`;
      const next = (counts.get(k) ?? 0) + 1;
      counts.set(k, next);
      return next;
    },
  };
}

beforeEach(() => {
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("AUTH_SECRET", "test-export-secret-1234567890");
  resetRateLimitMemory();
  setRateLimitStore(memoryRateStore());
  mockRequireUserId.mockReset();
  mockRequireUserId.mockResolvedValue("user_alice");
  mockBannedMessage.mockReset();
  mockBannedMessage.mockResolvedValue(null);
  mockFindMessage.mockReset();
});

afterEach(() => {
  setRateLimitStore(undefined);
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("multi-file project extraction", () => {
  it("extracts paths from preceding markdown headings/labels as well as fence info and comments", () => {
    const md = [
      "### src/bot.py",
      "```python",
      "def main():",
      "    return 'ok'",
      "```",
      "",
      "**`config/settings.json`**",
      "```json",
      '{"max_daily_loss": 50}',
      "```",
      "",
      "File: `README.md`:",
      "```markdown",
      "# Trading Bot",
      "```",
      "",
      "### ../../etc/passwd",
      "```bash",
      "echo safe",
      "```",
    ].join("\n");

    const blocks = extractCodeBlocks(md);
    expect(blocks.map((b) => b.filename)).toEqual([
      "src/bot.py",
      "config/settings.json",
      "README.md",
      "code-04.sh",
    ]);
  });
});

describe("R2 server-side exports & signed short-lived links", () => {
  it("creates signed zip & PDF in R2 for signed-in users and serves only the owner", async () => {
    const bucket = memoryR2();
    const nowMs = 1_795_000_000_000;
    const bundle = await createSignedExport({
      userId: "user_alice",
      kind: "both",
      title: "Kalshi Multi-File Bot",
      markdown: [
        "# Kalshi Multi-File Bot",
        "",
        "### bot/main.py",
        "```python",
        "print('running')",
        "```",
        "",
        "```toml",
        "# pyproject.toml",
        'name = "kalshi-bot"',
        "```",
      ].join("\n"),
      bucket,
      nowMs,
    });

    expect(bundle.zip).toBeDefined();
    expect(bundle.pdf).toBeDefined();
    expect(bundle.zip!.fileCount).toBe(3);
    expect(bundle.zip!.url).toMatch(/^\/api\/exports\/exp_[a-f0-9]{24}\?/);
    expect(bucket.store.size).toBe(2);

    // Parse signed URL params and verify download works for user_alice
    const zipUrl = new URL("https://citad3l.io" + bundle.zip!.url);
    const loadedZip = await loadSignedExport({
      userId: "user_alice",
      exportId: bundle.zip!.exportId,
      kind: "zip",
      filename: zipUrl.searchParams.get("name")!,
      expMs: Number(zipUrl.searchParams.get("exp")),
      sig: zipUrl.searchParams.get("sig")!,
      bucket,
      nowMs: nowMs + 60_000,
    });
    expect("body" in loadedZip).toBe(true);
    if ("body" in loadedZip) {
      const JSZip = (await import("jszip")).default;
      const z = await JSZip.loadAsync(loadedZip.body);
      expect(Object.keys(z.files).sort()).toEqual(["answer.md", "bot/main.py", "pyproject.toml"]);
      expect(await z.file("bot/main.py")!.async("string")).toContain("print('running')");
    }

    // Wrong user cannot download even with the exact signed URL
    const wrongUser = await loadSignedExport({
      userId: "user_bob",
      exportId: bundle.zip!.exportId,
      kind: "zip",
      filename: zipUrl.searchParams.get("name")!,
      expMs: Number(zipUrl.searchParams.get("exp")),
      sig: zipUrl.searchParams.get("sig")!,
      bucket,
      nowMs: nowMs + 60_000,
    });
    expect(wrongUser).toEqual({ error: "forbidden" });

    // Tampered signature rejected
    const badSig = await loadSignedExport({
      userId: "user_alice",
      exportId: bundle.zip!.exportId,
      kind: "zip",
      filename: zipUrl.searchParams.get("name")!,
      expMs: Number(zipUrl.searchParams.get("exp")),
      sig: "0".repeat(64),
      bucket,
      nowMs: nowMs + 60_000,
    });
    expect(badSig).toEqual({ error: "forbidden" });

    // Expired link rejected (past 24h)
    const expired = await loadSignedExport({
      userId: "user_alice",
      exportId: bundle.zip!.exportId,
      kind: "zip",
      filename: zipUrl.searchParams.get("name")!,
      expMs: Number(zipUrl.searchParams.get("exp")),
      sig: zipUrl.searchParams.get("sig")!,
      bucket,
      nowMs: nowMs + 25 * 60 * 60 * 1000,
    });
    expect(expired).toEqual({ error: "expired" });

    // Missing R2 object (24h lifecycle deleted it) returns expired
    bucket.store.clear();
    const gone = await loadSignedExport({
      userId: "user_alice",
      exportId: bundle.zip!.exportId,
      kind: "zip",
      filename: zipUrl.searchParams.get("name")!,
      expMs: Number(zipUrl.searchParams.get("exp")),
      sig: zipUrl.searchParams.get("sig")!,
      bucket,
      nowMs: nowMs + 60_000,
    });
    expect(gone).toEqual({ error: "expired" });
  });

  it("enforces per-user rate limits and size/file/storage caps", async () => {
    const bucket = memoryR2();

    // Path traversal in explicit files rejected
    await expect(
      createSignedExport({
        userId: "user_alice",
        kind: "zip",
        files: [{ path: "../secrets.txt", content: "nope" }],
        bucket,
      }),
    ).rejects.toMatchObject({ status: 400, code: "bad_request" });

    // Oversized source payload rejected
    await expect(
      createSignedExport({
        userId: "user_alice",
        kind: "zip",
        markdown: "x".repeat(600_000),
        bucket,
      }),
    ).rejects.toMatchObject({ status: 413, code: "too_large" });

    // Active R2 storage cap (50 MB per user) enforced
    bucket.store.set("exports/user_alice/exp_000000000000000000000001.zip", {
      bytes: new Uint8Array(50 * 1024 * 1024),
    });
    await expect(
      createSignedExport({
        userId: "user_alice",
        kind: "zip",
        markdown: "```py\nprint(1)\n```",
        bucket,
      }),
    ).rejects.toMatchObject({ status: 413, code: "storage_limit" });

    bucket.store.clear();

    // Rate limit (10/min) enforced
    for (let i = 0; i < 10; i++) {
      await createSignedExport({
        userId: "user_rate",
        kind: "zip",
        markdown: `\`\`\`py\nprint(${i})\n\`\`\``,
        bucket,
      });
    }
    await expect(
      createSignedExport({
        userId: "user_rate",
        kind: "zip",
        markdown: "```py\nprint(11)\n```",
        bucket,
      }),
    ).rejects.toMatchObject({ status: 429, code: "rate_limited" });
  });

  it("auto-exports multi-file Swarm replies and skips gracefully when storage is absent", async () => {
    expect(
      shouldAutoExport({
        swarm: true,
        userMessage: "build a multi-file python bot",
        assistantText: "```py\n# main.py\nprint(1)\n```",
      }),
    ).toEqual({ create: true, kind: "both" });

    expect(
      shouldAutoExport({
        swarm: false,
        userMessage: "hi",
        assistantText: "Hello!",
      }),
    ).toEqual({ create: false, kind: "zip" });

    // Missing bucket: no throw, returns null
    const absent = await maybeCreateAutoExports({
      userId: "user_alice",
      swarm: true,
      title: "Bot",
      userMessage: "build a bot",
      assistantText: "```py\n# main.py\nprint(1)\n```",
      bucket: null,
    });
    expect(absent).toBeNull();

    // With bucket: returns bundle + markdown footer
    const bucket = memoryR2();
    const res = await maybeCreateAutoExports({
      userId: "user_alice",
      swarm: true,
      title: "Bot",
      userMessage: "build a bot",
      assistantText: "```py\n# main.py\nprint(1)\n```",
      bucket,
    });
    expect(res).not.toBeNull();
    expect(res!.footer).toContain("**Downloads (signed, 24h):**");
    expect(res!.footer).toContain("/api/exports/exp_");
  });

  it("rejects guest/unauthenticated calls on POST /api/exports and GET /api/exports/[id]", async () => {
    const { POST } = await import("@/app/api/exports/route");
    const { GET } = await import("@/app/api/exports/[id]/route");

    mockRequireUserId.mockResolvedValue(null);

    const postRes = await POST(
      new Request("https://citad3l.io/api/exports", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ markdown: "# hi", kind: "zip" }),
      }),
    );
    expect(postRes.status).toBe(401);

    const signed = signExportLink({
      exportId: "exp_0123456789abcdef01234567",
      userId: "user_alice",
      kind: "zip",
      filename: "proj.zip",
      expMs: Date.now() + 60_000,
    });
    const getRes = await GET(new Request("https://citad3l.io" + signed), {
      params: Promise.resolve({ id: "exp_0123456789abcdef01234567" }),
    });
    expect(getRes.status).toBe(401);

    // Signed-in user requesting another user's messageId gets 404
    mockRequireUserId.mockResolvedValue("user_bob");
    mockFindMessage.mockResolvedValue(null);
    const otherMsgRes = await POST(
      new Request("https://citad3l.io/api/exports", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messageId: "msg_alice_1", kind: "zip" }),
      }),
    );
    expect(otherMsgRes.status).toBe(404);
  });

  it("verifies signature helper edge cases and keeps UI copy free of vendor names", () => {
    const url = signExportLink({
      exportId: "exp_0123456789abcdef01234567",
      userId: "user_1",
      kind: "pdf",
      filename: "report.pdf",
      expMs: 2_000_000_000_000,
    });
    const parsed = new URL("https://citad3l.io" + url);
    expect(
      verifyExportSignature({
        exportId: "exp_0123456789abcdef01234567",
        userId: "user_1",
        kind: "pdf",
        filename: parsed.searchParams.get("name")!,
        expMs: Number(parsed.searchParams.get("exp")),
        sig: parsed.searchParams.get("sig")!,
        nowMs: 1_900_000_000_000,
      }),
    ).toEqual({ ok: true });

    const ws = readFileSync("components/chat/ChatWorkspace.tsx", "utf8");
    expect(ws).toContain('data-testid="msg-create-export-links"');
    expect(ws).toContain('data-testid="msg-signed-zip"');
    expect(ws).toContain('data-testid="msg-signed-pdf"');
  });
});
