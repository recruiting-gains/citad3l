import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { LEAK_RE, LEAK_WORDS } from "./leak-words";

describe("guest try box guardrails", () => {
  afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });

  it("defaults: Fast only, short replies, 300/day site-wide, kill switch", async () => {
    const c = await import("@/lib/config");
    expect(c.GUEST_MODEL_ID).toBe("citad3l-fast");
    expect(c.GUEST_MAX_TOKENS).toBeLessThanOrEqual(512);
    expect(c.FREE_MESSAGES).toBe(5);
    expect(c.GUEST_GLOBAL_DAILY_CAP).toBe(300);
    expect(c.guestChatEnabled()).toBe(true);
  });

  it("GUEST_CHAT=off or a zero budget turns guest chat off", async () => {
    vi.stubEnv("GUEST_CHAT", "off");
    expect((await import("@/lib/config")).guestChatEnabled()).toBe(false);
    vi.unstubAllEnvs(); vi.resetModules();
    vi.stubEnv("GUEST_GLOBAL_DAILY_CAP", "0");
    expect((await import("@/lib/config")).guestChatEnabled()).toBe(false);
  });

  it("the guest route enforces the site-wide budget, Fast only, and no web search/thinking", () => {
    const src = readFileSync("app/api/chat/route.ts", "utf8");
    const g = src.slice(src.indexOf("async function guestChat"));
    expect(g).toContain("guestChatEnabled()");
    expect(g).toContain("LIMITS.guestGlobalDay");
    expect(g).toContain("GUEST_MODEL_ID");
    expect(g).toMatch(/webSearch: false/);
    expect(g).toMatch(/thinking: false/);
    expect(g).toContain("reviewOrKeyword");
    expect(g).toContain("checkText");
  });

  it("home page copy has no banned words, vendor names or whole-site E2E claims", () => {
    const home = readFileSync("components/marketing/HomeView.tsx", "utf8") + readFileSync("components/marketing/GuestTryBox.tsx", "utf8");
    expect(home).toContain("Private AI. Fast answers.");
    expect(home).toContain("Try it free — no signup");
    expect(home).not.toMatch(/canned refusals/i);
    expect(home).not.toMatch(LEAK_RE);
    expect(home).not.toMatch(/end-to-end/i);
  });
});

describe("guest IP daily cap", () => {
  it("a second cookie on the same IP gets the remaining 3 of the 8/day, then is blocked", async () => {
    const g = await import("@/lib/guest");
    g.resetGuestMemory();
    const store = g.memoryGuestStore();
    const ip = "9.9.9.9";
    let a = { id: g.newGuestId(), used: 0, reserved: 0 };
    for (let i = 0; i < 5; i++) a = await g.settleGuest((await g.reserveGuest(a, ip, store)).state, ip, true, store);
    await expect(g.reserveGuest(a, ip, store)).rejects.toBeInstanceOf(g.GuestError);
    let b = { id: g.newGuestId(), used: 0, reserved: 0 };
    for (let i = 0; i < 3; i++) b = await g.settleGuest((await g.reserveGuest(b, ip, store)).state, ip, true, store);
    expect(b.used).toBe(3);
    await expect(g.reserveGuest(b, ip, store)).rejects.toBeInstanceOf(g.GuestError);
    // A different IP is unaffected.
    const c = await g.reserveGuest(null, "8.8.8.8", store);
    expect(c.state.reserved).toBe(1);
  });
});
