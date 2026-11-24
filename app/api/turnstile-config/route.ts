import { NextResponse } from "next/server";
import { turnstileSiteKey } from "@/lib/turnstile";
export const dynamic = "force-dynamic";

/** Public: tells the login and waitlist forms whether to show the Turnstile check, and its site key. */
export async function GET() {
  return NextResponse.json({ siteKey: turnstileSiteKey() }, { headers: { "Cache-Control": "no-store" } });
}
