import { NextResponse } from "next/server";
import { requireUserId, auth } from "@/auth";
import { jerr } from "@/lib/http";
import { listSessions } from "@/lib/sessions";
export const dynamic = "force-dynamic";
export async function GET() {
  const userId = await requireUserId();
  if (!userId) return jerr(401, "unauthorized", "Sign in.");
  const s = await auth();
  const currentId = typeof (s as unknown as { sid?: string } | null)?.sid === "string" ? (s as unknown as { sid: string }).sid : null;
  return NextResponse.json({ sessions: await listSessions(userId, currentId) });
}
