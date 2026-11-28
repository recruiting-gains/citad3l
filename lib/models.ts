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
  /** Optional unique still for marketing cards (public path). Falls back to `art` when unset. */
  cover?: string;
  /** Alt text for `cover`. */
  coverAlt?: string;
  /** Keep in the catalog for routing, but hide from marketing and the picker (merged Fast). */
  hidden?: boolean;
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
    name: "Citad3L V1 Fast",
    description: "Uncensored chat for reasoning, code, and swarm lead.",
    modality: "chat",
    default: true,
    supportsVision: true,
    role: "Uncensored chat",
    summary: "Uncensored chat for everyday questions, reasoning, code, and swarm lead. It can read images you upload.",
    specs: ["Chat", "Image input", "Uncensored"],
    art: "rook",
    cover: "/models/covers/citad3l-v1.webp",
    coverAlt: "A black wedge supercar on a dusk coastal freeway, blue-white exhaust flames stretching down the wet road toward a city skyline",
    context: "128K",
    speed: "Standard",
    usageDots: 3,
    skills: { webSearch: true, thinking: true, coding: true },
  },
  {
    id: "citad3l-fast",
    name: "Citad3L Fast",
    description: "Internal quicker worker used by Swarm. Merged into Citad3L V1 Fast on the public lineup.",
    modality: "chat",
    supportsVision: true,
    hidden: true,
    role: "Swarm workers",
    summary: "Internal quicker worker used by Swarm. Not shown as its own card.",
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
    cover: "/models/covers/citad3l-private.webp",
    coverAlt: "A sealed liquid-chrome droplet with a locked teal filament inside on black",
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
    cover: "/models/covers/gemma4-uncensored.webp",
    coverAlt: "A lived-in industrial loft at first light, a blank notebook and a coffee mug on a worn wood table by factory windows",
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
    cover: "/models/covers/uncensored-1.2.webp",
    coverAlt: "A sheet of liquid teal light torn open by a thin bright seam on black",
    context: "128K",
    speed: "Fast",
    usageDots: 2,
    skills: { webSearch: true, thinking: false, coding: true },
  },
  {
    id: "glm5.3-flash-uncensored",
    name: "GLM 5.3 Flash Uncensored",
    description: "Fast uncensored reasoning with image input.",
    modality: "chat",
    supportsVision: true,
    role: "Uncensored reasoning",
    summary: "A fast uncensored reasoning model for chat, code and long work. It can read images too.",
    specs: ["Chat", "Image input", "Uncensored", "Reasoning"],
    art: "ai",
    cover: "/models/covers/glm5.3-flash-uncensored.webp",
    coverAlt: "A dark stone corridor aimed at a tall rectangle of white-teal light",
    context: "128K",
    speed: "Fast",
    usageDots: 1,
    skills: { webSearch: true, thinking: true, coding: true },
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
    cover: "/models/covers/roleplay-uncensored.webp",
    coverAlt: "A teal long-exposure light trail looping on black",
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
    cover: "/models/covers/inkling2-mini.webp",
    coverAlt: "A dark hall of stacked blank paper receding toward an arched window, a shaft of sunlight falling down the aisle",
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
    cover: "/models/covers/qwen3.8-27b.webp",
    coverAlt: "A brass-and-glass orrery on a dark plinth in a gallery, teal-rimmed spheres among thin orbital rings",
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
    cover: "/models/covers/qwen4-max.webp",
    coverAlt: "A luxury hillside terrace at golden hour, infinity pool and empty balcony overlooking a coastal town and the sun on the ocean",
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
    cover: "/models/covers/grok-4.7.webp",
    coverAlt: "A glass-and-steel cantilever overlook on a sharp mountain ridge above a sea of clouds at sunrise",
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
    cover: "/models/covers/kimi-k3.1-pro.webp",
    coverAlt: "Looking down a monumental stone-and-brass spiral staircase into a teal glow far below",
    context: "128K",
    speed: "Slow",
    usageDots: 5,
    skills: { webSearch: true, thinking: false, coding: true },
  },
  {
    id: "kimi-k2.7-code",
    name: "Kimi K2.7 Code",
    description: "Coding specialist with reasoning and image input.",
    modality: "chat",
    supportsVision: true,
    role: "Coding specialist",
    summary: "A coding specialist for writing, fixing and explaining code, with step-by-step reasoning. It can read screenshots and images too.",
    specs: ["Chat", "Image input", "Code"],
    art: "robotics",
    cover: "/models/covers/kimi-k2.7-code.webp",
    coverAlt: "A teal wireframe volume of interlocking nodes with a bead of liquid light at a joint",
    context: "128K",
    speed: "Standard",
    usageDots: 3,
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
    cover: "/models/covers/citad3l-image.webp",
    coverAlt: "A coastal photograph appearing in a developer tray under amber safelight, unmarked bottles of teal chemistry on the bench",
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
    cover: "/models/covers/citad3l-video.webp",
    coverAlt: "An empty cinema, a projector beam, a coastal sea blooming on a wide curved screen",
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
 * Which plan a model needs. Guests (no account) get V1 Fast and the Free uncensored models. Private needs an account (any plan), Image needs
 * an active Pro or Max plan, Video needs an active Max plan. Admins (ADMIN_EMAILS) have everything. The server enforces
 * this in every route (lib/access.ts); the client only uses it for labels.
 */
export type ModelTier = "guest" | "signin" | "pro" | "max";
export const MODEL_TIER: Record<string, ModelTier> = {
  "citad3l-v1": "guest",
  "citad3l-fast": "guest",
  "citad3l-private": "signin",
  // Lineup v2: Free named chat = V1 Fast, Private, Gemma 4 Uncensored, Uncensored 1.2, GLM 5.3 Flash Uncensored (Fast merged into V1 Fast; citad3l-fast stays for Swarm workers only). No sign-in wall, no age check.
  "gemma4-uncensored": "guest",
  "uncensored-1.2": "guest",
  "glm5.3-flash-uncensored": "guest",
  // Pro (8) adds three.
  "roleplay-uncensored": "pro",
  "inkling2-mini": "pro",
  "qwen3.8-27b": "pro",
  // Max (12) adds four (slot 12 = Kimi K2.7 Code, Cruz's pick 2026-11-27).
  "qwen4-max": "max",
  "grok-4.7": "max",
  "kimi-k3.1-pro": "max",
  "kimi-k2.7-code": "max",
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

function isPublicCard(m: PublicModel): boolean {
  return m.hidden !== true;
}

/** Public lineup list (models index, command palette). Video stays hidden if its flag is off. Image and Video both stay hidden while media generation is off. Hidden catalog entries (merged Fast) stay out. */
export function visibleModels(): PublicModel[] {
  return withoutGeneratedMedia(MODELS.filter((m) => isPublicCard(m) && (m.id !== VIDEO_MODEL_ID || isVideoModelEnabled())));
}

/**
 * What the chat picker offers. Guests get V1 Fast and the Free uncensored models; signed-in accounts see the whole lineup (plan locks are
 * enforced by the server with an upgrade message). Admins always get every model, Video included, unless media
 * generation is turned off — then nobody can pick Image or Video.
 */
export function pickerModels(signedIn: boolean, admin = false): PublicModel[] {
  if (!mediaGenerationEnabled()) {
    const chat = MODELS.filter((m) => isPublicCard(m) && !isGeneratedMediaModality(m.modality));
    if (admin || signedIn) return chat.slice();
    return chat.filter((m) => !isMemberModel(m.id));
  }
  // Media is on. Admins still see Video even if CITAD3L_VIDEO_ENABLED is off. Hidden entries stay out.
  if (admin) return MODELS.filter(isPublicCard);
  if (signedIn) return visibleModels();
  return visibleModels().filter((m) => !isMemberModel(m.id));
}

/** Public lineup for marketing pages. V1 Fast and Qwen 4 Max lead the grid (top row). Hidden entries stay out. */
const MARKETING_LEAD_IDS = ["citad3l-v1", "qwen4-max"] as const;
export function marketingModels(): PublicModel[] {
  const all = withoutGeneratedMedia(MODELS.filter(isPublicCard));
  const lead = MARKETING_LEAD_IDS.map((id) => all.find((m) => m.id === id)).filter(Boolean) as PublicModel[];
  const rest = all.filter((m) => !MARKETING_LEAD_IDS.includes(m.id as (typeof MARKETING_LEAD_IDS)[number]));
  return [...lead, ...rest];
}

export function modalityLabel(m: PublicModel): string {
  if (m.modality === "image") return "Image";
  if (m.modality === "video") return "Video";
  return "Chat";
}

/** Can this account pick the model? Guests: V1 Fast and the Free uncensored models. Plan checks happen in lib/access.ts.
 * Hidden catalog entries (merged Fast) stay routable for Swarm workers and old chats, but are not listed in the picker. */
export function isSelectableModelId(id: string, signedIn = false, admin = false): boolean {
  if (pickerModels(signedIn, admin).some((m) => m.id === id)) return true;
  const pub = getPublicModel(id);
  if (!pub || pub.hidden !== true) return false;
  if (admin || signedIn) return true;
  return modelTier(id) === "guest";
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

export const GUEST_MODEL_IDS = ["citad3l-v1", "gemma4-uncensored", "uncensored-1.2", "glm5.3-flash-uncensored"] as const;


/** Chat models in a plan, in lineup order (Free 5, Pro 8, Max 12). Image/Video excluded. */
export function chatModelsForPlan(plan: "trial" | "pro" | "max"): PublicModel[] {
  return MODELS.filter((m) => isPublicCard(m) && m.modality === "chat" && planIncludesModel(plan, m.id));
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
