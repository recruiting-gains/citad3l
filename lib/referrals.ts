import { createHmac, randomBytes } from "node:crypto";
import type Stripe from "stripe";
import { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { appUrl, PLAN_PRICE_USD } from "./config";
import { getStripe } from "./stripe";
import { ensureEntitlement, isPaidActive } from "./usage";

/**
 * Referral promo: "When they sign up with your code and subscribe, you get a free month. Up to 3. Ends Dec 8."
 *
 *  1. Landing: `?ref=CODE` is kept in the first-party `c3_ref` cookie (first code wins; components/RefCapture.tsx).
 *  2. Signup: a NEW account's first sign-in locks the code onto it (ReferralAttribution, unique per referred user).
 *     Only inside the promo window (REFERRAL_PROMO_START .. REFERRAL_PROMO_END). Cruz can also log one by hand
 *     (logManualReferral) if it is dated inside the window.
 *  3. Reward: the friend's FIRST paid subscription invoice (invoice.paid webhook) earns the REFERRER one free Pro month.
 *     Payment may land up to REFERRAL_PAYMENT_GRACE_DAYS after the window closes.
 *       - Worth at most one Pro month ($20) and never more than the friend's first payment (pen test 2026-11-24, H2).
 *       - Referrer on a paid plan (Pro or Max): Stripe customer balance credit (comes off the next bill).
 *       - Referrer on Free: Pro days ending on Entitlement.referralProEndsAt (lapses in ensureEntitlement()).
 *     One-sided: the friend gets nothing extra. No cash.
 *  4. Refund or dispute on the friend's first payment: a pending reward is voided; an issued one is reversed
 *     (unused balance credit is taken back; Pro days are removed). Anything already spent is flagged for review.
 *  Guards: first code wins, one reward per new account, per email (even after the account is deleted and re-made), per
 *  paying customer and per card. Cap per referrer counts every reward ever granted (a reversed one still counts). No
 *  self-referral: same account, same email after normalising, same Stripe customer, or the same card on both sides.
 *  Rows are never deleted with an account (user links go NULL), so caps and refund reversals keep working.
 *  Grants and reversals run in one DB transaction that locks the row and the referrer's entitlement.
 *  Shared networks / IPs are NOT used.
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

/** Stable hash of the normalised email, kept on the row so a deleted-and-remade account is still recognised. */
export function referralEmailHash(email: string | null | undefined): string | null {
  const n = normalizeEmailForSelfCheck(email);
  return n ? createHmac("sha256", "citad3l-referral-email-v1").update(n).digest("hex") : null;
}

/** One Pro month in cents: the most a single referral can ever be worth. */
export const PRO_MONTH_CENTS = Math.round(PLAN_PRICE_USD.pro * 100);

/** Statuses/fields that mean a reward was (or is being) handed out. Used for the cap and the one-per-payer checks. */
const GRANTED: Prisma.ReferralAttributionWhereInput = { OR: [{ status: "crediting" }, { creditedAt: { not: null } }] };

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
  const referredEmailHash = referralEmailHash(friend?.email);
  // An email that was referred before (including by an account that has since been deleted) can't be referred again.
  if (referredEmailHash && (await prisma.referralAttribution.count({ where: { referredEmailHash } })) > 0) return "already_attributed";
  try {
    await prisma.referralAttribution.create({
      data: {
        referrerUserId: o.referrerUserId,
        referredUserId: o.referredUserId,
        referrerEmailHash: referralEmailHash(o.referrerEmail),
        referredEmailHash,
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

const PENDING_STATUSES = ["pending", "crediting", "review"];

/** Rows that belong to this referrer: by account, or by email hash (survives the referrer deleting and remaking). */
function referrerWhere(userId: string, emailHash: string | null): Prisma.ReferralAttributionWhereInput {
  return emailHash ? { OR: [{ referrerUserId: userId }, { referrerEmailHash: emailHash }] } : { referrerUserId: userId };
}

/** Rewards ever granted to this referrer (credited, being credited, or credited then reversed). */
export async function referralRewardsUsed(userId: string, emailHash: string | null, opts: { excludeId?: string; tx?: Prisma.TransactionClient } = {}): Promise<number> {
  const db = opts.tx ?? prisma;
  return db.referralAttribution.count({ where: { AND: [referrerWhere(userId, emailHash), GRANTED, ...(opts.excludeId ? [{ id: { not: opts.excludeId } }] : [])] } });
}

export async function referralPayload(userId: string, now = new Date()) {
  const row = await getOrCreateReferral(userId);
  const enabled = referralsEnabled();
  const cap = referralCap();
  let invited = 0, pending = 0, credited = 0, used = 0;
  if (enabled) {
    const me = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
    const where = referrerWhere(userId, referralEmailHash(me?.email));
    const groups = await prisma.referralAttribution.groupBy({ by: ["status"], where, _count: { _all: true } });
    for (const g of groups) {
      const n = g._count._all;
      if (g.status === "rejected") continue;
      invited += n;
      if (g.status === "credited") credited += n;
      else if (PENDING_STATUSES.includes(g.status)) pending += n;
    }
    used = await referralRewardsUsed(userId, referralEmailHash(me?.email));
  }
  return {
    code: row.code,
    url: `${appUrl()}/login?ref=${encodeURIComponent(row.code)}`,
    enabled,
    cap,
    invited,
    pending,
    credited,
    capRemaining: Math.max(0, cap - used),
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

/** What a referral is worth: one Pro month at most, and never more than the friend actually paid first. */
export function rewardValue(firstPaidCents: number): { cents: number; days: number } {
  const cents = Math.max(0, Math.min(PRO_MONTH_CENTS, Math.floor(firstPaidCents)));
  const days = cents >= PRO_MONTH_CENTS ? REFERRAL_FREE_DAYS : Math.floor((REFERRAL_FREE_DAYS * cents) / PRO_MONTH_CENTS);
  return { cents, days };
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
  const facts = invoiceFacts(inv);
  if (att.status === "crediting") {
    // Resume a grant that failed half way, but only from the same first invoice.
    if (att.firstPaidInvoiceId && att.firstPaidInvoiceId !== facts.invoiceId) return false;
    await grantReward(att.id);
    return true;
  }
  const decision = decideOnInvoice(att, facts);
  if (decision === "ignore") return false;
  const customerId = customerIdOf(inv.customer as string | { id: string } | null);
  if (decision === "expire") {
    await prisma.referralAttribution.updateMany({ where: { id: att.id, status: "pending" }, data: { status: "expired", reason: "outside_promo_window", firstPaidInvoiceId: facts.invoiceId, firstPaidAt: facts.paidAt, firstPaidAmountCents: facts.amountPaid, referredCustomerId: customerId } });
    return true;
  }
  // Claim it once (a duplicate or concurrent webhook can't grant twice), then grant.
  const claimed = await prisma.referralAttribution.updateMany({
    where: { id: att.id, status: "pending" },
    data: { status: "crediting", firstPaidInvoiceId: facts.invoiceId, firstPaidAt: facts.paidAt, firstPaidAmountCents: facts.amountPaid, referredCustomerId: customerId },
  });
  if (claimed.count !== 1) return false;
  await grantReward(att.id);
  return true;
}

// ----- card fingerprints (Stripe reads only) -----

type ChargeLike = { status?: string | null; payment_method_details?: { card?: { fingerprint?: string | null } | null } | null } | null | undefined;
const fpOf = (c: ChargeLike) => (c && (!c.status || c.status === "succeeded") ? c.payment_method_details?.card?.fingerprint ?? null : null);

/** Card fingerprint of the charge that paid this invoice, or null (e.g. a wallet with no card fingerprint). */
export async function invoiceCardFingerprint(stripe: Stripe, invoiceId: string): Promise<string | null> {
  if (!invoiceId) return null;
  const pays = await stripe.invoicePayments.list({ invoice: invoiceId, limit: 10 });
  for (const p of pays.data) {
    if (p.status && p.status !== "paid") continue;
    const pay = p.payment as { charge?: string | { id: string }; payment_intent?: string | { id: string } } | undefined;
    const piId = customerIdOf(pay?.payment_intent as string | { id: string } | undefined);
    if (piId) {
      const pi = await stripe.paymentIntents.retrieve(piId, { expand: ["latest_charge"] });
      const fp = fpOf(pi.latest_charge as ChargeLike);
      if (fp) return fp;
    }
    const chId = customerIdOf(pay?.charge as string | { id: string } | undefined);
    if (chId) {
      const fp = fpOf((await stripe.charges.retrieve(chId)) as unknown as ChargeLike);
      if (fp) return fp;
    }
  }
  return null;
}

/** Every card fingerprint seen on a customer: saved cards plus recent successful charges. */
export async function customerCardFingerprints(stripe: Stripe, customerId: string | null | undefined): Promise<Set<string>> {
  const out = new Set<string>();
  if (!customerId) return out;
  const pms = await stripe.customers.listPaymentMethods(customerId, { type: "card", limit: 100 });
  for (const pm of pms.data) if (pm.card?.fingerprint) out.add(pm.card.fingerprint);
  const charges = await stripe.charges.list({ customer: customerId, limit: 100 });
  for (const c of charges.data) {
    const fp = fpOf(c as unknown as ChargeLike);
    if (fp) out.add(fp);
  }
  return out;
}

export type GrantResult = "credited" | "rejected" | "capped" | "review" | "skipped";

/**
 * Gives the referrer their reward for a row in status "crediting". Runs in one DB transaction that locks the row and the
 * referrer's entitlement, so a concurrent grant, a resume, or a refund can't interleave with it. Resumable: the Stripe
 * balance credit uses an idempotency key, so a retry never credits twice.
 */
export async function grantReward(id: string, now = new Date()): Promise<GrantResult> {
  const pre = await prisma.referralAttribution.findUnique({ where: { id } });
  if (!pre || pre.status !== "crediting") return "skipped";
  if (!pre.referrerUserId) {
    await prisma.referralAttribution.updateMany({ where: { id, status: "crediting" }, data: { status: "rejected", reason: "referrer_deleted" } });
    return "rejected";
  }
  const referrerUserId = pre.referrerUserId;
  const referrerEnt0 = await ensureEntitlement(referrerUserId);
  const stripe = getStripe();

  // Network reads first (outside the lock): the friend's paying card, and every card the referrer has used.
  let friendFp: string | null = pre.referredCardFingerprint;
  let friendCards = new Set<string>();
  let referrerCards = new Set<string>();
  if (!pre.referrerCreditTxnId && !pre.rewardKind) {
    if (!stripe) throw new Error("referral reward: billing not configured");
    if (!friendFp && pre.firstPaidInvoiceId) friendFp = await invoiceCardFingerprint(stripe, pre.firstPaidInvoiceId);
    friendCards = await customerCardFingerprints(stripe, pre.referredCustomerId);
    if (friendFp) friendCards.add(friendFp);
    referrerCards = await customerCardFingerprints(stripe, referrerEnt0.stripeCustomerId);
  }

  return prisma.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "ReferralAttribution" WHERE "id" = ${id} FOR UPDATE`;
      await tx.$queryRaw`SELECT "userId" FROM "Entitlement" WHERE "userId" = ${referrerUserId} FOR UPDATE`;
      const att = await tx.referralAttribution.findUnique({ where: { id } });
      if (!att || att.status !== "crediting") return "skipped" as const;
      const referrerEnt = await tx.entitlement.findUniqueOrThrow({ where: { userId: referrerUserId } });
      const stop = async (status: "rejected" | "capped" | "review", reason: string) => {
        await tx.referralAttribution.update({ where: { id }, data: { status, reason, ...(friendFp ? { referredCardFingerprint: friendFp } : {}) } });
        return status;
      };
      const { cents, days } = rewardValue(att.firstPaidAmountCents);

      if (!att.referrerCreditTxnId && !att.rewardKind) {
        if (att.referredCustomerId && referrerEnt.stripeCustomerId && referrerEnt.stripeCustomerId === att.referredCustomerId) return stop("rejected", "same_customer");
        for (const fp of friendCards) if (referrerCards.has(fp)) return stop("rejected", "same_card");
        if (att.referredCustomerId) {
          const dup = await tx.referralAttribution.count({ where: { AND: [{ id: { not: id } }, { referredCustomerId: att.referredCustomerId }, GRANTED] } });
          if (dup > 0) return stop("rejected", "customer_already_rewarded");
        }
        if (friendFp) {
          const dupCard = await tx.referralAttribution.count({ where: { AND: [{ id: { not: id } }, { referredCardFingerprint: friendFp }, GRANTED] } });
          if (dupCard > 0) return stop("rejected", "card_already_rewarded");
        } else {
          // No card fingerprint (e.g. a wallet payment): hold for a manual look instead of paying out blind.
          return stop("review", "no_card_fingerprint");
        }
        if (cents <= 0 || days <= 0) return stop("rejected", "no_payment_amount");
        const used = await referralRewardsUsed(referrerUserId, att.referrerEmailHash, { excludeId: id, tx });
        if (used >= referralCap()) return stop("capped", "cap_reached");
      }

      const paying = !!referrerEnt.stripeSubscriptionId && (referrerEnt.plan === "pro" || referrerEnt.plan === "max") && referrerEnt.status !== "canceled" && !referrerEnt.referralProEndsAt;
      if ((paying && referrerEnt.stripeCustomerId) || att.rewardKind === "balance") {
        // Paid referrer: up to one Pro month as Stripe bill credit (never the Max price).
        const customer = att.referrerCustomerId ?? referrerEnt.stripeCustomerId!;
        const amount = att.rewardKind === "balance" ? att.rewardCents : cents;
        if (!stripe) throw new Error("referral reward: billing not configured");
        let txnId = att.referrerCreditTxnId;
        if (!txnId) {
          await tx.referralAttribution.update({ where: { id }, data: { rewardKind: "balance", rewardCents: amount, referrerCustomerId: customer, referredCardFingerprint: friendFp } });
          const t = await stripe.customers.createBalanceTransaction(
            customer,
            { amount: -amount, currency: "usd", description: "Citad3L referral: one free month of Pro", metadata: { referralAttributionId: id } },
            { idempotencyKey: `c3-ref-${id}-month` },
          );
          txnId = t.id;
        }
        await tx.referralAttribution.update({
          where: { id },
          data: { status: "credited", rewardKind: "balance", rewardCents: amount, referrerCustomerId: customer, referrerCreditTxnId: txnId, creditedAt: now },
        });
        return "credited" as const;
      }

      // Free referrer: Pro days with their own end date. Stacks on an earlier referral month that is still running.
      const onReferralPro = isPaidActive(referrerEnt) && !!referrerEnt.referralProEndsAt && referrerEnt.referralProEndsAt > now;
      const from = onReferralPro ? referrerEnt.referralProEndsAt! : now;
      const endsAt = new Date(from.getTime() + days * DAY_MS);
      const staleSub = !!referrerEnt.stripeSubscriptionId && referrerEnt.status === "canceled";
      await tx.entitlement.update({
        where: { userId: referrerUserId },
        data: onReferralPro
          ? { periodEnd: endsAt, referralProEndsAt: endsAt }
          : { plan: "pro", status: "active", periodStart: now, periodEnd: endsAt, periodUsed: 0, cancelAtPeriodEnd: false, referralProEndsAt: endsAt, ...(staleSub ? { stripeSubscriptionId: null } : {}) },
      });
      await tx.referralAttribution.update({
        where: { id },
        data: { status: "credited", rewardKind: "pro_days", rewardDays: days, rewardCents: cents, rewardEndsAt: endsAt, creditedAt: now, referredCardFingerprint: friendFp },
      });
      return "credited" as const;
    },
    { timeout: 20_000, maxWait: 10_000 },
  );
}

/** Refund or dispute on the friend's account: void a pending reward, or reverse an issued one where we can. */
export async function referralOnPaymentReversal(customerId: string | null, kind: "refund" | "dispute", now = new Date()): Promise<boolean> {
  if (!referralsEnabled() || !customerId) return false;
  let found = await prisma.referralAttribution.findFirst({ where: { referredCustomerId: customerId }, select: { id: true } });
  if (!found) {
    const ent = await prisma.entitlement.findUnique({ where: { stripeCustomerId: customerId }, select: { userId: true } });
    if (ent) found = await prisma.referralAttribution.findUnique({ where: { referredUserId: ent.userId }, select: { id: true } });
  }
  if (!found) return false;
  const id = found.id;
  const stripe = getStripe();

  return prisma.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "ReferralAttribution" WHERE "id" = ${id} FOR UPDATE`;
      const att = await tx.referralAttribution.findUniqueOrThrow({ where: { id } });
      if (att.referrerUserId) await tx.$queryRaw`SELECT "userId" FROM "Entitlement" WHERE "userId" = ${att.referrerUserId} FOR UPDATE`;
      if (att.status === "pending" || att.status === "review" || (att.status === "crediting" && !att.referrerCreditTxnId)) {
        await tx.referralAttribution.update({ where: { id }, data: { status: "voided", reason: kind } });
        return true;
      }
      if (att.status !== "credited") return false;

      if (att.rewardKind === "balance" && att.referrerCustomerId && att.rewardCents > 0) {
        // Take back only credit that is still unused, so a reversal never creates a surprise charge. A reward that was
        // already used keeps counting toward the cap (creditedAt stays set).
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
        await tx.referralAttribution.update({
          where: { id },
          data: { status: "reversed", reason: kind, reversalTxnId: txnId, reversedAt: now, ...(full ? {} : { flagReason: `credit_partly_used:${att.rewardCents - unused}` }) },
        });
        return true;
      }

      if (att.rewardKind === "pro_days" && att.referrerUserId) {
        const ent = await tx.entitlement.findUnique({ where: { userId: att.referrerUserId } });
        if (ent?.referralProEndsAt && isPaidActive(ent)) {
          const newEnd = new Date(ent.referralProEndsAt.getTime() - att.rewardDays * DAY_MS);
          await tx.entitlement.update({
            where: { userId: att.referrerUserId },
            data: newEnd <= now
              ? { plan: "trial", status: "trialing", periodStart: null, periodEnd: null, periodUsed: 0, referralProEndsAt: null }
              : { periodEnd: newEnd, referralProEndsAt: newEnd },
          });
        }
        await tx.referralAttribution.update({
          where: { id },
          data: { status: "reversed", reason: kind, reversedAt: now, ...(ent?.referralProEndsAt ? {} : { flagReason: "referrer_now_subscribed" }) },
        });
        return true;
      }
      await tx.referralAttribution.update({ where: { id }, data: { flagReason: kind } });
      return true;
    },
    { timeout: 20_000, maxWait: 10_000 },
  );
}
