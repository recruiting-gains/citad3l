import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId } from "@/auth";
import { prisma } from "@/lib/db";
import { jerr } from "@/lib/http";
export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export async function GET(_: Request, { params }: Ctx) {
  const userId = await requireUserId();
  if (!userId) return jerr(401, "unauthorized", "Sign in.");
  const { id } = await params;
  const c = await prisma.conversation.findFirst({ where: { id, userId }, select: { id: true, title: true, projectId: true } });
  if (!c) return jerr(404, "not_found", "Conversation not found.");
  const messages = await prisma.message.findMany({ where: { conversationId: id, userId }, orderBy: { createdAt: "asc" } });
  return NextResponse.json({
    conversation: c,
    messages: messages.map((m) => ({ id: m.id, role: m.role, content: m.content, status: m.status, createdAt: m.createdAt.toISOString() })),
  });
}

const Patch = z.object({ title: z.string().trim().min(1).max(120).optional(), projectId: z.string().max(40).nullable().optional() });
export async function PATCH(req: Request, { params }: Ctx) {
  const userId = await requireUserId();
  if (!userId) return jerr(401, "unauthorized", "Sign in.");
  const { id } = await params;
  const parsed = Patch.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jerr(400, "bad_request", "Invalid request.");
  if (parsed.data.projectId) {
    const p = await prisma.project.findFirst({ where: { id: parsed.data.projectId, userId } });
    if (!p) return jerr(404, "not_found", "Project not found.");
  }
  const r = await prisma.conversation.updateMany({ where: { id, userId }, data: parsed.data });
  if (!r.count) return jerr(404, "not_found", "Conversation not found.");
  return NextResponse.json({ ok: true });
}

export async function DELETE(_: Request, { params }: Ctx) {
  const userId = await requireUserId();
  if (!userId) return jerr(401, "unauthorized", "Sign in.");
  const { id } = await params;
  const r = await prisma.conversation.deleteMany({ where: { id, userId } });
  if (!r.count) return jerr(404, "not_found", "Conversation not found.");
  return NextResponse.json({ ok: true });
}
