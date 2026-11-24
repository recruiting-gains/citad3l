import "server-only";
import { ownerEmail } from "./config";
import type { PublicModel } from "./models";

/**
 * Citad3L Hermes (owner-only agent with persistent memory), proxied by the Worker to a private Hermes Agent API
 * server. The upstream URL and key live only in Worker secrets (HERMES_URL, HERMES_API_KEY); the browser never sees
 * them. Who may use it: HERMES_ALLOWED_EMAILS (comma list), default = the owner only (not every admin).
 */
export const HERMES_MODEL_ID = "citad3l-hermes";

export const HERMES_MODEL: PublicModel = {
  id: HERMES_MODEL_ID,
  name: "Citad3L Hermes",
  description: "Your personal agent with long-term memory and skills.",
  modality: "agent",
  supportsVision: false,
  role: "Personal agent",
  summary: "Remembers you across chats and learns skills over time. Only you can see it.",
  specs: ["Agent", "Memory", "Skills"],
  art: "ai",
  context: "128K",
  speed: "Standard",
  usageDots: 3,
  skills: { webSearch: false, thinking: false, coding: false },
};

export function hermesAllowedEmails(): string[] {
  const listed = (process.env.HERMES_ALLOWED_EMAILS ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  return listed.length ? Array.from(new Set(listed)) : [ownerEmail()];
}

export function isHermesEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return hermesAllowedEmails().includes(email.trim().toLowerCase());
}

import { HERMES_BRAINS, HERMES_BRAIN_KEYS, type HermesBrain } from "./hermes-brains";
export { HERMES_BRAINS, HERMES_BRAIN_KEYS, type HermesBrain };

const SLASH = new RegExp(`^\\/(${HERMES_BRAIN_KEYS.join("|")})\\b\\s*`, "i");

/** "/sol …", "/astra …", "/fast …" etc. at the start of a message picks that brain for this turn. */
export function pickBrain(message: string, chosen: string | null | undefined): { brain: HermesBrain; text: string } {
  const m = SLASH.exec(message);
  if (m) return { brain: m[1].toLowerCase() as HermesBrain, text: message.slice(m[0].length) };
  const b = (chosen ?? "v1").toLowerCase();
  return { brain: (b in HERMES_BRAINS ? b : "v1") as HermesBrain, text: message };
}

export function hermesConfig(): { url: string; key: string } | null {
  const url = process.env.HERMES_URL?.trim().replace(/\/+$/, "");
  const key = process.env.HERMES_API_KEY?.trim();
  if (!url || !key || !/^https:\/\//.test(url)) return null;
  return { url, key };
}

const envInt = (n: string, d: number) => { const v = Number(process.env[n]); return Number.isFinite(v) && v > 0 ? Math.floor(v) : d; };
/** Spend guards: the model key has a $20/month cap (2026-11-21) shared with all of Citad3L. */
export const hermesMaxPerDay = () => envInt("HERMES_MAX_PER_DAY", 60);
export const hermesPremiumPerDay = () => envInt("HERMES_PREMIUM_PER_DAY", 10);

export const HERMES_TITLE_PREFIX = "Hermes · ";

/** Parse one SSE data payload from Hermes' /v1/chat/completions stream. */
export function parseHermesChunk(data: string): { text?: string; tool?: string; done?: boolean } {
  if (data === "[DONE]") return { done: true };
  try {
    const j = JSON.parse(data) as { object?: string; choices?: { delta?: { content?: string } }[]; tool?: string; name?: string };
    if (j.object === "hermes.tool.progress" || j.tool) return { tool: String(j.tool ?? j.name ?? "tool") };
    const t = j.choices?.[0]?.delta?.content;
    return typeof t === "string" && t ? { text: t } : {};
  } catch {
    return {};
  }
}

/** Plain-words status for a tool name (no internals shown). */
export function toolStatus(tool: string): string {
  if (/memory/i.test(tool)) return "Updating memory…";
  if (/skill/i.test(tool)) return "Using a skill…";
  if (/todo/i.test(tool)) return "Planning…";
  if (/^(app_logs|app_status|fly_apps)$/.test(tool)) return "Checking Fly…";
  if (/^(deploy_script|app_control|app_secret|confirm_action)$/.test(tool)) return "Working on Fly…";
  if (/telegram/i.test(tool)) return "Telegram…";
  return "Working…";
}
