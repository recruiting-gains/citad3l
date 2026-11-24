import { requireUserId } from "@/auth";
import { prisma } from "@/lib/db";
import { jerr } from "@/lib/http";
export const dynamic = "force-dynamic";
export async function GET() {
  const userId = await requireUserId();
  if (!userId) return jerr(401, "unauthorized", "Sign in.");
  const [user, entitlement, projects, conversations] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true, name: true, createdAt: true } }),
    prisma.entitlement.findUnique({ where: { userId }, select: { plan: true, status: true, trialUsed: true, periodUsed: true, periodStart: true, periodEnd: true, cancelAtPeriodEnd: true } }),
    prisma.project.findMany({ where: { userId }, select: { id: true, name: true, instructions: true, createdAt: true } }),
    prisma.conversation.findMany({ where: { userId }, select: { id: true, title: true, projectId: true, createdAt: true, messages: { select: { role: true, content: true, status: true, createdAt: true }, orderBy: { createdAt: "asc" } } } }),
  ]);
  const body = JSON.stringify({ exportedAt: new Date().toISOString(), user, entitlement, projects, conversations }, null, 2);
  return new Response(body, { headers: { "content-type": "application/json", "content-disposition": `attachment; filename="citad3l-export.json"` } });
}
