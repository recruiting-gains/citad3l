/** Holiday promo window. Jan 31, 2027 11:59:59 PM America/Chicago (CST, UTC−6). */

/** Stripe `redeem_by` / `expires_at` for HOLIDAY50: 1801461599. */
export const HOLIDAY_ENDS_AT_UNIX = 1801461599;

export const HOLIDAY_CODE = "HOLIDAY50";

export const HOLIDAY_HEADLINE_LEAD = "AI for all.";
export const HOLIDAY_HEADLINE_REST = "Privacy comes with it.";

/** Eligibility, discount, and end date. Amounts live in the ledger. */
export const HOLIDAY_BODY_BEFORE = "Holiday deal: new signups get ";
export const HOLIDAY_BODY_STRONG = "50% off your first month";
export const HOLIDAY_BODY_AFTER = " through January 31, 2027.";
/** Desktop only. Hidden on small screens so prices are not listed twice. */
export const HOLIDAY_BODY_PRICES = "Pro $10, then $20. Max $25, then $50.";

export const HOLIDAY_CODE_BEFORE = "Use code ";
export const HOLIDAY_CODE_AFTER = " at checkout if it is not already applied.";

export const HOLIDAY_FIRST_MONTH = { pro: 10, max: 25 } as const;

/** True through the last second of the promo, including that second. */
export function holidayActive(now = Date.now()): boolean {
  return Math.floor(now / 1000) <= HOLIDAY_ENDS_AT_UNIX;
}

/** Ongoing list price stays $20 / $50. Kept in sync with planCatalog(). */
export const LIST_PRICE_USD = { pro: 20, max: 50 } as const;

/** Ongoing list price stays $20 / $50. This line is the first-month overlay. */
export function holidayPriceLine(plan: "pro" | "max"): string {
  const first = HOLIDAY_FIRST_MONTH[plan];
  const then = LIST_PRICE_USD[plan];
  return `First month $${first}, then $${then} per month`;
}

/**
 * First-month prices are for people who have never paid us.
 * Current Pro/Max (including a referral month) and anyone whose subscription was canceled or went past due
 * have subscribed before, so they do not see the intro line. Guests and free accounts do.
 * Checkout applies HOLIDAY50 itself for a first-time Stripe customer; they do not type the code.
 */
export function holidayIntroEligible(input?: { plan?: string | null; status?: string | null } | null): boolean {
  if (!input) return true;
  if (input.plan === "pro" || input.plan === "max") return false;
  if (input.status === "canceled" || input.status === "past_due") return false;
  return true;
}

/** One line for one plan card. Checkout auto-applies HOLIDAY50 for a first-time buyer. */
export function checkoutRenewalLine(plan: "pro" | "max", showFirstMonth: boolean): string {
  const then = LIST_PRICE_USD[plan];
  const label = plan === "pro" ? "Pro" : "Max";
  if (showFirstMonth) {
    return `First-time buyers: ${label} $${HOLIDAY_FIRST_MONTH[plan]} first month, then $${then}/month.`;
  }
  return `${label}: $${then}/month. Cancel anytime.`;
}
