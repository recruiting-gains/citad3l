import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId } from "@/auth";
import { prisma } from "@/lib/db";
import { jerr, readJsonLimited } from "@/lib/http";
import { listProjects } from "@/lib/projects";
import { MAX_PROJECT_INSTRUCTIONS } from "@/lib/config";
export const dynamic = "force-dynamic";

export async function GET() {
  const userId = await requireUserId();
  if (!userId) return jerr(401, "unauthorized", "Sign in.");
  return NextResponse.json({ projects: await listProjects(userId) });
}
const Body = z.object({ name: z.string().trim().min(1).max(80), instructions: z.string().max(MAX_PROJECT_INSTRUCTIONS).default("") });
export async function POST(req: Request) {
  const userId = await requireUserId();
  if (!userId) return jerr(401, "unauthorized", "Sign in.");
  const parsed = Body.safeParse(await readJsonLimited(req, 16_000).catch(() => null));
  if (!parsed.success) return jerr(400, "bad_request", "Name is required (max 80 chars); instructions max 4,000.");
  if ((await prisma.project.count({ where: { userId } })) >= 100) return jerr(400, "too_many", "Project limit reached.");
  const p = await prisma.project.create({ data: { userId, ...parsed.data } });
  return NextResponse.json({ project: { id: p.id, name: p.name, instructions: p.instructions, updatedAt: p.updatedAt.toISOString(), conversationCount: 0 } });
}
