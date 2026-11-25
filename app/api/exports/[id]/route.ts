import { requireUserId } from "@/auth";
import { bannedMessage } from "@/lib/banned";
import { isValidExportId, loadSignedExport, safeDownloadFilename } from "@/lib/exports-r2";
import { jerr } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Signed, short-lived (24h) download endpoint for Citad3L exports stored in R2.
 * Signed-in owner ONLY (guests never have access; HMAC binds userId + exportId + exp).
 */
export async function GET(req: Request, { params }: Ctx) {
  const userId = await requireUserId();
  if (!userId) return jerr(401, "unauthorized", "Sign in to download this export.");

  const suspended = await bannedMessage(userId);
  if (suspended) return jerr(403, "suspended", suspended);

  const { id } = await params;
  if (!isValidExportId(id)) return jerr(404, "not_found", "Export not found.");

  const url = new URL(req.url);
  const kindRaw = url.searchParams.get("kind");
  if (kindRaw !== "zip" && kindRaw !== "pdf") {
    return jerr(400, "bad_request", "Invalid export type.");
  }
  const expMs = Number(url.searchParams.get("exp") ?? "");
  const sig = url.searchParams.get("sig") ?? "";
  const filename = safeDownloadFilename(url.searchParams.get("name"), kindRaw);
  const inline = kindRaw === "pdf" && url.searchParams.get("inline") === "1";

  const loaded = await loadSignedExport({
    userId,
    exportId: id,
    kind: kindRaw,
    filename,
    expMs,
    sig,
  });

  if ("error" in loaded) {
    if (loaded.error === "unauthorized") return jerr(401, "unauthorized", "Sign in to download this export.");
    if (loaded.error === "forbidden") return jerr(403, "forbidden", "Invalid download signature.");
    if (loaded.error === "expired") {
      return jerr(410, "expired", "This download link has expired (exports are kept for 24 hours). Generate a new link from the message.");
    }
    if (loaded.error === "storage_unavailable") {
      return jerr(503, "storage_unavailable", "Export storage is not configured.");
    }
    return jerr(404, "not_found", "Export not found.");
  }

  return new Response(Buffer.from(loaded.body), {
    headers: {
      "content-type": loaded.mime,
      "content-length": String(loaded.body.byteLength),
      "content-disposition": `${inline ? "inline" : "attachment"}; filename="${loaded.filename}"`,
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
      "x-robots-tag": "noindex, nofollow",
    },
  });
}
