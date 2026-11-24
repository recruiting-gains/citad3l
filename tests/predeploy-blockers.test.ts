import { readFileSync } from "node:fs";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createGate, createSyncEngine, type SyncDeps } from "@/lib/sync";
import { createDraftBinding, giveMicConsent, hasMicConsent, MIC_CONSENT_KEY, MIC_DISCLOSURE } from "@/lib/dictation";

/* Pre-deploy review, blockers 3–4 and the isolation checks. */

const deferred = <T,>() => {
  let resolve!: (v: T) => void, reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
};

function harness(over: Partial<SyncDeps> = {}) {
  const log: string[] = [];
  let stamps = { list: "1:1", conv: "1:1" as string | null };
  let inFlight = 0, maxInFlight = 0;
  const deps: SyncDeps = {
    async fetchStamps(cid) {
      inFlight++; maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((r) => setTimeout(r, 5));
      inFlight--;
      log.push(`stamps:${cid}`);
      return { ...stamps };
    },
    async refreshList() { log.push("list"); return true; },
    async refreshConv(cid) { log.push(`conv:${cid}`); return true; },
    currentConvId: () => "c1",
    busy: () => false,
    ...over,
  };
  return { deps, log, set: (s: typeof stamps) => { stamps = s; }, max: () => maxInFlight };
}

describe("sync engine (blocker 3)", () => {
  it("never runs two polls at once; overlapping ticks queue exactly one re-run", async () => {
    const h = harness();
    const e = createSyncEngine(h.deps);
    await Promise.all([e.tick(), e.tick(), e.tick(), e.tick()]);
    expect(h.max()).toBe(1);
    expect(h.log.filter((l) => l.startsWith("stamps")).length).toBe(2); // the first + one coalesced re-run
  });
  it("first poll reconciles the open chat and list instead of trusting the initial snapshot", async () => {
    const h = harness();
    const e = createSyncEngine(h.deps);
    await e.tick();
    expect(h.log).toEqual(["stamps:c1", "list", "conv:c1"]);
    await e.tick();
    expect(h.log.slice(3)).toEqual(["stamps:c1"]); // nothing changed → no refetch
  });
  it("a failed refetch is NOT acknowledged and is retried on the next tick", async () => {
    let fail = true;
    const h = harness({ refreshConv: async (cid) => { h.log.push(`conv:${cid}:${fail ? "fail" : "ok"}`); if (fail) throw new Error("503"); return true; } });
    const e = createSyncEngine(h.deps);
    await e.tick();
    expect(e.state().conv).toBeNull();
    fail = false;
    await e.tick();
    expect(h.log.filter((l) => l.startsWith("conv:"))).toEqual(["conv:c1:fail", "conv:c1:ok"]);
    expect(e.state().conv).toBe("1:1");
  });
  it("a failed stamps fetch changes nothing and the next tick works", async () => {
    let n = 0;
    const h = harness();
    const base = h.deps.fetchStamps;
    h.deps.fetchStamps = async (c, s) => { if (n++ === 0) throw new Error("offline"); return base(c, s); };
    const e = createSyncEngine(h.deps);
    await e.tick();
    expect(e.state()).toEqual({ list: null, conv: null, convId: null });
    await e.tick();
    expect(e.state()).toEqual({ list: "1:1", conv: "1:1", convId: "c1" });
  });
  it("a refresh rejected as stale (returns false) stays dirty and is redone", async () => {
    let ok = false;
    const h = harness({ refreshConv: async () => ok });
    const e = createSyncEngine(h.deps);
    await e.tick();
    expect(e.state().conv).toBeNull();
    ok = true;
    await e.tick();
    expect(e.state().conv).toBe("1:1");
  });
  it("while a reply streams on this device the chat isn't touched or acknowledged", async () => {
    let busy = true;
    const h = harness({ busy: () => busy });
    const e = createSyncEngine(h.deps);
    await e.tick();
    expect(h.log).not.toContain("conv:c1");
    busy = false;
    await e.tick();
    expect(h.log).toContain("conv:c1");
  });
  it("switching chats mid-poll redoes the poll for the new chat (no baseline from the old one)", async () => {
    let cid = "c1";
    const h = harness({ currentConvId: () => cid });
    const base = h.deps.fetchStamps;
    h.deps.fetchStamps = async (c, s) => { const r = await base(c, s); if (c === "c1") cid = "c2"; return r; };
    const e = createSyncEngine(h.deps);
    await e.tick();
    expect(h.log).toEqual(["stamps:c1", "stamps:c2", "list", "conv:c2"]);
    expect(e.state().convId).toBe("c2");
  });
  it("stop() aborts a fetch already in flight", async () => {
    let seen: AbortSignal | null = null;
    const d = deferred<never>();
    const h = harness({ fetchStamps: (_c, s) => { seen = s; s.addEventListener("abort", () => d.reject(new Error("aborted"))); return d.promise; } });
    const e = createSyncEngine(h.deps);
    const t = e.tick();
    e.stop();
    await t;
    expect(seen!.aborted).toBe(true);
  });
});

describe("generation gate: stale / out-of-order responses are dropped (blocker 3)", () => {
  it("an older response that arrives after a newer one is dropped", () => {
    const g = createGate();
    const old = g.begin(), newer = g.begin();
    expect(g.accept(newer)).toBe(true);
    expect(g.accept(old)).toBe(false);
  });
  it("anything in flight across a chat switch or a local reply start/finish is dropped", () => {
    const g = createGate();
    const t = g.begin();
    g.bump();
    expect(g.accept(t)).toBe(false);
    expect(g.accept(g.begin())).toBe(true);
  });
});

describe("mic (blocker 4)", () => {
  const store = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) }; };
  it("needs an explicit opt-in that names Apple's and Google's speech services", () => {
    const s = store();
    expect(hasMicConsent(s)).toBe(false);
    expect(hasMicConsent(null)).toBe(false);
    expect(MIC_DISCLOSURE).toMatch(/Apple/);
    expect(MIC_DISCLOSURE).toMatch(/Google/);
    expect(MIC_DISCLOSURE).toMatch(/speech audio may be sent/i);
    giveMicConsent(s);
    expect(s.getItem(MIC_CONSENT_KEY)).toBe("yes");
    expect(hasMicConsent(s)).toBe(true);
    expect(hasMicConsent({ getItem: () => { throw new Error("blocked"); }, setItem: () => {} })).toBe(false);
  });
  it("late results after send or a chat switch are dropped", () => {
    const b = createDraftBinding();
    const s1 = b.start("c1");
    expect(b.live(s1, "c1")).toBe(true);
    expect(b.live(s1, "c2")).toBe(false); // switched chats
    b.cancel(); // sent / switched / signed out / page hidden
    expect(b.live(s1, "c1")).toBe(false);
    const s2 = b.start("c1");
    expect(b.live(s1, "c1")).toBe(false);
    expect(b.live(s2, "c1")).toBe(true);
  });
  it("ChatWorkspace: disclosure before start(), abort on send/switch/sign-out/hide/unmount, guarded callbacks", () => {
    const ws = readFileSync(new URL("../components/chat/ChatWorkspace.tsx", import.meta.url), "utf8");
    expect(ws).toMatch(/if \(!hasMicConsent\(store\)\) \{\s*setMicNotice\(true\);[^]*?return;/);
    expect(ws).toContain("{MIC_DISCLOSURE}");
    expect(ws).toMatch(/const send = \(\) => \{\s*if \(!canSend\) return;\s*stopDictation\(\);/);
    expect(ws.match(/stopDictationRef\.current\?\.\(\);/g)?.length).toBeGreaterThanOrEqual(2); // loadConversation + newChat
    expect(ws).toContain('window.addEventListener("pagehide", stopDictation)');
    expect(ws).toMatch(/visibilityState === "hidden"\) stopDictation\(\)/);
    expect(ws).toMatch(/if \(!signedIn\) stopDictation\(\)/);
    expect(ws).toMatch(/onText: \(text\) => \{\s*if \(!micBindRef\.current\.live\(bind, convRef\.current\)\) return;/);
    expect(ws).toContain("canDictate && (!streaming || listening)"); // Stop stays usable while listening
  });
  it("ChatWorkspace sync uses the engine, the gate, and aborts on cleanup", () => {
    const ws = readFileSync(new URL("../components/chat/ChatWorkspace.tsx", import.meta.url), "utf8");
    expect(ws).toContain("createSyncEngine(");
    expect(ws).toContain("engine.stop()");
    expect(ws).toMatch(/!gateRef\.current\.accept\(token\)/);
    expect(ws).not.toMatch(/void refreshOpenConversation\(/); // no fire-and-forget refetch with an early acknowledgement
  });
});

/* ---------- two-account isolation (Owner vs his cousin) over an in-memory DB that honours `where` ---------- */
let userId: string | null = null;
type Row = Record<string, any>;
const db = {
  conversation: [] as Row[],
  message: [] as Row[],
  userModelSettings: [] as Row[],
};
const match = (r: Row, w: Row = {}) => Object.entries(w).every(([k, v]) => (v && typeof v === "object" && !(v instanceof Date) ? true : r[k] === v));
const agg = (rows: Row[]) => ({ _count: { _all: rows.length }, _max: { updatedAt: rows.reduce<Date | null>((m, r) => (!m || r.updatedAt > m ? r.updatedAt : m), null) } });
vi.mock("@/auth", () => ({ requireUserId: async () => userId }));
vi.mock("@/lib/images-r2", () => ({ deleteGeneratedImage: async () => undefined }));
vi.mock("@/lib/db", () => ({
  prisma: {
    conversation: {
      aggregate: async (q: any) => agg(db.conversation.filter((r) => match(r, q.where))),
      findFirst: async (q: any) => db.conversation.find((r) => match(r, q.where)) ?? null,
    },
    message: {
      aggregate: async (q: any) => agg(db.message.filter((r) => match(r, q.where))),
      findMany: async (q: any) => db.message.filter((r) => match(r, q.where)),
    },
    userModelSettings: {
      findUnique: async (q: any) => db.userModelSettings.find((r) => r.userId === q.where.userId_modelId.userId && r.modelId === q.where.userId_modelId.modelId) ?? null,
      upsert: async (q: any) => {
        const k = q.where.userId_modelId;
        const i = db.userModelSettings.findIndex((r) => r.userId === k.userId && r.modelId === k.modelId);
        if (i >= 0) Object.assign(db.userModelSettings[i], q.update); else db.userModelSettings.push({ ...q.create });
        return {};
      },
      deleteMany: async () => ({ count: 0 }),
    },
  },
}));

describe("two-account isolation: chats, sync and settings", () => {
  beforeEach(() => {
    const t = (n: number) => new Date(1_700_000_000_000 + n);
    db.conversation = [
      { id: "convcruz0001", userId: "u-cruz", title: "Owner chat", projectId: null, updatedAt: t(1) },
      { id: "convcousin01", userId: "u-cousin", title: "Cousin chat", projectId: null, updatedAt: t(2) },
    ];
    db.message = [
      { id: "m1", conversationId: "convcruz0001", userId: "u-cruz", role: "user", content: "cruz secret", status: "complete", createdAt: t(1), updatedAt: t(1) },
      { id: "m2", conversationId: "convcousin01", userId: "u-cousin", role: "user", content: "cousin secret", status: "complete", createdAt: t(2), updatedAt: t(2) },
    ];
    db.userModelSettings = [];
  });
  it("sync: each account's fingerprints only count their own data; the other's chat id reads as empty", async () => {
    const { GET } = await import("@/app/api/sync/route");
    userId = "u-cruz";
    const own = await (await GET(new Request("https://citad3l.io/api/sync?c=convcruz0001"))).json();
    const other = await (await GET(new Request("https://citad3l.io/api/sync?c=convcousin01"))).json();
    const missing = await (await GET(new Request("https://citad3l.io/api/sync?c=convmissing1"))).json();
    expect(own.conv).not.toBe("0:0");
    expect(other.conv).toBe("0:0");
    expect(missing.conv).toBe("0:0");
    const before = own.list;
    db.message.push({ id: "m3", conversationId: "convcousin01", userId: "u-cousin", role: "assistant", content: "x", status: "complete", createdAt: new Date(), updatedAt: new Date() });
    db.conversation[1].updatedAt = new Date();
    expect((await (await GET(new Request("https://citad3l.io/api/sync?c=convcruz0001"))).json()).list).toBe(before); // cousin's edit doesn't move the owner's stamps
    userId = null;
    expect((await GET(new Request("https://citad3l.io/api/sync"))).status).toBe(401);
  });
  it("chat detail: neither admin can read the other's conversation", async () => {
    const { GET } = await import("@/app/api/conversations/[id]/route");
    const get = (id: string) => GET(new Request(`https://citad3l.io/api/conversations/${id}`), { params: Promise.resolve({ id }) });
    userId = "u-cruz";
    expect((await get("convcousin01")).status).toBe(404);
    const mine = await (await get("convcruz0001")).json();
    expect(mine.messages.map((m: any) => m.content)).toEqual(["cruz secret"]);
    userId = "u-cousin";
    expect((await get("convcruz0001")).status).toBe(404);
    expect((await (await get("convcousin01")).json()).messages.map((m: any) => m.content)).toEqual(["cousin secret"]);
  });
  it("per-model settings are stored per account", async () => {
    const { getModelSettings, saveModelSettings } = await import("@/lib/model-settings");
    await saveModelSettings("u-cruz", { modelId: "citad3l-private", systemPrompt: "cruz prompt", temperature: 0.5, maxTokens: null });
    expect((await getModelSettings("u-cruz", "citad3l-private")).systemPrompt).toBe("cruz prompt");
    expect((await getModelSettings("u-cousin", "citad3l-private")).systemPrompt).toBe("");
    await saveModelSettings("u-cousin", { modelId: "citad3l-private", systemPrompt: "cousin prompt", temperature: null, maxTokens: null });
    expect((await getModelSettings("u-cruz", "citad3l-private")).systemPrompt).toBe("cruz prompt");
  });
  it("@computer settings route: hub chosen from the session owner, never the client (real DO isolation is in computer-hub.test.ts)", () => {
    const shared = readFileSync(new URL("../app/api/computer/_shared.ts", import.meta.url), "utf8");
    expect(shared).toContain("getHub(owner.id)");
    const route = readFileSync(new URL("../app/api/computer/settings/route.ts", import.meta.url), "utf8");
    expect(route).not.toMatch(/userId|ownerId/);
  });
});
