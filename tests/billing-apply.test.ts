/** Unit tests for Stripe entitlement handlers and checkout sub selection (no server required). */
import { describe, it, expect, beforeEach, vi } from "vitest";
import type Stripe from "stripe";

const { stripeEvent, entitlement, user } = vi.hoisted(() => ({
  stripeEvent: { create: vi.fn(), delete: vi.fn() },
  entitlement: { findUnique: vi.fn(), update: vi.fn(), upsert: vi.fn(), updateMany: vi.fn() },
  user: { findUnique: vi.fn() },
}));

vi.mock("@/lib/db", () => ({
  prisma: { stripeEvent, entitlement, user },
}));

vi.mock("@/lib/stripe", () => ({
  planForPrice: (id?: string | null) => (id === "price_max" ? "max" : id === "price_pro" ? "pro" : null),
}));

import { applyStripeEvent, pickOpenSubscription, subscriptionItemAndPrice } from "@/lib/billing";

function ev(id: string, type: Stripe.Event["type"], object: unknown): Stripe.Event {
  return {
    id,
    object: "event",
    type,
    livemode: false,
    created: Math.floor(Date.now() / 1000),
    data: { object },
    api_version: "2025-01-01",
    pending_webhooks: 0,
    request: null,
  } as unknown as Stripe.Event;
}

const userId = "user_frank";
const cus = "cus_1";
const proSub = "sub_pro";
const maxSub = "sub_max";

beforeEach(() => {
  vi.clearAllMocks();
  stripeEvent.create.mockResolvedValue({});
  stripeEvent.delete.mockResolvedValue({});
  entitlement.update.mockResolvedValue({});
  entitlement.upsert.mockResolvedValue({});
  user.findUnique.mockResolvedValue({ id: userId });
});

describe("pickOpenSubscription", () => {
  it("prefers the entitlement's sub when several are open, and ignores canceled ones", () => {
    const subs = [
      { id: "sub_old", status: "canceled", items: { data: [{ id: "si_old", price: { id: "price_pro" } }] } },
      { id: proSub, status: "active", items: { data: [{ id: "si_pro", price: { id: "price_pro" } }] } },
      { id: maxSub, status: "active", items: { data: [{ id: "si_max", price: { id: "price_max" } }] } },
    ];
    const picked = pickOpenSubscription(subs, maxSub);
    expect(picked?.id).toBe(maxSub);
    expect(subscriptionItemAndPrice(picked!).priceId).toBe("price_max");
    expect(pickOpenSubscription(subs, null)?.id).toBe(proSub);
    expect(pickOpenSubscription([{ id: "sub_x", status: "canceled" }], "sub_x")).toBeNull();
  });
});

describe("customer.subscription.deleted", () => {
  it("downgrades only when the deleted sub is the one on the entitlement", async () => {
    entitlement.findUnique.mockResolvedValue({
      userId,
      plan: "pro",
      status: "active",
      stripeCustomerId: cus,
      stripeSubscriptionId: proSub,
    });
    const result = await applyStripeEvent(ev("evt_del_match", "customer.subscription.deleted", {
      id: proSub,
      object: "subscription",
      customer: cus,
      status: "canceled",
      metadata: { userId },
      items: { data: [] },
    }));
    expect(result).toBe("processed");
    expect(entitlement.update).toHaveBeenCalledWith({
      where: { userId },
      data: { plan: "trial", status: "canceled", cancelAtPeriodEnd: false, stripeSubscriptionId: null, periodEnd: null },
    });
  });

  it("ignores a deleted leftover sub when the entitlement is already on a different sub (e.g. Max)", async () => {
    entitlement.findUnique.mockResolvedValue({
      userId,
      plan: "max",
      status: "active",
      stripeCustomerId: cus,
      stripeSubscriptionId: maxSub,
    });
    const result = await applyStripeEvent(ev("evt_del_other", "customer.subscription.deleted", {
      id: proSub,
      object: "subscription",
      customer: cus,
      status: "canceled",
      metadata: { userId },
      items: { data: [] },
    }));
    expect(result).toBe("ignored");
    expect(entitlement.update).not.toHaveBeenCalled();
  });

  it("ignores a deleted sub when the entitlement has no stripeSubscriptionId yet", async () => {
    entitlement.findUnique.mockResolvedValue({
      userId,
      plan: "max",
      status: "active",
      stripeCustomerId: cus,
      stripeSubscriptionId: null,
    });
    const result = await applyStripeEvent(ev("evt_del_null", "customer.subscription.deleted", {
      id: proSub,
      object: "subscription",
      customer: cus,
      status: "canceled",
      metadata: { userId },
      items: { data: [] },
    }));
    expect(result).toBe("ignored");
    expect(entitlement.update).not.toHaveBeenCalled();
  });
});
