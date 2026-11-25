/** Unit tests for the referral promo rules (no server, no Stripe). Includes the 2026-11-24 pen-test fixes (H1/H2/races). */
import { describe, it, expect, beforeEach, vi } from "vitest";

const { referral, referralAttribution, user, entitlement, stripeEvent, stripe, db } = vi.hoisted(() => {
  const referral = { findUnique: vi.fn(), create: vi.fn() };
  const referralAttribution = { findUnique: vi.fn(), findUniqueOrThrow: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn(), count: vi.fn(), groupBy: vi.fn() };
  const user = { findUnique: vi.fn(), findUniqueOrThrow: vi.fn() };
  const entitlement = { findUnique: vi.fn(), findUniqueOrThrow: vi.fn(), update: vi.fn(), upsert: vi.fn(), updateMany: vi.fn() };
  const stripeEvent = { create: vi.fn(), delete: vi.fn() };
  const stripe = {
    customers: { retrieve: vi.fn(), createBalanceTransaction: vi.fn(), listPaymentMethods: vi.fn() },
    invoices: { list: vi.fn() },
    invoicePayments: { list: vi.fn() },
    paymentIntents: { retrieve: vi.fn() },
    charges: { retrieve: vi.fn(), list: vi.fn() },
  };
  const db: Record<string, unknown> = { referral, referralAttribution, user, entitlement, stripeEvent, $queryRaw: vi.fn(async () => []) };
  db.$transaction = vi.fn(async (fn: (tx: unknown) => unknown) => fn(db));
  return { referral, referralAttribution, user, entitlement, stripeEvent, stripe, db };
});

vi.mock("@/lib/db", () => ({ prisma: db }));
vi.mock("@/lib/stripe", () => ({ getStripe: () => stripe, planForPrice: () => null }));
vi.mock("@/lib/usage", () => ({
  ensureEntitlement: (userId: string) => entitlement.upsert({ where: { userId } }),
  isPaidActive: (e: { plan: string; status: string }) => (e.plan === "pro" || e.plan === "max") && e.status === "active",
}));

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
  referralEmailHash,
  referralOnInvoicePaid,
  referralOnPaymentReversal,
  referralPayload,
  rewardValue,
} from "@/lib/referrals";
import { applyStripeEvent } from "@/lib/billing";

const DAY = 24 * 60 * 60 * 1000;
const now = new Date("2026-11-25T18:00:00Z"); // inside the window
const card = (fingerprint: string | null) => ({ status: "succeeded", payment_method_details: { card: { fingerprint } } });
type Where = Record<string, unknown>;
const has = (w: unknown, key: string) => JSON.stringify(w ?? {}).includes(`"${key}"`);

beforeEach(() => {
  vi.clearAllMocks();
  process.env.REFERRALS_ENABLED = "on";
  delete process.env.REFERRAL_CAP;
  stripe.customers.createBalanceTransaction.mockImplementation(async (cus: string, p: { amount: number }) => ({ id: `cbtxn_${cus}_${p.amount}` }));
  stripe.invoicePayments.list.mockResolvedValue({ data: [{ status: "paid", payment: { type: "payment_intent", payment_intent: "pi_friend" } }] });
  stripe.paymentIntents.retrieve.mockResolvedValue({ id: "pi_friend", latest_charge: card("fp_friend") });
  stripe.customers.listPaymentMethods.mockImplementation(async (cus: string) => ({ data: cus === "cus_ref" ? [{ card: { fingerprint: "fp_ref" } }] : [] }));
  stripe.charges.list.mockResolvedValue({ data: [] });
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
    expect(inPromoWindow(new Date("2026-11-24T05:59:59Z"))).toBe(false);
    expect(inPromoWindow(new Date("2026-12-09T05:59:00Z"))).toBe(true);
    expect(inPromoWindow(new Date("2026-12-09T06:00:00Z"))).toBe(false);
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
  it("email hash is stable across aliases and never contains the email", () => {
    const h = referralEmailHash("Cruz.G+x@gmail.com")!;
    expect(h).toBe(referralEmailHash("cruzg@gmail.com"));
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(referralEmailHash(null)).toBeNull();
  });
});

describe("rewardValue (H2)", () => {
  it("is one Pro month at most and never more than the friend's first payment", () => {
    expect(rewardValue(2000)).toEqual({ cents: 2000, days: 30 });
    expect(rewardValue(5000)).toEqual({ cents: 2000, days: 30 }); // friend on Max: still one Pro month
    expect(rewardValue(1000)).toEqual({ cents: 1000, days: 15 }); // 50% coupon
    expect(rewardValue(1)).toEqual({ cents: 1, days: 0 });
    expect(rewardValue(0)).toEqual({ cents: 0, days: 0 });
  });
});

describe("decideOnInvoice", () => {
  const pending = { status: "pending", createdAt: now };
  const paid = (o: Partial<{ billingReason: string; amountPaid: number; paidAt: Date }> = {}) => ({ invoiceId: "in_1", billingReason: "subscription_create", amountPaid: 2000, paidAt: now, ...o });
  it("rewards the friend's first real subscription payment", () => {
    expect(decideOnInvoice(pending, paid())).toBe("reward");
    expect(decideOnInvoice(pending, paid({ billingReason: "subscription_cycle" }))).toBe("reward");
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
    for (const status of ["credited", "rejected", "capped", "voided", "reversed", "expired", "crediting", "review"]) expect(decideOnInvoice({ status, createdAt: now }, paid())).toBe("ignore");
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
  it("locks a valid code onto a brand-new account, with both email hashes kept for later", async () => {
    expect(await captureReferralAtSignup({ userId: "u_new", code: "ABCD1234", now })).toBe("attributed");
    expect(referralAttribution.create).toHaveBeenCalledWith({
      data: { referrerUserId: "u_ref", referredUserId: "u_new", referrerEmailHash: referralEmailHash("ref@example.com"), referredEmailHash: referralEmailHash("friend@example.com"), code: "abcd1234", source: "link", createdAt: now },
    });
  });
  it("H1: an email that was referred before (account since deleted) can't be referred again", async () => {
    referralAttribution.count.mockImplementation(async ({ where }: { where: Where }) => (where.referredEmailHash === referralEmailHash("friend@example.com") ? 1 : 0));
    expect(await captureReferralAtSignup({ userId: "u_new2", code: "abcd1234", now })).toBe("already_attributed");
    expect(referralAttribution.create).not.toHaveBeenCalled();
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
  const base = { id: "att_1", status: "crediting", referrerUserId: "u_ref", referrerEmailHash: "h_ref", referredUserId: "u_new", referredCustomerId: "cus_friend", referredCardFingerprint: null, firstPaidInvoiceId: "in_1", firstPaidAmountCents: 2000, referrerCreditTxnId: null, rewardKind: null, rewardCents: 0 };
  const proRef = { userId: "u_ref", plan: "pro", status: "active", stripeSubscriptionId: "sub_r", stripeCustomerId: "cus_ref", referralProEndsAt: null };
  const freeRef = { userId: "u_ref", plan: "trial", status: "trialing", stripeSubscriptionId: null, stripeCustomerId: null, referralProEndsAt: null };
  const setup = (row: object, ent: object) => {
    referralAttribution.findUnique.mockResolvedValue(row);
    entitlement.upsert.mockResolvedValue(ent);
    entitlement.findUniqueOrThrow.mockResolvedValue(ent);
  };

  it("paid Pro referrer: $20 of bill credit, idempotent, inside a locked transaction", async () => {
    setup(base, proRef);
    expect(await grantReward("att_1", now)).toBe("credited");
    expect(stripe.customers.createBalanceTransaction).toHaveBeenCalledWith("cus_ref", expect.objectContaining({ amount: -2000, currency: "usd" }), { idempotencyKey: "c3-ref-att_1-month" });
    expect(referralAttribution.update).toHaveBeenLastCalledWith({ where: { id: "att_1" }, data: expect.objectContaining({ status: "credited", rewardKind: "balance", rewardCents: 2000 }) });
    expect(db.$transaction).toHaveBeenCalledTimes(1);
    const sql = (db.$queryRaw as ReturnType<typeof vi.fn>).mock.calls.map((c) => (c[0] as string[]).join("?"));
    expect(sql.some((q) => q.includes('"ReferralAttribution"') && q.includes("FOR UPDATE"))).toBe(true);
    expect(sql.some((q) => q.includes('"Entitlement"') && q.includes("FOR UPDATE"))).toBe(true);
  });
  it("H2: paid Max referrer still gets one Pro month ($20), not a Max month", async () => {
    setup(base, { ...proRef, plan: "max" });
    await grantReward("att_1", now);
    expect(stripe.customers.createBalanceTransaction).toHaveBeenCalledWith("cus_ref", expect.objectContaining({ amount: -2000 }), expect.anything());
  });
  it("H2: never more than the friend paid (friend on Max still caps at $20; a $10 coupon payment gives $10)", async () => {
    setup({ ...base, firstPaidAmountCents: 5000 }, proRef);
    await grantReward("att_1", now);
    expect(stripe.customers.createBalanceTransaction).toHaveBeenLastCalledWith("cus_ref", expect.objectContaining({ amount: -2000 }), expect.anything());
    setup({ ...base, firstPaidAmountCents: 1000 }, proRef);
    await grantReward("att_1", now);
    expect(stripe.customers.createBalanceTransaction).toHaveBeenLastCalledWith("cus_ref", expect.objectContaining({ amount: -1000 }), expect.anything());
  });
  it("Free referrer: 30 days of Pro with its own end date (referralProEndsAt), no Stripe credit", async () => {
    setup(base, freeRef);
    expect(await grantReward("att_1", now)).toBe("credited");
    expect(stripe.customers.createBalanceTransaction).not.toHaveBeenCalled();
    const end = new Date(now.getTime() + 30 * DAY);
    expect(entitlement.update).toHaveBeenCalledWith({ where: { userId: "u_ref" }, data: expect.objectContaining({ plan: "pro", status: "active", periodEnd: end, referralProEndsAt: end }) });
  });
  it("Free referrer whose friend paid $10 gets 15 days", async () => {
    setup({ ...base, firstPaidAmountCents: 1000 }, freeRef);
    await grantReward("att_1", now);
    expect(entitlement.update).toHaveBeenCalledWith({ where: { userId: "u_ref" }, data: expect.objectContaining({ referralProEndsAt: new Date(now.getTime() + 15 * DAY) }) });
  });
  it("a second reward on referral Pro stacks another 30 days", async () => {
    const end = new Date(now.getTime() + 10 * DAY);
    setup(base, { ...freeRef, plan: "pro", status: "active", periodEnd: end, referralProEndsAt: end });
    await grantReward("att_1", now);
    const next = new Date(end.getTime() + 30 * DAY);
    expect(entitlement.update).toHaveBeenCalledWith({ where: { userId: "u_ref" }, data: { periodEnd: next, referralProEndsAt: next } });
  });
  it("Free referrer with a leftover canceled subscription id: the stale id is cleared so it can't end the month", async () => {
    setup(base, { ...freeRef, status: "canceled", stripeSubscriptionId: "sub_old", stripeCustomerId: "cus_ref" });
    await grantReward("att_1", now);
    expect(entitlement.update).toHaveBeenCalledWith({ where: { userId: "u_ref" }, data: expect.objectContaining({ plan: "pro", stripeSubscriptionId: null }) });
  });
  it("H2: rejects the same card on both sides", async () => {
    stripe.paymentIntents.retrieve.mockResolvedValue({ latest_charge: card("fp_ref") });
    setup(base, proRef);
    expect(await grantReward("att_1", now)).toBe("rejected");
    expect(referralAttribution.update).toHaveBeenLastCalledWith({ where: { id: "att_1" }, data: expect.objectContaining({ status: "rejected", reason: "same_card", referredCardFingerprint: "fp_ref" }) });
    expect(stripe.customers.createBalanceTransaction).not.toHaveBeenCalled();
  });
  it("H2: rejects when the referrer once paid with the friend's card (charge history)", async () => {
    stripe.charges.list.mockImplementation(async ({ customer }: { customer: string }) => ({ data: customer === "cus_ref" ? [card("fp_friend")] : [] }));
    setup(base, proRef);
    expect(await grantReward("att_1", now)).toBe("rejected");
  });
  it("H2: a card that already earned a reward can't earn another", async () => {
    referralAttribution.count.mockImplementation(async ({ where }: { where: Where }) => (has(where, "referredCardFingerprint") ? 1 : 0));
    setup(base, proRef);
    expect(await grantReward("att_1", now)).toBe("rejected");
    expect(referralAttribution.update).toHaveBeenLastCalledWith({ where: { id: "att_1" }, data: expect.objectContaining({ reason: "card_already_rewarded" }) });
  });
  it("H2: no card fingerprint (e.g. a wallet) is held for review, not paid", async () => {
    stripe.paymentIntents.retrieve.mockResolvedValue({ latest_charge: card(null) });
    setup(base, proRef);
    expect(await grantReward("att_1", now)).toBe("review");
    expect(stripe.customers.createBalanceTransaction).not.toHaveBeenCalled();
  });
  it("rejects same Stripe customer and a customer already rewarded", async () => {
    setup(base, { ...proRef, stripeCustomerId: "cus_friend" });
    expect(await grantReward("att_1", now)).toBe("rejected");
    referralAttribution.count.mockImplementation(async ({ where }: { where: Where }) => (has(where, "referredCustomerId") ? 1 : 0));
    setup(base, proRef);
    expect(await grantReward("att_1", now)).toBe("rejected");
    expect(stripe.customers.createBalanceTransaction).not.toHaveBeenCalled();
  });
  it("H1: the cap counts every reward ever granted, including reversed ones and rows from a deleted account", async () => {
    let capWhere: unknown = null;
    referralAttribution.count.mockImplementation(async ({ where }: { where: Where }) => {
      if (has(where, "creditedAt") && has(where, "referrerEmailHash")) { capWhere = where; return 3; }
      return 0;
    });
    setup(base, proRef);
    expect(await grantReward("att_1", now)).toBe("capped");
    expect(JSON.stringify(capWhere)).toContain('"crediting"');
    expect(JSON.stringify(capWhere)).toContain('"h_ref"'); // matched by email hash too, not only the live account id
    expect(JSON.stringify(capWhere)).not.toContain('"reversed"'); // no status filter that would drop reversed rows
  });
  it("referrer account deleted before the grant: rejected, nothing paid", async () => {
    referralAttribution.findUnique.mockResolvedValue({ ...base, referrerUserId: null });
    expect(await grantReward("att_1", now)).toBe("rejected");
    expect(stripe.customers.createBalanceTransaction).not.toHaveBeenCalled();
  });
  it("race: a row already granted by a concurrent webhook is skipped inside the lock", async () => {
    referralAttribution.findUnique.mockResolvedValueOnce(base).mockResolvedValueOnce({ ...base, status: "credited" });
    entitlement.upsert.mockResolvedValue(proRef);
    expect(await grantReward("att_1", now)).toBe("skipped");
    expect(stripe.customers.createBalanceTransaction).not.toHaveBeenCalled();
  });
});

describe("webhook wiring", () => {
  const ev = (id: string, type: string, object: unknown) => ({ id, type, livemode: false, data: { object } }) as never;
  const t = Math.floor(now.getTime() / 1000);
  const inv = (o: object = {}) => ({ id: "in_1", customer: "cus_friend", billing_reason: "subscription_create", amount_paid: 2000, created: t, status_transitions: { paid_at: t }, lines: { data: [] }, ...o });
  it("friend's first invoice.paid grants the referrer's reward right away and records the amount paid", async () => {
    user.findUnique.mockResolvedValue({ id: "u_new" });
    entitlement.findUnique.mockResolvedValue({ userId: "u_new", plan: "pro", periodStart: null });
    const row = { id: "att_1", status: "crediting", referrerUserId: "u_ref", referrerEmailHash: null, referredCustomerId: "cus_friend", firstPaidInvoiceId: "in_1", firstPaidAmountCents: 2000, referrerCreditTxnId: null, rewardKind: null };
    referralAttribution.findUnique.mockResolvedValueOnce({ id: "att_1", status: "pending", createdAt: now }).mockResolvedValue(row);
    const ent = { userId: "u_ref", plan: "pro", status: "active", stripeSubscriptionId: "sub_r", stripeCustomerId: "cus_ref", referralProEndsAt: null };
    entitlement.upsert.mockResolvedValue(ent);
    entitlement.findUniqueOrThrow.mockResolvedValue(ent);
    expect(await applyStripeEvent(ev("evt_1", "invoice.paid", inv()))).toBe("processed");
    expect(referralAttribution.updateMany).toHaveBeenCalledWith({ where: { id: "att_1", status: "pending" }, data: expect.objectContaining({ status: "crediting", firstPaidInvoiceId: "in_1", firstPaidAmountCents: 2000, referredCustomerId: "cus_friend" }) });
    expect(stripe.customers.createBalanceTransaction).toHaveBeenCalledTimes(1);
  });
  it("race: a half-done grant only resumes from its own first invoice", async () => {
    referralAttribution.findUnique.mockResolvedValue({ id: "att_1", status: "crediting", firstPaidInvoiceId: "in_first", createdAt: now });
    expect(await referralOnInvoicePaid(inv({ id: "in_other" }) as never, "u_new")).toBe(false);
    expect(db.$transaction).not.toHaveBeenCalled();
  });
  it("refund before the grant voids it", async () => {
    referralAttribution.findFirst.mockResolvedValueOnce({ id: "att_1" });
    referralAttribution.findUniqueOrThrow.mockResolvedValueOnce({ id: "att_1", status: "pending", referrerUserId: "u_ref" });
    expect(await referralOnPaymentReversal("cus_friend", "refund", now)).toBe(true);
    expect(referralAttribution.update).toHaveBeenLastCalledWith({ where: { id: "att_1" }, data: { status: "voided", reason: "refund" } });
  });
  it("refund after a bill credit takes back only the unused part; the used part still counts toward the cap", async () => {
    const row = { id: "att_1", status: "credited", rewardKind: "balance", rewardCents: 2000, referrerCustomerId: "cus_ref", referrerUserId: "u_ref", creditedAt: now };
    referralAttribution.findFirst.mockResolvedValueOnce({ id: "att_1" });
    referralAttribution.findUniqueOrThrow.mockResolvedValueOnce(row);
    stripe.customers.retrieve.mockResolvedValueOnce({ id: "cus_ref", balance: -2000 });
    await referralOnPaymentReversal("cus_friend", "dispute", now);
    expect(stripe.customers.createBalanceTransaction).toHaveBeenCalledWith("cus_ref", expect.objectContaining({ amount: 2000 }), { idempotencyKey: "c3-ref-att_1-reverse" });
    referralAttribution.findFirst.mockResolvedValueOnce({ id: "att_2" });
    referralAttribution.findUniqueOrThrow.mockResolvedValueOnce({ ...row, id: "att_2" });
    stripe.customers.retrieve.mockResolvedValueOnce({ id: "cus_ref", balance: -500 });
    await referralOnPaymentReversal("cus_friend2", "refund", now);
    expect(stripe.customers.createBalanceTransaction).toHaveBeenLastCalledWith("cus_ref", expect.objectContaining({ amount: 500 }), expect.anything());
    const last = referralAttribution.update.mock.calls.at(-1)![0];
    expect(last).toEqual({ where: { id: "att_2" }, data: expect.objectContaining({ status: "reversed", flagReason: "credit_partly_used:1500" }) });
    expect(last.data).not.toHaveProperty("creditedAt"); // stays set, so it keeps counting toward the cap
  });
  it("refund after Pro days takes the days off referralProEndsAt", async () => {
    referralAttribution.findFirst.mockResolvedValueOnce({ id: "att_1" });
    referralAttribution.findUniqueOrThrow.mockResolvedValueOnce({ id: "att_1", status: "credited", rewardKind: "pro_days", rewardDays: 30, referrerUserId: "u_ref" });
    entitlement.findUnique.mockResolvedValueOnce({ plan: "pro", status: "active", stripeSubscriptionId: null, referralProEndsAt: new Date(now.getTime() + 29 * DAY) });
    await referralOnPaymentReversal("cus_friend", "refund", now);
    expect(entitlement.update).toHaveBeenCalledWith({ where: { userId: "u_ref" }, data: expect.objectContaining({ plan: "trial", status: "trialing", referralProEndsAt: null }) });
    referralAttribution.findFirst.mockResolvedValueOnce({ id: "att_2" });
    referralAttribution.findUniqueOrThrow.mockResolvedValueOnce({ id: "att_2", status: "credited", rewardKind: "pro_days", rewardDays: 30, referrerUserId: "u_ref" });
    entitlement.findUnique.mockResolvedValueOnce({ plan: "pro", status: "active", stripeSubscriptionId: null, referralProEndsAt: new Date(now.getTime() + 50 * DAY) });
    await referralOnPaymentReversal("cus_friend2", "refund", now);
    const left = new Date(now.getTime() + 20 * DAY);
    expect(entitlement.update).toHaveBeenLastCalledWith({ where: { userId: "u_ref" }, data: { periodEnd: left, referralProEndsAt: left } });
  });
  it("H1: on referral Pro days, an old canceled subscription event can't end them early", async () => {
    entitlement.findUnique.mockResolvedValue({ userId: "u_ref", plan: "pro", status: "active", stripeSubscriptionId: null, referralProEndsAt: new Date(now.getTime() + 20 * DAY) });
    const r = await applyStripeEvent(ev("evt_s", "customer.subscription.updated", { id: "sub_old", customer: "cus_ref", status: "canceled", items: { data: [] }, metadata: {} }));
    expect(r).toBe("ignored");
    expect(entitlement.upsert).not.toHaveBeenCalled();
  });
  it("a real subscription taking over clears referralProEndsAt", async () => {
    entitlement.findUnique.mockResolvedValue({ userId: "u_ref", plan: "pro", status: "active", stripeSubscriptionId: null, referralProEndsAt: new Date(now.getTime() + 20 * DAY) });
    entitlement.upsert.mockResolvedValue({});
    await applyStripeEvent(ev("evt_s2", "customer.subscription.updated", { id: "sub_new", customer: "cus_ref", status: "active", items: { data: [] }, metadata: {} }));
    expect(entitlement.upsert).toHaveBeenCalledWith(expect.objectContaining({ update: expect.objectContaining({ stripeSubscriptionId: "sub_new", referralProEndsAt: null }) }));
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
  it("counts invited / waiting / free months, the cap left (reversed still counts), and the end date, without exposing friends", async () => {
    referral.findUnique.mockResolvedValue({ userId: "u_ref", code: "abcd1234" });
    user.findUnique.mockResolvedValue({ email: "ref@example.com" });
    referralAttribution.groupBy.mockResolvedValue([
      { status: "pending", _count: { _all: 2 } },
      { status: "review", _count: { _all: 1 } },
      { status: "credited", _count: { _all: 1 } },
      { status: "reversed", _count: { _all: 1 } },
      { status: "rejected", _count: { _all: 4 } },
    ]);
    referralAttribution.count.mockResolvedValue(2); // credited + reversed-after-use
    const p = await referralPayload("u_ref", now);
    expect(p).toMatchObject({ code: "abcd1234", enabled: true, cap: 3, invited: 5, pending: 3, credited: 1, capRemaining: 1, endsLabel: "Dec 8", ended: false });
    expect((await referralPayload("u_ref", new Date("2026-12-10T00:00:00Z"))).ended).toBe(true);
    expect(JSON.stringify(p)).not.toMatch(/@/);
  });
});
