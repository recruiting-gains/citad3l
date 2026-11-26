import type { PlanId } from "./types";

function envInt(name: string, fallback: number): number {
  const n = Number(process.env[name] ?? fallback);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

/** Central, env-configurable plan + limit settings. Paid allowances MUST be load-tested before sale. */
export const TRIAL_REPLIES = 5;
/** Guest (signed-out) one-time allowance. Kept as an alias of TRIAL_REPLIES. */
export const FREE_MESSAGES = TRIAL_REPLIES;

/**
 * Signed-in Free accounts: successful replies per America/Chicago calendar day, shared across Fast and Private.
 * Override with FREE_DAILY_REPLIES. Set to 0 to pause the daily allowance (kill switch, with FREE_DAILY_GLOBAL_CAP).
 */
export const FREE_DAILY_REPLIES = Math.max(0, Number(process.env.FREE_DAILY_REPLIES ?? 3) || 0);

/**
 * Site-wide ceiling on attempted Free-account daily messages (every free user combined) per Chicago day.
 * Kill switch: set FREE_DAILY_GLOBAL_CAP=0 to pause free daily chat for everyone.
 * Default 2500 is generous (~$50/day at the $0.02/reply admin estimate) and can be raised in wrangler vars.
 */
export const FREE_DAILY_GLOBAL_CAP = Math.max(0, Number(process.env.FREE_DAILY_GLOBAL_CAP ?? 2500) || 0);

/** Admin/planning estimate only, matching lib/admin.ts. Not a provider invoice. */
export const FREE_DAILY_USD_PER_REPLY = 0.02;

/** Owner email lives only here. Everywhere else must call ownerEmail() / isOwnerEmail(). */
export function ownerEmail(): string {
  // Set as a Worker secret (CITAD3L_OWNER_EMAIL), never in the repo. Unset -> no owner (owner-only tools stay off).
  return (process.env.CITAD3L_OWNER_EMAIL || process.env.OWNER_EMAIL || "").trim().toLowerCase();
}

export function isOwnerEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return email.trim().toLowerCase() === ownerEmail();
}

/**
 * Admin emails (comma-separated ADMIN_EMAILS). The owner is always included,
 * even if someone leaves them off the list. Matching is trimmed and case-insensitive.
 */
export function adminEmails(): string[] {
  const listed = (process.env.CITAD3L_ADMIN_EMAILS || process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return Array.from(new Set([ownerEmail(), ...listed].filter(Boolean)));
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return adminEmails().includes(email.trim().toLowerCase());
}

/**
 * Emails allowed to use web search inside Swarm. Everyone else keeps Swarm search off.
 * Set as a Worker var (SWARM_WEB_SEARCH_EMAILS, comma-separated). Empty / unset = no one (current default).
 * Do not put the owner or other admins here unless Cruz asks — this is for Chief of Staff / Media bot runs only.
 */
export function swarmWebSearchEmails(): string[] {
  return (process.env.SWARM_WEB_SEARCH_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function canUseSwarmWebSearch(email: string | null | undefined): boolean {
  if (!email) return false;
  return swarmWebSearchEmails().includes(email.trim().toLowerCase());
}

/** 5-hour refresh window for paid plans. */
export function usageWindowMs(): number {
  return envInt("USAGE_WINDOW_MS", 5 * 60 * 60 * 1000);
}
/** Weekly cap for paid plans. */
export function usageWeekMs(): number {
  return envInt("USAGE_WEEK_MS", 7 * 24 * 60 * 60 * 1000);
}

export function proWindowUnits(): number {
  return envInt("PRO_WINDOW_UNITS", 25);
}
export function proWeeklyUnits(): number {
  return envInt("PRO_WEEKLY_UNITS", 150);
}
export function maxWindowUnits(): number {
  return Math.floor(proWindowUnits() * 2.5);
}
export function maxWeeklyUnits(): number {
  return Math.floor(proWeeklyUnits() * 2.5);
}

/** @deprecated Monthly pool replaced by a 5-hour window + weekly cap. Kept as an alias of the weekly cap. */
export function proUnits(): number {
  return proWeeklyUnits();
}
export function maxUnits(): number {
  return maxWeeklyUnits();
}
export function planLimit(plan: PlanId): number {
  if (plan === "pro") return proWeeklyUnits();
  if (plan === "max") return maxWeeklyUnits();
  return TRIAL_REPLIES;
}
export function planWindowLimit(plan: PlanId): number {
  if (plan === "pro") return proWindowUnits();
  if (plan === "max") return maxWindowUnits();
  return TRIAL_REPLIES;
}
export const PLAN_PRICE_USD: Record<PlanId, number> = { trial: 0, pro: 20, max: 50 };
export const UNIT_LABEL = "replies";
export const MAX_MESSAGE_CHARS = 8000;
export const GUEST_MAX_MESSAGE_CHARS = 2000;
export const GUEST_HISTORY_CHAR_BUDGET = 6000;
/** Guests get short replies on Fast only (no web search, thinking, Image, Video, Private or Swarm). */
export const GUEST_MAX_TOKENS = 512;
/** The only model guests can use (home page try box and signed-out /chat). */
export const GUEST_MODEL_ID = "citad3l-fast";
/**
 * Global guest budget: successful-or-attempted guest replies across ALL visitors per UTC day. Stops bots from
 * burning inference credit. At ~512 output tokens on Fast this is well under $1/day. Override with GUEST_GLOBAL_DAILY_CAP.
 */
export const GUEST_GLOBAL_DAILY_CAP = Math.max(0, Number(process.env.GUEST_GLOBAL_DAILY_CAP ?? 300) || 0);
/** Kill switch: GUEST_CHAT=off turns signed-out chat off everywhere (the try box then asks for an email). */
export function guestChatEnabled(): boolean {
  return (process.env.GUEST_CHAT ?? "on").toLowerCase() !== "off" && GUEST_GLOBAL_DAILY_CAP > 0;
}
export const GUEST_COOKIE = "citad3l_guest";
/** Successful guest completions per IP per 24h (cookie is still capped at 5). Slack for shared NATs. */
export const GUEST_IP_DAILY_CAP = 8;
export const MAX_PROJECT_INSTRUCTIONS = 4000;
export const MAX_SYSTEM_PROMPT = 4000;
export const DEFAULT_MAX_TOKENS = 4096;
export const MAX_SETTINGS_TOKENS = 8192;
export const MAX_AUTO_CONTINUATIONS = 3;
export const MAX_CONCURRENT_STREAMS_PER_USER = Number(process.env.MAX_CONCURRENT_STREAMS_PER_USER ?? 2);
export const RATE_LIMIT_PER_MINUTE = Number(process.env.RATE_LIMIT_PER_MINUTE ?? 20);
export const GUEST_RATE_LIMIT_PER_MINUTE = Number(process.env.GUEST_RATE_LIMIT_PER_MINUTE ?? 10);
export const HISTORY_CHAR_BUDGET = 48000; // room for an attached document (≤ 40K chars) plus recent turns
/** Swarm: V1 plans, Fast runs up to this many subtasks in parallel, V1 synthesizes. */
export const SWARM_MAX_WORKERS = 3;
/** 1 plan + up to 3 workers; V1 synthesis is included in this cap. */
export const SWARM_UNITS = 1 + SWARM_MAX_WORKERS;
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
