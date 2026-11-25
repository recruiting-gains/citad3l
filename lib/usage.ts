import { Prisma, type Entitlement } from "@prisma/client";
import { prisma } from "./db";
import {
  isAdminEmail,
  isOwnerEmail,
  planLimit,
  planWindowLimit,
  TRIAL_REPLIES,
  UNIT_LABEL,
  MAX_CONCURRENT_STREAMS_PER_USER,
  STALE_RESERVATION_MS,
  usageWeekMs,
  usageWindowMs,
} from "./config";
import type { UsageMeter, UsageSummary } from "./types";

export class UsageError extends Error {
  constructor(public code: "limit_reached" | "busy", message: string) {
    super(message);
  }
}

type Tx = Prisma.TransactionClient;

export type EntitlementWindows = Pick<
  Entitlement,
  | "plan"
  | "status"
  | "trialUsed"
  | "periodUsed"
  | "reserved"
  | "periodEnd"
  | "cancelAtPeriodEnd"
  | "windowUsed"
  | "windowStart"
  | "windowEnd"
  | "weekUsed"
  | "weekStart"
  | "weekEnd"
>;

export function isPaidActive(e: Pick<EntitlementWindows, "plan" | "status">): boolean {
  return (e.plan === "pro" || e.plan === "max") && e.status === "active";
}

/** Which pool the user draws from right now (trial vs paid vs blocked). */
export function poolFor(e: Pick<EntitlementWindows, "plan" | "status" | "trialUsed" | "periodUsed">) {
  const paid = isPaidActive(e);
  if (paid) return { pool: "period" as const, used: e.periodUsed, limit: planLimit(e.plan) };
  if (e.plan !== "trial" && e.status === "past_due") return { pool: "blocked" as const, used: e.periodUsed, limit: 0 };
  return { pool: "trial" as const, used: e.trialUsed, limit: TRIAL_REPLIES };
}

export function rolledWindows<T extends EntitlementWindows>(e: T, now = new Date()): T {
  if (!isPaidActive(e)) return e;
  const next = { ...e };
  if (!next.windowEnd || now.getTime() >= next.windowEnd.getTime()) {
    next.windowUsed = 0;
    next.windowStart = now;
    next.windowEnd = new Date(now.getTime() + usageWindowMs());
  }
  if (!next.weekEnd || now.getTime() >= next.weekEnd.getTime()) {
    next.weekUsed = 0;
    next.weekStart = now;
    next.weekEnd = new Date(now.getTime() + usageWeekMs());
  }
  return next;
}

function meter(used: number, limit: number, reserved: number, resetAt: Date | null, label: string): UsageMeter {
  return {
    used,
    limit,
    remaining: Math.max(0, limit - used - reserved),
    resetAt: resetAt?.toISOString() ?? null,
    label,
  };
}

export function summarize(e: EntitlementWindows, opts: { owner?: boolean; admin?: boolean } = {}): UsageSummary {
  const owner = !!opts.owner;
  const admin = !!opts.admin || owner;
  const rolled = rolledWindows(e);
  const p = poolFor(rolled);
  const periodEnd = rolled.periodEnd ? rolled.periodEnd.toISOString() : null;
  if (admin) {
    return {
      plan: p.pool === "trial" ? "trial" : rolled.plan,
      status: rolled.status,
      used: p.pool === "trial" ? rolled.trialUsed : rolled.weekUsed,
      limit: Number.MAX_SAFE_INTEGER,
      remaining: Number.MAX_SAFE_INTEGER,
      resetAt: null,
      periodEnd,
      cancelAtPeriodEnd: rolled.cancelAtPeriodEnd,
      unitLabel: UNIT_LABEL,
      owner,
      admin: true,
      unlimited: true,
    };
  }
  if (p.pool === "period") {
    const window = meter(rolled.windowUsed, planWindowLimit(rolled.plan), rolled.reserved, rolled.windowEnd, "5-hour window");
    const week = meter(rolled.weekUsed, planLimit(rolled.plan), rolled.reserved, rolled.weekEnd, "Weekly cap");
    const binding = window.remaining <= week.remaining ? window : week;
    return {
      plan: rolled.plan,
      status: rolled.status,
      used: binding.used,
      limit: binding.limit,
      remaining: binding.remaining,
      resetAt: binding.resetAt,
      periodEnd,
      cancelAtPeriodEnd: rolled.cancelAtPeriodEnd,
      unitLabel: UNIT_LABEL,
      window,
      week,
    };
  }
  const remaining = Math.max(0, p.limit - p.used - rolled.reserved);
  return {
    plan: p.pool === "trial" ? "trial" : rolled.plan,
    status: rolled.status,
    used: p.used,
    limit: p.limit,
    remaining,
    resetAt: p.pool === "trial" ? null : periodEnd,
    periodEnd,
    cancelAtPeriodEnd: rolled.cancelAtPeriodEnd,
    unitLabel: UNIT_LABEL,
  };
}

export async function userIsOwner(userId: string): Promise<boolean> {
  try {
    const u = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
    return isOwnerEmail(u?.email);
  } catch {
    return false;
  }
}

export async function userIsAdmin(userId: string): Promise<boolean> {
  try {
    const u = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
    return isAdminEmail(u?.email);
  } catch {
    return false;
  }
}

export async function ensureEntitlement(userId: string, tx: Tx | typeof prisma = prisma) {
  const e = await tx.entitlement.upsert({ where: { userId }, create: { userId }, update: {} });
  // Pro days from the referral promo end on their own date (referralProEndsAt), whatever happens to the friend's account.
  // Once it passes, drop back to Free, unless a real subscription has taken over (then just clear the marker).
  const refEnd = (e as { referralProEndsAt?: Date | null }).referralProEndsAt;
  if (refEnd && refEnd.getTime() <= Date.now()) {
    const realSub = !!e.stripeSubscriptionId && e.status !== "canceled" && !!e.periodEnd && e.periodEnd.getTime() > Date.now();
    return tx.entitlement.update({
      where: { userId },
      data: realSub ? { referralProEndsAt: null } : { plan: "trial", status: "trialing", periodStart: null, periodEnd: null, periodUsed: 0, cancelAtPeriodEnd: false, referralProEndsAt: null },
    });
  }
  return e;
}

export async function getUsage(userId: string): Promise<UsageSummary> {
  const [e, owner, admin] = await Promise.all([ensureEntitlement(userId), userIsOwner(userId), userIsAdmin(userId)]);
  return summarize(e, { owner, admin });
}

/** Release reservations left behind by a crashed process (best-effort, inside the row lock). */
async function reapStale(tx: Tx, userId: string) {
  const cutoff = new Date(Date.now() - STALE_RESERVATION_MS);
  const stale = await tx.usageReservation.findMany({ where: { userId, status: "reserved", createdAt: { lt: cutoff } } });
  if (!stale.length) return;
  const units = stale.reduce((a, r) => a + r.units, 0);
  await tx.usageReservation.updateMany({ where: { id: { in: stale.map((s) => s.id) } }, data: { status: "released", settledAt: new Date() } });
  await tx.entitlement.update({ where: { userId }, data: { reserved: { decrement: units } } });
}

async function persistRolledWindows(tx: Tx, userId: string, before: Entitlement, after: EntitlementWindows) {
  const changed =
    before.windowUsed !== after.windowUsed ||
    before.windowStart?.getTime() !== after.windowStart?.getTime() ||
    before.windowEnd?.getTime() !== after.windowEnd?.getTime() ||
    before.weekUsed !== after.weekUsed ||
    before.weekStart?.getTime() !== after.weekStart?.getTime() ||
    before.weekEnd?.getTime() !== after.weekEnd?.getTime();
  if (!changed) return after as Entitlement;
  return tx.entitlement.update({
    where: { userId },
    data: {
      windowUsed: after.windowUsed,
      windowStart: after.windowStart,
      windowEnd: after.windowEnd,
      weekUsed: after.weekUsed,
      weekStart: after.weekStart,
      weekEnd: after.weekEnd,
    },
  });
}

/**
 * Atomically reserve `units` of allowance. Locks the user's entitlement row with SELECT ... FOR UPDATE,
 * so concurrent requests serialize: used + reserved can never exceed the limit.
 * Admin accounts (including the owner) bypass limits but still record reservations for the dashboard.
 */
export async function reserve(userId: string, units = 1): Promise<{ reservationId: string }> {
  const owner = await userIsAdmin(userId);
  await ensureEntitlement(userId);
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "userId" FROM "Entitlement" WHERE "userId" = ${userId} FOR UPDATE`;
    await reapStale(tx, userId);
    const raw = await tx.entitlement.findUniqueOrThrow({ where: { userId } });
    const e = await persistRolledWindows(tx, userId, raw, rolledWindows(raw));
    const p = poolFor(e);
    if (!owner && p.pool === "blocked") throw new UsageError("limit_reached", "Your last payment failed. Update billing to continue.");
    const inflight = await tx.usageReservation.count({ where: { userId, status: "reserved" } });
    if (!owner) {
      if (p.pool === "period") {
        const windowLeft = planWindowLimit(e.plan) - e.windowUsed - e.reserved;
        const weekLeft = planLimit(e.plan) - e.weekUsed - e.reserved;
        if (units > windowLeft || units > weekLeft) {
          throw new UsageError("limit_reached", windowLeft <= weekLeft ? "You've used this window's allowance. It refreshes every 5 hours." : "You've used this week's allowance.");
        }
      } else if (p.used + e.reserved + units > p.limit) {
        throw new UsageError("limit_reached", p.pool === "trial" ? "You've used all 5 free messages." : "You've used this period's allowance.");
      }
    }
    if (!owner && inflight >= MAX_CONCURRENT_STREAMS_PER_USER) throw new UsageError("busy", "Too many replies in progress. Wait for one to finish.");
    await tx.entitlement.update({ where: { userId }, data: { reserved: { increment: units } } });
    const r = await tx.usageReservation.create({ data: { userId, units, pool: p.pool === "blocked" ? "period" : p.pool } });
    return { reservationId: r.id };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, timeout: 10000 });
}

/** success=true charges the reservation; false releases it (failures / stops are never charged). Idempotent. */
export async function settle(reservationId: string, success: boolean, assistantMessageId?: string) {
  return prisma.$transaction(async (tx) => {
    const r = await tx.usageReservation.findUnique({ where: { id: reservationId } });
    if (!r) return;
    await tx.$queryRaw`SELECT "userId" FROM "Entitlement" WHERE "userId" = ${r.userId} FOR UPDATE`;
    const claimed = await tx.usageReservation.updateMany({
      where: { id: reservationId, status: "reserved" },
      data: { status: success ? "settled" : "released", settledAt: new Date(), assistantMessageId },
    });
    if (claimed.count !== 1) return; // already settled/released (or reaped)
    const data: Prisma.EntitlementUpdateInput = { reserved: { decrement: r.units } };
    if (success) {
      if (r.pool === "trial") data.trialUsed = { increment: r.units };
      else {
        data.periodUsed = { increment: r.units };
        data.windowUsed = { increment: r.units };
        data.weekUsed = { increment: r.units };
      }
    }
    await tx.entitlement.update({ where: { userId: r.userId }, data });
  });
}
