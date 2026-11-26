import { prisma } from "./db";

/** Account-wide custom instructions ("who should the assistant be for me"). Signed-in accounts only. */
export const MAX_CUSTOM_INSTRUCTIONS = 1500;

export interface CustomInstructionsState {
  text: string;
  enabled: boolean;
  updatedAt: string | null;
}

export const EMPTY_CUSTOM_INSTRUCTIONS: CustomInstructionsState = { text: "", enabled: true, updatedAt: null };

/**
 * Trim, drop control characters (keeps newlines and tabs), collapse runs of blank lines, and cap the length.
 * The cap counts characters after cleanup, so what the user sees in the counter is what is stored.
 */
export function normalizeCustomInstructions(raw: unknown): string {
  if (typeof raw !== "string") return "";
  // eslint-disable-next-line no-control-regex
  const cleaned = raw.replace(/\r\n?/g, "\n").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").replace(/\n{3,}/g, "\n\n").trim();
  return Array.from(cleaned).slice(0, MAX_CUSTOM_INSTRUCTIONS).join("").trim();
}

/** The text that goes into the system prompt, or null when it is off or empty. */
export function activeInstructionText(state: Pick<CustomInstructionsState, "text" | "enabled"> | null | undefined): string | null {
  if (!state || !state.enabled) return null;
  const t = normalizeCustomInstructions(state.text);
  return t ? t : null;
}

export async function getCustomInstructions(userId: string): Promise<CustomInstructionsState> {
  const row = await prisma.customInstructions.findUnique({ where: { userId } });
  if (!row) return { ...EMPTY_CUSTOM_INSTRUCTIONS };
  return { text: row.text, enabled: row.enabled, updatedAt: row.updatedAt.toISOString() };
}

export async function saveCustomInstructions(userId: string, input: { text: string; enabled: boolean }): Promise<CustomInstructionsState> {
  const text = normalizeCustomInstructions(input.text);
  const enabled = input.enabled === true;
  const row = await prisma.customInstructions.upsert({
    where: { userId },
    create: { userId, text, enabled },
    update: { text, enabled },
  });
  return { text: row.text, enabled: row.enabled, updatedAt: row.updatedAt.toISOString() };
}

export async function clearCustomInstructions(userId: string): Promise<CustomInstructionsState> {
  await prisma.customInstructions.deleteMany({ where: { userId } });
  return { ...EMPTY_CUSTOM_INSTRUCTIONS };
}

/**
 * For the chat route: the active text for this user, or null. A database hiccup must not break chat, so errors give
 * null. Only the error class name is logged, never the instruction text.
 */
export async function loadActiveInstructions(userId: string): Promise<string | null> {
  try {
    return activeInstructionText(await getCustomInstructions(userId));
  } catch (e) {
    console.error("[custom-instructions] load failed", (e as Error)?.name ?? "Error");
    return null;
  }
}
