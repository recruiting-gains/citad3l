import { NextResponse } from "next/server";
import { z } from "zod";
import { computerCtx } from "../_shared";
import { writeAudit } from "@/lib/admin";
import { jerr } from "@/lib/http";
export const dynamic = "force-dynamic";

const Body = z.object({ name: z.string().trim().max(80).optional() });

/** Mints a new pairing token (shown ONCE). Pairing again replaces the old token and disconnects the old helper. */
export async function POST(req: Request) {
  const c = await computerCtx(req, true);
  if (c instanceof Response) return c;
  const body = Body.safeParse(await req.json().catch(() => ({})));
  if (!body.success) return jerr(400, "bad_request", "Invalid request.");
  const r = await c.hub.call<{ token?: string }>("/pair", { name: body.data.name || "MacBook" });
  if (r.status !== 200 || !r.body.token) return jerr(502, "relay_error", "Couldn't create a pairing token.");
  await writeAudit(c.owner.id, "computer.pair", null, body.data.name || "MacBook").catch(() => null);
  const app = (process.env.APP_URL || new URL(req.url).origin).replace(/\/$/, "");
  return NextResponse.json(
    { token: r.body.token, server: app, wsUrl: `${app.replace(/^http/, "ws")}/api/computer/ws` },
    { headers: { "Cache-Control": "no-store" } },
  );
}
