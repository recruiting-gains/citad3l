import "server-only";
import { getPublicModel, modelTier, type ModelTier } from "./models";
import { ensureEntitlement, isPaidActive, userIsAdmin } from "./usage";

/**
 * Public-launch access rules for the member features. Server-side only; the client just mirrors them for labels.
 *  - Private and Swarm: any signed-in account (Free included; Swarm still costs 4 replies of allowance).
 *  - Image: an active Pro or Max plan.
 *  - Video: an active Max plan.
 *  - Admins (ADMIN_EMAILS) get everything.
 * Kill switch: PUBLIC_FEATURES="admins" puts Private, Image, Video and Swarm back to admin-only without a code change.
 */
export type AccessDenied = { status: 402 | 403; code: "admin_only" | "upgrade_required"; message: string };

export function publicFeaturesOpen(): boolean {
  return (process.env.PUBLIC_FEATURES ?? "all").trim().toLowerCase() !== "admins";
}

const NAMES: Record<string, string> = { "citad3l-private": "Citad3L Private", "citad3l-image": "Citad3L Image", "citad3l-video": "Citad3L Video" };

/** Pure rule check (tests use this directly). */
export function accessFor(
  feature: ModelTier | "swarm",
  ctx: { admin: boolean; plan: string; paidActive: boolean },
  name = "This feature",
): AccessDenied | null {
  if (ctx.admin || feature === "guest") return null;
  if (!publicFeaturesOpen()) return { status: 403, code: "admin_only", message: `${name} is paused right now. Citad3L V1 and Fast still work.` };
  if (feature === "signin" || feature === "swarm") return null;
  if (feature === "pro") {
    if (ctx.paidActive && (ctx.plan === "pro" || ctx.plan === "max")) return null;
    return { status: 402, code: "upgrade_required", message: `${name} comes with Pro and Max. Upgrade on the pricing page to use it.` };
  }
  if (ctx.paidActive && ctx.plan === "max") return null;
  return { status: 402, code: "upgrade_required", message: `${name} is included with the Max plan. Upgrade on the pricing page to use it.` };
}

/** Can this signed-in user use the model (or Swarm)? null = allowed. */
export async function checkAccess(userId: string, feature: string): Promise<AccessDenied | null> {
  const tier: ModelTier | "swarm" = feature === "swarm" ? "swarm" : modelTier(feature);
  if (tier === "guest") return null;
  const admin = await userIsAdmin(userId);
  if (admin) return null;
  const e = await ensureEntitlement(userId);
  return accessFor(tier, { admin, plan: e.plan, paidActive: isPaidActive(e) }, feature === "swarm" ? "Swarm mode" : NAMES[feature] ?? getPublicModel(feature)?.name ?? "This model");
}
