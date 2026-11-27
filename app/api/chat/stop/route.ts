import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId } from "@/auth";
import { prisma } from "@/lib/db";
import { jerr, readJsonLimited } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({ assistantMessageId: z.string().min(1).max(40) });

/**
 * The Stop button. A chat reply keeps running when the connection drops (see lib/reply-lifeline.ts), so Stop has to
 * say so explicitly: this marks the user's own in-progress reply "stopped"; the running reply sees it within a couple
 * of seconds, ends, saves what it has, and is not charged.
 */
export async function POST(req: Request) {
  const userId = await requireUserId();
  if (!userId) return jerr(401, "unauthorized", "Sign in.");
  const parsed = Body.safeParse(await readJsonLimited(req, 1_024).catch(() => null));
  if (!parsed.success) return jerr(400, "bad_request", "Invalid request.");
  const r = await prisma.message.updateMany({
    where: { id: parsed.data.assistantMessageId, userId, role: "assistant", status: "streaming" },
    data: { status: "stopped" },
  });
  return NextResponse.json({ ok: true, stopped: r.count === 1 });
}
