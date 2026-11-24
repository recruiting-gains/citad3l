import { describe, expect, it } from "vitest";
import { relevantLimitHit, usageLine } from "@/lib/usage-display";
import { peekDurable, setRateLimitStore, type RateLimitStore } from "@/lib/ratelimit";
import type { UsageSummary } from "@/lib/types";

const base: UsageSummary = {
  plan: "pro",
  status: "active",
  used: 5,
  limit: 25,
  remaining: 20,
  resetAt: null,
  cancelAtPeriodEnd: false,
  unitLabel: "replies",
  window: { used: 5, limit: 25, remaining: 20, resetAt: null, label: "5-hour window" },
  week: { used: 10, limit: 150, remaining: 140, resetAt: null, label: "Weekly cap" },
  swarmUnits: 4,
};

describe("usageLine / relevantLimitHit", () => {
  it("shows both window and week for paid chat, and Swarm cost when on", () => {
    expect(usageLine(base, { mode: "chat" })).toBe("20 of 25 left this 5-hour window · 140 of 150 left this week");
    expect(usageLine(base, { mode: "chat", swarm: true })).toMatch(/Swarm uses 4/);
    expect(relevantLimitHit({ ...base, remaining: 3 }, { mode: "chat", swarm: true })).toBe(true);
    expect(relevantLimitHit({ ...base, remaining: 4 }, { mode: "chat", swarm: true })).toBe(false);
  });

  it("shows guest free-message counts", () => {
    const guest: UsageSummary = { ...base, plan: "trial", guest: true, used: 2, limit: 5, remaining: 3, window: undefined, week: undefined };
    expect(usageLine(guest, { mode: "chat" })).toBe("3 of 5 free messages left");
  });

  it("shows image and video daily remaining plus the chat window", () => {
    const u: UsageSummary = {
      ...base,
      image: { used: 3, limit: 10, remaining: 7, resetAt: null, label: "Images today" },
      video: { used: 1, limit: 2, remaining: 1, resetAt: null, label: "Video clips today" },
    };
    expect(usageLine(u, { mode: "image" })).toMatch(/7 of 10 images left today/);
    expect(usageLine(u, { mode: "video" })).toMatch(/1 of 2 clips left today/);
    expect(relevantLimitHit({ ...u, image: { ...u.image!, remaining: 0 } }, { mode: "image" })).toBe(true);
    expect(relevantLimitHit(u, { mode: "image" })).toBe(false);
  });
});

describe("peekDurable does not increment", () => {
  it("reads the current count twice and leaves it unchanged", async () => {
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
    const rule = { name: "image-user-day", id: "user-1", limit: 10, windowMs: 86_400_000 };
    await store.hit("warmup", new Date(), new Date()); // unused; real key is hashed
    // seed via peekDurable after a hit on the real key
    const keyUsed: string[] = [];
    const wrapped: RateLimitStore = {
      async hit(key, ws, ex) { keyUsed.push(key); return store.hit(key, ws, ex); },
      async peek(key, ws) { keyUsed.push("peek:" + key); return store.peek!(key, ws); },
    };
    setRateLimitStore(wrapped);
    // First call peeks a missing key -> 0
    const a = await peekDurable(rule);
    const b = await peekDurable(rule);
    expect(a).toBe(0);
    expect(b).toBe(0);
    // Increment once, then peek twice
    const hashed = keyUsed.find((k) => k.startsWith("peek:"))!.slice(5);
    await wrapped.hit(hashed, new Date(), new Date());
    const c = await peekDurable(rule);
    const d = await peekDurable(rule);
    expect(c).toBe(1);
    expect(d).toBe(1);
    setRateLimitStore(undefined);
  });
});
