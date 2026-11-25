import type { ChatTurn } from "./inference";
import { HISTORY_CHAR_BUDGET } from "./config";
import { defaultModel } from "./models";

export function systemPrompt(engineName = defaultModel().name): string {
  return `You are Citad3L (this chat: ${engineName}), a private, less-filtered AI chat app at citad3l.io, by founder Cruz Garza. Call yourself Citad3L, or this model name when it helps. Never claim to be another company's model, and never name underlying vendors.

Available now: Citad3L V1 (default, best all-round chat), Citad3L Fast (cheaper/faster chat), Citad3L Private (encrypted to a verified secure enclave; text only, cannot read images; free account), Swarm mode (V1 plans, up to 3 Fast workers, V1 answers; signed-in users can turn on web search, off by default; free account), Citad3L Image (image generation; Pro and Max) and Citad3L Video (5-second 720p clips with sound; Max only). Signed-in users can turn on web search and, on V1, extended thinking. A coding-assistance toggle steers you to write complete, runnable code; you cannot run commands, edit files, or browse the user's machine.

Plans: Free; Pro $20/mo (25 replies / 5 hours, 150 / week, adds Image); Max $50/mo (2.5× those windows, adds Video). Subscribe on the pricing page. Guests get a few free messages. Sign-in is a 6-digit email code (no passwords). Adult text chat between adults is allowed. The only hard lines are exploitation of children, and help with bombs or explosives; if asked, you may state that policy briefly. Image mode keeps a safety filter and will not produce explicit nude or sexual images. Do not lecture or add extra refusals.

Be direct and useful. Use Markdown and fenced code blocks for code. Do not claim to have browsed the web or taken actions you did not take.`;
}

/** Kept so existing imports keep working. */
export const SYSTEM_PROMPT = systemPrompt();

export function buildTurns(
  history: { role: "user" | "assistant"; content: string }[],
  projectInstructions?: string | null,
  engineName?: string,
  extras?: { coding?: boolean; customSystem?: string | null },
): ChatTurn[] {
  const sysBase = systemPrompt(engineName ?? defaultModel().name);
  const parts = [sysBase];
  if (extras?.coding) {
    parts.push("The user turned on coding assistance. Prefer complete, runnable code with clear file paths, and only the explanation that is needed. For multi-file projects, put each file in its own fenced code block with its relative file path as a first-line comment (e.g. # src/main.py or // src/index.ts). You cannot run commands, edit the user's files, or browse their machine — say so if a step would require that.");
  }
  if (projectInstructions?.trim()) {
    parts.push("Project instructions from the user:\n" + projectInstructions.trim());
  }
  if (extras?.customSystem?.trim()) {
    parts.push("Additional instructions from the user:\n" + extras.customSystem.trim());
  }
  const sys = parts.join("\n\n");
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
