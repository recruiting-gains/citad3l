import "server-only";
import { prisma, dbConfigured } from "./db";
import { addChicagoDays, chicagoDateKey, chicagoMidnightUtc } from "./chicago-day";

/** Move a YYYY-MM-DD by whole Chicago calendar days. `addChicagoDays` is only safe one day forward. */
export function shiftChicagoDay(ymd: string, delta: number): string {
  let cur = ymd;
  const step = delta < 0 ? -1 : 1;
  for (let i = 0; i < Math.abs(delta); i++) {
    if (step > 0) {
      cur = addChicagoDays(cur, 1);
    } else {
      // 12 hours before Chicago midnight is always the previous calendar day, including 23h/25h DST days.
      cur = chicagoDateKey(new Date(chicagoMidnightUtc(cur).getTime() - 12 * 60 * 60 * 1000));
    }
  }
  return cur;
}
import {
  hasImagePromptBlock,
  isImagePromptPlan,
  type ImagePromptPlan,
} from "./image-prompt";

/**
 * Daily counts of replies that included an image-prompt block.
 * One row per Chicago day and plan (guest, free, pro, max). The prompt text
 * is never written, logged, or stored — only the counter moves.
 */

export type ImagePromptTotals = {
  days7: Record<ImagePromptPlan, number>;
  days30: Record<ImagePromptPlan, number>;
};

function zeros(): Record<ImagePromptPlan, number> {
  return { guest: 0, free: 0, pro: 0, max: 0 };
}

export function emptyImagePromptTotals(): ImagePromptTotals {
  return { days7: zeros(), days30: zeros() };
}

/** Sum stored rows into last-7 and last-30 Chicago-day windows, ending on `today` (YYYY-MM-DD). */
export function tallyImagePromptCounts(
  rows: { day: string; plan: string; count: number }[],
  today: string,
): ImagePromptTotals {
  const start7 = shiftChicagoDay(today, -6);
  const start30 = shiftChicagoDay(today, -29);
  const out = emptyImagePromptTotals();
  for (const row of rows) {
    if (!isImagePromptPlan(row.plan)) continue;
    if (row.day < start30 || row.day > today) continue;
    const n = Number.isFinite(row.count) ? Math.max(0, Math.floor(row.count)) : 0;
    out.days30[row.plan] += n;
    if (row.day >= start7) out.days7[row.plan] += n;
  }
  return out;
}

function dbReady(): boolean {
  try {
    return dbConfigured();
  } catch {
    return false;
  }
}

/** Increment today's counter for this plan. Never throws. Does not accept prompt text. */
export async function recordImagePromptRequest(plan: ImagePromptPlan, now = new Date()): Promise<boolean> {
  if (!isImagePromptPlan(plan) || !dbReady()) return false;
  const day = chicagoDateKey(now);
  try {
    await prisma.imagePromptCount.upsert({
      where: { day_plan: { day, plan } },
      create: { day, plan, count: 1 },
      update: { count: { increment: 1 } },
    });
    return true;
  } catch (e) {
    console.error("[image-prompt] count failed", e instanceof Error ? e.message : "error");
    return false;
  }
}

/**
 * If `text` contains an image-prompt block, increment that plan's counter for today.
 * The text is only used to decide whether a block was emitted. It is not stored.
 */
export async function noteImagePromptReply(text: string, plan: ImagePromptPlan, now = new Date()): Promise<boolean> {
  if (!hasImagePromptBlock(text)) return false;
  return recordImagePromptRequest(plan, now);
}

/** Last 7 and 30 Chicago days, by plan. Missing days are zero. */
export async function imagePromptTotals(now = new Date()): Promise<ImagePromptTotals> {
  const today = chicagoDateKey(now);
  if (!dbReady()) return emptyImagePromptTotals();
  const start = shiftChicagoDay(today, -29);
  const rows = await prisma.imagePromptCount.findMany({
    where: { day: { gte: start, lte: today } },
    select: { day: true, plan: true, count: true },
  });
  return tallyImagePromptCounts(rows, today);
}
