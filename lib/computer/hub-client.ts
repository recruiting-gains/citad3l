import "server-only";
import { getCloudflareContext } from "@opennextjs/cloudflare";

export type HubResponse<T = unknown> = { status: number; body: T & { error?: string } };
export interface HubClient {
  call<T = Record<string, unknown>>(path: string, body?: unknown, method?: "GET" | "POST"): Promise<HubResponse<T>>;
}

type DoNamespace = { idFromName(n: string): unknown; get(id: unknown): { fetch(r: Request): Promise<Response> } };

export class HubUnavailable extends Error {}

/** One hub per user. Must match hubNameForUser() in worker/computer-hub.js. */
export function hubNameForUser(userId: string): string {
  const id = String(userId ?? "").trim();
  if (!id) throw new Error("hub_user_required");
  return `user:${id}`;
}

/** Test seam: tests install a fake hub factory; production resolves the COMPUTER_HUB binding per call. */
let override: ((userId: string) => HubClient) | null = null;
export function setHubForTests(h: HubClient | ((userId: string) => HubClient) | null) {
  override = h === null ? null : typeof h === "function" ? h : () => h;
}

/** The signed-in user's OWN hub. Every call is tagged with that user id; the hub refuses any other user. */
export function getHub(userId: string): HubClient {
  const name = hubNameForUser(userId);
  if (override) return override(userId);
  let ns: DoNamespace | undefined;
  try {
    ns = (getCloudflareContext() as unknown as { env: Record<string, unknown> }).env.COMPUTER_HUB as DoNamespace | undefined;
  } catch {
    ns = undefined;
  }
  if (!ns) throw new HubUnavailable("@computer needs the COMPUTER_HUB Durable Object binding (Workers only).");
  const stub = ns.get(ns.idFromName(name));
  return {
    async call(path, body, method = body === undefined ? "GET" : "POST") {
      const res = await stub.fetch(new Request(`https://hub.internal${path}`, {
        method,
        headers: { "content-type": "application/json", "x-hub-user": userId },
        body: method === "GET" ? undefined : JSON.stringify(body ?? {}),
      }));
      const parsed = await res.json().catch(() => ({}));
      return { status: res.status, body: parsed as never };
    },
  };
}
