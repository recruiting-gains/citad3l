/**
 * Public model catalog for Citad3L.
 *
 * Display names, picker copy and marketing copy only. Provider model IDs
 * live in the server-only inference layer and must never be imported here.
 */
import { isGeneratedMediaModality, mediaGenerationEnabled } from "./media";

export type ModelModality = "chat" | "image" | "video" | "agent";

/** Existing SlotVideo slots. Marketing art only; no new media files. */
export type ModelArtSlot = "rookHero" | "rook" | "ai" | "robotics" | "cyber" | "everyday";

export interface PublicModel {
  id: string;
  name: string;
  description: string;
  modality: ModelModality;
  /** Default chat model for new conversations. */
  default?: boolean;
  /** When false, the chat UI must not show image upload. */
  supportsVision?: boolean;
  /**
   * Needs the provider's client-side E2EE protocol (attestation + encrypt/decrypt).
   * A plain chat-completions server call is not sufficient or honest.
   */
  requiresClientE2EE?: boolean;
  /** Short role line for marketing cards. */
  role?: string;
  /** One or two plain sentences for marketing pages. */
  summary?: string;
  /** Short spec labels, rendered small on marketing cards. */
  specs?: readonly string[];
  /** Listed on marketing pages but not usable yet. */
  comingSoon?: boolean;
  /** Only this paid plan includes the model. */
  exclusivePlan?: "max";
  /** Marketing art slot. */
  art?: ModelArtSlot;
  /** Approximate context window shown in the picker. */
  context?: string;
  /** Relative reply speed shown in the picker. */
  speed?: "Fast" | "Standard" | "Slow";
  /** Relative usage-cost dots, 1 (cheapest) to 5 (heaviest). */
  usageDots?: 1 | 2 | 3 | 4 | 5;
  /** Skills this model can run. Missing means none. */
  skills?: { webSearch?: boolean; thinking?: boolean; coding?: boolean };
}

/** Internal slug for the video slot. */
export const VIDEO_MODEL_ID = "citad3l-video";

/**
 * Off-switch for Citad3L Video when media generation is on (Max plan only).
 * CITAD3L_VIDEO_ENABLED=false hides Video again. MEDIA_GENERATION_ENABLED=false hides Image and Video together.
 */
export const VIDEO_MODEL_ENABLED = true;

export function isVideoModelEnabled(): boolean {
  const env = process.env.CITAD3L_VIDEO_ENABLED;
  if (env === "true") return true;
  if (env === "false") return false;
  return VIDEO_MODEL_ENABLED;
}

export const MODELS: readonly PublicModel[] = [
  {
    id: "citad3l-v1",
    name: "Citad3L V1",
    description: "Main chat for reasoning, code, and swarm lead.",
    modality: "chat",
    default: true,
    supportsVision: true,
    role: "Default chat · swarm lead",
    summary: "The default for new chats. Use it for reasoning, code, and questions about images you upload.",
    specs: ["Chat", "Image input"],
    art: "rook",
    context: "128K",
    speed: "Standard",
    usageDots: 3,
    skills: { webSearch: true, thinking: true, coding: true },
  },
  {
    id: "citad3l-fast",
    name: "Citad3L Fast",
    description: "Quick, lower-cost chat and swarm workers.",
    modality: "chat",
    supportsVision: true,
    role: "Quick chat · swarm workers",
    summary: "Quicker, lower-cost replies for short tasks and drafts. It can read images too.",
    specs: ["Chat", "Image input"],
    art: "ai",
    context: "128K",
    speed: "Fast",
    usageDots: 2,
    skills: { webSearch: true, thinking: false, coding: true },
  },
  {
    id: "citad3l-private",
    name: "Citad3L Private",
    description: "Encrypted chat in a verified secure enclave.",
    modality: "chat",
    supportsVision: false,
    requiresClientE2EE: true,
    role: "Encrypted chat",
    summary: "Encrypted chat that runs in a verified secure enclave. Messages are encrypted from Citad3L's server to the enclave, so the model host can't read them. Text only, no web search.",
    specs: ["Chat", "Text only", "Secure enclave"],
    art: "cyber",
    context: "128K",
    speed: "Standard",
    usageDots: 3,
    skills: { webSearch: false, thinking: false, coding: false },
  },
  // ── 2026-11-27 lineup v2 (preview). Public slugs only; provider ids live in the MODEL_IDS secret under these same
  // keys. Free adds two named uncensored models; Pro and Max add the rest. Context is shown at the app's 128K label.
  {
    id: "gemma4-uncensored",
    name: "Gemma 4 Uncensored",
    description: "Uncensored everyday chat that reads images.",
    modality: "chat",
    supportsVision: true,
    role: "Uncensored chat",
    summary: "Uncensored chat for everyday questions, drafts and ideas. It can read images you upload.",
    specs: ["Chat", "Image input", "Uncensored"],
    art: "everyday",
    context: "128K",
    speed: "Fast",
    usageDots: 1,
    skills: { webSearch: true, thinking: false, coding: true },
  },
  {
    id: "uncensored-1.2",
    name: "Uncensored 1.2",
    description: "Our most open chat model, with image input.",
    modality: "chat",
    supportsVision: true,
    role: "Uncensored chat",
    summary: "The most open model in the lineup. Straight answers with fewer refusals. It can read images too.",
    specs: ["Chat", "Image input", "Uncensored"],
    art: "cyber",
    context: "128K",
    speed: "Fast",
    usageDots: 2,
    skills: { webSearch: true, thinking: false, coding: true },
  },
  {
    id: "roleplay-uncensored",
    name: "Role Play Uncensored",
    description: "Uncensored role play and character chat.",
    modality: "chat",
    supportsVision: true,
    role: "Role play · characters",
    summary: "Uncensored role play, characters and interactive stories. It can read images too.",
    specs: ["Chat", "Image input", "Uncensored"],
    art: "ai",
    context: "128K",
    speed: "Standard",
    usageDots: 2,
    skills: { webSearch: false, thinking: false, coding: false },
  },
  {
    id: "inkling2-mini",
    name: "Inkling 2 Mini",
    description: "Light, low-cost chat for long documents.",
    modality: "chat",
    supportsVision: true,
    role: "Long documents",
    summary: "A light, low-cost model that handles long documents and quick questions. It can read images too.",
    specs: ["Chat", "Image input"],
    art: "everyday",
    context: "128K",
    speed: "Fast",
    usageDots: 1,
    skills: { webSearch: true, thinking: false, coding: true },
  },
  {
    id: "qwen3.8-27b",
    name: "Qwen 3.8 27B",
    description: "Step-up reasoning with image input.",
    modality: "chat",
    supportsVision: true,
    role: "Reasoning",
    summary: "A step up for reasoning, math and code. It can read images too.",
    specs: ["Chat", "Image input", "Reasoning"],
    art: "robotics",
    context: "128K",
    speed: "Standard",
    usageDots: 3,
    skills: { webSearch: true, thinking: false, coding: true },
  },
  {
    id: "qwen4-max",
    name: "Qwen 4 Max",
    description: "Flagship-class reasoning and vision.",
    modality: "chat",
    supportsVision: true,
    role: "Flagship reasoning",
    summary: "A flagship-class model for hard reasoning, code and image questions.",
    specs: ["Chat", "Image input", "Reasoning"],
    art: "rookHero",
    context: "128K",
    speed: "Standard",
    usageDots: 4,
    skills: { webSearch: true, thinking: false, coding: true },
  },
  {
    id: "grok-4.7",
    name: "Grok 4.7",
    description: "Top-tier reasoning with image input.",
    modality: "chat",
    supportsVision: true,
    role: "Top-tier reasoning",
    summary: "A top-tier model for hard questions, analysis and code. It can read images too.",
    specs: ["Chat", "Image input", "Reasoning"],
    art: "rook",
    context: "128K",
    speed: "Standard",
    usageDots: 5,
    skills: { webSearch: true, thinking: false, coding: true },
  },
  {
    id: "kimi-k3.1-pro",
    name: "Kimi K3.1 Pro",
    description: "Deep reasoning for long, complex work.",
    modality: "chat",
    supportsVision: true,
    role: "Deep reasoning · long work",
    summary: "Deep reasoning for long, complex work like big documents and multi-step code. It can read images too.",
    specs: ["Chat", "Image input", "Reasoning"],
    art: "ai",
    context: "128K",
    speed: "Slow",
    usageDots: 5,
    skills: { webSearch: true, thinking: false, coding: true },
  },
  {
    id: "citad3l-image",
    name: "Citad3L Image",
    description: "Detailed image generation with clean, legible text.",
    modality: "image",
    supportsVision: false,
    role: "Image generation",
    summary: "Detailed images from a written prompt, including clean, legible text in the picture.",
    specs: ["Image output", "Legible text"],
    art: "everyday",
    context: "—",
    speed: "Standard",
    usageDots: 3,
    skills: { webSearch: false, thinking: false, coding: false },
  },
  {
    id: "citad3l-video",
    name: "Citad3L Video",
    description: "Cinematic video generation: 5-second 720p clips with sound.",
    modality: "video",
    supportsVision: false,
    role: "Video generation",
    summary: "Cinematic video generation. Clips run 5 seconds at 720p, with sound.",
    specs: ["5 sec", "720p", "Sound"],
    exclusivePlan: "max",
    art: "robotics",
    context: "—",
    speed: "Slow",
    usageDots: 5,
    skills: { webSearch: false, thinking: false, coding: false },
  },
];

export const DEFAULT_MODEL_ID = "citad3l-v1";

export function getPublicModel(id: string | null | undefined): PublicModel | undefined {
  if (!id) return undefined;
  return MODELS.find((m) => m.id === id);
}

/**
 * Which plan a model needs. Guests (no account) only get V1 and Fast. Private needs an account (any plan), Image needs
 * an active Pro or Max plan, Video needs an active Max plan. Admins (ADMIN_EMAILS) have everything. The server enforces
 * this in every route (lib/access.ts); the client only uses it for labels.
 */
export type ModelTier = "guest" | "signin" | "pro" | "max";
export const MODEL_TIER: Record<string, ModelTier> = {
  "citad3l-v1": "guest",
  "citad3l-fast": "guest",
  "citad3l-private": "signin",
  // Lineup v2: Free (5) = V1, Fast, Private + these two. Guests can use them too (no sign-in wall, no age check).
  "gemma4-uncensored": "guest",
  "uncensored-1.2": "guest",
  // Pro (8) adds three.
  "roleplay-uncensored": "pro",
  "inkling2-mini": "pro",
  "qwen3.8-27b": "pro",
  // Max (12) adds four. Slot 12 is MAX_SLOT_12_PLACEHOLDER below (hidden until Cruz picks the model).
  "qwen4-max": "max",
  "grok-4.7": "max",
  "kimi-k3.1-pro": "max",
  "citad3l-image": "pro",
  [VIDEO_MODEL_ID]: "max",
};

export function modelTier(id: string | null | undefined): ModelTier {
  return (id && MODEL_TIER[id]) || "guest";
}

/** Models that need a signed-in account (Private, Image, Video). */
export function isMemberModel(id: string | null | undefined): boolean {
  return !!id && modelTier(id) !== "guest" && id in MODEL_TIER;
}

function withoutGeneratedMedia(models: readonly PublicModel[]): PublicModel[] {
  if (mediaGenerationEnabled()) return models.slice();
  return models.filter((m) => !isGeneratedMediaModality(m.modality));
}

/** Public lineup list (models index, command palette). Video stays hidden if its flag is off. Image and Video both stay hidden while media generation is off. */
export function visibleModels(): PublicModel[] {
  return withoutGeneratedMedia(MODELS.filter((m) => m.id !== VIDEO_MODEL_ID || isVideoModelEnabled()));
}

/**
 * What the chat picker offers. Guests get V1 and Fast; signed-in accounts see the whole lineup (plan locks are
 * enforced by the server with an upgrade message). Admins always get every model, Video included, unless media
 * generation is turned off — then nobody can pick Image or Video.
 */
export function pickerModels(signedIn: boolean, admin = false): PublicModel[] {
  if (!mediaGenerationEnabled()) {
    const chat = MODELS.filter((m) => !isGeneratedMediaModality(m.modality));
    if (admin || signedIn) return chat.slice();
    return chat.filter((m) => !isMemberModel(m.id));
  }
  if (admin) return MODELS.slice();
  if (signedIn) return visibleModels();
  return visibleModels().filter((m) => !isMemberModel(m.id));
}

/** Public lineup for marketing pages. Includes Image and Video only while media generation is on. */
export function marketingModels(): PublicModel[] {
  return withoutGeneratedMedia(MODELS);
}

export function modalityLabel(m: PublicModel): string {
  if (m.modality === "image") return "Image";
  if (m.modality === "video") return "Video";
  return "Chat";
}

/** Can this account pick the model? Guests: V1 and Fast only. Plan checks happen in lib/access.ts. */
export function isSelectableModelId(id: string, signedIn = false, admin = false): boolean {
  return pickerModels(signedIn, admin).some((m) => m.id === id);
}

/** Short plan label for a model ("Pro", "Max only"), or null when every account can use it. */
export function planLabel(id: string): string | null {
  const t = modelTier(id);
  if (t === "max") return "Max only";
  if (t === "pro") return "Pro & Max";
  if (t === "signin") return "Free account";
  return null;
}

export function defaultModel(): PublicModel {
  return MODELS.find((m) => m.default) ?? MODELS[0];
}

/**
 * Model id for the next message. A saved Image or Video chat falls back to the default text model
 * when those modes are not in the catalog, so a text follow-up still sends.
 */
export function modelForFollowUp(savedId: string | null | undefined, catalog: readonly { id: string }[], fallback = DEFAULT_MODEL_ID): string {
  if (savedId && catalog.some((m) => m.id === savedId)) return savedId;
  if (catalog.some((m) => m.id === fallback)) return fallback;
  return catalog[0]?.id ?? fallback;
}

export function modelAllowsImageUpload(model: PublicModel | undefined | null): boolean {
  return !!model && model.modality === "chat" && model.supportsVision === true;
}

export function isChatReady(model: PublicModel | undefined | null): boolean {
  return !!model && model.modality === "chat" && !model.comingSoon;
}

export function isImageReady(model: PublicModel | undefined | null): boolean {
  return !!model && model.modality === "image" && !model.comingSoon;
}

export function isVideoReady(model: PublicModel | undefined | null): boolean {
  return !!model && model.modality === "video" && !model.comingSoon;
}

export function isSwarmAvailable(model: PublicModel | undefined | null): boolean {
  return isChatReady(model) && model?.requiresClientE2EE !== true;
}

/** "/image prompt" from chat, or any prompt when Citad3L Image is selected. */
export function parseImageCommand(text: string, imageMode: boolean): { image: boolean; prompt: string } {
  const m = /^\/image(?:\s+|$)/i.exec(text);
  if (m) return { image: true, prompt: text.slice(m[0].length).trim() };
  if (imageMode) return { image: true, prompt: text };
  return { image: false, prompt: text };
}

export const GUEST_MODEL_IDS = ["citad3l-fast", "gemma4-uncensored", "uncensored-1.2"] as const;

/**
 * PLACEHOLDER — Max slot 12 (lineup v2). Deliberately NOT in MODELS, so it never shows in the picker, marketing pages
 * or the API. When Cruz picks the model: add a MODELS entry with this id (or a better slug), set MODEL_TIER[id] = "max",
 * and add the provider id under the same key in the MODEL_IDS secret.
 */
export const MAX_SLOT_12_PLACEHOLDER = { id: "max-slot-12", tier: "max", hidden: true } as const;

/** Chat models in a plan, in lineup order (Free 5, Pro 8, Max 11 today + the hidden slot 12). Image/Video excluded. */
export function chatModelsForPlan(plan: "trial" | "pro" | "max"): PublicModel[] {
  return MODELS.filter((m) => m.modality === "chat" && planIncludesModel(plan, m.id));
}

/** Does this plan include the model? Free ("trial") gets guest + signin models; Pro adds pro; Max adds max. */
export function planIncludesModel(plan: string | null | undefined, id: string): boolean {
  const t = modelTier(id);
  if (t === "guest" || t === "signin") return true;
  if (t === "pro") return plan === "pro" || plan === "max";
  return plan === "max";
}

export function isGuestModelId(id: string): boolean {
  return (GUEST_MODEL_IDS as readonly string[]).includes(id);
}

export function modelSkills(model: PublicModel | undefined | null) {
  return {
    webSearch: !!model?.skills?.webSearch,
    thinking: !!model?.skills?.thinking,
    coding: !!model?.skills?.coding,
  };
}

export type ModelBadge = { key: string; label: string; tone: "default" | "soon" | "max" };
/**
 * Lineup / model-page badges. Admins (ADMIN_EMAILS) have every model unlocked whatever their plan, so they never see a
 * plan lock. Everyone else sees which plan includes the model.
 */
export function modelBadges(model: PublicModel, isAdmin = false): ModelBadge[] {
  const flags: ModelBadge[] = [];
  if (model.default) flags.push({ key: "default", label: "Default", tone: "default" });
  if (model.comingSoon) {
    flags.push({ key: "soon", label: "Coming soon", tone: "soon" });
  } else if (isAdmin) {
    if (isMemberModel(model.id)) flags.push({ key: "unlocked", label: "Unlocked for you", tone: "default" });
  } else {
    const t = modelTier(model.id);
    if (t === "max") flags.push({ key: "max", label: "Max only", tone: "max" });
    else if (t === "pro") flags.push({ key: "pro", label: "Pro & Max", tone: "max" });
  }
  return flags;
}
