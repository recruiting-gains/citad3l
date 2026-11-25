import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId } from "@/auth";
import { prisma } from "@/lib/db";
import { pickOpenSubscription, subscriptionItemAndPrice } from "@/lib/billing";
import { BodyTooLarge, jerr, readJsonLimited, tooMany } from "@/lib/http";
import { LIMITS, limitDurable, rule } from "@/lib/ratelimit";
import { billingOpenFor, getStripe, planForPrice, priceFor } from "@/lib/stripe";
import { appUrl } from "@/lib/config";
import { ensureEntitlement } from "@/lib/usage";
import { readUtmCookieHeader, utmMetadata } from "@/lib/utm";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const userId = await requireUserId();
  if (!userId) return jerr(401, "unauthorized", "Sign in.");
  const lim = await limitDurable([rule(LIMITS.billingUser10m, userId)]);
  if (!lim.ok) return tooMany("Too many checkout attempts. Try again in a few minutes.", lim.retryAfterSec);
  let raw: unknown = null;
  try { raw = await readJsonLimited(req, 1_024); }
  catch (e) { if (e instanceof BodyTooLarge) return jerr(413, "too_large", "Request too large."); }
  const parsed = z.object({ plan: z.enum(["pro", "max"]) }).safeParse(raw);
  if (!parsed.success) return jerr(400, "bad_request", "Unknown plan.");
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (!billingOpenFor(user.email)) return jerr(403, "billing_coming_soon", "Paid plans are coming soon. Join early access to hear first.");
  const stripe = getStripe();
  const price = priceFor(parsed.data.plan);
  if (!stripe || !price) return jerr(503, "billing_not_configured", "Billing isn't configured yet.");
  const ent = await ensureEntitlement(userId);
  let customer = ent.stripeCustomerId;
  if (!customer) {
    // Reuse a Stripe customer with the same email (and our userId) if one exists, else create it.
    const found = user.email ? await stripe.customers.list({ email: user.email, limit: 10 }) : null;
    const match = found?.data.find((c) => !c.deleted && (c.metadata?.userId === userId || !c.metadata?.userId));
    const c = match ?? (await stripe.customers.create({ email: user.email ?? undefined, metadata: { userId } }));
    customer = c.id;
    await prisma.entitlement.update({ where: { userId }, data: { stripeCustomerId: customer } });
  }
  // Never open a second subscription. If they already have one, swap the price in place (or refuse a same-plan checkout).
  const listed = await stripe.subscriptions.list({ customer, status: "all", limit: 100 });
  const existing = pickOpenSubscription(listed.data, ent.stripeSubscriptionId);
  if (existing) {
    const { itemId, priceId } = subscriptionItemAndPrice(existing);
    const currentPlan = planForPrice(priceId);
    if (currentPlan === parsed.data.plan) {
      return jerr(409, "already_subscribed", "You already have this plan — use Manage billing to make changes.");
    }
    if (!itemId) {
      return jerr(409, "already_subscribed", "You already have a subscription — use Manage billing to change plans.");
    }
    await stripe.subscriptions.update(existing.id, {
      items: [{ id: itemId, price }],
      proration_behavior: "create_prorations",
      cancel_at_period_end: false,
      metadata: { userId, plan: parsed.data.plan },
    });
    return NextResponse.json({ url: `${appUrl()}/account/billing?checkout=success` });
  }
  const utmMeta = utmMetadata(readUtmCookieHeader(req.headers.get("cookie")));
  const meta = { userId, plan: parsed.data.plan, ...utmMeta };
  console.info("[funnel]", JSON.stringify({ event: "checkout_started", plan: parsed.data.plan, ...utmMeta }));
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer,
    client_reference_id: userId,
    line_items: [{ price, quantity: 1 }],
    metadata: meta,
    subscription_data: { metadata: meta },
    success_url: `${appUrl()}/account/billing?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl()}/pricing?checkout=canceled`,
  });
  return NextResponse.json({ url: session.url });
}
