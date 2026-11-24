import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId } from "@/auth";
import { jerr, readJsonLimited } from "@/lib/http";
import { getUsage, userIsAdmin } from "@/lib/usage";
import { canUseModelSettings, getModelSettings, resetModelSettings, saveModelSettings } from "@/lib/model-settings";
import { DEFAULT_MODEL_ID } from "@/lib/models";
export const dynamic = "force-dynamic";

const Body = z.object({
  modelId: z.string().max(40),
  systemPrompt: z.string().max(4000).optional().default(""),
  temperature: z.number().nullable().optional(),
  maxTokens: z.number().int().nullable().optional(),
  reset: z.boolean().optional(),
});

async function gate(userId: string) {
  const [usage, admin] = await Promise.all([getUsage(userId), userIsAdmin(userId)]);
  if (!canUseModelSettings(usage.plan, admin || usage.admin === true || usage.owner === true)) return jerr(403, "forbidden", "Per-model settings are included with Max.");
  return null;
}

export async function GET(req: Request) {
  const userId = await requireUserId();
  if (!userId) return jerr(401, "unauthorized", "Sign in.");
  const blocked = await gate(userId);
  if (blocked) return blocked;
  const modelId = new URL(req.url).searchParams.get("model") || DEFAULT_MODEL_ID;
  return NextResponse.json({ settings: await getModelSettings(userId, modelId) });
}

export async function PUT(req: Request) {
  const userId = await requireUserId();
  if (!userId) return jerr(401, "unauthorized", "Sign in.");
  const blocked = await gate(userId);
  if (blocked) return blocked;
  let body: z.infer<typeof Body>;
  try { body = Body.parse(await readJsonLimited(req, 16_000)); }
  catch { return jerr(400, "bad_request", "Invalid request."); }
  if (body.reset) return NextResponse.json({ settings: await resetModelSettings(userId, body.modelId) });
  try {
    const settings = await saveModelSettings(userId, {
      modelId: body.modelId,
      systemPrompt: body.systemPrompt,
      temperature: body.temperature ?? null,
      maxTokens: body.maxTokens ?? null,
    });
    return NextResponse.json({ settings });
  } catch {
    return jerr(400, "bad_request", "Unknown model.");
  }
}
