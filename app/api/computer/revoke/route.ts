import { NextResponse } from "next/server";
import { computerCtx } from "../_shared";
import { writeAudit } from "@/lib/admin";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const c = await computerCtx(req, true);
  if (c instanceof Response) return c;
  await c.hub.call("/stop", {}).catch(() => null);
  const r = await c.hub.call("/revoke", {});
  await writeAudit(c.owner.id, "computer.revoke").catch(() => null);
  return NextResponse.json({ ok: r.status === 200 });
}
