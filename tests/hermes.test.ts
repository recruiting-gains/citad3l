import { readFileSync } from "node:fs";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { LEAK_RE, LEAK_WORDS } from "./leak-words";

/*
 * 2026-11-20 1:55 PM CT, Owner: "Yes, start building Hermes now". Citad3L Hermes is owner-only (not the cousin),
 * server-enforced, proxied to a private Hermes API server; no upstream URL, key or provider ids reach the client.
 */
// Real admin addresses are Worker secrets; tests use stand-ins.
const ADMINS = ["owner@example.test", "cousin@example.test"];
const [OWNER, COUSIN] = ADMINS;
process.env.OWNER_EMAIL = OWNER;
process.env.ADMIN_EMAILS = ADMINS.join(",");

let me: { id: string; email: string } | null = null;
const upstream: { url: string; init: any }[] = [];
let msgN = 0;
const saved: any[] = [];

vi.mock("@/lib/session", () => ({ currentUser: async () => me }));
vi.mock("@/lib/banned", () => ({ bannedMessage: async () => null }));
vi.mock("@/lib/filter-log", () => ({ logFilterRefusal: async () => undefined }));
vi.mock("@/lib/filter-llm", () => ({ reviewOrKeyword: async () => ({ allowed: true }) }));
vi.mock("@/lib/ratelimit", () => ({ rule: (d: any, id: string) => ({ ...d, id }), rateLimit: () => true, limitDurable: async () => ({ ok: true }) }));
vi.mock("@/lib/db", () => ({
  prisma: {
    conversation: { findFirst: async () => null, create: async (q: any) => ({ id: "c-h", title: q.data.title }), update: async () => ({}) },
    message: {
      findMany: async () => [],
      create: async (q: any) => ({ id: `m${++msgN}`, ...q.data }),
      update: async (q: any) => { saved.push(q.data); return {}; },
    },
  },
}));

const req = (body: object, origin = "https://citad3l.io") =>
  new Request("https://citad3l.io/api/hermes", { method: "POST", headers: { "content-type": "application/json", origin }, body: JSON.stringify(body) });
const post = async (body: object, origin?: string) => (await import("@/app/api/hermes/route")).POST(req(body, origin));
async function sse(res: Response) {
  const text = await res.text();
  return text.split("\n\n").filter(Boolean).map((b) => ({ event: /event: (.*)/.exec(b)?.[1], data: JSON.parse(/data: (.*)/.exec(b)?.[1] ?? "null") }));
}

beforeEach(() => {
  upstream.length = 0;
  saved.length = 0;
  delete process.env.HERMES_ALLOWED_EMAILS;
  process.env.HERMES_URL = "https://hermes.internal.test";
  process.env.HERMES_API_KEY = "test-hermes-key";
  globalThis.fetch = vi.fn(async (url: any, init: any) => {
    upstream.push({ url: String(url), init });
    const chunks = [
      'data: {"object":"hermes.tool.progress","tool":"memory"}\n\n',
      'data: {"choices":[{"delta":{"content":"Hi "}}]}\n\n',
      'data: {"choices":[{"delta":{"content":"Owner"}}]}\n\n',
      "data: [DONE]\n\n",
    ];
    return new Response(new ReadableStream({ start(c) { for (const x of chunks) c.enqueue(new TextEncoder().encode(x)); c.close(); } }), { headers: { "content-type": "text/event-stream" } });
  }) as any;
});

describe("who can use Hermes", () => {
  it("signed out → 401; cousin (admin) → 403; random → 403; nothing reaches upstream", async () => {
    me = null;
    expect((await post({ message: "hi" })).status).toBe(401);
    me = { id: "u-cousin", email: COUSIN };
    expect((await post({ message: "hi" })).status).toBe(403);
    me = { id: "u-x", email: "someone@example.com" };
    expect((await post({ message: "hi" })).status).toBe(403);
    expect(upstream).toHaveLength(0);
  });
  it("HERMES_ALLOWED_EMAILS can widen it; default is the owner only", async () => {
    const { isHermesEmail } = await import("@/lib/hermes");
    expect(isHermesEmail(OWNER)).toBe(true);
    expect(isHermesEmail(COUSIN)).toBe(false);
    process.env.HERMES_ALLOWED_EMAILS = `${OWNER},${COUSIN}`;
    expect(isHermesEmail(COUSIN)).toBe(true);
  });
  it("owner: cross-site origin refused; missing config → 503", async () => {
    me = { id: "u-cruz", email: OWNER };
    expect((await post({ message: "hi" }, "https://evil.example")).status).toBe(403);
    delete process.env.HERMES_URL;
    expect((await post({ message: "hi" })).status).toBe(503);
  });
});

describe("owner chat through the proxy", () => {
  it("streams Hermes text, maps tools to plain status, saves the reply", async () => {
    me = { id: "u-cruz", email: OWNER };
    const ev = await sse(await post({ message: "hello" }));
    expect(ev.map((e) => e.event)).toEqual(["meta", "status", "delta", "delta", "done"]);
    expect(ev[1].data.detail).toBe("Updating memory…");
    expect(ev[0].data.title.startsWith("Hermes · ")).toBe(true);
    expect(saved.at(-1)).toEqual({ content: "Hi Owner", status: "complete" });
    const call = upstream[0];
    expect(call.url).toBe("https://hermes.internal.test/v1/chat/completions");
    expect(call.init.headers.authorization).toBe("Bearer test-hermes-key");
    expect(call.init.headers["x-hermes-session-key"]).toBe("citad3l-c-h");
    expect(JSON.parse(call.init.body)).toMatchObject({ model: "hermes", stream: true, messages: [{ role: "user", content: "hello" }] });
    // the browser never sees the upstream URL or key
    expect(JSON.stringify(ev)).not.toMatch(/hermes\.internal|test-hermes-key/);
  });
  it("brain picker and /sol, /prime prefixes route to the alias", async () => {
    me = { id: "u-cruz", email: OWNER };
    await sse(await post({ message: "plan my week", brain: "sol" }));
    await sse(await post({ message: "/prime write a poem" }));
    expect(JSON.parse(upstream[0].init.body).model).toBe("hermes-sol");
    const b = JSON.parse(upstream[1].init.body);
    expect(b.model).toBe("hermes-prime");
    expect(b.messages.at(-1).content).toBe("write a poem");
  });
  it("every brain: slash shortcut and picker map to its Hermes alias; tiers match the owner's list", async () => {
    const { HERMES_BRAINS, pickBrain } = await import("@/lib/hermes");
    expect(Object.keys(HERMES_BRAINS).sort()).toEqual(["astra", "carbon", "fable", "fast", "large", "prime", "sol", "uncensored", "v1"]);
    const premium = Object.entries(HERMES_BRAINS).filter(([, b]) => b.premium).map(([k]) => k).sort();
    expect(premium).toEqual(["astra", "carbon", "fable", "large", "prime", "sol"]);
    for (const k of Object.keys(HERMES_BRAINS)) {
      expect(pickBrain(`/${k.toUpperCase()} hi`, "v1")).toEqual({ brain: k, text: "hi" });
      expect(HERMES_BRAINS[k as keyof typeof HERMES_BRAINS].route).toBe(k === "v1" ? "hermes" : `hermes-${k}`);
    }
    expect(pickBrain("/solar panels", "v1").brain).toBe("v1");
    me = { id: "u-cruz", email: OWNER };
    await sse(await post({ message: "/astra hi" }));
    await sse(await post({ message: "hi", brain: "carbon" }));
    expect(JSON.parse(upstream[0].init.body).model).toBe("hermes-astra");
    expect(JSON.parse(upstream[1].init.body).model).toBe("hermes-carbon");
    const bad = await post({ message: "hi", brain: "gpt" });
    expect(bad.status).toBe(400);
  });
  it("upstream failure → friendly error, no internals", async () => {
    me = { id: "u-cruz", email: OWNER };
    globalThis.fetch = vi.fn(async () => new Response("boom", { status: 502 })) as any;
    const ev = await sse(await post({ message: "hello" }));
    expect(ev.at(-1)).toEqual({ event: "error", data: { code: "provider_unavailable", message: "Hermes is unavailable right now." } });
  });
});

describe("no leaks into the client or marketing", () => {
  it("Hermes is not in the public lineup and chat/model routes don't know it", async () => {
    const { MODELS, marketingModels, pickerModels, isSelectableModelId } = await import("@/lib/models");
    expect(MODELS.some((m) => m.id === "citad3l-hermes")).toBe(false);
    expect(marketingModels().some((m) => m.id === "citad3l-hermes")).toBe(false);
    expect(pickerModels(true).some((m) => m.id === "citad3l-hermes")).toBe(false);
    expect(isSelectableModelId("citad3l-hermes", true)).toBe(false);
  });
  it("client code has no upstream URL, key names or provider ids", () => {
    const files = ["../components/chat/ChatWorkspace.tsx", "../components/chat/ModelPicker.tsx", "../lib/hermes.ts", "../lib/hermes-brains.ts"];
    for (const f of files) {
      const s = readFileSync(new URL(f, import.meta.url), "utf8");
      expect(s, f).not.toMatch(/fly\.dev/i);
      expect(s, f).not.toMatch(LEAK_RE);
    }
    const ws = readFileSync(new URL("../components/chat/ChatWorkspace.tsx", import.meta.url), "utf8");
    expect(ws).toContain('hermesReady ? "/api/hermes"');
  });
  it("only the owner's pages pass Hermes into the picker", () => {
    for (const f of ["../app/chat/page.tsx", "../app/chat/[id]/page.tsx"]) {
      const s = readFileSync(new URL(f, import.meta.url), "utf8");
      expect(s).toMatch(/isHermesEmail\(u\.email\)/);
      expect(s).toMatch(/hermes \? \[HERMES_MODEL\] : \[\]/);
    }
  });
});
