import { NextResponse } from "next/server";
import { requireUserId } from "@/auth";
import { prisma } from "@/lib/db";
import { jerr } from "@/lib/http";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const userId = await requireUserId();
  if (!userId) return jerr(401, "unauthorized", "Sign in.");
  const projectId = new URL(req.url).searchParams.get("projectId");
  const rows = await prisma.conversation.findMany({
    where: { userId, ...(projectId ? { projectId } : {}) },
    orderBy: { updatedAt: "desc" },
    take: 200,
    select: { id: true, title: true, projectId: true, updatedAt: true },
  });
  return NextResponse.json({ conversations: rows.map((r) => ({ ...r, updatedAt: r.updatedAt.toISOString() })) });
}
