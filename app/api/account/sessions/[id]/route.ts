import { NextResponse } from "next/server";
import { requireUserId } from "@/auth";
import { jerr } from "@/lib/http";
import { revokeSession } from "@/lib/sessions";
export const dynamic = "force-dynamic";
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const userId = await requireUserId();
  if (!userId) return jerr(401, "unauthorized", "Sign in.");
  const { id } = await ctx.params;
  if (!id || id.length > 40) return jerr(400, "bad_request", "Invalid session.");
  const ok = await revokeSession(userId, id);
  if (!ok) return jerr(404, "not_found", "Session not found.");
  return NextResponse.json({ ok: true });
}
