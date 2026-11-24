import Stripe from "stripe";
import { NextResponse } from "next/server";
import { applyStripeEvent } from "@/lib/billing";
import { BodyTooLarge, readTextLimited } from "@/lib/http";
import { webhookAcceptsEvent, stripeMode } from "@/lib/stripe";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "webhook_not_configured" }, { status: 503 });
  const sig = req.headers.get("stripe-signature");
  if (!sig) return NextResponse.json({ error: "missing_signature" }, { status: 400 });
  // Stripe events are small; cap the raw body at 1 MB, counted while streaming.
  let raw: string;
  try {
    raw = await readTextLimited(req, 1_000_000);
  } catch (e) {
    if (e instanceof BodyTooLarge) return NextResponse.json({ error: "too_large" }, { status: 413 });
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  let event: Stripe.Event;
  try {
    // Async + SubtleCrypto so verification works on Cloudflare Workers; needs only the signing secret.
    event = await Stripe.webhooks.constructEventAsync(raw, sig, secret, undefined, Stripe.createSubtleCryptoProvider());
  } catch {
    return NextResponse.json({ error: "invalid_signature" }, { status: 400 });
  }
  // Accept events that match STRIPE_MODE; refuse the other mode so a live endpoint never skips
  // live events (the previous live_mode_refused gate blocked every production webhook).
  if (!webhookAcceptsEvent(event.livemode)) {
    const error = stripeMode() === "live" ? "test_mode_refused" : "live_mode_refused";
    return NextResponse.json({ error }, { status: 400 });
  }
  try {
    const result = await applyStripeEvent(event);
    return NextResponse.json({ received: true, result });
  } catch {
    console.error("[stripe] handler failed for", event.type, event.id);
    return NextResponse.json({ error: "handler_failed" }, { status: 500 });
  }
}
