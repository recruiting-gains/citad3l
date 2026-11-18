import { Prisma, type Entitlement } from "@prisma/client";
import { prisma } from "./db";
import { planLimit, TRIAL_REPLIES, UNIT_LABEL, MAX_CONCURRENT_STREAMS_PER_USER, STALE_RESERVATION_MS } from "./config";
import type { UsageSummary } from "./types";

export class UsageError extends Error {
  constructor(public code: "limit_reached" | "busy", message: string) {
    super(message);
  }
}

type Tx = Prisma.TransactionClient;

/** Which pool the user draws from right now, and its limit. */
export function poolFor(e: Pick<Entitlement, "plan" | "status" | "trialUsed" | "periodUsed">) {
  const paid = (e.plan === "pro" || e.plan === "max") && e.status === "active";
  if (paid) return { pool: "period" as const, used: e.periodUsed, limit: planLimit(e.plan) };
  if (e.plan !== "trial" && e.status === "past_due") return { pool: "blocked" as const, used: e.periodUsed, limit: 0 };
  return { pool: "trial" as const, used: e.trialUsed, limit: TRIAL_REPLIES };
}

export async function ensureEntitlement(userId: string, tx: Tx | typeof prisma = prisma) {
  return tx.entitlement.upsert({ where: { userId }, create: { userId }, update: {} });
}

export function summarize(e: Entitlement): UsageSummary {
  const p = poolFor(e);
  const remaining = Math.max(0, p.limit - p.used - e.reserved);
  return {
    plan: p.pool === "trial" ? "trial" : e.plan,
    status: e.status,
    used: p.used,
    limit: p.limit,
    remaining,
    resetAt: p.pool === "trial" ? null : e.periodEnd?.toISOString() ?? null,
    cancelAtPeriodEnd: e.cancelAtPeriodEnd,
    unitLabel: UNIT_LABEL,
  };
}

export async function getUsage(userId: string): Promise<UsageSummary> {
  return summarize(await ensureEntitlement(userId));
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

/**
 * Atomically reserve `units` of allowance. Locks the user's entitlement row with SELECT ... FOR UPDATE,
 * so concurrent requests serialize: used + reserved can never exceed the limit.
 */
export async function reserve(userId: string, units = 1): Promise<{ reservationId: string }> {
  await ensureEntitlement(userId);
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "userId" FROM "Entitlement" WHERE "userId" = ${userId} FOR UPDATE`;
    await reapStale(tx, userId);
    const e = await tx.entitlement.findUniqueOrThrow({ where: { userId } });
    const p = poolFor(e);
    if (p.pool === "blocked") throw new UsageError("limit_reached", "Your last payment failed. Update billing to continue.");
    const inflight = await tx.usageReservation.count({ where: { userId, status: "reserved" } });
    if (p.used + e.reserved + units > p.limit) {
      throw new UsageError("limit_reached", p.pool === "trial" ? "You've used all 5 trial replies." : "You've used this period's allowance.");
    }
    if (inflight >= MAX_CONCURRENT_STREAMS_PER_USER) throw new UsageError("busy", "Too many replies in progress. Wait for one to finish.");
    await tx.entitlement.update({ where: { userId }, data: { reserved: { increment: units } } });
    const r = await tx.usageReservation.create({ data: { userId, units, pool: p.pool } });
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
      else data.periodUsed = { increment: r.units };
    }
    await tx.entitlement.update({ where: { userId: r.userId }, data });
  });
}
