import { NextResponse } from "next/server";
import { requireUserId } from "@/auth";
import { getUsage } from "@/lib/usage";
import { jerr } from "@/lib/http";
import { clientIp, guestUsageSummary, readGuestCookieHeader, serializeGuestCookie, newGuestId } from "@/lib/guest";
import { guestStore } from "@/lib/guest-store";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  const userId = await requireUserId();
  if (userId) return NextResponse.json({ usage: await getUsage(userId) });
  const cookie = readGuestCookieHeader(req.headers.get("cookie"));
  let used = cookie?.used ?? 0;
  try {
    const store = await guestStore();
    if (cookie) {
      const row = await store.get(cookie.id);
      if (row) used = Math.max(used, row.used);
    }
  } catch { /* memory/cookie only */ }
  const state = cookie ?? { id: newGuestId(), used: 0, reserved: 0 };
  const res = NextResponse.json({ usage: guestUsageSummary(used) });
  if (!cookie) res.headers.append("Set-Cookie", serializeGuestCookie({ ...state, used }));
  void clientIp(req);
  return res;
}
