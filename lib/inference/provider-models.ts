import "server-only";
import { DEFAULT_MODEL_ID, getPublicModel, isMemberModel, isSelectableModelId } from "../models";

/**
 * Inference provider settings. Every provider-specific value (API root, wire field names, header prefix, media host,
 * model ids) lives in Worker secrets, never in this repo:
 *   PROVIDER_BASE_URL    API root (standard /chat/completions, /image/generate, /video/*).
 *   PROVIDER_API_KEY     API key, or PROVIDER_API_KEY_VAR = the name of the secret that holds it.
 *   PROVIDER_WIRE        JSON: provider-specific request field names, enclave settings and the host that serves
 *                        finished videos (see ProviderWire for the keys; unset keys fall back to neutral defaults).
 *   MODEL_IDS            JSON {"citad3l-v1","citad3l-fast","citad3l-private","citad3l-image","video-t2v","video-i2v","computer",
 *                        plus one key per lineup-v2 chat model, named by its public slug: "gemma4-uncensored",
 *                        "uncensored-1.2","glm5.3-flash-uncensored","roleplay-uncensored","inkling2-mini","qwen3.8-27b","qwen4-max","grok-4.7",
 *                        "kimi-k3.1-pro","kimi-k2.7-code"}.
 * Unset values fail safe: no key -> mock/unavailable; no model id -> UnknownModel.
 */
export function providerBaseUrl(): string {
  return (process.env.PROVIDER_BASE_URL || "").trim().replace(/\/$/, "");
}

export function providerApiKey(): string | undefined {
  const indirect = process.env.PROVIDER_API_KEY_VAR?.trim();
  const key = (process.env.PROVIDER_API_KEY || (indirect ? process.env[indirect] : undefined))?.trim();
  return key ? key : undefined;
}

import { providerWire } from "./wire";
export type { ProviderWire } from "./wire";

function readJson(name: string): Record<string, unknown> {
  try {
    const v = JSON.parse(process.env[name] || "{}");
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : "");

export { providerWire };

/** True only for https URLs on the configured media host (or a subdomain of it). */
export function isProviderMediaUrl(url: string): boolean {
  const host = providerWire().mediaHost;
  if (!host) return false;
  try {
    const u = new URL(url);
    const h = u.hostname.toLowerCase();
    return u.protocol === "https:" && (h === host || h.endsWith(`.${host}`));
  } catch {
    return false;
  }
}

/** Server-only model id for a MODEL_IDS key. Never send these ids to the client or include them in ProviderInfo. */
export function providerModelIdFor(key: string): string | undefined {
  return str(readJson("MODEL_IDS")[key]) || undefined;
}

type ModelMap = { text?: string; image?: string; videoT2v?: string; videoI2v?: string };
const MODEL_IDS: Record<string, ModelMap> = {
  "citad3l-v1": { get text() { return providerModelIdFor("citad3l-v1"); } },
  "citad3l-fast": { get text() { return providerModelIdFor("citad3l-fast"); } },
  "citad3l-private": { get text() { return providerModelIdFor("citad3l-private"); } },
  "citad3l-image": { get image() { return providerModelIdFor("citad3l-image"); } },
  "citad3l-video": {
    get videoT2v() { return providerModelIdFor("video-t2v"); },
    get videoI2v() { return providerModelIdFor("video-i2v"); },
  },
};
/** Lineup v2 chat models: the MODEL_IDS key is the public slug. A missing key fails safe (UnknownModel). */
function modelMap(id: string): ModelMap | undefined {
  if (Object.prototype.hasOwnProperty.call(MODEL_IDS, id)) return MODEL_IDS[id];
  const pub = getPublicModel(id);
  if (!pub || pub.modality !== "chat") return undefined;
  return { text: providerModelIdFor(id) };
}


/** Server-only provider id for Citad3L Video. `i2v` is the image-to-video endpoint; never send this id to the client. */
export function resolveVideoModelId(kind: "t2v" | "i2v" = "t2v"): string {
  const map = MODEL_IDS["citad3l-video"];
  const id = kind === "i2v" ? map?.videoI2v : map?.videoT2v;
  if (!id) throw new UnknownModel("Unknown model.");
  return id;
}

export type ResolvedModel = {
  publicId: string;
  name: string;
  modality: "chat" | "image" | "video";
  providerModelId: string;
  supportsVision: boolean;
  requiresClientE2EE: boolean;
};

export class UnknownModel extends Error {
  constructor(message = "Unknown model.") {
    super(message);
    this.name = "UnknownModel";
  }
}

export class SignInRequired extends Error {
  constructor(name: string) {
    super(`Sign in to use ${name}.`);
    this.name = "SignInRequired";
  }
}

/**
 * Public slug → provider model id. `signedIn` / `admin` must come from the server (session + isAdminEmail), never the client.
 * Guests get SignInRequired for Private, Image and Video. Plan checks (Image = Pro/Max, Video = Max) are done by the
 * routes with lib/access.ts, not here.
 */
export function resolveModel(publicId?: string | null, access: { signedIn?: boolean; admin?: boolean } = {}): ResolvedModel {
  const id = publicId?.trim() || DEFAULT_MODEL_ID;
  const admin = access.admin === true;
  const signedIn = admin || access.signedIn === true;
  if (!signedIn && isMemberModel(id)) throw new SignInRequired(getPublicModel(id)?.name ?? "that model");
  if (!isSelectableModelId(id, signedIn, admin)) throw new UnknownModel("Unknown model.");
  const pub = getPublicModel(id);
  const map = modelMap(id);
  if (!pub || !map || pub.modality === "agent") throw new UnknownModel("Unknown model.");
  const providerModelId = map.text ?? map.image ?? map.videoT2v;
  if (!providerModelId) throw new UnknownModel("Unknown model.");
  return {
    publicId: pub.id,
    name: pub.name,
    modality: pub.modality as ResolvedModel["modality"],
    providerModelId,
    supportsVision: pub.supportsVision === true,
    requiresClientE2EE: pub.requiresClientE2EE === true,
  };
}
