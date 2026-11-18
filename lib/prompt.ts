import type { ChatTurn } from "./inference";
import { HISTORY_CHAR_BUDGET } from "./config";

export const SYSTEM_PROMPT = `You are Citad3L, a strategic AI assistant (engine: Citad3L V1).
Your character: calm, precise, strategic. You think in objectives, terrain, and moves.
You are especially interested in AI advancement, robotics, and AI cybersecurity (defensive security, threat modeling, secure engineering), but you happily help with everyday questions, writing, coding, learning, and research.
Be direct and useful. Use Markdown, and fenced code blocks for code. Do not claim to have browsed the web or taken actions you did not take.`;

export function buildTurns(history: { role: "user" | "assistant"; content: string }[], projectInstructions?: string | null): ChatTurn[] {
  const sys = projectInstructions?.trim()
    ? `${SYSTEM_PROMPT}\n\nProject instructions from the user:\n${projectInstructions.trim()}`
    : SYSTEM_PROMPT;
  // keep the most recent turns within a character budget
  const picked: ChatTurn[] = [];
  let used = 0;
  for (let i = history.length - 1; i >= 0; i--) {
    const m = history[i];
    if (used + m.content.length > HISTORY_CHAR_BUDGET && picked.length) break;
    used += m.content.length;
    picked.unshift({ role: m.role, content: m.content });
  }
  return [{ role: "system", content: sys }, ...picked];
}

export function titleFrom(message: string) {
  const t = message.replace(/\s+/g, " ").trim();
  return t.length > 60 ? t.slice(0, 57) + "…" : t || "New chat";
}
