import type { HubClient } from "./hub-client";

export type AutoApproveRead = { ok: true; autoApprove: boolean } | { ok: false; autoApprove: false };

/**
 * Fail closed (pre-deploy review, blocker 2): auto-approve is ON only for a successful (200) read whose body holds the boolean
 * `true`. A missing, empty, malformed or failed read means OFF, and the caller gets ok:false so it can say "unavailable".
 */
export async function readAutoApprove(hub: Pick<HubClient, "call">): Promise<AutoApproveRead> {
  try {
    const r = await hub.call<{ autoApprove?: unknown }>("/settings");
    if (r?.status !== 200 || !r.body || typeof r.body.autoApprove !== "boolean") return { ok: false, autoApprove: false };
    return { ok: true, autoApprove: r.body.autoApprove === true };
  } catch {
    return { ok: false, autoApprove: false };
  }
}
