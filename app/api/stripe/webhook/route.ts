import Stripe from "stripe";
import { NextResponse } from "next/server";
import { applyStripeEvent } from "@/lib/billing";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "webhook_not_configured" }, { status: 503 });
  const sig = req.headers.get("stripe-signature");
  if (!sig) return NextResponse.json({ error: "missing_signature" }, { status: 400 });
  const raw = await req.text();
  let event: Stripe.Event;
  try {
    // constructEvent only needs the signing secret; no API key or network access required.
    event = Stripe.webhooks.constructEvent(raw, sig, secret);
  } catch {
    return NextResponse.json({ error: "invalid_signature" }, { status: 400 });
  }
  if (event.livemode) return NextResponse.json({ error: "live_mode_refused" }, { status: 400 });
  try {
    const result = await applyStripeEvent(event);
    return NextResponse.json({ received: true, result });
  } catch {
    console.error("[stripe] handler failed for", event.type, event.id);
    return NextResponse.json({ error: "handler_failed" }, { status: 500 });
  }
}
