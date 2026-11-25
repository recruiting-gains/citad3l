import { NextResponse } from "next/server";
import { requireUserId } from "@/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { BodyTooLarge, jerr, readJsonLimited, tooMany } from "@/lib/http";
import { LIMITS, limitDurable, rule } from "@/lib/ratelimit";
import { titleFrom } from "@/lib/prompt";
import { checkTexts } from "@/lib/filter";
import { reviewOrKeyword } from "@/lib/filter-llm";
import { logFilterRefusal } from "@/lib/filter-log";

const MAX_IMPORT_MESSAGES = 12;
const MAX_IMPORT_CHARS = 8000;
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const userId = await requireUserId();
  if (!userId) return jerr(401, "unauthorized", "Sign in.");
  const projectId = new URL(req.url).searchParams.get("projectId");
  const rows = await prisma.conversation.findMany({
    where: { userId, ...(projectId ? { projectId } : {}) },
    orderBy: { updatedAt: "desc" },
    take: 200,
    select: { id: true, title: true, projectId: true, updatedAt: true },
  });
  return NextResponse.json({ conversations: rows.map((r) => ({ ...r, updatedAt: r.updatedAt.toISOString() })) });
}

/**
 * Save a guest chat (home page try box / signed-out chat) into the signed-in account. The transcript comes from the
 * visitor's own browser (localStorage) right after they sign in with the "save your chat" email code. Bounded in size
 * and rate limited. It never runs a chat model, but the whole transcript goes through the same safety filter as a
 * live message first, so blocked content can't be planted into an account's history this way.
 */
const GuestImport = z.object({
  messages: z.array(z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string().min(1).max(MAX_IMPORT_CHARS),
  })).min(1).max(MAX_IMPORT_MESSAGES),
});

export async function POST(req: Request) {
  const userId = await requireUserId();
  if (!userId) return jerr(401, "unauthorized", "Sign in.");
  const lim = await limitDurable([rule(LIMITS.guestImportHour, userId)]);
  if (!lim.ok) return tooMany("Too many saves. Try again later.", lim.retryAfterSec);
  let body: z.infer<typeof GuestImport>;
  try {
    body = GuestImport.parse(await readJsonLimited(req, 64_000));
  } catch (e) {
    if (e instanceof BodyTooLarge) return jerr(413, "too_large", "That chat is too large to save.");
    return jerr(400, "bad_request", "Invalid request.");
  }
  const firstUser = body.messages.find((m) => m.role === "user");
  if (!firstUser) return jerr(400, "bad_request", "Nothing to save.");
  let verdict = checkTexts(body.messages.map((m) => m.content));
  if (verdict.allowed) verdict = await reviewOrKeyword(body.messages.map((m) => m.content).join("\n\n"), req.signal);
  if (!verdict.allowed) {
    await logFilterRefusal({ userId, direction: "input", verdict, modelId: null });
    return jerr(400, "content_policy", verdict.message);
  }
  const base = Date.now() - body.messages.length;
  const conv = await prisma.conversation.create({
    data: {
      userId,
      title: titleFrom(firstUser.content),
      messages: {
        create: body.messages.map((m, i) => ({
          userId,
          role: m.role,
          content: m.content,
          status: "complete" as const,
          createdAt: new Date(base + i),
        })),
      },
    },
    select: { id: true },
  });
  return NextResponse.json({ conversationId: conv.id });
}
