import { describe, it, expect, vi, afterEach } from "vitest";
import Stripe from "stripe";

afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });

describe("billing gate (BILLING_ENABLED)", () => {
  it("defaults to admins only", async () => {
    vi.stubEnv("OWNER_EMAIL", "owner@test.local");
    vi.stubEnv("ADMIN_EMAILS", "owner@test.local,cousin@test.local");
    vi.stubEnv("BILLING_ENABLED", "");
    const { billingOpenFor, billingMode } = await import("@/lib/stripe");
    expect(billingMode()).toBe("admins");
    expect(billingOpenFor("Owner@Test.local")).toBe(true);
    expect(billingOpenFor("cousin@test.local")).toBe(true);
    expect(billingOpenFor("someone@example.com")).toBe(false);
    expect(billingOpenFor(null)).toBe(false);
  });
  it("all opens to everyone only in STRIPE_MODE=live; off closes to admins too", async () => {
    vi.stubEnv("BILLING_ENABLED", "all");
    vi.stubEnv("STRIPE_MODE", "live");
    let m = await import("@/lib/stripe");
    expect(m.billingOpenFor("someone@example.com")).toBe(true);
    expect(m.billingPublic()).toBe(true);
    vi.resetModules();
    vi.stubEnv("STRIPE_MODE", "test"); // test keys: nobody but admins can get a plan with a test card
    vi.stubEnv("OWNER_EMAIL", "owner@test.local");
    m = await import("@/lib/stripe");
    expect(m.billingOpenFor("someone@example.com")).toBe(false);
    expect(m.billingOpenFor("owner@test.local")).toBe(true);
    expect(m.billingPublic()).toBe(false);
    vi.resetModules();
    vi.stubEnv("BILLING_ENABLED", "off");
    vi.stubEnv("OWNER_EMAIL", "owner@test.local");
    m = await import("@/lib/stripe");
    expect(m.billingOpenFor("owner@test.local")).toBe(false);
  });
  it("price ids map to plans", async () => {
    vi.stubEnv("STRIPE_PRICE_PRO", "price_pro");
    vi.stubEnv("STRIPE_PRICE_MAX", "price_max");
    const { planForPrice } = await import("@/lib/stripe");
    expect(planForPrice("price_pro")).toBe("pro");
    expect(planForPrice("price_max")).toBe("max");
    expect(planForPrice("price_other")).toBeNull();
  });
  it("webhook signatures verify with the async SubtleCrypto path used on Workers", async () => {
    const secret = "whsec_unit_test_only";
    const payload = JSON.stringify({ id: "evt_1", object: "event", type: "invoice.paid", livemode: false, data: { object: {} } });
    const header = Stripe.webhooks.generateTestHeaderString({ payload, secret });
    const ev = await Stripe.webhooks.constructEventAsync(payload, header, secret, undefined, Stripe.createSubtleCryptoProvider());
    expect(ev.id).toBe("evt_1");
    await expect(Stripe.webhooks.constructEventAsync(payload, "t=1,v1=deadbeef", secret, undefined, Stripe.createSubtleCryptoProvider())).rejects.toThrow();
  });

  it("accepts webhook events only when livemode matches STRIPE_MODE", async () => {
    vi.stubEnv("STRIPE_MODE", "live");
    let m = await import("@/lib/stripe");
    expect(m.webhookAcceptsEvent(true)).toBe(true);
    expect(m.webhookAcceptsEvent(false)).toBe(false);
    vi.resetModules();
    vi.stubEnv("STRIPE_MODE", "test");
    m = await import("@/lib/stripe");
    expect(m.webhookAcceptsEvent(false)).toBe(true);
    expect(m.webhookAcceptsEvent(true)).toBe(false);
  });
});
