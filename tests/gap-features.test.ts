import { describe, it, expect, afterEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { isOwnerEmail, ownerEmail, FREE_DAILY_REPLIES, proWindowUnits, maxWindowUnits, proWeeklyUnits, maxWeeklyUnits } from "@/lib/config";
import { timeOfDayGreeting, formatGreeting } from "@/lib/greeting";
import { availableSkills, resolveSkills } from "@/lib/skills";
import { getPublicModel, isGuestModelId } from "@/lib/models";
import {
  decodeGuestCookie,
  encodeGuestCookie,
  guestUsageSummary,
  newGuestId,
  reserveGuest,
  resetGuestMemory,
  settleGuest,
  GuestError,
  memoryGuestStore,
} from "@/lib/guest";
import { rolledWindows, summarize, poolFor } from "@/lib/usage";
import { planCatalog } from "@/lib/plans";
import { canUseModelSettings, clampTemperature, clampMaxTokens } from "@/lib/model-settings";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
  resetGuestMemory();
});

const MODEL_IDS = [
  "test-v1-model",
  "test-fast-model",
  "test-image-model",
  "test-video-t2v",
  "e2ee-test-private-model",
];

describe("owner email", () => {
  it("reads OWNER_EMAIL from the environment and ignores case/space", async () => {
    vi.stubEnv("OWNER_EMAIL", " Ops@Example.COM ");
    vi.resetModules();
    const cfg = await import("@/lib/config");
    expect(cfg.ownerEmail()).toBe("ops@example.com");
    expect(cfg.isOwnerEmail("ops@example.com")).toBe(true);
    expect(cfg.isOwnerEmail("someone-else@example.com")).toBe(false);
    expect(cfg.isOwnerEmail(null)).toBe(false);
  });

  it("has no owner when no owner email is configured (it is a Worker secret, never a code default)", async () => {
    vi.stubEnv("OWNER_EMAIL", "");
    vi.stubEnv("CITAD3L_OWNER_EMAIL", "");
    vi.resetModules();
    const cfg = await import("@/lib/config");
    expect(cfg.ownerEmail()).toBe("");
    expect(cfg.isOwnerEmail("")).toBe(false);
    expect(cfg.isOwnerEmail("not-the-operator@example.com")).toBe(false);
    expect(cfg.adminEmails()).not.toContain("");
    expect(typeof ownerEmail).toBe("function");
    expect(isOwnerEmail(null)).toBe(false);
  });

  it("prefers CITAD3L_OWNER_EMAIL / CITAD3L_ADMIN_EMAILS (secrets)", async () => {
    vi.stubEnv("CITAD3L_OWNER_EMAIL", "Boss@Example.com");
    vi.stubEnv("CITAD3L_ADMIN_EMAILS", "second@example.com");
    vi.resetModules();
    const cfg = await import("@/lib/config");
    expect(cfg.ownerEmail()).toBe("boss@example.com");
    expect(cfg.adminEmails()).toEqual(["boss@example.com", "second@example.com"]);
  });

  it("does not hardcode any email address in lib/config.ts", () => {
    const cfg = readFileSync(path.resolve(import.meta.dirname, "../lib/config.ts"), "utf8");
    expect(cfg).not.toMatch(/[\w.+-]+@[\w-]+\.[a-z]{2,}/i);
  });
});

describe("admin emails", () => {
  it("parses ADMIN_EMAILS, ignores case/space, and always includes the owner", async () => {
    vi.stubEnv("OWNER_EMAIL", " owner@example.com ");
    vi.stubEnv("ADMIN_EMAILS", " Cousin@Example.COM , owner@example.com ");
    vi.resetModules();
    const cfg = await import("@/lib/config");
    expect(cfg.adminEmails()).toEqual(["owner@example.com", "cousin@example.com"]);
    expect(cfg.isAdminEmail("COUSIN@example.com")).toBe(true);
    expect(cfg.isAdminEmail(" owner@example.com ")).toBe(true);
    expect(cfg.isOwnerEmail("cousin@example.com")).toBe(false);
    expect(cfg.isAdminEmail("someone-else@example.com")).toBe(false);
    expect(cfg.isAdminEmail(null)).toBe(false);
    expect(cfg.isAdminEmail("   ")).toBe(false);
  });

  it("treats the owner as admin when ADMIN_EMAILS is unset", async () => {
    vi.stubEnv("OWNER_EMAIL", "ops@example.com");
    vi.stubEnv("ADMIN_EMAILS", "");
    vi.resetModules();
    const cfg = await import("@/lib/config");
    expect(cfg.adminEmails()).toEqual(["ops@example.com"]);
    expect(cfg.isAdminEmail("ops@example.com")).toBe(true);
    expect(cfg.isOwnerEmail("ops@example.com")).toBe(true);
    expect(cfg.isAdminEmail("cousin@example.com")).toBe(false);
  });
});

describe("greetings", () => {
  it("changes with the hour and stays original", () => {
    const d = (h: number) => new Date(2026, 0, 1, h, 0, 0);
    expect(timeOfDayGreeting(d(2)).short).toMatch(/Still at it/);
    expect(timeOfDayGreeting(d(8)).short).toMatch(/Morning/);
    expect(timeOfDayGreeting(d(14)).short).toMatch(/Midday/);
    expect(timeOfDayGreeting(d(19)).short).toMatch(/Evening/);
    expect(timeOfDayGreeting(d(22)).short).toMatch(/Lights low/);
    expect(formatGreeting(timeOfDayGreeting(d(22)), "Owner")).not.toContain("Up late");
  });
});

describe("skills", () => {
  it("enables thinking only on V1, and strips costly skills for guests and swarm", () => {
    const v1 = getPublicModel("citad3l-v1")!;
    const fast = getPublicModel("citad3l-fast")!;
    const priv = getPublicModel("citad3l-private")!;
    expect(availableSkills(v1)).toEqual({ webSearch: true, thinking: true, coding: true });
    expect(availableSkills(fast).thinking).toBe(false);
    expect(availableSkills(priv)).toEqual({ webSearch: false, thinking: false, coding: false });
    const want = { webSearch: true, thinking: true, coding: true };
    expect(resolveSkills(v1, want, { guest: true })).toEqual({ webSearch: false, thinking: false, coding: true });
    expect(resolveSkills(v1, { coding: true }, { swarm: true })).toEqual({ webSearch: false, thinking: false, coding: true });
    expect(resolveSkills(v1, want, { swarm: true })).toEqual({ webSearch: true, thinking: false, coding: true });
    expect(resolveSkills(v1, want, { swarm: true, swarmWebSearch: true })).toEqual({ webSearch: true, thinking: false, coding: true });
    expect(resolveSkills(v1, want)).toEqual(want);
    // Guests (home page try box, signed-out chat) run on V1 Fast and the Free uncensored models.
    expect(isGuestModelId("citad3l-v1")).toBe(true);
    expect(isGuestModelId("citad3l-fast")).toBe(false);
    expect(isGuestModelId("citad3l-private")).toBe(false);
    expect(isGuestModelId("citad3l-image")).toBe(false);
  });
});

describe("guest cookie + quota", () => {
  it("rejects a tampered cookie and caps at 5 successful messages", async () => {
    const id = newGuestId();
    const cookie = encodeGuestCookie({ id, used: 2, reserved: 0 });
    expect(decodeGuestCookie(cookie)?.used).toBe(2);
    expect(decodeGuestCookie(cookie.slice(0, -1) + (cookie.endsWith("a") ? "b" : "a"))).toBeNull();
    const store = memoryGuestStore();
    let state = { id, used: 0, reserved: 0 };
    for (let i = 0; i < 5; i++) {
      const r = await reserveGuest(state, "1.1.1.1", store);
      state = await settleGuest(r.state, "1.1.1.1", true, store);
    }
    expect(state.used).toBe(5);
    expect(guestUsageSummary(state.used).remaining).toBe(0);
    await expect(reserveGuest(state, "1.1.1.1", store)).rejects.toBeInstanceOf(GuestError);
  });

  it("does not charge a failed reply", async () => {
    const store = memoryGuestStore();
    const r = await reserveGuest(null, "2.2.2.2", store);
    const next = await settleGuest(r.state, "2.2.2.2", false, store);
    expect(next.used).toBe(0);
  });
});

describe("usage windows", () => {
  const base = {
    plan: "pro" as const,
    status: "active" as const,
    trialUsed: 0,
    periodUsed: 0,
    reserved: 0,
    periodEnd: null,
    cancelAtPeriodEnd: false,
    windowUsed: 10,
    windowStart: new Date("2026-01-01T00:00:00Z"),
    windowEnd: new Date("2026-01-01T05:00:00Z"),
    weekUsed: 40,
    weekStart: new Date("2026-01-01T00:00:00Z"),
    weekEnd: new Date("2026-01-08T00:00:00Z"),
  };

  it("rolls an expired 5-hour window but keeps a live week", () => {
    const rolled = rolledWindows(base, new Date("2026-01-01T06:00:00Z"));
    expect(rolled.windowUsed).toBe(0);
    expect(rolled.weekUsed).toBe(40);
  });

  it("returns the stored billing period end (paid and admin)", () => {
    const end = new Date("2099-02-01T00:00:00Z");
    const live = { ...base, periodEnd: end, windowEnd: new Date("2099-01-01"), weekEnd: new Date("2099-01-01") };
    expect(summarize(live).periodEnd).toBe(end.toISOString());
    expect(summarize(live, { admin: true }).periodEnd).toBe(end.toISOString());
    expect(summarize({ ...live, periodEnd: null }).periodEnd).toBeNull();
  });

  it("summarizes the binding meter and marks the owner as unlimited", () => {
    const live = { ...base, windowEnd: new Date("2099-01-01"), weekEnd: new Date("2099-01-01") };
    const u = summarize(live);
    expect(u.window?.used).toBe(10);
    expect(u.week?.used).toBe(40);
    expect(u.remaining).toBe(Math.min(u.window!.remaining, u.week!.remaining));
    const owner = summarize(live, { owner: true });
    expect(owner.unlimited).toBe(true);
    expect(owner.owner).toBe(true);
    expect(owner.admin).toBe(true);
    expect(owner.remaining).toBe(Number.MAX_SAFE_INTEGER);
    const admin = summarize(live, { admin: true });
    expect(admin.unlimited).toBe(true);
    expect(admin.admin).toBe(true);
    expect(admin.owner).toBe(false);
    expect(admin.remaining).toBe(Number.MAX_SAFE_INTEGER);
    expect(poolFor({ plan: "trial", status: "trialing", trialUsed: 2, periodUsed: 0, windowUsed: 1 }).limit).toBe(FREE_DAILY_REPLIES);
    expect(poolFor({ plan: "trial", status: "trialing", trialUsed: 2, periodUsed: 0, windowUsed: 1 }).used).toBe(1);
    expect(maxWindowUnits()).toBe(Math.floor(proWindowUnits() * 2.5));
    expect(maxWeeklyUnits()).toBe(Math.floor(proWeeklyUnits() * 2.5));
  });
});

describe("plans, settings, and no vendor leak", () => {
  it("shows Free $0, Pro $20, Max $50 with window copy", () => {
    const plans = planCatalog();
    expect(plans.map((p) => [p.id, p.name, p.priceUsd])).toEqual([
      ["trial", "Free", 0],
      ["pro", "Pro", 20],
      ["max", "Max", 50],
    ]);
    expect(plans[1].allowance).toMatch(/5 hours/);
    expect(plans[2].features.some((f) => /Per-model settings/i.test(f))).toBe(true);
  });

  it("locks per-model settings to Max or the owner", () => {
    expect(canUseModelSettings("pro", false)).toBe(false);
    expect(canUseModelSettings("max", false)).toBe(true);
    expect(canUseModelSettings("trial", true)).toBe(true);
    expect(clampTemperature(1.234)).toBe(1.23);
    expect(clampMaxTokens(99999)).toBe(8192);
  });

  it("keeps vendor model ids out of client components", () => {
    const files = [
      "components/chat/ChatWorkspace.tsx",
      "components/chat/ModelPicker.tsx",
      "components/CommandPalette.tsx",
      "components/marketing/PricingView.tsx",
      "components/marketing/HomeView.tsx",
      "components/marketing/WaitlistForm.tsx",
      "components/account/ConnectView.tsx",
      "lib/models.ts",
      "lib/greeting.ts",
      "lib/faq.ts",
      "lib/prompt.ts",
    ];
    for (const rel of files) {
      const src = readFileSync(path.resolve(import.meta.dirname, "..", rel), "utf8");
      for (const id of MODEL_IDS) expect(src, rel).not.toContain(id);
    }
  });
});
