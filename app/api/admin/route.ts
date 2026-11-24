import { NextResponse } from "next/server";
import { computerAllowedEmail } from "@/lib/computer/gate";
import { jerr } from "@/lib/http";
import { requireOwnerApi, listAdminUsers, estimateProviderSpendUsd } from "@/lib/admin";
import { listWaitlist } from "@/lib/waitlist";
import { listFilterRefusals } from "@/lib/filter-log";
import { prisma } from "@/lib/db";
import { isOwnerEmail } from "@/lib/config";
export const dynamic = "force-dynamic";

export async function GET() {
  const owner = await requireOwnerApi();
  if (!owner) return jerr(404, "not_found", "Not found.");
  const [users, spend, refusals, audits, waitlist] = await Promise.all([
    listAdminUsers(),
    estimateProviderSpendUsd(),
    listFilterRefusals(80),
    prisma.adminAuditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { actor: { select: { email: true } }, target: { select: { email: true } } },
    }),
    listWaitlist(200),
  ]);
  return NextResponse.json({
    owner: { email: owner.email },
    // @computer panel renders for the OWNER only, not for other admins.
    viewer: { owner: isOwnerEmail(owner.email), computer: computerAllowedEmail(owner.email) },
    users,
    spend,
    refusals,
    waitlist,
    audits: audits.map((a) => ({
      id: a.id,
      action: a.action,
      detail: a.detail,
      createdAt: a.createdAt.toISOString(),
      actorEmail: a.actor.email,
      targetEmail: a.target?.email ?? null,
    })),
  });
}
