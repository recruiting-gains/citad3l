import { NextResponse } from "next/server";
import { requireUserId } from "@/auth";
import { prisma } from "@/lib/db";
import { jerr } from "@/lib/http";
import { stamp } from "@/lib/sync";
export const dynamic = "force-dynamic";

/**
 * Live-sync fingerprints for the signed-in user only. `list` changes when any of their conversations is created,
 * renamed, moved, deleted or gets a new message; `conv` changes when a message in the open conversation is added or
 * updated (e.g. a reply finishing on another device). Two indexed aggregate queries; no message content is returned.
 */
export async function GET(req: Request) {
  const userId = await requireUserId();
  if (!userId) return jerr(401, "unauthorized", "Sign in.");
  const c = new URL(req.url).searchParams.get("c");
  const convId = c && /^[a-z0-9]{8,40}$/i.test(c) ? c : null;
  const [list, conv] = await Promise.all([
    prisma.conversation.aggregate({ where: { userId }, _count: { _all: true }, _max: { updatedAt: true } }),
    convId ? prisma.message.aggregate({ where: { conversationId: convId, userId }, _count: { _all: true }, _max: { updatedAt: true } }) : null,
  ]);
  return NextResponse.json(
    { list: stamp(list._count._all, list._max.updatedAt), conv: conv ? stamp(conv._count._all, conv._max.updatedAt) : null },
    { headers: { "Cache-Control": "no-store" } },
  );
}
