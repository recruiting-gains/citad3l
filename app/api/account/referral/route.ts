import { NextResponse } from "next/server";
import { requireUserId } from "@/auth";
import { jerr } from "@/lib/http";
import { referralPayload } from "@/lib/referrals";
export const dynamic = "force-dynamic";
export async function GET() {
  const userId = await requireUserId();
  if (!userId) return jerr(401, "unauthorized", "Sign in.");
  return NextResponse.json(await referralPayload(userId));
}
