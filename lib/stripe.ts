import "server-only";
import Stripe from "stripe";
import type { PlanId } from "./types";

/** Returns a TEST-mode Stripe client, or null when not configured. Live keys are refused by this build. */
export function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  if (!key.startsWith("sk_test_") && !key.startsWith("rk_test_")) {
    console.error("[stripe] refusing non-test key: this build only supports Stripe TEST mode");
    return null;
  }
  return new Stripe(key);
}
export function billingConfigured() {
  return !!getStripe() && !!process.env.STRIPE_PRICE_PRO && !!process.env.STRIPE_PRICE_MAX;
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
