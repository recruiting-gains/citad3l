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
 * Swarm mode drops web search and thinking (cost and planning complexity).
 */
export function resolveSkills(
  model: PublicModel | undefined | null,
  requested: SkillRequest | null | undefined,
  opts: { guest?: boolean; swarm?: boolean } = {},
): ResolvedSkills {
  const avail = availableSkills(model);
  const guest = !!opts.guest;
  const swarm = !!opts.swarm;
  return {
    webSearch: !guest && !swarm && avail.webSearch && requested?.webSearch === true,
    thinking: !guest && !swarm && avail.thinking && requested?.thinking === true,
    coding: avail.coding && requested?.coding === true,
  };
}

export const CODING_TOOLS_PROMPT =
  "The user turned on coding assistance. Prefer complete, runnable code with clear file paths, and only the explanation that is needed. You cannot run commands, edit the user's files, or browse their machine — say so if a step would require that.";
