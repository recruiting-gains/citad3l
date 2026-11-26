/** Client-safe usage labels for the composer (no server imports). */

import type { UsageSummary } from "./types";

export type ComposerUsageMode = "chat" | "image" | "video";

function freeResetPhrase(): string {
  return "midnight Central";
}

function chatLine(usage: UsageSummary): string {
  if (usage.unlimited) return "Unlimited";
  if (usage.guest) {
    return `${usage.remaining} of ${usage.limit} free messages left`;
  }
  if (usage.plan === "trial") {
    if (usage.remaining <= 0) {
      return `You've used today's ${usage.limit} free messages. More at ${freeResetPhrase()}`;
    }
    return `${usage.remaining} of ${usage.limit} free messages left today · resets at ${freeResetPhrase()}`;
  }
  if (usage.window && usage.week) {
    return `${usage.window.remaining.toLocaleString()} of ${usage.window.limit.toLocaleString()} left this 5-hour window · ${usage.week.remaining.toLocaleString()} of ${usage.week.limit.toLocaleString()} left this week`;
  }
  return `${usage.remaining.toLocaleString()} of ${usage.limit.toLocaleString()} ${usage.unitLabel} left`;
}

/** Short chat remainder, or empty when unlimited / unknown. */
function chatShort(usage: UsageSummary): string {
  if (usage.unlimited) return "";
  if (usage.guest) {
    return `${usage.remaining} of ${usage.limit} free messages left`;
  }
  if (usage.plan === "trial") {
    if (usage.remaining <= 0) return `You've used today's ${usage.limit} free messages`;
    return `${usage.remaining} of ${usage.limit} free messages left today`;
  }
  if (usage.window) {
    return `${usage.window.remaining.toLocaleString()} of ${usage.window.limit.toLocaleString()} replies left this window`;
  }
  return `${usage.remaining.toLocaleString()} of ${usage.limit.toLocaleString()} ${usage.unitLabel} left`;
}

/** Line shown beside Send, using the real caps already loaded from /api/usage. */
export function usageLine(usage: UsageSummary, opts: { mode: ComposerUsageMode; swarm?: boolean } = { mode: "chat" }): string {
  if (opts.mode === "image") {
    const parts: string[] = [];
    if (usage.image) {
      parts.push(`${usage.image.remaining.toLocaleString()} of ${usage.image.limit.toLocaleString()} images left today`);
    }
    const chat = chatShort(usage);
    if (chat) parts.push(chat);
    return parts.join(" · ") || "Image uses 1 reply of your allowance";
  }
  if (opts.mode === "video") {
    const parts: string[] = [];
    if (usage.video) {
      parts.push(`${usage.video.remaining.toLocaleString()} of ${usage.video.limit.toLocaleString()} clips left today`);
    }
    const chat = chatShort(usage);
    if (chat) parts.push(chat);
    return parts.join(" · ") || "Video uses 1 reply of your allowance";
  }
  let line = chatLine(usage);
  if (opts.swarm && !usage.unlimited) {
    const cost = usage.swarmUnits ?? 4;
    line += ` · Swarm uses ${cost}`;
  }
  return line;
}

/** True when the next send would be rejected for allowance or the daily media cap. */
export function relevantLimitHit(usage: UsageSummary, opts: { mode: ComposerUsageMode; swarm?: boolean } = { mode: "chat" }): boolean {
  if (usage.unlimited) return false;
  const cost = opts.mode === "chat" && opts.swarm ? (usage.swarmUnits ?? 4) : 1;
  if (usage.remaining < cost) return true;
  if (opts.mode === "image" && usage.image && usage.image.remaining <= 0) return true;
  if (opts.mode === "video" && usage.video && usage.video.remaining <= 0) return true;
  return false;
}
