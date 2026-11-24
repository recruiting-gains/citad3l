export type PlanId = "trial" | "pro" | "max";

export interface UsageMeter {
  used: number;
  limit: number;
  remaining: number;
  resetAt: string | null;
  label: string;
}

export interface UsageSummary {
  plan: PlanId;
  status: "active" | "trialing" | "past_due" | "canceled" | "none";
  used: number;
  limit: number;
  remaining: number;
  resetAt: string | null;
  /** End of the current paid billing period (Stripe current_period_end), when one is stored. */
  periodEnd?: string | null;
  cancelAtPeriodEnd: boolean;
  unitLabel: string;
  guest?: boolean;
  owner?: boolean;
  admin?: boolean;
  unlimited?: boolean;
  window?: UsageMeter;
  week?: UsageMeter;
}

export interface ProviderInfo {
  /** true when no inference endpoint is configured (nothing is served). */
  offline?: boolean;
  mock: boolean;
  label: string;
  model: string;
}

export interface PlanCard {
  id: PlanId;
  name: string;
  priceUsd: number;
  blurb: string;
  allowance: string;
  features: string[];
  cta: string;
  highlight?: boolean;
}

export interface ConversationListItem {
  id: string;
  title: string;
  projectId: string | null;
  updatedAt: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  status: "complete" | "streaming" | "error" | "stopped";
  createdAt: string;
}

export interface Project {
  id: string;
  name: string;
  instructions: string;
  updatedAt: string;
  conversationCount: number;
}

export type ChatErrorCode =
  | "limit_reached"
  | "unauthorized"
  | "signup_required"
  | "forbidden"
  | "suspended"
  | "too_large"
  | "rate_limited"
  | "busy"
  | "provider_unavailable"
  | "content_policy"
  | "unavailable"
  | "bad_request"
  | "internal";

export type SkillId = "webSearch" | "thinking" | "coding";

export interface SkillRequest {
  webSearch?: boolean;
  thinking?: boolean;
  coding?: boolean;
}

export interface ModelSettings {
  modelId: string;
  systemPrompt: string;
  temperature: number | null;
  maxTokens: number | null;
}
