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
 * Plain renewal line next to paid checkout buttons.
 * First-month amounts apply only while the holiday promo is shown to that visitor.
 */
export function checkoutRenewalLine(showFirstMonth: boolean): string {
  const pro = LIST_PRICE_USD.pro;
  const max = LIST_PRICE_USD.max;
  if (showFirstMonth) {
    return `Pro: $${HOLIDAY_FIRST_MONTH.pro} first month, then $${pro}/month. Max: $${HOLIDAY_FIRST_MONTH.max} first month, then $${max}/month. Cancel anytime.`;
  }
  return `Pro: $${pro}/month. Max: $${max}/month. Cancel anytime.`;
}
