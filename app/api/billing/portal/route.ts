import { NextResponse } from "next/server";
import { requireUserId } from "@/auth";
import { prisma } from "@/lib/db";
import { jerr, tooMany } from "@/lib/http";
import { LIMITS, limitDurable, rule } from "@/lib/ratelimit";
import { getStripe } from "@/lib/stripe";
import { appUrl } from "@/lib/config";
export const dynamic = "force-dynamic";
export async function POST() {
  const userId = await requireUserId();
  if (!userId) return jerr(401, "unauthorized", "Sign in.");
  const lim = await limitDurable([rule(LIMITS.billingUser10m, userId)]);
  if (!lim.ok) return tooMany("Too many billing requests. Try again in a few minutes.", lim.retryAfterSec);
  const stripe = getStripe();
  if (!stripe) return jerr(503, "billing_not_configured", "Billing isn't configured yet.");
  const ent = await prisma.entitlement.findUnique({ where: { userId } });
  if (!ent?.stripeCustomerId) return jerr(400, "no_customer", "No billing account yet — choose a plan first.");
  const s = await stripe.billingPortal.sessions.create({ customer: ent.stripeCustomerId, return_url: `${appUrl()}/account/billing` });
  return NextResponse.json({ url: s.url });
}
