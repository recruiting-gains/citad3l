import { NextResponse } from "next/server";
import { z } from "zod";
import { computerCtx } from "../_shared";
import { jerr } from "@/lib/http";
import { writeAudit } from "@/lib/admin";
import { readAutoApprove } from "@/lib/computer/settings";
export const dynamic = "force-dynamic";

/** Per-admin @computer settings, stored in that admin's own ComputerHub. Auto-approve defaults OFF; changes apply to new runs. */
export async function GET(req: Request) {
  const c = await computerCtx(req, false);
  if (c instanceof Response) return c;
  const s = await readAutoApprove(c.hub);
  if (!s.ok) return jerr(502, "unavailable", "Couldn't load the auto-approve setting. It is treated as off.");
  return NextResponse.json({ autoApprove: s.autoApprove }, { headers: { "Cache-Control": "no-store" } });
}

const Body = z.object({ autoApprove: z.boolean() });
export async function POST(req: Request) {
  const c = await computerCtx(req, true);
  if (c instanceof Response) return c;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jerr(400, "bad_request", "Invalid request.");
  const s = await c.hub.call<{ autoApprove?: boolean }>("/settings", parsed.data);
  if (s.status !== 200 || s.body?.autoApprove !== parsed.data.autoApprove) return jerr(502, "unavailable", "Couldn't save the setting.");
  await writeAudit(c.owner.id, "computer.settings", null, `autoApprove=${parsed.data.autoApprove}`).catch(() => null);
  return NextResponse.json({ autoApprove: parsed.data.autoApprove });
}
