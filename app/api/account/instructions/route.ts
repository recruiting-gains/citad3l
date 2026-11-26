import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId } from "@/auth";
import { BodyTooLarge, jerr, readJsonLimited, tooMany } from "@/lib/http";
import { rateLimit } from "@/lib/ratelimit";
import { checkText } from "@/lib/filter";
import { logFilterRefusal } from "@/lib/filter-log";
import {
  clearCustomInstructions,
  getCustomInstructions,
  MAX_CUSTOM_INSTRUCTIONS,
  normalizeCustomInstructions,
  saveCustomInstructions,
} from "@/lib/custom-instructions";
export const dynamic = "force-dynamic";

// Account-wide custom instructions. Signed-in accounts only (guests get 401 and a sign-in prompt in the UI).
// The instruction text is never written to logs; errors log only their class name.

const Body = z.object({
  // Generous raw limit so CRLF/whitespace doesn't trip it; the stored text is capped after cleanup.
  text: z.string().max(MAX_CUSTOM_INSTRUCTIONS * 2).optional().default(""),
  enabled: z.boolean().optional().default(true),
  clear: z.boolean().optional(),
});

export async function GET() {
  const userId = await requireUserId();
  if (!userId) return jerr(401, "unauthorized", "Sign in to use custom instructions.");
  try {
    return NextResponse.json({ instructions: await getCustomInstructions(userId), max: MAX_CUSTOM_INSTRUCTIONS });
  } catch (e) {
    console.error("[custom-instructions] read failed", (e as Error)?.name ?? "Error");
    return jerr(500, "internal", "Couldn't load your custom instructions.");
  }
}

export async function PUT(req: Request) {
  const userId = await requireUserId();
  if (!userId) return jerr(401, "unauthorized", "Sign in to use custom instructions.");
  if (!rateLimit(`instructions:${userId}`, 20)) return tooMany("Too many saves this minute. Try again shortly.");
  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await readJsonLimited(req, 16_000));
  } catch (e) {
    if (e instanceof BodyTooLarge) return jerr(413, "too_large", "Request too large.");
    return jerr(400, "bad_request", "Invalid request.");
  }
  try {
    if (body.clear) return NextResponse.json({ instructions: await clearCustomInstructions(userId), max: MAX_CUSTOM_INSTRUCTIONS });
    const raw = body.text.replace(/\r\n?/g, "\n").trim();
    if (Array.from(raw).length > MAX_CUSTOM_INSTRUCTIONS) {
      return jerr(400, "too_long", `Custom instructions are limited to ${MAX_CUSTOM_INSTRUCTIONS.toLocaleString()} characters.`);
    }
    const text = normalizeCustomInstructions(raw);
    // Same hard lines as chat. Every chat also re-checks the saved text with the full review before it is used.
    const verdict = checkText(text);
    if (!verdict.allowed) {
      await logFilterRefusal({ userId, direction: "input", verdict });
      return jerr(400, "content_policy", verdict.message);
    }
    return NextResponse.json({ instructions: await saveCustomInstructions(userId, { text, enabled: body.enabled }), max: MAX_CUSTOM_INSTRUCTIONS });
  } catch (e) {
    console.error("[custom-instructions] save failed", (e as Error)?.name ?? "Error");
    return jerr(500, "internal", "Couldn't save your custom instructions.");
  }
}
