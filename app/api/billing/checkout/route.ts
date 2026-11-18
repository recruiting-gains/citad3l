import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId } from "@/auth";
import { prisma } from "@/lib/db";
import { jerr } from "@/lib/http";
import { getStripe, priceFor } from "@/lib/stripe";
import { appUrl } from "@/lib/config";
import { ensureEntitlement } from "@/lib/usage";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const userId = await requireUserId();
  if (!userId) return jerr(401, "unauthorized", "Sign in.");
  const parsed = z.object({ plan: z.enum(["pro", "max"]) }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jerr(400, "bad_request", "Unknown plan.");
  const stripe = getStripe();
  const price = priceFor(parsed.data.plan);
  if (!stripe || !price) return jerr(503, "billing_not_configured", "Test-mode billing not configured yet.");
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const ent = await ensureEntitlement(userId);
  if (ent.stripeSubscriptionId && ent.status === "active") return jerr(409, "already_subscribed", "You already have a subscription — use Manage billing to change plans.");
  let customer = ent.stripeCustomerId;
  if (!customer) {
    const c = await stripe.customers.create({ email: user.email ?? undefined, metadata: { userId } });
    customer = c.id;
    await prisma.entitlement.update({ where: { userId }, data: { stripeCustomerId: customer } });
  }
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer,
    client_reference_id: userId,
    line_items: [{ price, quantity: 1 }],
    metadata: { userId, plan: parsed.data.plan },
    subscription_data: { metadata: { userId, plan: parsed.data.plan } },
    success_url: `${appUrl()}/account?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl()}/pricing?checkout=canceled`,
  });
  return NextResponse.json({ url: session.url });
}
