import { describe, it, expect, vi, afterEach } from "vitest";

/* 2026-11-21 public launch: plan rules (lib/access.ts) and daily spend guards (lib/spend-guard.ts). */
afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });

describe("access rules", () => {
  it("Private/Swarm any account, Image Pro+Max, Video Max, admins everything", async () => {
    const { accessFor } = await import("@/lib/access");
    const free = { admin: false, plan: "trial", paidActive: false };
    const pro = { admin: false, plan: "pro", paidActive: true };
    const max = { admin: false, plan: "max", paidActive: true };
    const lapsedMax = { admin: false, plan: "max", paidActive: false };
    const admin = { admin: true, plan: "trial", paidActive: false };
    expect(accessFor("signin", free)?.code).toBe("upgrade_required");
    expect(accessFor("swarm", free)?.code).toBe("upgrade_required");
    expect(accessFor("signin", { admin: false, plan: "pro", paidActive: true })).toBeNull();
    expect(accessFor("swarm", { admin: false, plan: "pro", paidActive: true })).toBeNull();
    expect(accessFor("pro", free)?.code).toBe("upgrade_required");
    expect(accessFor("pro", pro)).toBeNull();
    expect(accessFor("pro", max)).toBeNull();
    expect(accessFor("max", pro)?.code).toBe("upgrade_required");
    expect(accessFor("max", max)).toBeNull();
    expect(accessFor("max", lapsedMax)?.code).toBe("upgrade_required");
    for (const f of ["signin", "swarm", "pro", "max"] as const) expect(accessFor(f, admin)).toBeNull();
  });
  it("PUBLIC_FEATURES=admins pauses member features for everyone but admins", async () => {
    vi.stubEnv("PUBLIC_FEATURES", "admins");
    const { accessFor } = await import("@/lib/access");
    expect(accessFor("signin", { admin: false, plan: "max", paidActive: true })?.code).toBe("admin_only");
    expect(accessFor("guest", { admin: false, plan: "trial", paidActive: false })).toBeNull();
    expect(accessFor("max", { admin: true, plan: "trial", paidActive: false })).toBeNull();
  });
});

describe("spend guard", () => {
  async function withStore() {
    const counts = new Map<string, number>();
    const rl = await import("@/lib/ratelimit");
    rl.setRateLimitStore({ async hit(key) { const n = (counts.get(key) ?? 0) + 1; counts.set(key, n); return n; } });
    return counts;
  }
  it("per-user daily cap, then a global ceiling across accounts; admins skip only the per-user cap", async () => {
    vi.stubEnv("VIDEO_MAX_PER_DAY", "2");
    vi.stubEnv("VIDEO_MAX_GLOBAL_DAY", "3");
    await withStore();
    const { spendGuard } = await import("@/lib/spend-guard");
    expect(await spendGuard("video", "a")).toBeNull();
    expect(await spendGuard("video", "a")).toBeNull();
    const capped = await spendGuard("video", "a");
    expect(capped?.code).toBe("daily_cap");
    expect(capped?.message).toMatch(/today's limit of 2 video clips/);
    expect(await spendGuard("video", "b")).toBeNull(); // global 3rd
    const g = await spendGuard("video", "c");
    expect(g?.message).toMatch(/Citad3L has hit today's limit/);
    const adm = await spendGuard("video", "admin", { admin: true });
    expect(adm?.message).toMatch(/Citad3L has hit today's limit/); // global still applies
  });
  it("defaults are sized for the $20/month provider cap", async () => {
    const { spendLimits, providerMonthlyBudgetUsd } = await import("@/lib/spend-guard");
    expect(providerMonthlyBudgetUsd()).toBe(20);
    expect(spendLimits("video")).toEqual({ perUser: 2, global: 2, month: 6 }); // 6 × $1.60 = $9.60
    expect(spendLimits("image")).toEqual({ perUser: 10, global: 20, month: 50 }); // 50 × $0.10 = $5
  });
  it("monthly ceiling scales with PROVIDER_MONTHLY_BUDGET_USD and blocks once used", async () => {
    vi.stubEnv("PROVIDER_MONTHLY_BUDGET_USD", "4");
    vi.stubEnv("VIDEO_MAX_PER_DAY", "9");
    vi.stubEnv("VIDEO_MAX_GLOBAL_DAY", "9");
    await withStore();
    const { spendGuard, spendLimits } = await import("@/lib/spend-guard");
    expect(spendLimits("video").month).toBe(1);
    expect(await spendGuard("video", "a")).toBeNull();
    expect((await spendGuard("video", "b"))?.message).toMatch(/this month's capacity/);
  });
  it("fails closed when the rate-limit store is down", async () => {
    const rl = await import("@/lib/ratelimit");
    rl.setRateLimitStore({ async hit() { throw new Error("db down"); } });
    const { spendGuard } = await import("@/lib/spend-guard");
    expect((await spendGuard("image", "a"))?.code).toBe("daily_cap");
  });
});
