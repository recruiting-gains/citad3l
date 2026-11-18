/**
 * Real-behaviour integration tests against a running dev server (BASE_URL) + real Postgres (DATABASE_URL).
 * Inference = explicitly labelled MOCK provider (no live Qwen endpoint exists yet).
 */
import { describe, it, expect, beforeAll } from "vitest";
import Stripe from "stripe";
import { prisma } from "@/lib/db";
import { Client, chat, sleep, BASE } from "./helpers";


const run = Date.now().toString(36);
const A = new Client(), B = new Client();
let aId = "", bId = "";

beforeAll(async () => {
  aId = await A.login(`alice-${run}@test.local`);
  bId = await B.login(`bob-${run}@test.local`);
});

describe("auth + guards", () => {
  it("rejects unauthenticated API calls", async () => {
    const anon = new Client();
    expect((await anon.json("/api/conversations")).status).toBe(401);
    expect((await anon.json("/api/usage")).status).toBe(401);
    expect((await chat(anon, { message: "hi" })).status).toBe(401);
  });
  it("provider endpoint reports MOCK explicitly", async () => {
    const r = await A.json("/api/provider");
    expect(r.data.provider.mock).toBe(true);
    expect(r.data.provider.label).toBe("Mock provider – not live inference");
  });
  it("rejects oversized messages (8,000 char limit)", async () => {
    const r = await chat(A, { message: "x".repeat(8001) });
    expect(r.status).toBe(413);
  });
});

describe("streaming chat (mock provider)", () => {
  let convId = "";
  it("streams meta → deltas → done and persists both messages", async () => {
    const r = await chat(A, { message: "Explain zero-trust networking in two lines." });
    expect(r.status).toBe(200);
    expect(r.events[0].event).toBe("meta");
    expect(r.events.filter((e) => e.event === "delta").length).toBeGreaterThan(10);
    const done = r.events.at(-1)!;
    expect(done.event).toBe("done");
    expect(done.data.usage.used).toBe(1);
    expect(done.data.usage.remaining).toBe(4);
    convId = r.events[0].data.conversationId;
    const c = await A.json(`/api/conversations/${convId}`);
    expect(c.data.messages.map((m: any) => [m.role, m.status])).toEqual([["user", "complete"], ["assistant", "complete"]]);
    expect(c.data.messages[1].content).toContain("Mock provider");
  });
  it("interruption: aborting mid-stream marks the reply stopped and does NOT charge", async () => {
    const before = (await A.json("/api/usage")).data.usage.used;
    const r = await chat(A, { conversationId: convId, message: "Long answer please [[mock-slow]]" }, { abortAfterDeltas: 3 });
    const asstId = r.events[0].data.assistantMessageId;
    await sleep(1500);
    const c = await A.json(`/api/conversations/${convId}`);
    const m = c.data.messages.find((x: any) => x.id === asstId);
    expect(m.status).toBe("stopped");
    expect((await A.json("/api/usage")).data.usage.used).toBe(before);
    // retry the stopped turn → completes and is charged once
    const retry = await chat(A, { conversationId: convId, message: "", retryAssistantMessageId: asstId });
    expect(retry.events.at(-1)!.event).toBe("done");
    const c2 = await A.json(`/api/conversations/${convId}`);
    expect(c2.data.messages.find((x: any) => x.id === asstId).status).toBe("complete");
    expect(c2.data.messages.length).toBe(4);
    expect((await A.json("/api/usage")).data.usage.used).toBe(before + 1);
  });
  it("provider failure is not charged", async () => {
    const before = (await A.json("/api/usage")).data.usage.used;
    const r = await chat(A, { conversationId: convId, message: "trigger [[mock-fail]]" });
    expect(r.events.at(-1)!.event).toBe("error");
    expect((await A.json("/api/usage")).data.usage.used).toBe(before);
  });
});

describe("history, projects, cross-user isolation", () => {
  let projId = "", convId = "";
  it("creates a project and a chat inside it; project instructions are owned", async () => {
    const p = await A.json("/api/projects", "POST", { name: "Robotics brief", instructions: "Answer as a robotics analyst." });
    expect(p.status).toBe(200);
    projId = p.data.project.id;
    // give A plenty of allowance so isolation tests don't hit the trial cap
    await prisma.entitlement.update({ where: { userId: aId }, data: { plan: "pro", status: "active", periodUsed: 0, periodEnd: new Date(Date.now() + 864e5 * 30) } });
    const r = await chat(A, { projectId: projId, message: "What's new in humanoid actuators?" });
    convId = r.events[0].data.conversationId;
    const list = await A.json(`/api/conversations?projectId=${projId}`);
    expect(list.data.conversations.map((c: any) => c.id)).toContain(convId);
    const projects = await A.json("/api/projects");
    expect(projects.data.projects.find((x: any) => x.id === projId).conversationCount).toBe(1);
  });
  it("user B cannot read, modify, delete, or post into A's resources", async () => {
    expect((await B.json(`/api/conversations/${convId}`)).status).toBe(404);
    expect((await B.json(`/api/conversations/${convId}`, "PATCH", { title: "pwned" })).status).toBe(404);
    expect((await B.json(`/api/conversations/${convId}`, "DELETE")).status).toBe(404);
    expect((await B.json(`/api/projects/${projId}`)).status).toBe(404);
    expect((await B.json(`/api/projects/${projId}`, "PATCH", { name: "pwned" })).status).toBe(404);
    expect((await B.json(`/api/projects/${projId}`, "DELETE")).status).toBe(404);
    expect((await chat(B, { conversationId: convId, message: "inject" })).status).toBe(404);
    expect((await chat(B, { projectId: projId, message: "inject" })).status).toBe(404);
    const bl = await B.json("/api/conversations");
    expect(bl.data.conversations.find((c: any) => c.id === convId)).toBeUndefined();
    const page = await B.fetch(`/chat/${convId}`);
    expect(page.status).toBe(404);
    // A's data unchanged
    const a = await A.json(`/api/conversations/${convId}`);
    expect(a.data.conversation.title).not.toBe("pwned");
  });
  it("export contains only own data; delete conversation works", async () => {
    const ex = await A.json("/api/account/export");
    expect(ex.data.user.id).toBe(aId);
    expect(JSON.stringify(ex.data)).not.toContain(bId);
    expect((await A.json(`/api/conversations/${convId}`, "DELETE")).status).toBe(200);
    expect((await A.json(`/api/conversations/${convId}`)).status).toBe(404);
  });
});

describe("atomic usage limits under concurrency", () => {
  it("trial: 20 parallel requests with 1 reply remaining → exactly 1 succeeds", async () => {
    const C = new Client(); const cId = await C.login(`carol-${run}@test.local`);
    await prisma.entitlement.upsert({ where: { userId: cId }, create: { userId: cId, trialUsed: 4 }, update: { trialUsed: 4 } });
    const results = await Promise.all(Array.from({ length: 20 }, (_, i) => chat(C, { message: `parallel ${i}` })));
    const ok = results.filter((r) => r.status === 200 && r.events.at(-1)?.event === "done");
    const limited = results.filter((r) => r.status === 402 && r.json?.error?.code === "limit_reached");
    expect(ok.length).toBe(1);
    expect(limited.length).toBe(19);
    const e = await prisma.entitlement.findUniqueOrThrow({ where: { userId: cId } });
    expect(e.trialUsed).toBe(5);
    expect(e.reserved).toBe(0);
    const u = (await C.json("/api/usage")).data.usage;
    expect(u.remaining).toBe(0);
    // 21st request this minute: blocked either by the exhausted allowance (402) or the 20/min rate limiter (429)
    const again = await chat(C, { message: "one more" });
    expect([402, 429]).toContain(again.status);
  });
  it("paid (Pro): 20 parallel requests with 1 unit remaining → exactly 1 succeeds", async () => {
    const D = new Client(); const dId = await D.login(`dave-${run}@test.local`);
    const limit = Number(process.env.PRO_MONTHLY_UNITS ?? 600);
    await prisma.entitlement.upsert({ where: { userId: dId }, create: { userId: dId }, update: {} });
    await prisma.entitlement.update({ where: { userId: dId }, data: { plan: "pro", status: "active", periodUsed: limit - 1, periodEnd: new Date(Date.now() + 864e5 * 30) } });
    const results = await Promise.all(Array.from({ length: 20 }, (_, i) => chat(D, { message: `paid parallel ${i}` })));
    expect(results.filter((r) => r.events.at(-1)?.event === "done").length).toBe(1);
    const e = await prisma.entitlement.findUniqueOrThrow({ where: { userId: dId } });
    expect(e.periodUsed).toBe(limit);
    expect(e.reserved).toBe(0);
  });
  it("Max allowance is 2.5× Pro", async () => {
    const E = new Client(); const eId = await E.login(`erin-${run}@test.local`);
    await prisma.entitlement.upsert({ where: { userId: eId }, create: { userId: eId, plan: "max", status: "active" }, update: { plan: "max", status: "active" } });
    const u = (await E.json("/api/usage")).data.usage;
    expect(u.limit).toBe(Math.floor(Number(process.env.PRO_MONTHLY_UNITS ?? 600) * 2.5));
  });
});

describe("Stripe webhooks (TEST mode, locally signed payloads)", () => {
  const secret = process.env.STRIPE_WEBHOOK_SECRET!;
  const sign = (payload: string) => Stripe.webhooks.generateTestHeaderString({ payload, secret });
  const post = (payload: string, sig?: string) => fetch(BASE + "/api/stripe/webhook", { method: "POST", headers: { "content-type": "application/json", ...(sig ? { "stripe-signature": sig } : {}) }, body: payload });
  const ev = (id: string, type: string, object: any) => JSON.stringify({ id, object: "event", type, livemode: false, created: Math.floor(Date.now() / 1000), data: { object }, api_version: "2025-01-01" });
  let F: Client, fId = "";
  const cus = `cus_test_${run}`, subId = `sub_test_${run}`;

  beforeAll(async () => { F = new Client(); fId = await F.login(`frank-${run}@test.local`); });

  it("rejects bad / missing signatures", async () => {
    const p = ev(`evt_bad_${run}`, "checkout.session.completed", {});
    expect((await post(p)).status).toBe(400);
    expect((await post(p, "t=1,v1=deadbeef")).status).toBe(400);
  });
  it("checkout.session.completed → Pro active; duplicate replay is idempotent", async () => {
    const p = ev(`evt_co_${run}`, "checkout.session.completed", { id: `cs_test_${run}`, object: "checkout.session", customer: cus, subscription: subId, client_reference_id: fId, metadata: { userId: fId, plan: "pro" } });
    const r1 = await (await post(p, sign(p))).json();
    const r2 = await (await post(p, sign(p))).json();
    expect(r1.result).toBe("processed");
    expect(r2.result).toBe("duplicate");
    const e = await prisma.entitlement.findUniqueOrThrow({ where: { userId: fId } });
    expect([e.plan, e.status, e.stripeCustomerId]).toEqual(["pro", "active", cus]);
  });
  it("subscription.updated: period set, then cancel_at_period_end keeps access", async () => {
    const start = Math.floor(Date.now() / 1000), end = start + 30 * 86400;
    const sub = (extra: any) => ({ id: subId, object: "subscription", customer: cus, status: "active", cancel_at_period_end: false, metadata: { userId: fId, plan: "pro" }, items: { data: [{ price: { id: "price_unknown" }, current_period_start: start, current_period_end: end }] }, ...extra });
    let p = ev(`evt_su1_${run}`, "customer.subscription.updated", sub({}));
    expect((await post(p, sign(p))).status).toBe(200);
    await prisma.entitlement.update({ where: { userId: fId }, data: { periodUsed: 7 } });
    p = ev(`evt_su2_${run}`, "customer.subscription.updated", sub({ cancel_at_period_end: true }));
    expect((await post(p, sign(p))).status).toBe(200);
    const e = await prisma.entitlement.findUniqueOrThrow({ where: { userId: fId } });
    expect(e.cancelAtPeriodEnd).toBe(true);
    expect(e.status).toBe("active");
    expect(e.periodUsed).toBe(7); // same period → usage not reset
    expect(e.periodEnd?.getTime()).toBe(end * 1000);
    const u = (await F.json("/api/usage")).data.usage;
    expect(u.cancelAtPeriodEnd).toBe(true);
    expect(u.plan).toBe("pro");
  });
  it("invoice.payment_failed → past_due blocks new replies; invoice.paid (new period) restores and resets", async () => {
    let p = ev(`evt_pf_${run}`, "invoice.payment_failed", { id: `in_f_${run}`, object: "invoice", customer: cus });
    expect((await post(p, sign(p))).status).toBe(200);
    expect((await prisma.entitlement.findUniqueOrThrow({ where: { userId: fId } })).status).toBe("past_due");
    const blocked = await chat(F, { message: "should be blocked" });
    expect(blocked.status).toBe(402);
    const s2 = Math.floor(Date.now() / 1000) + 31 * 86400, e2 = s2 + 30 * 86400;
    p = ev(`evt_ip_${run}`, "invoice.paid", { id: `in_p_${run}`, object: "invoice", customer: cus, lines: { data: [{ period: { start: s2, end: e2 } }] } });
    expect((await post(p, sign(p))).status).toBe(200);
    const e = await prisma.entitlement.findUniqueOrThrow({ where: { userId: fId } });
    expect([e.status, e.periodUsed]).toEqual(["active", 0]);
    expect((await chat(F, { message: "works again" })).events.at(-1)?.event).toBe("done");
  });
  it("subscription.deleted → falls back to trial pool", async () => {
    const p = ev(`evt_sd_${run}`, "customer.subscription.deleted", { id: subId, object: "subscription", customer: cus, status: "canceled", metadata: { userId: fId }, items: { data: [] } });
    expect((await post(p, sign(p))).status).toBe(200);
    const e = await prisma.entitlement.findUniqueOrThrow({ where: { userId: fId } });
    expect([e.plan, e.status, e.stripeSubscriptionId]).toEqual(["trial", "canceled", null]);
    expect((await F.json("/api/usage")).data.usage.plan).toBe("trial");
  });
  it("checkout without Stripe keys returns billing_not_configured; success/cancel return pages render", async () => {
    const r = await F.json("/api/billing/checkout", "POST", { plan: "pro" });
    expect(r.status).toBe(503);
    expect(r.data.error.code).toBe("billing_not_configured");
    expect((await F.fetch("/account?checkout=success&session_id=cs_test_x")).status).toBe(200);
    expect((await F.fetch("/pricing?checkout=canceled")).status).toBe(200);
  });
});

describe("account deletion", () => {
  it("deletes the user and cascades data", async () => {
    const G = new Client(); const gId = await G.login(`gina-${run}@test.local`);
    await chat(G, { message: "hello" });
    expect((await G.json("/api/account", "DELETE")).status).toBe(200);
    expect(await prisma.user.findUnique({ where: { id: gId } })).toBeNull();
    expect(await prisma.conversation.count({ where: { userId: gId } })).toBe(0);
    expect((await G.json("/api/usage")).status).toBe(401);
  });
});
