import { readFileSync } from "node:fs";
import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";

/*
 * 2026-11-19 5:20 PM CT, Owner: "i need full access to everything all models me and my cousin both just us".
 * Both ADMIN_EMAILS accounts get every model and mode; everyone else is refused by the server (403 admin_only).
 */
// Real admin addresses are Worker secrets (CITAD3L_OWNER_EMAIL / CITAD3L_ADMIN_EMAILS); tests use stand-ins.
const ADMIN_EMAILS = "owner@example.test,cousin@example.test";
const ADMINS = ADMIN_EMAILS.split(",").map((s) => s.trim());
process.env.OWNER_EMAIL = ADMINS[0];
process.env.ADMIN_EMAILS = ADMIN_EMAILS;
const [OWNER, COUSIN] = [ADMINS[0], ADMINS[1]];

const USERS: Record<string, string> = { "u-cruz": OWNER, "u-cousin": COUSIN, "u-max": "paying.max@example.com", "u-pro": "paying.pro@example.com", "u-trial": "someone@example.com" };
const PLAN = (id: string) => (id === "u-max" ? "max" : id === "u-pro" ? "pro" : "trial");
let userId: string | null = null;
const calls = { provider: [] as any[], reserve: 0, swarm: 0, swarmWebSearch: undefined as boolean | undefined, image: 0, quote: 0, queue: 0 };

vi.mock("@/auth", () => ({ requireUserId: async () => userId }));
vi.mock("@/lib/banned", () => ({ bannedMessage: async () => null }));
vi.mock("@/lib/filter-log", () => ({ logFilterRefusal: async () => undefined }));
vi.mock("@/lib/ratelimit", () => ({ LIMITS: new Proxy({}, { get: () => ({}) }), rule: () => ({}), rateLimit: () => true, limitDurable: async () => ({ ok: true }) }));
vi.mock("@/lib/filter-llm", () => ({ reviewOrKeyword: async () => ({ allowed: true }), reviewImagePrompt: async () => ({ allowed: true }) }));
vi.mock("@/lib/model-settings", () => ({ canUseModelSettings: () => false, getModelSettings: async () => null }));
vi.mock("@/lib/usage", async () => {
  const { isAdminEmail } = await import("@/lib/config");
  class UsageError extends Error { code = "limit_reached"; }
  return {
    userIsAdmin: async (id: string) => isAdminEmail(USERS[id]),
    userEmail: async (id: string) => USERS[id] ?? null,
    getUsage: async (id: string) => ({ plan: PLAN(id), admin: isAdminEmail(USERS[id]), owner: USERS[id] === OWNER }),
    ensureEntitlement: async (id: string) => ({ plan: PLAN(id), status: "active" }),
    isPaidActive: (e: any) => (e.plan === "pro" || e.plan === "max") && e.status === "active",
    reserve: async () => { calls.reserve++; return { reservationId: "r1" }; },
    settle: async () => undefined,
    UsageError,
  };
});
vi.mock("@/lib/inference", () => ({
  ProviderUnavailable: class extends Error {},
  getProvider: (opts: any) => { calls.provider.push(opts); return { stream: async function* () { yield "ok from " + opts.modelId; } }; },
}));
vi.mock("@/lib/inference/swarm", () => ({ FilterRefusal: class extends Error {}, runSwarm: async (o: any) => { calls.swarm++; calls.swarmWebSearch = !!o.webSearch; o.onDelta("swarm answer"); return { text: "swarm answer" }; } }));
vi.mock("@/lib/inference/image", () => ({ generateImage: async () => { calls.image++; return { markdown: "![Generated image](data:image/png;base64,iVBORw==)", mock: false, bytes: new Uint8Array([137, 80, 78, 71]), mime: "image/png" }; } }));
vi.mock("@/lib/images-r2", () => ({ putGeneratedImage: async () => null, imagesBucket: () => null }));
vi.mock("@/lib/inference/video", () => ({
  quoteVideo: async () => { calls.quote++; return 1.44; },
  queueVideo: async () => { calls.queue++; return { queueId: "q-1", downloadUrl: "https://private-share.media.provider.test/v/q-1.mp4" }; },
  videoMaxUsdPerClip: () => 1.6,
  videoMaxPerDay: () => 5,
}));
vi.mock("@/lib/video-store", () => ({
  finalizeVideo: async ({ messageId }: any) => ({ status: "ready", content: `![Generated video](/api/videos/${messageId} "c3l-video:r2")` }),
  serveVideo: async () => new Response(Buffer.from([0, 0, 0, 24, 102, 116, 121, 112]), { headers: { "content-type": "video/mp4" } }),
}));
let msgN = 0;
vi.mock("@/lib/db", () => ({
  prisma: {
    user: { findUnique: async (q: any) => (USERS[q.where.id] ? { email: USERS[q.where.id] } : null) },
    conversation: { findFirst: async () => null, create: async (q: any) => ({ id: "c-new", title: q.data.title, project: null }), update: async () => ({}) },
    project: { findFirst: async () => null },
    message: {
      findFirst: async () => null,
      findMany: async () => [],
      count: async () => 0,
      create: async (q: any) => ({ id: `m${++msgN}`, ...q.data }),
      update: async () => ({}),
    },
  },
}));

const json = (url: string, body: object) => new Request(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
async function sse(res: Response) {
  const text = await res.text();
  return text.split("\n\n").filter(Boolean).map((b) => ({ event: /event: (.*)/.exec(b)?.[1], data: JSON.parse(/data: (.*)/.exec(b)?.[1] ?? "null") }));
}
const chat = async (body: object) => (await import("@/app/api/chat/route")).POST(json("https://citad3l.test/api/chat", body));
const image = async (body: object) => (await import("@/app/api/image/route")).POST(json("https://citad3l.test/api/image", body));
const video = async (body: object) => (await import("@/app/api/video/route")).POST(json("https://citad3l.test/api/video", body));
const getVideo = async (id: string, q = "") => (await import("@/app/api/videos/[id]/route")).GET(new Request(`https://citad3l.test/api/videos/${id}${q}`), { params: Promise.resolve({ id }) });

beforeAll(async () => {
  // warm the route modules (first import compiles them)
  await import("@/app/api/chat/route");
  await import("@/app/api/image/route");
  await import("@/app/api/video/route");
});
beforeEach(() => { Object.assign(calls, { provider: [], reserve: 0, swarm: 0, swarmWebSearch: undefined, image: 0, quote: 0, queue: 0 }); });

describe("who is an admin", () => {
  it("ADMIN_EMAILS is exactly the owner and one other admin", async () => {
    const { isAdminEmail, ownerEmail } = await import("@/lib/config");
    expect(ADMINS).toHaveLength(2);
    expect(ADMINS).toContain(ownerEmail()); // the owner (Owner) is one of the two
    expect(COUSIN).toBe("cousin@example.test");
    for (const e of ADMINS) expect(isAdminEmail(e), e).toBe(true);
    expect(isAdminEmail(COUSIN.toUpperCase())).toBe(true);
    for (const e of ["paying.max@example.com", "someone@example.com", "", null, `${OWNER}.evil.com`, `x${COUSIN}`]) expect(isAdminEmail(e as any), String(e)).toBe(false);
  });
});

describe("model lineup and resolution", () => {
  it("admins and signed-in accounts can pick every model; guests only V1 and Fast", async () => {
    const { MODELS, pickerModels, isSelectableModelId } = await import("@/lib/models");
    const { resolveModel, SignInRequired } = await import("@/lib/inference/provider-models");
    const all = MODELS.map((m) => m.id);
    expect(all).toEqual(expect.arrayContaining(["citad3l-v1", "citad3l-fast", "citad3l-private", "citad3l-image", "citad3l-video"]));
    expect(pickerModels(true, true).map((m) => m.id).sort()).toEqual([...all].sort());
    expect(pickerModels(true).map((m) => m.id).sort()).toEqual([...all].sort());
    expect(pickerModels(false).map((m) => m.id).sort()).toEqual(["citad3l-fast", "citad3l-v1"]);
    for (const id of all) {
      expect(isSelectableModelId(id, true), id).toBe(true);
      expect(resolveModel(id, { admin: true }).providerModelId, id).toBeTruthy();
      expect(resolveModel(id, { signedIn: true }).providerModelId, id).toBeTruthy();
    }
    for (const id of ["citad3l-private", "citad3l-image", "citad3l-video"]) {
      expect(isSelectableModelId(id), id).toBe(false);
      expect(() => resolveModel(id), id).toThrow(SignInRequired);
      expect(() => resolveModel(id, { signedIn: false }), id).toThrow(SignInRequired);
    }
    expect(resolveModel("citad3l-v1").providerModelId).toBeTruthy();
    expect(resolveModel("citad3l-fast").providerModelId).toBeTruthy();
    expect(resolveModel("citad3l-private", { admin: true }).requiresClientE2EE).toBe(true);
    expect(resolveModel("citad3l-private", { admin: true }).providerModelId).toMatch(/^e2ee-/);
  });
});

describe("both admins: every model and mode works end to end (server)", () => {
  for (const [uid, email] of [["u-cruz", "cruz"], ["u-cousin", "cousin"]] as const) {
    it(`${email}: V1, Fast and Private stream a reply`, async () => {
      userId = uid;
      for (const model of ["citad3l-v1", "citad3l-fast", "citad3l-private"]) {
        const r = await chat({ message: "hello", model });
        expect(r.status, model).toBe(200);
        const ev = await sse(r);
        expect(ev.map((e) => e.event), model).toContain("done");
        expect(ev.filter((e) => e.event === "delta").map((e) => e.data.text).join(""), model).toBe(`ok from ${model}`);
      }
      expect(calls.provider.map((p) => p.modelId)).toEqual(["citad3l-v1", "citad3l-fast", "citad3l-private"]);
    });
    it(`${email}: Swarm runs`, async () => {
      userId = uid;
      const r = await chat({ message: "plan a launch", model: "citad3l-v1", swarm: true });
      expect(r.status).toBe(200);
      const ev = await sse(r);
      expect(calls.swarm).toBe(1);
      expect(calls.swarmWebSearch).toBe(false); // off by default unless the client turns it on or the account is allowlisted
      expect(ev.some((e) => e.event === "delta" && e.data.text === "swarm answer")).toBe(true);
    });
    it(`${email}: Image generates and the reply is an image`, async () => {
      userId = uid;
      const r = await image({ message: "a rook on a chessboard" });
      expect(r.status).toBe(200);
      const ev = await sse(r);
      expect(calls.image).toBe(1);
      const text = ev.filter((e) => e.event === "delta").map((e) => e.data.text).join("");
      expect(text).toMatch(/^!\[[^\]]*\]\(data:image\/png;base64,/);
    });
    it(`${email}: Video is quoted, queued and finishes as a playable clip`, async () => {
      userId = uid;
      const r = await video({ message: "a rook rolling across a desk" });
      expect(r.status).toBe(200);
      const ev = await sse(r);
      expect(calls.quote).toBe(1);
      expect(calls.queue).toBe(1);
      const pending = ev.find((e) => e.event === "delta")!.data.text as string;
      expect(pending).toMatch(/\/api\/videos\/m\d+\?pending=1 "c3l-video:q-1:/);
      expect(ev.find((e) => e.event === "replace")!.data.text).toMatch(/^!\[Generated video\]\(\/api\/videos\/m\d+ "c3l-video:r2"\)$/);
      expect(ev.at(-1)!.event).toBe("done");
      const g = await getVideo("m1");
      expect(g.status).toBe(200);
      expect(g.headers.get("content-type")).toBe("video/mp4");
      expect((await getVideo("m1", "?status=1")).status).toBe(200);
    }, 20000);
  }
});

describe("public launch: plan rules are enforced by the server, whatever the client sends", () => {
  for (const uid of ["u-trial", "u-pro", "u-max"]) {
    it(`${uid}: Private chat and Swarm work on any signed-in plan`, async () => {
      userId = uid;
      const r = await chat({ message: "hello", model: "citad3l-private" });
      expect(r.status).toBe(200);
      const s2 = await chat({ message: "plan a launch", model: "citad3l-v1", swarm: true });
      expect(s2.status).toBe(200);
      await sse(s2);
      expect(calls.swarm).toBe(1);
    });
    it(`${uid}: V1 and Fast still work`, async () => {
      userId = uid;
      for (const model of ["citad3l-v1", "citad3l-fast"]) expect((await chat({ message: "hello", model })).status, model).toBe(200);
    });
    it(`${uid}: Image and Video never go through /api/chat`, async () => {
      userId = uid;
      for (const model of ["citad3l-image", "citad3l-video"]) expect([400, 402], model).toContain((await chat({ message: "hello", model })).status);
    });
  }
  it("free account: Image and Video → 402 upgrade_required, nothing generated or charged", async () => {
    userId = "u-trial";
    for (const r of [await image({ message: "a cat" }), await video({ message: "a cat" })]) {
      expect(r.status).toBe(402);
      const j = await r.json();
      expect(j.error.code).toBe("upgrade_required");
      expect(j.upgrade).toBe("/pricing");
    }
    expect(calls.image + calls.quote + calls.queue + calls.reserve).toBe(0);
  });
  it("Pro: Image works, Video → 402 (Max only)", async () => {
    userId = "u-pro";
    const r = await image({ message: "a cat" });
    expect(r.status).toBe(200);
    await sse(r);
    expect(calls.image).toBe(1);
    const v = await video({ message: "a cat" });
    expect(v.status).toBe(402);
    expect((await v.json()).error.message).toMatch(/Max/);
    expect(calls.quote + calls.queue).toBe(0);
  });
  it("Max: Image and Video work", async () => {
    userId = "u-max";
    const r = await image({ message: "a cat" });
    expect(r.status).toBe(200);
    await sse(r);
    const v = await video({ message: "a cat" });
    expect(v.status).toBe(200);
    await sse(v);
    expect(calls.image).toBe(1);
    expect(calls.queue).toBe(1);
  }, 20000);
  it("kill switch PUBLIC_FEATURES=admins puts Private, Image, Video and Swarm back to admins only", async () => {
    process.env.PUBLIC_FEATURES = "admins";
    try {
      userId = "u-max";
      const p = await chat({ message: "hello", model: "citad3l-private" });
      expect(p.status).toBe(403);
      expect((await p.json()).error.code).toBe("admin_only");
      expect((await chat({ message: "hello", model: "citad3l-v1", swarm: true })).status).toBe(403);
      expect((await image({ message: "a cat" })).status).toBe(403);
      expect((await video({ message: "a cat" })).status).toBe(403);
      expect((await chat({ message: "hello", model: "citad3l-v1" })).status).toBe(200);
      userId = "u-cruz";
      expect((await chat({ message: "hello", model: "citad3l-private" })).status).toBe(200);
    } finally {
      delete process.env.PUBLIC_FEATURES;
    }
  });
  it("signed-out: Image/Video routes 401, Private/Image/Video in guest chat refused", async () => {
    userId = null;
    expect((await image({ message: "a cat" })).status).toBe(401);
    expect((await video({ message: "a cat" })).status).toBe(401);
    expect((await getVideo("m1")).status).toBe(401);
    for (const model of ["citad3l-private", "citad3l-image", "citad3l-video"]) {
      const r = await chat({ message: "hello", model });
      expect([401, 403], model).toContain(r.status);
    }
    expect(calls.provider).toEqual([]);
  });
});

describe("client gating source checks", () => {
  const ws = readFileSync(new URL("../components/chat/ChatWorkspace.tsx", import.meta.url), "utf8");
  const mv = readFileSync(new URL("../components/model/ModelView.tsx", import.meta.url), "utf8");
  it("chat pages hand admins the full lineup", () => {
    for (const p of ["../app/chat/page.tsx", "../app/chat/[id]/page.tsx"]) expect(readFileSync(new URL(p, import.meta.url), "utf8"), p).toMatch(/pickerModels\(/);
  });
  it("Image, Video and Swarm are offered to signed-in accounts (server enforces plans); Video posts to /api/video", () => {
    expect(ws).toMatch(/imageReady = isImageReady\(selectedModel\) && signedIn;/);
    expect(ws).toMatch(/videoReady = isVideoReady\(selectedModel\) && signedIn;/);
    expect(ws).toMatch(/swarmAvailable = isSwarmAvailable\(selectedModel\) && signedIn;/);
    expect(ws).toContain('case "upgrade_required"');
    expect(ws).toContain('videoReady ? "/api/video"');
  });
  it("admins never see the 'Chat still uses V1 or Fast' line", () => {
    expect(mv).not.toContain("Chat still uses Citad3L V1 or Fast for now");
    expect(mv).toMatch(/is unlocked for you/);
  });
});

describe("2026-11-19 6:05 PM: no plan lock for admins on a trial plan (Owner saw 'Max only' on Video)", () => {
  it("both admins are on plan 'trial' in this test and still get every route (see above); usage reports unlimited", async () => {
    const { getUsage } = await import("@/lib/usage");
    for (const uid of ["u-cruz", "u-cousin"]) {
      const u: any = await getUsage(uid);
      expect(u.plan).toBe("trial");
      expect(u.admin).toBe(true);
    }
  });
  it("lineup/model-page badges: admins never see a plan lock; customers see which plan includes the model", async () => {
    const { MODELS, modelBadges } = await import("@/lib/models");
    const txt = (m: any, a: boolean) => modelBadges(m, a).map((b) => b.label).join(",");
    for (const m of MODELS) {
      const admin = txt(m, true), cust = txt(m, false);
      expect(admin, m.id).not.toMatch(/Max only|Coming soon|Pro & Max/);
      expect(cust, m.id).not.toMatch(/Coming soon/);
      if (["citad3l-private", "citad3l-image", "citad3l-video"].includes(m.id)) expect(admin, m.id).toMatch(/Unlocked for you/);
      if (m.id === "citad3l-video") expect(cust).toMatch(/Max only/);
      if (m.id === "citad3l-image") expect(cust).toMatch(/Pro & Max/);
    }
    expect(readFileSync(new URL("../components/model/LineupCard.tsx", import.meta.url), "utf8")).toContain("modelBadges(model, isAdmin)");
  });
  it("picker has no plan tags; model page, models index, home and pricing are admin-aware; /chat?model= preselects", () => {
    const src = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");
    expect(src("../components/chat/ModelPicker.tsx")).not.toMatch(/mp-tag">Max/);
    expect(src("../components/model/ModelView.tsx")).toMatch(/<ModelFlags model=\{model\} isAdmin=\{isAdmin\} \/>/);
    expect(src("../components/model/ModelView.tsx")).toMatch(/const tier = modelTier\(model\.id\);/);
    expect(src("../components/model/ModelView.tsx")).toContain("/chat?model=");
    expect(src("../app/models/page.tsx")).toMatch(/isAdmin=\{!!u && isAdminEmail\(u\.email\)\}/);
    expect(src("../app/page.tsx")).toMatch(/isAdmin=\{!!u && isAdminEmail\(u\.email\)\}/);
    expect(src("../app/pricing/page.tsx")).toMatch(/isAdmin=\{!!u && isAdminEmail\(u\.email\)\}/);
    expect(src("../components/model/ModelsIndexView.tsx")).not.toMatch(/Video comes with Max/);
    expect(src("../components/chat/ChatWorkspace.tsx")).toMatch(/searchParams\)?\.get\("model"\)|URLSearchParams\(window\.location\.search\)\.get\("model"\)/);
  });
});

describe("Swarm web search toggle and allowlist", () => {
  it("Media bot is always on; other signed-in users follow the client toggle; guests cannot", async () => {
    const saved = process.env.SWARM_WEB_SEARCH_EMAILS;
    USERS["u-media"] = "media@example.test";
    try {
      process.env.SWARM_WEB_SEARCH_EMAILS = "media@example.test";
      // Allowlisted account: on even if the client omits the flag
      userId = "u-media";
      const r = await chat({ message: "plan a launch", model: "citad3l-v1", swarm: true });
      expect(r.status).toBe(200);
      expect(calls.swarmWebSearch).toBe(true);

      // Owner, flag off (default): stays off
      Object.assign(calls, { swarm: 0, swarmWebSearch: undefined });
      userId = "u-cruz";
      const r2 = await chat({ message: "plan a launch", model: "citad3l-v1", swarm: true });
      expect(r2.status).toBe(200);
      expect(calls.swarmWebSearch).toBe(false);

      // Owner, flag on: honored
      Object.assign(calls, { swarm: 0, swarmWebSearch: undefined });
      const r3 = await chat({ message: "plan a launch", model: "citad3l-v1", swarm: true, skills: { webSearch: true } });
      expect(r3.status).toBe(200);
      expect(calls.swarmWebSearch).toBe(true);

      // Regular trial user can also toggle on
      Object.assign(calls, { swarm: 0, swarmWebSearch: undefined });
      userId = "u-trial";
      const r4 = await chat({ message: "plan a launch", model: "citad3l-v1", swarm: true, skills: { webSearch: true } });
      expect(r4.status).toBe(200);
      expect(calls.swarmWebSearch).toBe(true);
    } finally {
      delete USERS["u-media"];
      if (saved === undefined) delete process.env.SWARM_WEB_SEARCH_EMAILS;
      else process.env.SWARM_WEB_SEARCH_EMAILS = saved;
    }
  });
});
