import { NextResponse } from "next/server";
import { providerInfo } from "@/lib/inference";
export const dynamic = "force-dynamic";
export async function GET() {
  return NextResponse.json({ provider: providerInfo() });
}
