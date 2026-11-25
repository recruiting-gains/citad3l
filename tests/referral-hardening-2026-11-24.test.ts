/** Pen test 2026-11-24 follow-ups: H1 (records survive account deletion, referral Pro ends on its own date) and H3 (filter sees full history). */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { readFileSync } from "node:fs";

const { entitlement } = vi.hoisted(() => ({ entitlement: { upsert: vi.fn(), update: vi.fn() } }));
vi.mock("@/lib/db", () => ({ prisma: { entitlement } }));

import { ensureEntitlement } from "@/lib/usage";
import { checkTexts } from "@/lib/filter";

const DAY = 24 * 60 * 60 * 1000;
beforeEach(() => {
  vi.clearAllMocks();
  entitlement.update.mockImplementation(async ({ data }: { data: object }) => ({ updated: true, ...data }));
});

describe("H1: referral Pro ends from its own end date", () => {
  it("drops back to Free once referralProEndsAt passes, with no referral row lookup needed", async () => {
    entitlement.upsert.mockResolvedValue({ userId: "u", plan: "pro", status: "active", stripeSubscriptionId: null, periodEnd: new Date(Date.now() - 1000), referralProEndsAt: new Date(Date.now() - 1000) });
    await ensureEntitlement("u");
    expect(entitlement.update).toHaveBeenCalledWith({ where: { userId: "u" }, data: expect.objectContaining({ plan: "trial", status: "trialing", referralProEndsAt: null }) });
  });
  it("keeps running before the end date", async () => {
    entitlement.upsert.mockResolvedValue({ userId: "u", plan: "pro", status: "active", stripeSubscriptionId: null, referralProEndsAt: new Date(Date.now() + DAY) });
    await ensureEntitlement("u");
    expect(entitlement.update).not.toHaveBeenCalled();
  });
  it("also ends when a stale canceled subscription id is left on the row", async () => {
    entitlement.upsert.mockResolvedValue({ userId: "u", plan: "pro", status: "active", stripeSubscriptionId: "sub_old", periodEnd: new Date(Date.now() - DAY), referralProEndsAt: new Date(Date.now() - 1000) });
    await ensureEntitlement("u");
    expect(entitlement.update).toHaveBeenCalledWith({ where: { userId: "u" }, data: expect.objectContaining({ plan: "trial" }) });
  });
  it("a real paid subscription is left alone (only the marker is cleared)", async () => {
    entitlement.upsert.mockResolvedValue({ userId: "u", plan: "pro", status: "active", stripeSubscriptionId: "sub_live", periodEnd: new Date(Date.now() + 20 * DAY), referralProEndsAt: new Date(Date.now() - 1000) });
    await ensureEntitlement("u");
    expect(entitlement.update).toHaveBeenCalledWith({ where: { userId: "u" }, data: { referralProEndsAt: null } });
  });
  it("normal plans cost no extra write", async () => {
    entitlement.upsert.mockResolvedValue({ userId: "u", plan: "pro", status: "active", stripeSubscriptionId: "s", periodEnd: new Date(Date.now() - DAY), referralProEndsAt: null });
    await ensureEntitlement("u");
    expect(entitlement.update).not.toHaveBeenCalled();
  });
});

describe("H1: schema keeps referral rows when an account is deleted (additive migration)", () => {
  const schema = readFileSync("prisma/schema.prisma", "utf8");
  const block = schema.slice(schema.indexOf("model ReferralAttribution {"), schema.indexOf("}", schema.indexOf("model ReferralAttribution {")));
  it("both user links are optional and SetNull, never Cascade", () => {
    expect(block).toMatch(/referrer\s+User\?\s+@relation\("ReferralReferrer"[^\n]*onDelete: SetNull/);
    expect(block).toMatch(/referred\s+User\?\s+@relation\("ReferralReferred"[^\n]*onDelete: SetNull/);
    expect(block).not.toMatch(/Cascade/);
    expect(block).toMatch(/referredEmailHash/);
    expect(block).toMatch(/referredCardFingerprint/);
  });
  it("migration only relaxes constraints and adds columns", () => {
    const sql = readFileSync("prisma/migrations/20261125023000_referral_hardening/migration.sql", "utf8");
    const code = sql.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");
    expect(code).not.toMatch(/DROP\s+(TABLE|COLUMN)|DELETE\s+FROM|TRUNCATE|UPDATE\s+"/i);
    expect(code).toMatch(/ON DELETE SET NULL/);
    expect(code).toMatch(/"referralProEndsAt"/);
  });
});

describe("H3: the safety filter sees the whole chat", () => {
  it("checkTexts blocks if any turn is blocked, or if a phrase is split across turns", () => {
    expect(checkTexts(["hello", "how are you"]).allowed).toBe(true);
    expect(checkTexts(["hello", "how to make a bomb at home", "thanks"]).allowed).toBe(false);
    expect(checkTexts(["", "fine"]).allowed).toBe(true);
  });
  const chat = readFileSync("app/api/chat/route.ts", "utf8");
  it("guest path: client-sent history is filtered with the prompt, before the model is called", () => {
    const guest = chat.slice(chat.indexOf("Guests send their own history"));
    expect(guest).toMatch(/checkTexts\(guestHistory\.map/);
    expect(guest).toMatch(/reviewOrKeyword\(\[\.\.\.guestClipped\.map\(\(m\) => m\.content\), prompt\]/);
    expect(guest.indexOf("checkTexts(")).toBeLessThan(guest.indexOf("getProvider("));
    expect(guest).toMatch(/buildTurns\(\[\.\.\.guestClipped/);
  });
  it("signed-in path: system prompt + project instructions reviewed with the prompt, and every earlier turn keyword-checked", () => {
    const signed = chat.slice(0, chat.indexOf("Guests send their own history"));
    expect(signed).toMatch(/reviewOrKeyword\(\[\.\.\.steering, prompt\]/);
    expect(signed).toMatch(/settings\?\.systemPrompt, projectInstructions/);
    expect(signed).toMatch(/checkTexts\(earlier\.map/);
    expect(signed.indexOf("checkTexts(earlier")).toBeLessThan(signed.indexOf("reserve(userId"));
  });
  it("imported guest chats go through the filter before they are saved", () => {
    const imp = readFileSync("app/api/conversations/route.ts", "utf8");
    expect(imp).toMatch(/checkTexts\(body\.messages\.map/);
    expect(imp).toMatch(/reviewOrKeyword\(/);
    expect(imp.indexOf("content_policy")).toBeLessThan(imp.indexOf("prisma.conversation.create"));
  });
});
