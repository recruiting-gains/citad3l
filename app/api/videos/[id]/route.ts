import { requireUserId } from "@/auth";
import { jerr } from "@/lib/http";
import { finalizeVideo, serveVideo } from "@/lib/video-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

/** The owner's own clip only (message.userId match). `?status=1` → JSON and finishes a pending job if the provider is done. */
export async function GET(req: Request, { params }: Ctx) {
  const userId = await requireUserId();
  if (!userId) return jerr(401, "unauthorized", "Sign in to view this video.");
  const { id } = await params;
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(id)) return jerr(404, "not_found", "Video not found.");
  if (new URL(req.url).searchParams.get("status") === "1") {
    const r = await finalizeVideo({ userId, messageId: id, signal: req.signal });
    return Response.json({ status: r.status }, { status: r.status === "not_found" ? 404 : 200, headers: { "cache-control": "no-store" } });
  }
  const v = await serveVideo({ userId, messageId: id, range: req.headers.get("range"), signal: req.signal });
  if (!(v instanceof Response)) {
    if (v.error === "pending") return jerr(409, "pending", "Still rendering.");
    if (v.error === "expired") return jerr(410, "expired", "This video expired (the video service keeps clips for 24 hours) and no copy was saved.");
    return jerr(404, "not_found", "Video not found.");
  }
  return v;
}
