import { NextResponse } from "next/server";
import { z } from "zod";
import { jerr, readJsonLimited } from "@/lib/http";
import { requireOwnerApi, setBanned, markRefund } from "@/lib/admin";
export const dynamic = "force-dynamic";

const Body = z.object({
  action: z.enum(["ban", "unban", "refund"]),
  reason: z.string().max(500).optional(),
});

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const owner = await requireOwnerApi();
  if (!owner) return jerr(404, "not_found", "Not found.");
  const { id } = await ctx.params;
  if (!id || id.length > 40) return jerr(404, "not_found", "Not found.");
  let body: z.infer<typeof Body>;
  try { body = Body.parse(await readJsonLimited(req, 4_096)); }
  catch { return jerr(400, "bad_request", "Invalid request."); }
  try {
    if (body.action === "ban" || body.action === "unban") {
      await setBanned(owner.id, id, body.action === "ban", body.reason ?? "");
      return NextResponse.json({ ok: true });
    }
    const result = await markRefund(owner.id, id);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const msg = (e as Error).message;
    if (msg === "not_found") return jerr(404, "not_found", "Not found.");
    if (msg === "cannot_ban_owner") return jerr(400, "bad_request", "The operator account can't be suspended.");
    return jerr(500, "internal", "Something went wrong.");
  }
}
