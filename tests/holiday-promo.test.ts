import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HOLIDAY_ENDS_AT_UNIX, holidayActive, holidayPriceLine } from "@/lib/holiday";
import { HOLIDAY_PROMO_CODE_ID_DEFAULT, holidayAutoPromo, holidayPromoCodeId, isFirstTimeCustomer } from "@/lib/holiday-checkout";
import { PLAN_PRICE_USD } from "@/lib/config";
import { planCatalog } from "@/lib/plans";
import { LEAK_RE } from "./leak-words";

const PROMO = "promo_1UgDyv3x58WVlPfpkqXvNB4y";
const DURING = Date.parse("2026-11-27T12:00:00Z");
const LAST_SECOND = Date.parse("2027-02-01T05:59:59Z");
const AFTER = Date.parse("2027-02-01T06:00:00Z");

describe("holiday window", () => {
  it("matches the Stripe redeem_by instant and closes after it", () => {
    expect(HOLIDAY_ENDS_AT_UNIX).toBe(1801461599);
    expect(LAST_SECOND / 1000).toBe(HOLIDAY_ENDS_AT_UNIX);
    expect(holidayActive(DURING)).toBe(true);
    expect(holidayActive(LAST_SECOND)).toBe(true);
    expect(holidayActive(LAST_SECOND + 999)).toBe(true);
    expect(holidayActive(AFTER)).toBe(false);
  });

  it("keeps list prices and only overlays the first month", () => {
    expect(PLAN_PRICE_USD.pro).toBe(20);
    expect(PLAN_PRICE_USD.max).toBe(50);
    expect(planCatalog().map((p) => p.priceUsd)).toEqual([0, 20, 50]);
    expect(holidayPriceLine("pro")).toBe("First month $10, then $20 per month");
    expect(holidayPriceLine("max")).toBe("First month $25, then $50 per month");
  });

  it("reads the promotion code id, and treats off as disabled", () => {
    vi.stubEnv("HOLIDAY_PROMO_CODE_ID", "");
    expect(holidayPromoCodeId()).toBeNull();
    vi.stubEnv("HOLIDAY_PROMO_CODE_ID", "off");
    expect(holidayPromoCodeId()).toBeNull();
    vi.stubEnv("HOLIDAY_PROMO_CODE_ID", "promo_custom");
    expect(holidayPromoCodeId()).toBe("promo_custom");
    vi.unstubAllEnvs();
    expect(holidayPromoCodeId()).toBe(HOLIDAY_PROMO_CODE_ID_DEFAULT);
    expect(holidayAutoPromo(DURING)).toBe(PROMO);
    expect(holidayAutoPromo(AFTER)).toBeNull();
  });
});

describe("first-time customer", () => {
  function stripe(invoices: { id: string }[], charges: { status?: string; paid?: boolean }[]) {
    return {
      invoices: { list: async () => ({ data: invoices }) },
      charges: { list: async () => ({ data: charges }) },
    };
  }

  it("is first-time only with no paid invoice and no succeeded charge", async () => {
    const none = stripe([], []);
    expect(await isFirstTimeCustomer(none as never, "cus_1")).toBe(true);
    expect(await isFirstTimeCustomer(stripe([{ id: "in_1" }], []) as never, "cus_1")).toBe(false);
    expect(await isFirstTimeCustomer(stripe([], [{ status: "succeeded" }]) as never, "cus_1")).toBe(false);
    expect(await isFirstTimeCustomer(stripe([], [{ status: "failed", paid: false }]) as never, "cus_1")).toBe(true);
  });
});

const h = vi.hoisted(() => {
  const created: Record<string, unknown>[] = [];
  const updated: { id: string; params: Record<string, unknown> }[] = [];
  const state = {
    invoices: [] as { id: string }[],
    charges: [] as { status?: string; paid?: boolean }[],
    subs: [] as { id: string; status: string; items: { data: { id: string; price: { id: string } }[] } }[],
  };
  const stripe = {
    customers: {
      list: async () => ({ data: [] }),
      create: async () => ({ id: "cus_new" }),
    },
    subscriptions: {
      list: async () => ({ data: state.subs }),
      update: async (id: string, params: Record<string, unknown>) => { updated.push({ id, params }); return {}; },
    },
    invoices: { list: async () => ({ data: state.invoices }) },
    charges: { list: async () => ({ data: state.charges }) },
    checkout: { sessions: { create: async (params: Record<string, unknown>) => { created.push(params); return { url: "https://checkout.stripe.test/cs" }; } } },
  };
  return { created, updated, state, stripe };
});

vi.mock("@/auth", () => ({ requireUserId: async () => "user_1" }));
vi.mock("@/lib/ratelimit", () => ({
  LIMITS: { billingUser10m: { name: "billing" } },
  rule: (limit: unknown, id: string) => ({ limit, id }),
  limitDurable: async () => ({ ok: true, retryAfterSec: 0 }),
}));
vi.mock("@/lib/usage", () => ({
  ensureEntitlement: async () => ({ stripeCustomerId: "cus_1", stripeSubscriptionId: h.state.subs[0]?.id ?? null }),
}));
vi.mock("@/lib/db", () => ({
  prisma: {
    user: { findUniqueOrThrow: async () => ({ id: "user_1", email: "new@example.com" }) },
    entitlement: { update: async () => ({}) },
  },
}));
vi.mock("@/lib/stripe", () => ({
  billingOpenFor: () => true,
  getStripe: () => h.stripe,
  planForPrice: (id?: string | null) => (id === "price_max" ? "max" : id === "price_pro" ? "pro" : null),
  priceFor: (plan: "pro" | "max") => (plan === "pro" ? "price_pro" : "price_max"),
}));

function post(plan: "pro" | "max") {
  return new Request("https://citad3l.io/api/billing/checkout", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ plan }),
  });
}

describe("checkout promo", () => {
  beforeEach(() => {
    h.created.length = 0;
    h.updated.length = 0;
    h.state.invoices = [];
    h.state.charges = [];
    h.state.subs = [];
    vi.useFakeTimers();
    vi.setSystemTime(DURING);
    vi.unstubAllEnvs();
  });

  it("auto-applies the promotion code id for a first-time customer", async () => {
    const { POST } = await import("@/app/api/billing/checkout/route");
    const res = await POST(post("pro"));
    expect(res.status).toBe(200);
    expect(h.created).toHaveLength(1);
    expect(h.created[0].discounts).toEqual([{ promotion_code: PROMO }]);
    expect(h.created[0].allow_promotion_codes).toBeUndefined();
    expect(h.created[0].success_url).toContain("/account/billing?checkout=success");
    expect(h.created[0].cancel_url).toContain("/pricing?checkout=canceled");
  });

  it("opens the code field for a customer who already paid", async () => {
    h.state.invoices = [{ id: "in_paid" }];
    const { POST } = await import("@/app/api/billing/checkout/route");
    const res = await POST(post("pro"));
    expect(res.status).toBe(200);
    expect(h.created[0].allow_promotion_codes).toBe(true);
    expect(h.created[0].discounts).toBeUndefined();
    expect(JSON.stringify(h.created[0])).not.toContain(PROMO);
  });

  it("does not attach the promo after the deadline", async () => {
    vi.setSystemTime(AFTER);
    const { POST } = await import("@/app/api/billing/checkout/route");
    await POST(post("max"));
    expect(h.created[0].allow_promotion_codes).toBe(true);
    expect(h.created[0].discounts).toBeUndefined();
  });

  it("does not attach the promo on an in-place plan swap", async () => {
    h.state.subs = [{ id: "sub_1", status: "active", items: { data: [{ id: "si_1", price: { id: "price_pro" } }] } }];
    const { POST } = await import("@/app/api/billing/checkout/route");
    const res = await POST(post("max"));
    expect(res.status).toBe(200);
    expect(h.created).toEqual([]);
    expect(h.updated).toHaveLength(1);
    expect(h.updated[0].params.items).toEqual([{ id: "si_1", price: "price_max" }]);
    expect(h.updated[0].params.discounts).toBeUndefined();
    expect(JSON.stringify(h.updated[0].params)).not.toContain("promo_");
    expect(JSON.stringify(h.updated[0].params)).not.toContain("HOLIDAY");
  });
});

describe("holiday banner", () => {
  const banner = readFileSync("components/marketing/HolidayBanner.tsx", "utf8");
  const copySrc = readFileSync("lib/holiday.ts", "utf8");
  const pricing = readFileSync("components/marketing/PricingView.tsx", "utf8");
  const home = readFileSync("components/marketing/HomeView.tsx", "utf8");
  const pricingPage = readFileSync("app/pricing/page.tsx", "utf8");
  const homePage = readFileSync("app/page.tsx", "utf8");
  const copy = banner + copySrc + pricing + home;

  it("keeps the approved headline, body, and code line", () => {
    expect(copySrc).toContain('HOLIDAY_HEADLINE_LEAD = "AI for all."');
    expect(copySrc).toContain('HOLIDAY_HEADLINE_REST = "Privacy comes with it."');
    expect(copySrc).toContain('HOLIDAY_BODY_BEFORE = "Holiday deal: new signups get "');
    expect(copySrc).toContain('HOLIDAY_BODY_STRONG = "50% off your first month"');
    expect(copySrc).toContain('HOLIDAY_BODY_AFTER = " through January 31, 2027."');
    expect(copySrc).toContain('HOLIDAY_BODY_PRICES = "Pro $10, then $20. Max $25, then $50."');
    expect(copySrc).toContain('HOLIDAY_CODE_BEFORE = "Use code "');
    expect(copySrc).toContain('HOLIDAY_CODE = "HOLIDAY50"');
    expect(copySrc).toContain('HOLIDAY_CODE_AFTER = " at checkout if it is not already applied."');
    expect(banner).toContain("Copy code {HOLIDAY_CODE}");
    expect(banner).toContain('aria-live="polite"');
    expect(banner).toContain("then $20 per month");
    expect(banner).toContain("then $50 per month");
    expect(banner).toContain("hb-body-prices");
    expect(copy).not.toMatch(/abliterat/i);
    expect(copy).not.toMatch(/end-to-end/i);
    expect(copy).not.toMatch(LEAK_RE);
  });

  it("gates the banner and first-month lines, and leaves list prices alone", () => {
    expect(pricing).toContain("{holiday ? <HolidayBanner /> : null}");
    expect(pricing).toContain('showHolidayPrices && (p.id === "pro" || p.id === "max")');
    expect(pricing).toContain("holidayPriceLine(p.id)");
    expect(pricing).toContain("${p.priceUsd}");
    expect(pricing).toContain('id="all-plans"');
    expect(home).toContain("<HolidayBanner compact />");
    expect(home).toContain('price: "$20"');
    expect(home).toContain('price: "$50"');
    expect(home).toContain("Private AI. Fast answers.");
    expect(banner).toContain('href="/pricing#plans"');
    expect(pricingPage).toContain("holidayActive()");
    expect(pricingPage).toContain('plan !== "pro" && plan !== "max"');
    expect(homePage).toContain("holidayActive()");
    expect(homePage).toContain('usage?.plan === "pro" || usage?.plan === "max"');
  });

  it("styles one cyan pass, then an even hairline, with no amber", () => {
    const css = readFileSync("app/globals.css", "utf8");
    const holiday = css.slice(css.indexOf("/* holiday"));
    expect(holiday).toContain("#3fd8ff");
    expect(holiday).toContain("hb-pass 8s linear 1 forwards");
    expect(holiday).toContain(".hb-body-prices { display: none; }");
    expect(holiday).toContain("prefers-reduced-motion: reduce");
    expect(holiday).toContain("animation: none !important");
    expect(holiday).not.toMatch(/infinite/);
    expect(holiday.toLowerCase()).not.toContain("amber");
    expect(holiday).not.toContain("#ffb547");
    expect(holiday).not.toMatch(/abliterat/i);
    expect(holiday).not.toMatch(/end-to-end/i);
  });
});
