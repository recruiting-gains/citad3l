import { NextResponse } from "next/server";
import { computerCtx } from "../_shared";
import { writeAudit } from "@/lib/admin";
export const dynamic = "force-dynamic";

/** Web kill switch: flags the active run and tells the helper to stop immediately. */
export async function POST(req: Request) {
  const c = await computerCtx(req, true);
  if (c instanceof Response) return c;
  const r = await c.hub.call<{ helperNotified?: boolean }>("/stop", {});
  await writeAudit(c.owner.id, "computer.stop").catch(() => null);
  return NextResponse.json({ ok: r.status === 200, helperNotified: !!r.body.helperNotified });
}
