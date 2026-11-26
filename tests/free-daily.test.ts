import { describe, expect, it, afterEach, vi } from "vitest";
import { chicagoDayWindow } from "@/lib/chicago-day";
import { FREE_DAILY_REPLIES, TRIAL_REPLIES } from "@/lib/config";
import { FREE_DAILY_GLOBAL_BUCKET, freeDailyGlobalGuard, freeDailyGlobalRule } from "@/lib/free-daily-cap";
import { planCatalog } from "@/lib/plans";
import { FAQ_ITEMS } from "@/lib/faq";
import { setRateLimitStore, type RateLimitStore } from "@/lib/ratelimit";
import { poolFor, rolledWindows, summarize } from "@/lib/usage";

const trial = {
  plan: "trial" as const,
  status: "trialing" as const,
  trialUsed: 9,
  periodUsed: 0,
  reserved: 0,
  periodEnd: null,
  cancelAtPeriodEnd: false,
  windowUsed: 2,
  windowStart: null as Date | null,
  windowEnd: null as Date | null,
  weekUsed: 0,
  weekStart: null as Date | null,
  weekEnd: null as Date | null,
};

describe("signed-in free daily allowance", () => {
  it("uses the Chicago-day window, not the lifetime trialUsed counter", () => {
    // summarize() reads the clock; pin it inside the window this test builds (it went stale after 2026-11-25).
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-25T20:00:00.000Z"));
    const day = chicagoDayWindow(new Date("2026-11-25T20:00:00.000Z"));
    const e = { ...trial, windowStart: day.start, windowEnd: day.end, windowUsed: 2 };
    const rolled = rolledWindows(e, new Date("2026-11-25T20:00:00.000Z"));
    expect(rolled.windowUsed).toBe(2);
    expect(poolFor(rolled).limit).toBe(FREE_DAILY_REPLIES);
    expect(poolFor(rolled).used).toBe(2);
    const u = summarize(rolled);
    expect(u.limit).toBe(3);
    expect(u.remaining).toBe(1);
    expect(u.resetAt).toBe(day.end.toISOString());
    expect(u.window?.label).toBe("Free messages today");
    vi.useRealTimers();
  });

  it("resets used to 0 when the stored window is a previous Chicago day", () => {
    const yesterday = chicagoDayWindow(new Date("2026-11-24T18:00:00.000Z"));
    const today = chicagoDayWindow(new Date("2026-11-25T06:30:00.000Z"));
    const e = { ...trial, windowUsed: 3, windowStart: yesterday.start, windowEnd: yesterday.end };
    const rolled = rolledWindows(e, new Date("2026-11-25T06:30:00.000Z"));
    expect(rolled.windowUsed).toBe(0);
    expect(rolled.windowStart?.toISOString()).toBe(today.start.toISOString());
    expect(rolled.windowEnd?.toISOString()).toBe(today.end.toISOString());
    expect(summarize(rolled).remaining).toBe(FREE_DAILY_REPLIES);
  });

  it("does not treat a leftover paid 5-hour window as today's free day", () => {
    const now = new Date("2026-11-25T20:00:00.000Z");
    const today = chicagoDayWindow(now);
    const e = {
      ...trial,
      windowUsed: 20,
      windowStart: now,
      windowEnd: new Date(now.getTime() + 5 * 60 * 60 * 1000),
    };
    const rolled = rolledWindows(e, now);
    expect(rolled.windowUsed).toBe(0);
    expect(rolled.windowStart?.toISOString()).toBe(today.start.toISOString());
  });

  it("leaves Pro/Max 5-hour windows unchanged", () => {
    const now = new Date("2026-01-01T03:00:00.000Z");
    const paid = {
      ...trial,
      plan: "pro" as const,
      status: "active" as const,
      windowUsed: 10,
      windowStart: new Date("2026-01-01T00:00:00.000Z"),
      windowEnd: new Date("2026-01-01T05:00:00.000Z"),
      weekUsed: 40,
      weekStart: new Date("2026-01-01T00:00:00.000Z"),
      weekEnd: new Date("2026-01-08T00:00:00.000Z"),
    };
    const rolled = rolledWindows(paid, now);
    expect(rolled.windowUsed).toBe(10);
    expect(summarize(rolled).plan).toBe("pro");
  });
});

describe("site-wide free daily cap", () => {
  afterEach(() => setRateLimitStore(undefined));

  it("blocks the request after the configured Chicago-day ceiling", async () => {
    const now = new Date("2026-11-25T20:00:00.000Z");
    const rule = freeDailyGlobalRule(now);
    expect(rule.name).toBe(FREE_DAILY_GLOBAL_BUCKET);
    expect(rule.windowStartMs).toBe(chicagoDayWindow(now).start.getTime());
    const counts = new Map<string, number>();
    const store: RateLimitStore = {
      async hit(key) {
        const n = (counts.get(key) ?? 0) + 1;
        counts.set(key, n);
        return n;
      },
      async peek(key) {
        return counts.get(key) ?? 0;
      },
    };
    setRateLimitStore(store);
    // Fill up to the cap, then the next call should refuse.
    const cap = rule.limit;
    for (let i = 0; i < cap; i++) {
      const r = await freeDailyGlobalGuard(now);
      expect(r).toBeNull();
    }
    const blocked = await freeDailyGlobalGuard(now);
    expect(blocked?.code).toBe("daily_cap");
    expect(blocked?.message).toMatch(/midnight Central/);
  });
});

describe("public copy", () => {
  it("tells guests about 5 one-time messages and 3 a day after signup, without unlocking free Swarm", () => {
    const free = planCatalog().find((p) => p.id === "trial")!;
    expect(free.allowance).toMatch(new RegExp(`${TRIAL_REPLIES} messages, one time`));
    expect(free.allowance).toMatch(new RegExp(`${FREE_DAILY_REPLIES} messages every day`));
    expect(free.allowance).toMatch(/midnight Central/);
    expect(free.features.join(" ")).toMatch(/Swarm uses 4 replies, so it is on Pro and Max/);
    const blob = FAQ_ITEMS.map((i) => i.a).join("\n");
    expect(blob).toMatch(/Create a free account for 3 messages every day|3 messages every day on Fast and Private/);
    expect(blob).toMatch(/Guests get 5 free messages, one time/);
    expect(blob).not.toMatch(/keeps that same 5-message try and unlocks Private and Swarm/);
    expect(blob).not.toMatch(/is end-to-end encrypted/i);
    expect(blob).not.toMatch(/abliterated/i);
  });
});
