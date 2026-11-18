import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId } from "@/auth";
import { prisma } from "@/lib/db";
import { jerr } from "@/lib/http";
import { MAX_PROJECT_INSTRUCTIONS } from "@/lib/config";
export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };
const Patch = z.object({ name: z.string().trim().min(1).max(80).optional(), instructions: z.string().max(MAX_PROJECT_INSTRUCTIONS).optional() });

export async function GET(_: Request, { params }: Ctx) {
  const userId = await requireUserId();
  if (!userId) return jerr(401, "unauthorized", "Sign in.");
  const { id } = await params;
  const p = await prisma.project.findFirst({ where: { id, userId } });
  if (!p) return jerr(404, "not_found", "Project not found.");
  return NextResponse.json({ project: p });
}
export async function PATCH(req: Request, { params }: Ctx) {
  const userId = await requireUserId();
  if (!userId) return jerr(401, "unauthorized", "Sign in.");
  const { id } = await params;
  const parsed = Patch.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jerr(400, "bad_request", "Invalid request.");
  const r = await prisma.project.updateMany({ where: { id, userId }, data: parsed.data });
  if (!r.count) return jerr(404, "not_found", "Project not found.");
  return NextResponse.json({ ok: true });
}
export async function DELETE(_: Request, { params }: Ctx) {
  const userId = await requireUserId();
  if (!userId) return jerr(401, "unauthorized", "Sign in.");
  const { id } = await params;
  const r = await prisma.project.deleteMany({ where: { id, userId } });
  if (!r.count) return jerr(404, "not_found", "Project not found.");
  return NextResponse.json({ ok: true });
}
