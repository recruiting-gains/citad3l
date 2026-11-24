import { NextResponse } from "next/server";
import { computerCtx } from "../_shared";
import { computerModel } from "@/lib/computer/model";
import { computerMaxSteps } from "@/lib/computer/gate";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const c = await computerCtx(req, false);
  if (c instanceof Response) return c;
  const s = await c.hub.call("/status");
  return NextResponse.json({ ...s.body, model: computerModel() ? "Citad3L Vision" : "not configured", maxSteps: computerMaxSteps() }, { headers: { "Cache-Control": "no-store" } });
}
