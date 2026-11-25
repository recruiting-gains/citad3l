/** Unit tests for the referral promo rules (no server, no Stripe). */
import { describe, it, expect, beforeEach, vi } from "vitest";

const { referral, referralAttribution, user, entitlement, stripeEvent, stripe } = vi.hoisted(() => ({
  referral: { findUnique: vi.fn(), create: vi.fn() },
  referralAttribution: { findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn(), count: vi.fn(), groupBy: vi.fn() },
  user: { findUnique: vi.fn(), findUniqueOrThrow: vi.fn() },
  entitlement: { findUnique: vi.fn(), update: vi.fn(), upsert: vi.fn(), updateMany: vi.fn() },
  stripeEvent: { create: vi.fn(), delete: vi.fn() },
  stripe: {
    customers: { retrieve: vi.fn(), createBalanceTransaction: vi.fn() },
    invoices: { list: vi.fn() },
    charges: { retrieve: vi.fn() },
  },
}));

vi.mock("@/lib/db", () => ({ prisma: { referral, referralAttribution, user, entitlement, stripeEvent } }));
vi.mock("@/lib/stripe", () => ({ getStripe: () => stripe, planForPrice: () => null }));
vi.mock("@/lib/usage", () => ({ ensureEntitlement: (userId: string) => entitlement.upsert({ where: { userId } }) }));

import {
  captureReferralAtSignup,
  decideOnInvoice,
  grantReward,
  inPromoWindow,
  logManualReferral,
  normalizeEmailForSelfCheck,
  normalizeRefCode,
  promoEnded,
  REFERRAL_PROMO_END,
  REFERRAL_PROMO_START,
  referralOnInvoicePaid,
  referralOnPaymentReversal,
  referralPayload,
} from "@/lib/referrals";
import { applyStripeEvent } from "@/lib/billing";

const DAY = 24 * 60 * 60 * 1000;
const now = new Date("2026-11-25T18:00:00Z"); // inside the window

beforeEach(() => {
  vi.clearAllMocks();
  process.env.REFERRALS_ENABLED = "on";
  delete process.env.REFERRAL_CAP;
  stripe.customers.createBalanceTransaction.mockImplementation(async (cus: string, p: { amount: number }) => ({ id: `cbtxn_${cus}_${p.amount}` }));
  referralAttribution.update.mockResolvedValue({});
  referralAttribution.updateMany.mockResolvedValue({ count: 1 });
  referralAttribution.count.mockResolvedValue(0);
  entitlement.update.mockResolvedValue({});
  stripeEvent.create.mockResolvedValue({});
});

describe("promo window", () => {
  it("runs Nov 24 00:00 through Dec 8 11:59:59 PM Chicago time", () => {
    expect(REFERRAL_PROMO_START.toISOString()).toBe("2026-11-24T06:00:00.000Z");
    expect(REFERRAL_PROMO_END.toISOString()).toBe("2026-12-09T05:59:59.999Z");
    expect(inPromoWindow(new Date("2026-11-24T05:59:59Z"))).toBe(false); // Nov 23, 11:59 PM CT
    expect(inPromoWindow(new Date("2026-12-09T05:59:00Z"))).toBe(true); // Dec 8, 11:59 PM CT
    expect(inPromoWindow(new Date("2026-12-09T06:00:00Z"))).toBe(false); // Dec 9, 12:00 AM CT
    expect(promoEnded(new Date("2026-12-09T06:00:00Z"))).toBe(true);
    expect(promoEnded(now)).toBe(false);
  });
});

describe("codes and emails", () => {
  it("accepts only short lowercase codes", () => {
    expect(normalizeRefCode(" AbC123 ")).toBe("abc123");
    expect(normalizeRefCode("x")).toBeNull();
    expect(normalizeRefCode("bad code!")).toBeNull();
  });
  it("matches obvious same-inbox aliases only", () => {
    expect(normalizeEmailForSelfCheck("Cruz.G+promo@gmail.com")).toBe("cruzg@gmail.com");
    expect(normalizeEmailForSelfCheck("a.b@work.com")).not.toBe(normalizeEmailForSelfCheck("ab@work.com"));
  });
});

describe("decideOnInvoice", () => {
  const pending = { status: "pending", createdAt: now };
  const paid = (o: Partial<{ billingReason: string; amountPaid: number; paidAt: Date }> = {}) => ({ invoiceId: "in_1", billingReason: "subscription_create", amountPaid: 2000, paidAt: now, ...o });
  it("rewards the friend's first real subscription payment", () => {
    expect(decideOnInvoice(pending, paid())).toBe("reward");
    expect(decideOnInvoice(pending, paid({ billingReason: "subscription_cycle" }))).toBe("reward"); // first charge after a trial
  });
  it("ignores $0 invoices, prorations and one-offs", () => {
    expect(decideOnInvoice(pending, paid({ amountPaid: 0 }))).toBe("ignore");
    expect(decideOnInvoice(pending, paid({ billingReason: "subscription_update" }))).toBe("ignore");
    expect(decideOnInvoice(pending, paid({ billingReason: "manual" }))).toBe("ignore");
  });
  it("lets payment land shortly after the window, but not much later", () => {
    expect(decideOnInvoice(pending, paid({ paidAt: new Date(REFERRAL_PROMO_END.getTime() + 3 * DAY) }))).toBe("reward");
    expect(decideOnInvoice(pending, paid({ paidAt: new Date(REFERRAL_PROMO_END.getTime() + 20 * DAY) }))).toBe("expire");
  });
  it("expires a row dated outside the window", () => {
    expect(decideOnInvoice({ status: "pending", createdAt: new Date("2026-12-10T00:00:00Z") }, paid())).toBe("expire");
  });
  it("never re-rewards a finished row", () => {
    for (const status of ["credited", "rejected", "capped", "voided", "reversed", "expired", "crediting"]) expect(decideOnInvoice({ status, createdAt: now }, paid())).toBe("ignore");
  });
});

describe("captureReferralAtSignup", () => {
  const referrer = { userId: "u_ref", user: { email: "ref@example.com", bannedAt: null } };
  beforeEach(() => {
    referral.findUnique.mockResolvedValue(referrer);
    user.findUnique.mockImplementation(async ({ select }: { select: Record<string, boolean> }) => (select.createdAt ? { createdAt: new Date(now.getTime() - 60_000) } : { email: "friend@example.com" }));
    entitlement.findUnique.mockResolvedValue(null);
    referralAttribution.findUnique.mockResolvedValue(null);
    referralAttribution.create.mockResolvedValue({});
  });
  it("does nothing while the program is off", async () => {
    process.env.REFERRALS_ENABLED = "off";
    expect(await captureReferralAtSignup({ userId: "u_new", code: "abcd1234", now })).toBe("disabled");
  });
  it("locks a valid code onto a brand-new account", async () => {
    expect(await captureReferralAtSignup({ userId: "u_new", code: "ABCD1234", now })).toBe("attributed");
    expect(referralAttribution.create).toHaveBeenCalledWith({ data: { referrerUserId: "u_ref", referredUserId: "u_new", code: "abcd1234", source: "link", createdAt: now } });
  });
  it("signups after Dec 8 earn nothing", async () => {
    expect(await captureReferralAtSignup({ userId: "u_new", code: "abcd1234", now: new Date("2026-12-09T06:00:01Z") })).toBe("outside_window");
    expect(referralAttribution.create).not.toHaveBeenCalled();
  });
  it("blocks self-referral by account and by email alias", async () => {
    expect(await captureReferralAtSignup({ userId: "u_ref", code: "abcd1234", now })).toBe("self");
    user.findUnique.mockImplementation(async ({ select }: { select: Record<string, boolean> }) => (select.createdAt ? { createdAt: new Date(now.getTime() - 60_000) } : { email: "ref+2@example.com" }));
    expect(await captureReferralAtSignup({ userId: "u_alias", code: "abcd1234", now })).toBe("same_email");
    expect(referralAttribution.create).toHaveBeenCalledWith({ data: expect.objectContaining({ status: "rejected", reason: "same_email" }) });
  });
  it("first code wins, and only new accounts", async () => {
    referralAttribution.findUnique.mockResolvedValueOnce({ id: "att_old" });
    expect(await captureReferralAtSignup({ userId: "u_new", code: "zzzz9999", now })).toBe("already_attributed");
    user.findUnique.mockImplementation(async () => ({ createdAt: new Date(now.getTime() - 2 * DAY), email: "x@example.com" }));
    expect(await captureReferralAtSignup({ userId: "u_old", code: "abcd1234", now })).toBe("not_new");
  });
});

describe("grantReward", () => {
  const base = { id: "att_1", status: "crediting", referrerUserId: "u_ref", referredUserId: "u_new", referredCustomerId: "cus_friend", referrerCreditTxnId: null };
  it("paid Pro referrer: one month ($20) of bill credit, idempotent", async () => {
    referralAttribution.findUnique.mockResolvedValue(base);
    entitlement.upsert.mockResolvedValue({ plan: "pro", status: "active", stripeSubscriptionId: "sub_r", stripeCustomerId: "cus_ref" });
    expect(await grantReward("att_1", now)).toBe("credited");
    expect(stripe.customers.createBalanceTransaction).toHaveBeenCalledWith("cus_ref", expect.objectContaining({ amount: -2000, currency: "usd" }), { idempotencyKey: "c3-ref-att_1-month" });
    expect(referralAttribution.update).toHaveBeenLastCalledWith({ where: { id: "att_1" }, data: expect.objectContaining({ status: "credited", rewardKind: "balance", rewardCents: 2000 }) });
  });
  it("paid Max referrer: one month of Max ($50)", async () => {
    referralAttribution.findUnique.mockResolvedValue(base);
    entitlement.upsert.mockResolvedValue({ plan: "max", status: "active", stripeSubscriptionId: "sub_r", stripeCustomerId: "cus_ref" });
    await grantReward("att_1", now);
    expect(stripe.customers.createBalanceTransaction).toHaveBeenCalledWith("cus_ref", expect.objectContaining({ amount: -5000 }), expect.anything());
  });
  it("Free referrer: 30 days of Pro, no Stripe", async () => {
    referralAttribution.findUnique.mockResolvedValue(base);
    entitlement.upsert.mockResolvedValue({ plan: "trial", status: "trialing", stripeSubscriptionId: null, stripeCustomerId: null });
    expect(await grantReward("att_1", now)).toBe("credited");
    expect(stripe.customers.createBalanceTransaction).not.toHaveBeenCalled();
    expect(entitlement.update).toHaveBeenCalledWith({ where: { userId: "u_ref" }, data: expect.objectContaining({ plan: "pro", status: "active", periodEnd: new Date(now.getTime() + 30 * DAY) }) });
  });
  it("a second reward on Free stacks another 30 days", async () => {
    const end = new Date(now.getTime() + 10 * DAY);
    referralAttribution.findUnique.mockResolvedValue(base);
    entitlement.upsert.mockResolvedValue({ plan: "pro", status: "active", stripeSubscriptionId: null, periodEnd: end });
    await grantReward("att_1", now);
    expect(entitlement.update).toHaveBeenCalledWith({ where: { userId: "u_ref" }, data: { periodEnd: new Date(end.getTime() + 30 * DAY) } });
  });
  it("rejects same Stripe customer, a customer already rewarded, and stops at the cap", async () => {
    referralAttribution.findUnique.mockResolvedValue(base);
    entitlement.upsert.mockResolvedValue({ plan: "pro", status: "active", stripeSubscriptionId: "s", stripeCustomerId: "cus_friend" });
    expect(await grantReward("att_1", now)).toBe("rejected");
    entitlement.upsert.mockResolvedValue({ plan: "pro", status: "active", stripeSubscriptionId: "s", stripeCustomerId: "cus_ref" });
    referralAttribution.count.mockResolvedValueOnce(1);
    expect(await grantReward("att_1", now)).toBe("rejected");
    referralAttribution.count.mockResolvedValueOnce(0).mockResolvedValueOnce(3);
    expect(await grantReward("att_1", now)).toBe("capped");
    expect(stripe.customers.createBalanceTransaction).not.toHaveBeenCalled();
  });
});

describe("webhook wiring", () => {
  const ev = (id: string, type: string, object: unknown) => ({ id, type, livemode: false, data: { object } }) as never;
  it("friend's first invoice.paid grants the referrer's month right away", async () => {
    user.findUnique.mockResolvedValue({ id: "u_new" });
    entitlement.findUnique.mockResolvedValue({ userId: "u_new", plan: "pro", periodStart: null });
    const t = Math.floor(now.getTime() / 1000);
    referralAttribution.findUnique
      .mockResolvedValueOnce({ id: "att_1", status: "pending", createdAt: now })
      .mockResolvedValueOnce({ id: "att_1", status: "crediting", referrerUserId: "u_ref", referredCustomerId: "cus_friend", referrerCreditTxnId: null });
    entitlement.upsert.mockResolvedValue({ plan: "pro", status: "active", stripeSubscriptionId: "sub_r", stripeCustomerId: "cus_ref" });
    const r = await applyStripeEvent(ev("evt_1", "invoice.paid", { id: "in_1", customer: "cus_friend", billing_reason: "subscription_create", amount_paid: 2000, created: t, status_transitions: { paid_at: t }, lines: { data: [] } }));
    expect(r).toBe("processed");
    expect(referralAttribution.updateMany).toHaveBeenCalledWith({ where: { id: "att_1", status: "pending" }, data: expect.objectContaining({ status: "crediting", firstPaidInvoiceId: "in_1", referredCustomerId: "cus_friend" }) });
    expect(stripe.customers.createBalanceTransaction).toHaveBeenCalledTimes(1);
  });
  it("refund before the grant voids it", async () => {
    referralAttribution.findFirst.mockResolvedValueOnce({ id: "att_1", status: "pending" });
    expect(await referralOnPaymentReversal("cus_friend", "refund", now)).toBe(true);
    expect(referralAttribution.update).toHaveBeenLastCalledWith({ where: { id: "att_1" }, data: { status: "voided", reason: "refund" } });
  });
  it("refund after a bill credit takes back only the unused part", async () => {
    referralAttribution.findFirst.mockResolvedValueOnce({ id: "att_1", status: "credited", rewardKind: "balance", rewardCents: 2000, referrerCustomerId: "cus_ref" });
    stripe.customers.retrieve.mockResolvedValueOnce({ id: "cus_ref", balance: -2000 });
    await referralOnPaymentReversal("cus_friend", "dispute", now);
    expect(stripe.customers.createBalanceTransaction).toHaveBeenCalledWith("cus_ref", expect.objectContaining({ amount: 2000 }), { idempotencyKey: "c3-ref-att_1-reverse" });
    referralAttribution.findFirst.mockResolvedValueOnce({ id: "att_2", status: "credited", rewardKind: "balance", rewardCents: 2000, referrerCustomerId: "cus_ref" });
    stripe.customers.retrieve.mockResolvedValueOnce({ id: "cus_ref", balance: -500 });
    await referralOnPaymentReversal("cus_friend2", "refund", now);
    expect(stripe.customers.createBalanceTransaction).toHaveBeenLastCalledWith("cus_ref", expect.objectContaining({ amount: 500 }), expect.anything());
    expect(referralAttribution.update).toHaveBeenLastCalledWith({ where: { id: "att_2" }, data: expect.objectContaining({ status: "reversed", flagReason: "credit_partly_used:1500" }) });
  });
  it("refund after Pro days removes the 30 days", async () => {
    referralAttribution.findFirst.mockResolvedValueOnce({ id: "att_1", status: "credited", rewardKind: "pro_days", rewardDays: 30, referrerUserId: "u_ref" });
    entitlement.findUnique.mockResolvedValueOnce({ plan: "pro", stripeSubscriptionId: null, periodEnd: new Date(now.getTime() + 29 * DAY) });
    await referralOnPaymentReversal("cus_friend", "refund", now);
    expect(entitlement.update).toHaveBeenCalledWith({ where: { userId: "u_ref" }, data: expect.objectContaining({ plan: "trial", status: "trialing" }) });
  });
  it("does nothing with the program off", async () => {
    process.env.REFERRALS_ENABLED = "off";
    expect(await referralOnInvoicePaid({ id: "in_1" } as never, "u_new")).toBe(false);
    expect(referralAttribution.findUnique).not.toHaveBeenCalled();
  });
});

describe("manual log", () => {
  it("only counts entries dated inside the window", async () => {
    expect(await logManualReferral({ referrerEmail: "a@x.com", friendEmail: "b@x.com", at: new Date("2026-11-20T12:00:00Z") })).toBe("outside_window");
    user.findUnique.mockResolvedValueOnce({ id: "u_ref", email: "a@x.com", bannedAt: null }).mockResolvedValueOnce({ id: "u_new" }).mockResolvedValueOnce({ email: "b@x.com" });
    referral.findUnique.mockResolvedValue({ userId: "u_ref", code: "abcd1234" });
    referralAttribution.create.mockResolvedValue({});
    entitlement.findUnique.mockResolvedValue(null);
    expect(await logManualReferral({ referrerEmail: "a@x.com", friendEmail: "b@x.com", at: new Date("2026-11-24T15:00:00Z") })).toBe("pending");
    expect(referralAttribution.create).toHaveBeenCalledWith({ data: expect.objectContaining({ source: "manual", createdAt: new Date("2026-11-24T15:00:00Z") }) });
  });
});

describe("referralPayload", () => {
  it("counts invited / waiting / free months, the cap, and the end date, without exposing friends", async () => {
    referral.findUnique.mockResolvedValue({ userId: "u_ref", code: "abcd1234" });
    referralAttribution.groupBy.mockResolvedValue([
      { status: "pending", _count: { _all: 2 } },
      { status: "credited", _count: { _all: 1 } },
      { status: "rejected", _count: { _all: 4 } },
    ]);
    const p = await referralPayload("u_ref", now);
    expect(p).toMatchObject({ code: "abcd1234", enabled: true, cap: 3, invited: 3, pending: 2, credited: 1, capRemaining: 2, endsLabel: "Dec 8", ended: false });
    expect((await referralPayload("u_ref", new Date("2026-12-10T00:00:00Z"))).ended).toBe(true);
    expect(JSON.stringify(p)).not.toMatch(/@/);
  });
});
