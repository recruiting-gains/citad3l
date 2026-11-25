import { randomBytes } from "node:crypto";
import type Stripe from "stripe";
import { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { appUrl, PLAN_PRICE_USD } from "./config";
import { getStripe } from "./stripe";
import { ensureEntitlement } from "./usage";

/**
 * Referral promo: "When they sign up with your code and subscribe, you get a free month. Up to 3. Ends Dec 8."
 *
 *  1. Landing: `?ref=CODE` is kept in the first-party `c3_ref` cookie (first code wins; components/RefCapture.tsx).
 *  2. Signup: a NEW account's first sign-in locks the code onto it (ReferralAttribution, unique per referred user).
 *     Only inside the promo window (REFERRAL_PROMO_START .. REFERRAL_PROMO_END). Cruz can also log one by hand
 *     (logManualReferral) if it is dated inside the window.
 *  3. Reward: the friend's FIRST paid subscription invoice (invoice.paid webhook) earns the REFERRER one free month.
 *     Payment may land up to REFERRAL_PAYMENT_GRACE_DAYS after the window closes.
 *       - Referrer on a paid plan: Stripe customer balance credit of one month of their plan (comes off the next bill).
 *       - Referrer on Free: 30 days of Pro on their account (no Stripe needed). Lapses in ensureEntitlement().
 *     One-sided: the friend gets nothing extra. No cash.
 *  4. Refund or dispute on the friend's first payment: a pending reward is voided; an issued one is reversed
 *     (unused balance credit is taken back; Pro days are removed). Anything already spent is flagged for review.
 *  Guards: first code wins, one reward per new account and per paying customer, cap per referrer, no self-referral
 *  (same account, same email after normalising, or same Stripe customer). Shared networks / IPs are NOT used.
 */

export const REF_COOKIE = "c3_ref";
export const REF_COOKIE_MAX_AGE_SEC = 30 * 24 * 60 * 60;
const CODE_RE = /^[a-z0-9]{4,16}$/;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Promo window. Nov 24, 2026 00:00 through Dec 8, 2026 11:59:59 PM America/Chicago (CST = UTC-6). */
export const REFERRAL_PROMO_START = new Date("2026-11-24T06:00:00.000Z");
export const REFERRAL_PROMO_END = new Date("2026-12-09T05:59:59.999Z");
export const REFERRAL_PROMO_END_LABEL = "Dec 8";
/** How long after the window a friend who signed up in time may still make the first payment. */
export const REFERRAL_PAYMENT_GRACE_DAYS = 14;
export const REFERRAL_FREE_DAYS = 30;

export function referralsEnabled(): boolean {
  return (process.env.REFERRALS_ENABLED ?? "off").trim().toLowerCase() === "on";
}
export function referralCap(): number {
  const n = Number(process.env.REFERRAL_CAP ?? 3);
  return Number.isFinite(n) && n >= 0 && n <= 100 ? Math.floor(n) : 3;
}
export function inPromoWindow(at: Date): boolean {
  return at.getTime() >= REFERRAL_PROMO_START.getTime() && at.getTime() <= REFERRAL_PROMO_END.getTime();
}
export function promoEnded(now = new Date()): boolean {
  return now.getTime() > REFERRAL_PROMO_END.getTime();
}
export function paymentDeadline(): Date {
  return new Date(REFERRAL_PROMO_END.getTime() + REFERRAL_PAYMENT_GRACE_DAYS * DAY_MS);
}

export function normalizeRefCode(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const c = raw.trim().toLowerCase();
  return CODE_RE.test(c) ? c : null;
}

/** Lowercases, drops +tags, and drops dots for Gmail, so obvious same-inbox aliases match. */
export function normalizeEmailForSelfCheck(email: string | null | undefined): string | null {
  if (!email) return null;
  const e = email.trim().toLowerCase();
  const at = e.lastIndexOf("@");
  if (at < 1) return e;
  let local = e.slice(0, at);
  let domain = e.slice(at + 1);
  local = local.split("+")[0];
  if (domain === "googlemail.com") domain = "gmail.com";
  if (domain === "gmail.com") local = local.replace(/\./g, "");
  return `${local}@${domain}`;
}

/** A referral is only locked onto an account this new (time since the user row was created). */
export const SIGNUP_WINDOW_MS = 30 * 60 * 1000;

function makeCode(): string {
  return randomBytes(5).toString("base64url").replace(/[^a-zA-Z0-9]/g, "").slice(0, 8).toLowerCase();
}

export async function getOrCreateReferral(userId: string) {
  const existing = await prisma.referral.findUnique({ where: { userId } });
  if (existing) return existing;
  for (let i = 0; i < 5; i++) {
    const code = makeCode();
    if (!CODE_RE.test(code)) continue;
    try {
      return await prisma.referral.create({ data: { userId, code } });
    } catch {
      /* unique clash, retry */
    }
  }
  throw new Error("Could not create a referral code.");
}

export type CaptureResult =
  | "disabled"
  | "outside_window"
  | "no_code"
  | "unknown_code"
  | "self"
  | "same_email"
  | "not_new"
  | "already_attributed"
  | "attributed";

type AttributeOpts = { referrerUserId: string; referrerEmail: string | null; referredUserId: string; code: string; at: Date; source: "link" | "manual" };

async function createAttribution(o: AttributeOpts): Promise<"attributed" | "same_email" | "already_attributed"> {
  const friend = await prisma.user.findUnique({ where: { id: o.referredUserId }, select: { email: true } });
  const sameEmail = !!friend?.email && normalizeEmailForSelfCheck(friend.email) === normalizeEmailForSelfCheck(o.referrerEmail);
  try {
    await prisma.referralAttribution.create({
      data: {
        referrerUserId: o.referrerUserId,
        referredUserId: o.referredUserId,
        code: o.code,
        source: o.source,
        createdAt: o.at,
        // Kept as a rejected row so the account can't be re-claimed with a second code later.
        ...(sameEmail ? { status: "rejected", reason: "same_email" } : {}),
      },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return "already_attributed";
    throw e;
  }
  return sameEmail ? "same_email" : "attributed";
}

/** Locks a referral code onto a brand-new account. Safe to call on every sign-in; only the first one sticks. */
export async function captureReferralAtSignup(opts: { userId: string; code: unknown; now?: Date }): Promise<CaptureResult> {
  if (!referralsEnabled()) return "disabled";
  const code = normalizeRefCode(opts.code);
  if (!code) return "no_code";
  const now = opts.now ?? new Date();
  if (!inPromoWindow(now)) return "outside_window";
  const ref = await prisma.referral.findUnique({ where: { code }, select: { userId: true, user: { select: { email: true, bannedAt: true } } } });
  if (!ref || ref.user.bannedAt) return "unknown_code";
  if (ref.userId === opts.userId) return "self";
  const [user, ent, existing] = await Promise.all([
    prisma.user.findUnique({ where: { id: opts.userId }, select: { createdAt: true } }),
    prisma.entitlement.findUnique({ where: { userId: opts.userId }, select: { stripeSubscriptionId: true, plan: true } }),
    prisma.referralAttribution.findUnique({ where: { referredUserId: opts.userId }, select: { id: true } }),
  ]);
  if (existing) return "already_attributed";
  if (!user) return "not_new";
  // Only brand-new accounts. Someone who already pays, or signed up earlier, can't be claimed after the fact.
  if (now.getTime() - user.createdAt.getTime() > SIGNUP_WINDOW_MS) return "not_new";
  if (ent?.stripeSubscriptionId || (ent && ent.plan !== "trial")) return "not_new";
  return createAttribution({ referrerUserId: ref.userId, referrerEmail: ref.user.email, referredUserId: opts.userId, code, at: now, source: "link" });
}

/**
 * Cruz's manual log: "friend X joined with Y's code on <date>". Counts only if dated inside the promo window.
 * If the friend has already paid, the reward is processed right away from their Stripe invoices.
 */
export async function logManualReferral(opts: { referrerEmail: string; friendEmail: string; at: Date }): Promise<CaptureResult | "no_referrer" | "no_friend" | "credited" | "pending"> {
  if (!inPromoWindow(opts.at)) return "outside_window";
  const referrer = await prisma.user.findUnique({ where: { email: opts.referrerEmail.trim().toLowerCase() }, select: { id: true, email: true, bannedAt: true } });
  if (!referrer || referrer.bannedAt) return "no_referrer";
  const friend = await prisma.user.findUnique({ where: { email: opts.friendEmail.trim().toLowerCase() }, select: { id: true } });
  if (!friend) return "no_friend";
  if (friend.id === referrer.id) return "self";
  const code = (await getOrCreateReferral(referrer.id)).code;
  const r = await createAttribution({ referrerUserId: referrer.id, referrerEmail: referrer.email, referredUserId: friend.id, code, at: opts.at, source: "manual" });
  if (r !== "attributed") return r;
  const ent = await prisma.entitlement.findUnique({ where: { userId: friend.id }, select: { stripeCustomerId: true } });
  const stripe = getStripe();
  if (ent?.stripeCustomerId && stripe) {
    const list = await stripe.invoices.list({ customer: ent.stripeCustomerId, status: "paid", limit: 24 });
    const first = list.data.filter((i) => isFirstPaymentCandidate(invoiceFacts(i))).sort((a, b) => (a.created ?? 0) - (b.created ?? 0))[0];
    if (first && (await referralOnInvoicePaid(first, friend.id))) {
      const row = await prisma.referralAttribution.findUnique({ where: { referredUserId: friend.id }, select: { status: true } });
      return row?.status === "credited" ? "credited" : "pending";
    }
  }
  return "pending";
}

const PENDING_STATUSES = ["pending", "crediting"];

export async function referralPayload(userId: string, now = new Date()) {
  const row = await getOrCreateReferral(userId);
  const enabled = referralsEnabled();
  const cap = referralCap();
  let invited = 0, pending = 0, credited = 0;
  if (enabled) {
    const groups = await prisma.referralAttribution.groupBy({ by: ["status"], where: { referrerUserId: userId }, _count: { _all: true } });
    for (const g of groups) {
      const n = g._count._all;
      if (g.status === "rejected") continue;
      invited += n;
      if (g.status === "credited") credited += n;
      else if (PENDING_STATUSES.includes(g.status)) pending += n;
    }
  }
  return {
    code: row.code,
    url: `${appUrl()}/login?ref=${encodeURIComponent(row.code)}`,
    enabled,
    cap,
    invited,
    pending,
    credited,
    capRemaining: Math.max(0, cap - credited),
    endsLabel: REFERRAL_PROMO_END_LABEL,
    endsAt: REFERRAL_PROMO_END.toISOString(),
    ended: promoEnded(now),
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Webhook side
// ---------------------------------------------------------------------------------------------------------------

export type InvoiceFacts = { invoiceId: string; billingReason: string | null; amountPaid: number; paidAt: Date };

export function invoiceFacts(inv: Stripe.Invoice): InvoiceFacts {
  const paidAtSec = inv.status_transitions?.paid_at ?? inv.created;
  return {
    invoiceId: inv.id ?? "",
    billingReason: inv.billing_reason ?? null,
    amountPaid: inv.amount_paid ?? 0,
    paidAt: new Date((paidAtSec ?? Math.floor(Date.now() / 1000)) * 1000),
  };
}

/** A real subscription payment: money changed hands, for a new subscription or a renewal (after a free trial). */
export function isFirstPaymentCandidate(f: InvoiceFacts): boolean {
  return f.amountPaid > 0 && (f.billingReason === "subscription_create" || f.billingReason === "subscription_cycle");
}

export type InvoiceDecision = "ignore" | "expire" | "reward";
/** Pure rule: what does this paid invoice mean for a pending referral? */
export function decideOnInvoice(att: { status: string; createdAt: Date }, inv: InvoiceFacts): InvoiceDecision {
  if (att.status !== "pending") return "ignore";
  if (!isFirstPaymentCandidate(inv)) return "ignore"; // trials, 100% coupons, prorations, one-offs
  if (!inPromoWindow(att.createdAt)) return "expire";
  if (inv.paidAt.getTime() > paymentDeadline().getTime()) return "expire";
  return "reward";
}

function customerIdOf(c: string | { id: string } | null | undefined): string | null {
  if (!c) return null;
  return typeof c === "string" ? c : c.id ?? null;
}

/** Called from the invoice.paid webhook for the paying user. Returns true when the referral row changed. */
export async function referralOnInvoicePaid(inv: Stripe.Invoice, userId: string): Promise<boolean> {
  if (!referralsEnabled()) return false;
  const att = await prisma.referralAttribution.findUnique({ where: { referredUserId: userId } });
  if (!att) return false;
  if (att.status === "crediting") {
    await grantReward(att.id); // resume a grant that failed half way
    return true;
  }
  const facts = invoiceFacts(inv);
  const decision = decideOnInvoice(att, facts);
  if (decision === "ignore") return false;
  const customerId = customerIdOf(inv.customer as string | { id: string } | null);
  if (decision === "expire") {
    await prisma.referralAttribution.updateMany({ where: { id: att.id, status: "pending" }, data: { status: "expired", reason: "outside_promo_window", firstPaidInvoiceId: facts.invoiceId, firstPaidAt: facts.paidAt, referredCustomerId: customerId } });
    return true;
  }
  // Claim it once (a duplicate or concurrent webhook can't grant twice), then grant.
  const claimed = await prisma.referralAttribution.updateMany({
    where: { id: att.id, status: "pending" },
    data: { status: "crediting", firstPaidInvoiceId: facts.invoiceId, firstPaidAt: facts.paidAt, referredCustomerId: customerId },
  });
  if (claimed.count !== 1) return false;
  await grantReward(att.id);
  return true;
}

/**
 * Gives the referrer one free month for a row in status "crediting". Resumable: the Stripe transaction id is saved
 * as soon as it exists, and a Stripe idempotency key stops a retry from crediting twice.
 */
export async function grantReward(id: string, now = new Date()): Promise<"credited" | "rejected" | "capped" | "skipped"> {
  const att = await prisma.referralAttribution.findUnique({ where: { id } });
  if (!att || att.status !== "crediting") return "skipped";
  const stop = async (status: "rejected" | "capped", reason: string) => {
    await prisma.referralAttribution.update({ where: { id }, data: { status, reason } });
    return status;
  };
  const referrerEnt = await ensureEntitlement(att.referrerUserId);
  if (!att.referrerCreditTxnId) {
    if (att.referredCustomerId && referrerEnt.stripeCustomerId && referrerEnt.stripeCustomerId === att.referredCustomerId) return stop("rejected", "same_customer");
    if (att.referredCustomerId) {
      const dup = await prisma.referralAttribution.count({ where: { id: { not: id }, referredCustomerId: att.referredCustomerId, status: { in: ["credited", "crediting"] } } });
      if (dup > 0) return stop("rejected", "customer_already_rewarded");
    }
    const used = await prisma.referralAttribution.count({ where: { id: { not: id }, referrerUserId: att.referrerUserId, status: { in: ["credited", "crediting"] } } });
    if (used >= referralCap()) return stop("capped", "cap_reached");
  }

  const payingPlan = referrerEnt.stripeSubscriptionId && (referrerEnt.plan === "pro" || referrerEnt.plan === "max") && referrerEnt.status !== "canceled" ? referrerEnt.plan : null;
  if (payingPlan && referrerEnt.stripeCustomerId) {
    // Paid referrer: one month of their plan as Stripe bill credit.
    const cents = Math.round(PLAN_PRICE_USD[payingPlan] * 100);
    const stripe = getStripe();
    if (!stripe) throw new Error("referral reward: billing not configured");
    let txnId = att.referrerCreditTxnId;
    if (!txnId) {
      const t = await stripe.customers.createBalanceTransaction(
        referrerEnt.stripeCustomerId,
        { amount: -cents, currency: "usd", description: `Citad3L referral: one free month of ${payingPlan === "max" ? "Max" : "Pro"}`, metadata: { referralAttributionId: id } },
        { idempotencyKey: `c3-ref-${id}-month` },
      );
      txnId = t.id;
    }
    await prisma.referralAttribution.update({
      where: { id },
      data: { status: "credited", rewardKind: "balance", rewardCents: cents, referrerCustomerId: referrerEnt.stripeCustomerId, referrerCreditTxnId: txnId, creditedAt: now },
    });
    return "credited";
  }

  // Free referrer: 30 days of Pro. Stacks on top of an earlier referral month that is still running.
  const onReferralPro = referrerEnt.plan === "pro" && referrerEnt.status === "active" && !referrerEnt.stripeSubscriptionId && referrerEnt.periodEnd && referrerEnt.periodEnd > now;
  const from = onReferralPro ? referrerEnt.periodEnd! : now;
  const endsAt = new Date(from.getTime() + REFERRAL_FREE_DAYS * DAY_MS);
  await prisma.entitlement.update({
    where: { userId: att.referrerUserId },
    data: onReferralPro ? { periodEnd: endsAt } : { plan: "pro", status: "active", periodStart: now, periodEnd: endsAt, periodUsed: 0, cancelAtPeriodEnd: false },
  });
  await prisma.referralAttribution.update({
    where: { id },
    data: { status: "credited", rewardKind: "pro_days", rewardDays: REFERRAL_FREE_DAYS, rewardEndsAt: endsAt, creditedAt: now },
  });
  return "credited";
}

/** Refund or dispute on the friend's account: void a pending reward, or reverse an issued one where we can. */
export async function referralOnPaymentReversal(customerId: string | null, kind: "refund" | "dispute", now = new Date()): Promise<boolean> {
  if (!referralsEnabled() || !customerId) return false;
  let att = await prisma.referralAttribution.findFirst({ where: { referredCustomerId: customerId } });
  if (!att) {
    const ent = await prisma.entitlement.findUnique({ where: { stripeCustomerId: customerId }, select: { userId: true } });
    if (ent) att = await prisma.referralAttribution.findUnique({ where: { referredUserId: ent.userId } });
  }
  if (!att) return false;
  if (att.status === "pending" || (att.status === "crediting" && !att.referrerCreditTxnId)) {
    await prisma.referralAttribution.update({ where: { id: att.id }, data: { status: "voided", reason: kind } });
    return true;
  }
  if (att.status !== "credited") return false;

  if (att.rewardKind === "balance" && att.referrerCustomerId && att.rewardCents > 0) {
    // Take back only credit that is still unused, so a reversal never creates a surprise charge.
    const stripe = getStripe();
    if (!stripe) throw new Error("referral reversal: billing not configured");
    const cus = await stripe.customers.retrieve(att.referrerCustomerId);
    const balance = "deleted" in cus && cus.deleted ? 0 : (cus as Stripe.Customer).balance ?? 0;
    const unused = Math.min(att.rewardCents, Math.max(0, -balance));
    let txnId: string | null = null;
    if (unused > 0) {
      const t = await stripe.customers.createBalanceTransaction(
        att.referrerCustomerId,
        { amount: unused, currency: "usd", description: "Citad3L referral reversed (friend's payment was refunded)", metadata: { referralAttributionId: att.id } },
        { idempotencyKey: `c3-ref-${att.id}-reverse` },
      );
      txnId = t.id;
    }
    const full = unused >= att.rewardCents;
    await prisma.referralAttribution.update({
      where: { id: att.id },
      data: { status: "reversed", reason: kind, reversalTxnId: txnId, reversedAt: now, ...(full ? {} : { flagReason: `credit_partly_used:${att.rewardCents - unused}` }) },
    });
    return true;
  }

  if (att.rewardKind === "pro_days") {
    const ent = await prisma.entitlement.findUnique({ where: { userId: att.referrerUserId } });
    if (ent && !ent.stripeSubscriptionId && ent.plan === "pro" && ent.periodEnd) {
      const newEnd = new Date(ent.periodEnd.getTime() - att.rewardDays * DAY_MS);
      await prisma.entitlement.update({
        where: { userId: att.referrerUserId },
        data: newEnd <= now ? { plan: "trial", status: "trialing", periodStart: null, periodEnd: null, periodUsed: 0 } : { periodEnd: newEnd },
      });
    }
    await prisma.referralAttribution.update({
      where: { id: att.id },
      data: { status: "reversed", reason: kind, reversedAt: now, ...(ent?.stripeSubscriptionId ? { flagReason: "referrer_now_subscribed" } : {}) },
    });
    return true;
  }
  await prisma.referralAttribution.update({ where: { id: att.id }, data: { flagReason: kind } });
  return true;
}
