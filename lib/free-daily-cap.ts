import "server-only";
import { FREE_DAILY_GLOBAL_CAP, FREE_DAILY_REPLIES } from "./config";
import { chicagoDayWindow } from "./chicago-day";
import { limitDurable, peekDurable, type RateLimitRule } from "./ratelimit";

/** Distinct bucket name so this never collides with guest or media caps in the shared RateLimitBucket table. */
export const FREE_DAILY_GLOBAL_BUCKET = "free-daily-global-chicago";

export function freeDailyPaused(): boolean {
  return FREE_DAILY_REPLIES <= 0 || FREE_DAILY_GLOBAL_CAP <= 0;
}

export function freeDailyGlobalRule(now = new Date()): RateLimitRule {
  const day = chicagoDayWindow(now);
  return {
    name: FREE_DAILY_GLOBAL_BUCKET,
    id: "all",
    limit: FREE_DAILY_GLOBAL_CAP,
    windowMs: Math.max(1, day.end.getTime() - day.start.getTime()),
    windowStartMs: day.start.getTime(),
  };
}

export type FreeDailyBlocked = { code: "daily_cap"; message: string; retryAfterSec?: number };

/**
 * Count one attempted Free-account daily message against the site-wide Chicago-day ceiling.
 * Fail closed if the counter cannot be read. null = allowed.
 */
export async function freeDailyGlobalGuard(now = new Date()): Promise<FreeDailyBlocked | null> {
  if (FREE_DAILY_REPLIES <= 0 || FREE_DAILY_GLOBAL_CAP <= 0) {
    return { code: "daily_cap", message: "Free daily messages are paused right now. See plans to keep chatting." };
  }
  const hit = await limitDurable([freeDailyGlobalRule(now)], { nowMs: now.getTime(), onDbError: "closed" });
  if (hit.ok) return null;
  if (hit.rule?.endsWith(":unavailable")) {
    return { code: "daily_cap", message: "Couldn't check today's free-message limit. Try again in a minute.", retryAfterSec: 30 };
  }
  return {
    code: "daily_cap",
    message: "Citad3L has hit today's free-message cap. It resets at midnight Central. Pro and Max are unaffected.",
    retryAfterSec: hit.retryAfterSec,
  };
}

/** Read today's global used count without incrementing. null if unreadable. */
export async function freeDailyGlobalPeek(now = new Date()): Promise<number | null> {
  return peekDurable(freeDailyGlobalRule(now), now.getTime());
}
