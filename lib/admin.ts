import { notFound } from "next/navigation";
import { prisma } from "./db";
import { currentUser } from "./session";
import { isAdminEmail, isOwnerEmail, planLimit, planWindowLimit } from "./config";
import { getStripe } from "./stripe";
import { rolledWindows, isPaidActive, summarize } from "./usage";

export async function findAdminUser() {
  const u = await currentUser();
  if (!u || !isAdminEmail(u.email)) return null;
  return u;
}

/** @deprecated Use findAdminUser(); kept so older call sites still compile. */
export async function findOwnerUser() {
  return findAdminUser();
}

/** Server-page gate: everyone else gets a 404, including signed-in non-admins. */
export async function requireAdminPage() {
  const u = await findAdminUser();
  if (!u) notFound();
  return u;
}

/** @deprecated Use requireAdminPage(). */
export async function requireOwnerPage() {
  return requireAdminPage();
}

/** API gate: same 404 policy so the admin surface is not advertised. */
export async function requireAdminApi(): Promise<{ id: string; email: string } | null> {
  const u = await findAdminUser();
  if (!u || !u.email) return null;
  return { id: u.id, email: u.email };
}

/** @deprecated Use requireAdminApi(). */
export async function requireOwnerApi(): Promise<{ id: string; email: string } | null> {
  return requireAdminApi();
}

export async function writeAudit(actorUserId: string, action: string, targetUserId?: string | null, detail = "") {
  await prisma.adminAuditLog.create({
    data: { actorUserId, action, targetUserId: targetUserId ?? null, detail: detail.slice(0, 2000) },
  });
}

/** Rough, conservative USD estimate from settled reply counts. Not a provider invoice. */
const ESTIMATE_USD_PER_REPLY = 0.02;
const ESTIMATE_USD_PER_IMAGE = 0.01;

export async function estimateProviderSpendUsd(): Promise<{ usd: number; replies: number; note: string }> {
  const replies = await prisma.usageReservation.count({ where: { status: "settled" } });
  const usd = Math.round(replies * ESTIMATE_USD_PER_REPLY * 100) / 100;
  return {
    usd,
    replies,
    note: `Estimate only, at about $${ESTIMATE_USD_PER_REPLY.toFixed(2)} per settled reply and $${ESTIMATE_USD_PER_IMAGE.toFixed(2)} per image. This is not a provider invoice.`,
  };
}

export type AdminUserRow = {
  id: string;
  email: string | null;
  name: string | null;
  createdAt: string;
  plan: string;
  status: string;
  weekUsed: number;
  weekLimit: number;
  windowUsed: number;
  windowLimit: number;
  trialUsed: number;
  banned: boolean;
  bannedReason: string | null;
  refundMarkedAt: string | null;
  owner: boolean;
  admin: boolean;
};

export async function listAdminUsers(): Promise<AdminUserRow[]> {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { entitlement: true },
  });
  return users.map((u) => {
    const owner = isOwnerEmail(u.email);
    const admin = isAdminEmail(u.email);
    const e = u.entitlement;
    const rolled = e ? rolledWindows(e) : null;
    const paid = rolled ? isPaidActive(rolled) : false;
    return {
      id: u.id,
      email: u.email,
      name: u.name,
      createdAt: u.createdAt.toISOString(),
      plan: owner ? "owner" : admin ? "admin" : rolled?.plan ?? "trial",
      status: rolled?.status ?? "trialing",
      weekUsed: paid && rolled ? rolled.weekUsed : rolled?.trialUsed ?? 0,
      weekLimit: paid && rolled ? planLimit(rolled.plan) : 5,
      windowUsed: paid && rolled ? rolled.windowUsed : 0,
      windowLimit: paid && rolled ? planWindowLimit(rolled.plan) : 5,
      trialUsed: rolled?.trialUsed ?? 0,
      banned: !!u.bannedAt,
      bannedReason: u.bannedReason,
      refundMarkedAt: e?.refundMarkedAt?.toISOString() ?? null,
      owner,
      admin,
    };
  });
}

export async function setBanned(actorUserId: string, targetUserId: string, banned: boolean, reason = "") {
  const target = await prisma.user.findUnique({ where: { id: targetUserId }, select: { id: true, email: true } });
  if (!target) throw new Error("not_found");
  if (isOwnerEmail(target.email)) throw new Error("cannot_ban_owner");
  await prisma.user.update({
    where: { id: targetUserId },
    data: banned
      ? { bannedAt: new Date(), bannedReason: reason.slice(0, 500) || "Suspended by the operator." }
      : { bannedAt: null, bannedReason: null },
  });
  await writeAudit(actorUserId, banned ? "ban" : "unban", targetUserId, reason.slice(0, 500));
}

/**
 * Mark a refund on the entitlement. If Stripe keys exist, attempt a test-mode
 * refund of the latest paid invoice; otherwise the mark is recorded only.
 */
export async function markRefund(actorUserId: string, targetUserId: string): Promise<{ stripe: "stubbed" | "attempted" | "failed"; message: string }> {
  const ent = await prisma.entitlement.findUnique({ where: { userId: targetUserId } });
  if (!ent) throw new Error("not_found");
  await prisma.entitlement.update({ where: { userId: targetUserId }, data: { refundMarkedAt: new Date() } });

  const stripe = getStripe();
  if (!stripe || !ent.stripeCustomerId) {
    await writeAudit(actorUserId, "refund_marked", targetUserId, "stripe_stubbed");
    return { stripe: "stubbed", message: "Refund marked. Stripe is not configured, so no charge was refunded." };
  }
  try {
    const invoices = await stripe.invoices.list({ customer: ent.stripeCustomerId, status: "paid", limit: 1 });
    const inv = invoices.data[0] as { id?: string; amount_paid?: number; payment_intent?: string | { id?: string } | null };
    if (!inv?.id || typeof inv.amount_paid !== "number" || inv.amount_paid <= 0) {
      await writeAudit(actorUserId, "refund_marked", targetUserId, "no_paid_invoice");
      return { stripe: "attempted", message: "Refund marked. No paid invoice was found to refund." };
    }
    const pi = typeof inv.payment_intent === "string" ? inv.payment_intent : inv.payment_intent?.id;
    if (!pi) {
      await writeAudit(actorUserId, "refund_marked", targetUserId, "no_payment_intent");
      return { stripe: "attempted", message: "Refund marked. No payment was found to refund." };
    }
    await stripe.refunds.create({ payment_intent: pi, reason: "requested_by_customer" });
    await writeAudit(actorUserId, "refund_marked", targetUserId, `stripe_refund invoice=${inv.id}`);
    return { stripe: "attempted", message: "Refund marked and a Stripe refund was requested." };
  } catch (e) {
    await writeAudit(actorUserId, "refund_marked", targetUserId, `stripe_failed:${(e as Error).name}`);
    return { stripe: "failed", message: "Refund marked, but the Stripe refund call failed." };
  }
}

export { summarize };
