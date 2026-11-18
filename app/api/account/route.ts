import { NextResponse } from "next/server";
import { requireUserId } from "@/auth";
import { prisma } from "@/lib/db";
import { jerr } from "@/lib/http";
import { getStripe } from "@/lib/stripe";
export const dynamic = "force-dynamic";

/** Deletes the account and all owned data (cascade). Cancels any Stripe subscription first when billing is configured. */
export async function DELETE() {
  const userId = await requireUserId();
  if (!userId) return jerr(401, "unauthorized", "Sign in.");
  const ent = await prisma.entitlement.findUnique({ where: { userId } });
  const stripe = getStripe();
  if (stripe && ent?.stripeSubscriptionId) {
    try { await stripe.subscriptions.cancel(ent.stripeSubscriptionId); } catch { return jerr(502, "billing_error", "Could not cancel your subscription; try again or use Manage billing."); }
  }
  await prisma.user.delete({ where: { id: userId } });
  return NextResponse.json({ ok: true });
}
