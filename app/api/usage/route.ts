import { NextResponse } from "next/server";
import { requireUserId } from "@/auth";
import { getUsage } from "@/lib/usage";
import { jerr } from "@/lib/http";
export const dynamic = "force-dynamic";
export async function GET() {
  const userId = await requireUserId();
  if (!userId) return jerr(401, "unauthorized", "Sign in.");
  return NextResponse.json({ usage: await getUsage(userId) });
}
