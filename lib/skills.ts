import type { PublicModel } from "./models";
import { modelSkills } from "./models";
import type { SkillRequest } from "./types";

export interface ResolvedSkills {
  webSearch: boolean;
  thinking: boolean;
  coding: boolean;
}

/** Skills the picker may offer for a model. Coming-soon and non-chat models get none. */
export function availableSkills(model: PublicModel | undefined | null): ResolvedSkills {
  if (!model || model.comingSoon || model.requiresClientE2EE || model.modality !== "chat") {
    return { webSearch: false, thinking: false, coding: false };
  }
  return modelSkills(model);
}

/**
 * Clamp requested skills to what the model and session allow.
 * Guests cannot use web search or extended thinking (cost).
 * Swarm drops web search and thinking for ordinary users (cost and planning complexity).
 * An allowlisted account (SWARM_WEB_SEARCH_EMAILS, e.g. the Media bot) may use web search in Swarm.
 */
export function resolveSkills(
  model: PublicModel | undefined | null,
  requested: SkillRequest | null | undefined,
  opts: { guest?: boolean; swarm?: boolean; swarmWebSearch?: boolean } = {},
): ResolvedSkills {
  const avail = availableSkills(model);
  const guest = !!opts.guest;
  const swarm = !!opts.swarm;
  const swarmSearch = swarm && opts.swarmWebSearch === true;
  return {
    webSearch: !guest && avail.webSearch && (swarmSearch || (!swarm && requested?.webSearch === true)),
    thinking: !guest && !swarm && avail.thinking && requested?.thinking === true,
    coding: avail.coding && requested?.coding === true,
  };
}

export const CODING_TOOLS_PROMPT =
  "The user turned on coding assistance. Prefer complete, runnable code with clear file paths, and only the explanation that is needed. For multi-file projects, put each file in its own fenced code block with its relative file path as a first-line comment (e.g. # src/main.py or // src/index.ts). You cannot run commands, edit the user's files, or browse their machine — say so if a step would require that.";
