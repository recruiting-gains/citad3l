import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { providerInfo } from "@/lib/inference";
export const dynamic = "force-dynamic";
export async function GET() {
  let db = false;
  try { await prisma.$queryRaw`SELECT 1`; db = true; } catch {}
  const p = providerInfo();
  return NextResponse.json({ ok: db, db, provider: { mock: p.mock, label: p.label } }, { status: db ? 200 : 503 });
}
