import { jerr } from "@/lib/http";
import { requireComputerOwner, sameOrigin } from "@/lib/computer/gate";
import { getHub, HubUnavailable, type HubClient } from "@/lib/computer/hub-client";

export type Ctx = { owner: { id: string; email: string }; hub: HubClient };

/** Owner + same-origin + hub. Anything else is a plain 404 (or 403 for a cross-site POST from the owner). */
export async function computerCtx(req: Request, mutating: boolean): Promise<Ctx | Response> {
  const owner = await requireComputerOwner();
  if (!owner) return jerr(404, "not_found", "Not found.");
  if (mutating && !sameOrigin(req)) return jerr(403, "forbidden", "Cross-site request blocked.");
  try {
    return { owner, hub: getHub(owner.id) };
  } catch (e) {
    if (e instanceof HubUnavailable) return jerr(503, "unavailable", e.message);
    throw e;
  }
}
