export type PlanId = "trial" | "pro" | "max";

export interface UsageSummary {
  plan: PlanId;
  status: "active" | "trialing" | "past_due" | "canceled" | "none";
  used: number;
  limit: number;
  remaining: number;
  resetAt: string | null;
  cancelAtPeriodEnd: boolean;
  unitLabel: string;
}

export interface ProviderInfo {
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
  | "too_large"
  | "rate_limited"
  | "busy"
  | "provider_unavailable"
  | "internal";
