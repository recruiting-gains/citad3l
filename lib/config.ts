import type { PlanId } from "./types";

/** Central, env-configurable plan + limit settings. Paid allowances MUST be load-tested before sale. */
export const TRIAL_REPLIES = 5;
export function proUnits(): number {
  const n = Number(process.env.PRO_MONTHLY_UNITS ?? 600);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 600;
}
export function maxUnits(): number {
  // Max = 2.5x Pro allowance
  return Math.floor(proUnits() * 2.5);
}
export function planLimit(plan: PlanId): number {
  if (plan === "pro") return proUnits();
  if (plan === "max") return maxUnits();
  return TRIAL_REPLIES;
}
export const PLAN_PRICE_USD: Record<PlanId, number> = { trial: 0, pro: 20, max: 50 };
export const UNIT_LABEL = "replies";
export const MAX_MESSAGE_CHARS = 8000;
export const MAX_PROJECT_INSTRUCTIONS = 4000;
export const MAX_CONCURRENT_STREAMS_PER_USER = Number(process.env.MAX_CONCURRENT_STREAMS_PER_USER ?? 2);
export const RATE_LIMIT_PER_MINUTE = Number(process.env.RATE_LIMIT_PER_MINUTE ?? 20);
export const HISTORY_CHAR_BUDGET = 24000;
/** Reservations older than this are considered abandoned (crashed process) and released. */
export const STALE_RESERVATION_MS = 10 * 60 * 1000;

export function isProd() {
  return process.env.NODE_ENV === "production";
}
export function demoLoginEnabled(): boolean {
  return !isProd() && process.env.DEMO_LOGIN_ENABLED === "true";
}
export function appUrl(): string {
  return (process.env.APP_URL ?? "http://localhost:3210").replace(/\/$/, "");
}
