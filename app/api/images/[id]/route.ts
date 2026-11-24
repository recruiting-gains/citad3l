import { requireUserId } from "@/auth";
import { prisma } from "@/lib/db";
import { jerr } from "@/lib/http";
import { loadImageForUser } from "@/lib/images-r2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** Authenticated image bytes. Not a public R2 URL — adult content stays behind a session. */
export async function GET(_: Request, { params }: Ctx) {
  const userId = await requireUserId();
  if (!userId) return jerr(401, "unauthorized", "Sign in to view this image.");
  const { id } = await params;
  if (!id || id.length > 80) return jerr(404, "not_found", "Image not found.");

  const result = await loadImageForUser({
    userId,
    messageId: id,
    getMessage: (messageId) =>
      prisma.message.findFirst({ where: { id: messageId }, select: { id: true, userId: true, content: true } }),
  });
  if ("error" in result) return jerr(404, "not_found", "Image not found.");

  return new Response(Buffer.from(result.body), {
    headers: {
      "content-type": result.mime,
      "content-length": String(result.body.byteLength),
      "cache-control": "private, max-age=3600",
      "x-content-type-options": "nosniff",
    },
  });
}
