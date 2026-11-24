import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import type { ChatMessage } from "@/lib/types";
import { mergeRemote, nextSyncDelay, sameMessages, stamp, SYNC_FAST_MS, SYNC_SLOW_MS } from "@/lib/sync";
import { transcriptOf } from "@/lib/dictation";

const m = (id: string, content = id, status: ChatMessage["status"] = "complete", role: ChatMessage["role"] = "assistant"): ChatMessage =>
  ({ id, role, content, status, createdAt: "2026-11-19T21:00:00.000Z" }) as ChatMessage;

describe("live sync helpers", () => {
  it("stamps change with count or newest updatedAt", () => {
    expect(stamp(3, "2026-11-19T21:00:00.000Z")).toBe("3:" + Date.parse("2026-11-19T21:00:00.000Z"));
    expect(stamp(0, null)).toBe("0:0");
    expect(stamp(3, new Date(1))).not.toBe(stamp(4, new Date(1)));
  });
  it("polls fast after activity, slow when idle", () => {
    expect(nextSyncDelay(0)).toBe(SYNC_FAST_MS);
    expect(nextSyncDelay(10 * 60_000)).toBe(SYNC_SLOW_MS);
  });
  it("a reply finished on the phone replaces the desktop's stale copy", () => {
    const local = [m("u1"), m("a1", "", "streaming")];
    const server = [m("u1"), m("a1", "Hello from the phone")];
    expect(mergeRemote(local, server)).toEqual(server);
  });
  it("new messages from the other device are appended", () => {
    expect(mergeRemote([m("u1"), m("a1")], [m("u1"), m("a1"), m("u2"), m("a2")]).map((x) => x.id)).toEqual(["u1", "a1", "u2", "a2"]);
  });
  it("keeps local-only @computer transcripts and errors where they were", () => {
    const local = [m("u1"), m("a1"), m("tmp-u-1"), m("tmp-c-1"), m("u2"), m("a2"), m("tmp-x-9")];
    const server = [m("u1"), m("a1"), m("u2"), m("a2"), m("u3")];
    expect(mergeRemote(local, server).map((x) => x.id)).toEqual(["u1", "a1", "tmp-u-1", "tmp-c-1", "u2", "a2", "tmp-x-9", "u3"]);
    expect(mergeRemote([m("tmp-c-1")], [m("u1")]).map((x) => x.id)).toEqual(["u1", "tmp-c-1"]);
  });
  it("no re-render when nothing actually changed", () => {
    expect(sameMessages([m("a")], [m("a")])).toBe(true);
    expect(sameMessages([m("a", "x")], [m("a", "y")])).toBe(false);
  });
  it("dictation joins final + interim results", () => {
    expect(transcriptOf([[{ transcript: "open " }], [{ transcript: " safari  please" }]])).toBe("open safari please");
  });
});

/* /api/sync: only the signed-in user's own rows, no content */
let userId: string | null = "user-a";
const calls: any[] = [];
vi.mock("@/auth", () => ({ requireUserId: async () => userId }));
vi.mock("@/lib/db", () => ({
  prisma: {
    conversation: { aggregate: async (q: any) => { calls.push(["conv", q.where]); return { _count: { _all: 2 }, _max: { updatedAt: new Date(1000) } }; } },
    message: { aggregate: async (q: any) => { calls.push(["msg", q.where]); return { _count: { _all: 5 }, _max: { updatedAt: new Date(2000) } }; } },
  },
}));

describe("/api/sync", () => {
  beforeEach(() => { calls.length = 0; userId = "user-a"; });
  it("401 when signed out", async () => {
    userId = null;
    const { GET } = await import("@/app/api/sync/route");
    expect((await GET(new Request("https://citad3l.io/api/sync"))).status).toBe(401);
    expect(calls).toEqual([]);
  });
  it("scopes every query to the caller, returns only fingerprints", async () => {
    const { GET } = await import("@/app/api/sync/route");
    const r = await GET(new Request("https://citad3l.io/api/sync?c=cmabc12345"));
    expect(await r.json()).toEqual({ list: "2:1000", conv: "5:2000" });
    expect(r.headers.get("cache-control")).toBe("no-store");
    expect(calls).toEqual([["conv", { userId: "user-a" }], ["msg", { conversationId: "cmabc12345", userId: "user-a" }]]);
  });
  it("ignores a malformed conversation id", async () => {
    const { GET } = await import("@/app/api/sync/route");
    expect(await (await GET(new Request("https://citad3l.io/api/sync?c=../../x"))).json()).toEqual({ list: "2:1000", conv: null });
  });
});

describe("wiring", () => {
  const src = readFileSync(new URL("../components/chat/ChatWorkspace.tsx", import.meta.url), "utf8");
  const cfg = readFileSync(new URL("../next.config.mjs", import.meta.url), "utf8");
  it("polls only while visible, never clobbers a reply streaming on this device", () => {
    expect(src).toContain('document.visibilityState === "visible"');
    expect(src).toMatch(/if \(convRef\.current !== id \|\| abortRef\.current \|\| !gateRef\.current\.accept\(token\)\) return false;/);
    expect(src).toContain("mergeRemote(ms, j.messages)");
  });
  it("mic button exists and the page may use the microphone (same origin only)", () => {
    expect(src).toContain('data-testid="mic-button"');
    expect(cfg).toContain("microphone=(self)");
    expect(cfg).toContain("camera=()");
  });
});
