import type Stripe from "stripe";
import { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { planForPrice } from "./stripe";

type Sub = Stripe.Subscription & { current_period_start?: number; current_period_end?: number };

function periodOf(sub: Sub) {
  const item = sub.items?.data?.[0] as (Stripe.SubscriptionItem & { current_period_start?: number; current_period_end?: number }) | undefined;
  const s = sub.current_period_start ?? item?.current_period_start;
  const e = sub.current_period_end ?? item?.current_period_end;
  return { start: s ? new Date(s * 1000) : null, end: e ? new Date(e * 1000) : null };
}
function mapStatus(s: Stripe.Subscription.Status): "active" | "past_due" | "canceled" | "trialing" {
  if (s === "active" || s === "trialing") return "active";
  if (s === "past_due" || s === "unpaid" || s === "incomplete") return "past_due";
  return "canceled";
}

async function findUserId(customerId: string | null, metaUserId?: string | null) {
  if (metaUserId) {
    const u = await prisma.user.findUnique({ where: { id: metaUserId }, select: { id: true } });
    if (u) return u.id;
  }
  if (customerId) {
    const e = await prisma.entitlement.findUnique({ where: { stripeCustomerId: customerId } });
    if (e) return e.userId;
  }
  return null;
}

/** Applies a Stripe event to entitlements. Returns "duplicate" when the event id was already processed. */
export async function applyStripeEvent(event: Stripe.Event): Promise<"processed" | "duplicate" | "ignored"> {
  try {
    await prisma.stripeEvent.create({ data: { id: event.id, type: event.type } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return "duplicate";
    throw e;
  }
  try {
    return await handle(event);
  } catch (e) {
    // allow Stripe to retry on failure
    await prisma.stripeEvent.delete({ where: { id: event.id } }).catch(() => {});
    throw e;
  }
}

async function handle(event: Stripe.Event): Promise<"processed" | "ignored"> {
  switch (event.type) {
    case "checkout.session.completed": {
      const s = event.data.object as Stripe.Checkout.Session;
      const userId = await findUserId(typeof s.customer === "string" ? s.customer : s.customer?.id ?? null, s.client_reference_id ?? s.metadata?.userId);
      if (!userId) return "ignored";
      const plan = s.metadata?.plan === "max" ? "max" : "pro";
      await prisma.entitlement.upsert({
        where: { userId },
        create: { userId, plan, status: "active", stripeCustomerId: s.customer as string, stripeSubscriptionId: (s.subscription as string) ?? null, periodUsed: 0, periodStart: new Date() },
        update: { plan, status: "active", stripeCustomerId: s.customer as string, stripeSubscriptionId: (s.subscription as string) ?? null, cancelAtPeriodEnd: false },
      });
      return "processed";
    }
    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const sub = event.data.object as Sub;
      const userId = await findUserId(typeof sub.customer === "string" ? sub.customer : sub.customer.id, sub.metadata?.userId);
      if (!userId) return "ignored";
      const ent = await prisma.entitlement.findUnique({ where: { userId } });
      const plan = planForPrice(sub.items?.data?.[0]?.price?.id) ?? (sub.metadata?.plan === "max" ? "max" : ent?.plan === "trial" || !ent ? "pro" : ent.plan);
      const { start, end } = periodOf(sub);
      const newPeriod = !!start && (!ent?.periodStart || ent.periodStart.getTime() !== start.getTime());
      const status = mapStatus(sub.status);
      await prisma.entitlement.upsert({
        where: { userId },
        create: { userId, plan: status === "canceled" ? "trial" : plan, status, stripeCustomerId: sub.customer as string, stripeSubscriptionId: sub.id, periodStart: start, periodEnd: end, cancelAtPeriodEnd: !!sub.cancel_at_period_end },
        update: {
          plan: status === "canceled" ? "trial" : plan,
          status,
          stripeSubscriptionId: sub.id,
          periodStart: start,
          periodEnd: end,
          cancelAtPeriodEnd: !!sub.cancel_at_period_end,
          ...(newPeriod ? { periodUsed: 0 } : {}),
        },
      });
      return "processed";
    }
    case "customer.subscription.deleted": {
      const sub = event.data.object as Sub;
      const userId = await findUserId(typeof sub.customer === "string" ? sub.customer : sub.customer.id, sub.metadata?.userId);
      if (!userId) return "ignored";
      // Paid access ends; user falls back to the (one-time) trial pool, which is usually exhausted.
      await prisma.entitlement.update({ where: { userId }, data: { plan: "trial", status: "canceled", cancelAtPeriodEnd: false, stripeSubscriptionId: null, periodEnd: null } });
      return "processed";
    }
    case "invoice.payment_failed": {
      const inv = event.data.object as Stripe.Invoice;
      const userId = await findUserId(typeof inv.customer === "string" ? inv.customer : inv.customer?.id ?? null);
      if (!userId) return "ignored";
      await prisma.entitlement.updateMany({ where: { userId, plan: { in: ["pro", "max"] } }, data: { status: "past_due" } });
      return "processed";
    }
    case "invoice.paid": {
      const inv = event.data.object as Stripe.Invoice;
      const userId = await findUserId(typeof inv.customer === "string" ? inv.customer : inv.customer?.id ?? null);
      if (!userId) return "ignored";
      const line = inv.lines?.data?.[0];
      const start = line?.period?.start ? new Date(line.period.start * 1000) : null;
      const end = line?.period?.end ? new Date(line.period.end * 1000) : null;
      const ent = await prisma.entitlement.findUnique({ where: { userId } });
      if (!ent || ent.plan === "trial") return "ignored";
      const newPeriod = !!start && (!ent.periodStart || ent.periodStart.getTime() !== start.getTime());
      await prisma.entitlement.update({ where: { userId }, data: { status: "active", ...(start ? { periodStart: start, periodEnd: end } : {}), ...(newPeriod ? { periodUsed: 0 } : {}) } });
      return "processed";
    }
    default:
      return "ignored";
  }
}
