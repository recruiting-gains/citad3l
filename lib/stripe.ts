import "server-only";
import Stripe from "stripe";
import type { PlanId } from "./types";
import { isAdminEmail } from "./config";

/**
 * STRIPE_MODE picks which keys this build accepts: "test" (default) takes only sk_test_/rk_test_ keys, "live" takes
 * only sk_live_/rk_live_ keys. A key from the other mode is refused, so a half-finished switch fails closed (billing
 * shows as not configured) instead of charging real cards against test prices or vice versa.
 */
export function stripeMode(): "test" | "live" {
  return (process.env.STRIPE_MODE ?? "test").trim().toLowerCase() === "live" ? "live" : "test";
}

/**
 * Returns a Stripe client for STRIPE_MODE, or null when not configured.
 * Uses the fetch HTTP client so it runs on Cloudflare Workers (no Node http module).
 */
export function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) return null;
  const mode = stripeMode();
  const ok = mode === "live" ? key.startsWith("sk_live_") || key.startsWith("rk_live_") : key.startsWith("sk_test_") || key.startsWith("rk_test_");
  if (!ok) {
    console.error(`[stripe] refusing key: STRIPE_MODE=${mode} needs a ${mode} key`);
    return null;
  }
  return new Stripe(key, { httpClient: Stripe.createFetchHttpClient(), maxNetworkRetries: 1 });
}
export function billingConfigured() {
  return !!getStripe() && !!process.env.STRIPE_PRICE_PRO && !!process.env.STRIPE_PRICE_MAX;
}

/**
 * Who may start checkout. BILLING_ENABLED:
 *  - "admins" (default): only ADMIN_EMAILS / owner. Everyone else sees "Paid plans coming soon".
 *  - "all": everyone, but only when STRIPE_MODE is "live". In test mode "all" still means admins only, so nobody can
 *    get a paid plan with a Stripe test card.
 *  - "off": nobody.
 */
export function billingMode(): "admins" | "all" | "off" {
  const v = (process.env.BILLING_ENABLED ?? "admins").trim().toLowerCase();
  return v === "all" || v === "off" ? v : "admins";
}
/** Checkout open to the public (signed-out visitors see live "Get Pro / Get Max" buttons that lead to sign-in). */
export function billingPublic(): boolean {
  return billingMode() === "all" && stripeMode() === "live";
}
export function billingOpenFor(email: string | null | undefined): boolean {
  const m = billingMode();
  if (m === "off") return false;
  if (billingPublic()) return true;
  return isAdminEmail(email);
}

/** True when a Stripe event's livemode matches STRIPE_MODE (live events on live, test events on test). */
export function webhookAcceptsEvent(livemode: boolean, mode: "test" | "live" = stripeMode()): boolean {
  return livemode === (mode === "live");
}

export function priceFor(plan: "pro" | "max") {
  return plan === "pro" ? process.env.STRIPE_PRICE_PRO : process.env.STRIPE_PRICE_MAX;
}
export function planForPrice(priceId?: string | null): PlanId | null {
  if (!priceId) return null;
  if (priceId === process.env.STRIPE_PRICE_PRO) return "pro";
  if (priceId === process.env.STRIPE_PRICE_MAX) return "max";
  return null;
}
