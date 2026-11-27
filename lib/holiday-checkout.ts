import "server-only";
import type Stripe from "stripe";
import { holidayActive } from "./holiday";

/** Live promotion code id. Override with HOLIDAY_PROMO_CODE_ID, or set that var to "off". */
export const HOLIDAY_PROMO_CODE_ID_DEFAULT = "promo_1UgDyv3x58WVlPfpkqXvNB4y";

export function holidayPromoCodeId(): string | null {
  const raw = process.env.HOLIDAY_PROMO_CODE_ID;
  if (raw === undefined) return HOLIDAY_PROMO_CODE_ID_DEFAULT;
  const v = raw.trim();
  if (!v || v.toLowerCase() === "off") return null;
  return v;
}

/** Promotion code to auto-apply, or null when the window has closed or the id is turned off. */
export function holidayAutoPromo(now = Date.now()): string | null {
  if (!holidayActive(now)) return null;
  return holidayPromoCodeId();
}

type ChargeLike = { status?: string | null; paid?: boolean | null };

/**
 * Matches Stripe's `first_time_transaction` rule: no paid invoice and no succeeded charge.
 * A lookup failure should be treated as "not first-time" by the caller so checkout still opens.
 */
export async function isFirstTimeCustomer(stripe: Stripe, customerId: string): Promise<boolean> {
  const invoices = await stripe.invoices.list({ customer: customerId, status: "paid", limit: 1 });
  if (invoices.data.length > 0) return false;
  const charges = await stripe.charges.list({ customer: customerId, limit: 10 });
  const paid = charges.data.some((c: ChargeLike) => c.status === "succeeded" || c.paid === true);
  return !paid;
}
