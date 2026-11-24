import "server-only";
import { limitDurable, type RateLimitRule } from "./ratelimit";

/**
 * Daily spend guards so one account (or a rush of new ones) can't drain the shared provider key. Two layers per costly
 * feature, both durable (Postgres buckets, fail closed) and reset at 00:00 UTC (6 PM CT):
 *  - per user per day (admins skip this one),
 *  - one global ceiling per day across every account (admins count toward it and are blocked by it too).
 * Plus a 30-day global ceiling for images and video derived from PROVIDER_MONTHLY_BUDGET_USD ($20, matching the provider
 * key's monthly cap). Raise PROVIDER_MONTHLY_BUDGET_USD together with the provider cap.
 * Video also keeps its own rolling 24 h per-user clip cap and the $1.60 per-clip quote ceiling (app/api/video).
 */
const DAY = 24 * 60 * 60 * 1000;

function envInt(name: string, fallback: number): number {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : fallback;
}

export type SpendKind = "image" | "video" | "swarm";

/**
 * Monthly provider budget (USD) this deployment is sized for. Must match the spend cap on the provider key
 * (provider dashboard → API keys → limit), which is the real hard stop. 2026-11-21: set to $20/month.
 * Video may use up to half of it and Image a quarter, leaving the rest for chat; the 30-day ceilings below are
 * derived from it unless overridden with VIDEO_MAX_GLOBAL_MONTH / IMAGE_MAX_GLOBAL_MONTH.
 */
export const providerMonthlyBudgetUsd = () => {
  const n = Number(process.env.PROVIDER_MONTHLY_BUDGET_USD);
  return Number.isFinite(n) && n > 0 ? n : 20;
};
const USD_PER_CLIP = () => { const n = Number(process.env.VIDEO_MAX_USD_PER_CLIP); return Number.isFinite(n) && n > 0 ? n : 1.6; };
const USD_PER_IMAGE = 0.1;
const MONTH = 30 * DAY;

export const spendLimits = (kind: SpendKind) => {
  const budget = providerMonthlyBudgetUsd();
  if (kind === "image") return {
    perUser: envInt("IMAGE_MAX_PER_USER_DAY", 10),
    global: envInt("IMAGE_MAX_GLOBAL_DAY", 20),
    month: envInt("IMAGE_MAX_GLOBAL_MONTH", Math.floor((budget * 0.25) / USD_PER_IMAGE)),
  };
  if (kind === "video") return {
    perUser: envInt("VIDEO_MAX_PER_DAY", 2),
    global: envInt("VIDEO_MAX_GLOBAL_DAY", 2),
    month: envInt("VIDEO_MAX_GLOBAL_MONTH", Math.floor((budget * 0.5) / USD_PER_CLIP())),
  };
  return { perUser: envInt("SWARM_MAX_PER_USER_DAY", 20), global: envInt("SWARM_MAX_GLOBAL_DAY", 400), month: 0 };
};

const LABEL: Record<SpendKind, string> = { image: "images", video: "video clips", swarm: "Swarm runs" };

export type SpendBlocked = { status: 429; code: "daily_cap"; message: string; retryAfterSec?: number };

const UNAVAILABLE = (kind: SpendKind): SpendBlocked => ({ status: 429, code: "daily_cap", message: `Couldn't check today's limit for ${LABEL[kind]}. Try again in a minute.`, retryAfterSec: 30 });

/** Count one use against today's caps. null = allowed. Call right before reserving allowance. */
export async function spendGuard(kind: SpendKind, userId: string, opts: { admin?: boolean } = {}): Promise<SpendBlocked | null> {
  const lim = spendLimits(kind);
  // Per-user first, so a user who is already capped doesn't eat into everyone's global budget.
  if (!opts.admin) {
    const u: RateLimitRule = { name: `${kind}-user-day`, limit: lim.perUser, windowMs: DAY, id: userId };
    const mine = await limitDurable([u]);
    if (!mine.ok && mine.rule?.endsWith(":unavailable")) return UNAVAILABLE(kind);
    if (!mine.ok) {
      return { status: 429, code: "daily_cap", message: `You've reached today's limit of ${lim.perUser} ${LABEL[kind]}. It resets at 6 PM Central.`, retryAfterSec: mine.retryAfterSec };
    }
  }
  const g: RateLimitRule = { name: `${kind}-global-day`, limit: lim.global, windowMs: DAY, id: "all" };
  const global = await limitDurable([g]);
  if (!global.ok && global.rule?.endsWith(":unavailable")) return UNAVAILABLE(kind);
  if (!global.ok) {
    return { status: 429, code: "daily_cap", message: `Citad3L has hit today's limit for ${LABEL[kind]}. It resets at 6 PM Central. Chat still works.`, retryAfterSec: global.retryAfterSec };
  }
  if (lim.month > 0 || kind !== "swarm") {
    const m: RateLimitRule = { name: `${kind}-global-month`, limit: lim.month, windowMs: MONTH, id: "all" };
    const month = await limitDurable([m]);
    if (!month.ok && month.rule?.endsWith(":unavailable")) return UNAVAILABLE(kind);
    if (!month.ok) {
      return { status: 429, code: "daily_cap", message: `Citad3L has used this month's capacity for ${LABEL[kind]}. Chat still works.`, retryAfterSec: month.retryAfterSec };
    }
  }
  return null;
}
