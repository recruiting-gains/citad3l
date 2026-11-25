import { z } from "zod";
import { requireUserId } from "@/auth";
import { bannedMessage } from "@/lib/banned";
import { prisma } from "@/lib/db";
import {
  createSignedExport,
  ExportError,
  MAX_EXPORT_FILES,
  MAX_EXPORT_SOURCE_BYTES,
} from "@/lib/exports-r2";
import { BodyTooLarge, jerr, readJsonLimited, tooMany } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  messageId: z.string().min(1).max(60).optional(),
  kind: z.enum(["zip", "pdf", "both"]).default("both"),
  title: z.string().max(160).optional().nullable(),
  markdown: z.string().max(MAX_EXPORT_SOURCE_BYTES).optional().nullable(),
  files: z
    .array(
      z.object({
        path: z.string().min(1).max(160),
        content: z.string().max(MAX_EXPORT_SOURCE_BYTES),
      }),
    )
    .max(MAX_EXPORT_FILES)
    .optional(),
});

export async function POST(req: Request) {
  const userId = await requireUserId();
  if (!userId) return jerr(401, "unauthorized", "Sign in to create downloadable exports.");

  const suspended = await bannedMessage(userId);
  if (suspended) return jerr(403, "suspended", suspended);

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await readJsonLimited(req, MAX_EXPORT_SOURCE_BYTES + 32_768));
  } catch (e) {
    if (e instanceof BodyTooLarge) return jerr(413, "too_large", "Export payload too large.");
    return jerr(400, "bad_request", "Invalid export request.");
  }

  let title = body.title ?? null;
  let markdown = body.markdown ?? null;
  let createdAt: string | undefined;

  if (body.messageId) {
    const msg = await prisma.message.findFirst({
      where: { id: body.messageId, userId },
      select: {
        id: true,
        content: true,
        createdAt: true,
        conversation: { select: { title: true } },
      },
    });
    if (!msg) return jerr(404, "not_found", "Message not found.");
    if (!msg.content.trim() && !body.files?.length) {
      return jerr(400, "bad_request", "Nothing to export from this message.");
    }
    markdown = msg.content;
    title = title || msg.conversation?.title || "Citad3L Answer";
    createdAt = msg.createdAt.toISOString();
  }

  try {
    const bundle = await createSignedExport({
      userId,
      kind: body.kind,
      title,
      markdown,
      files: body.files,
      createdAt,
    });
    return Response.json(bundle, { status: 201, headers: { "cache-control": "no-store" } });
  } catch (e) {
    if (e instanceof ExportError) {
      if (e.status === 429) return tooMany(e.message, e.retryAfterSec ?? 60);
      return jerr(e.status, e.code, e.message);
    }
    console.error("[exports] create failed", e instanceof Error ? e.name : "error");
    return jerr(500, "internal", "Couldn't create export.");
  }
}
