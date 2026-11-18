import { NextResponse } from "next/server";
import { requireUserId } from "@/auth";
import { prisma } from "@/lib/db";
import { jerr } from "@/lib/http";
import { getStripe } from "@/lib/stripe";
import { appUrl } from "@/lib/config";
export const dynamic = "force-dynamic";
export async function POST() {
  const userId = await requireUserId();
  if (!userId) return jerr(401, "unauthorized", "Sign in.");
  const stripe = getStripe();
  if (!stripe) return jerr(503, "billing_not_configured", "Test-mode billing not configured yet.");
  const ent = await prisma.entitlement.findUnique({ where: { userId } });
  if (!ent?.stripeCustomerId) return jerr(400, "no_customer", "No billing account yet — choose a plan first.");
  const s = await stripe.billingPortal.sessions.create({ customer: ent.stripeCustomerId, return_url: `${appUrl()}/account` });
  return NextResponse.json({ url: s.url });
}
