/** America/Chicago calendar days, DST-safe. Free daily allowances reset at midnight Central. */

export const CHICAGO_TZ = "America/Chicago";

/** YYYY-MM-DD in America/Chicago. */
export function chicagoDateKey(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: CHICAGO_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/**
 * UTC instant of 00:00 America/Chicago on the given YYYY-MM-DD.
 * Checks UTC-6 (CST) and UTC-5 (CDT) and picks the one that is actually midnight in Chicago.
 */
export function chicagoMidnightUtc(ymd: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) throw new Error(`Invalid date key: ${ymd}`);
  for (const offsetH of [6, 5]) {
    const candidate = new Date(`${ymd}T${String(offsetH).padStart(2, "0")}:00:00.000Z`);
    if (chicagoDateKey(candidate) === ymd && chicagoDateKey(new Date(candidate.getTime() - 1)) !== ymd) {
      return candidate;
    }
  }
  throw new Error(`Could not resolve Chicago midnight for ${ymd}`);
}

export function addChicagoDays(ymd: string, days: number): string {
  const start = chicagoMidnightUtc(ymd);
  // 36h later is always the next calendar day, even across a 23h DST spring-forward.
  return chicagoDateKey(new Date(start.getTime() + days * 36 * 60 * 60 * 1000));
}

export type ChicagoDayWindow = { start: Date; end: Date; key: string };

/** Inclusive start / exclusive end of the America/Chicago calendar day containing `now`. */
export function chicagoDayWindow(now = new Date()): ChicagoDayWindow {
  const key = chicagoDateKey(now);
  const start = chicagoMidnightUtc(key);
  const end = chicagoMidnightUtc(addChicagoDays(key, 1));
  return { start, end, key };
}

/** Short user-facing reset phrase. Always midnight Central; include the weekday when useful. */
export function midnightCentralLabel(resetAt?: Date | string | null): string {
  if (!resetAt) return "midnight Central";
  const d = typeof resetAt === "string" ? new Date(resetAt) : resetAt;
  if (Number.isNaN(d.getTime())) return "midnight Central";
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone: CHICAGO_TZ, weekday: "short" }).format(d);
  return `midnight Central (${weekday})`;
}
