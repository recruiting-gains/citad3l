import { prisma } from "./db";
import { MAX_SETTINGS_TOKENS, MAX_SYSTEM_PROMPT } from "./config";
import { isSelectableModelId } from "./models";
import type { ModelSettings } from "./types";

export const DEFAULT_TEMPERATURE = 0.7;

export function clampTemperature(n: unknown): number | null {
  if (n === null || n === undefined || n === "") return null;
  const v = Number(n);
  if (!Number.isFinite(v)) return null;
  return Math.min(2, Math.max(0, Math.round(v * 100) / 100));
}

export function clampMaxTokens(n: unknown): number | null {
  if (n === null || n === undefined || n === "") return null;
  const v = Number(n);
  if (!Number.isInteger(v) || v < 16) return null;
  return Math.min(MAX_SETTINGS_TOKENS, v);
}

export async function getModelSettings(userId: string, modelId: string): Promise<ModelSettings> {
  const id = isSelectableModelId(modelId, true) ? modelId : "";
  if (!id) return { modelId: modelId || "", systemPrompt: "", temperature: null, maxTokens: null };
  const row = await prisma.userModelSettings.findUnique({ where: { userId_modelId: { userId, modelId: id } } });
  return {
    modelId: id,
    systemPrompt: row?.systemPrompt ?? "",
    temperature: row?.temperature ?? null,
    maxTokens: row?.maxTokens ?? null,
  };
}

export async function saveModelSettings(userId: string, input: ModelSettings): Promise<ModelSettings> {
  if (!isSelectableModelId(input.modelId, true)) throw new Error("unknown_model");
  const systemPrompt = (input.systemPrompt ?? "").slice(0, MAX_SYSTEM_PROMPT);
  const temperature = clampTemperature(input.temperature);
  const maxTokens = clampMaxTokens(input.maxTokens);
  await prisma.userModelSettings.upsert({
    where: { userId_modelId: { userId, modelId: input.modelId } },
    create: { userId, modelId: input.modelId, systemPrompt, temperature, maxTokens },
    update: { systemPrompt, temperature, maxTokens },
  });
  return { modelId: input.modelId, systemPrompt, temperature, maxTokens };
}

export async function resetModelSettings(userId: string, modelId: string): Promise<ModelSettings> {
  if (isSelectableModelId(modelId, true)) {
    await prisma.userModelSettings.deleteMany({ where: { userId, modelId } });
  }
  return { modelId, systemPrompt: "", temperature: null, maxTokens: null };
}

/** Max (or the owner) may apply per-model settings. */
export function canUseModelSettings(plan: string | undefined, owner: boolean): boolean {
  return owner || plan === "max";
}
