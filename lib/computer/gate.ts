import "server-only";
import { currentUser } from "../session";
import { isAdminEmail } from "../config";
import { bannedMessage } from "../banned";

/**
 * @computer is for ADMIN accounts only (ADMIN_EMAILS, which always includes OWNER_EMAIL). Customers and signed-out
 * visitors get a 404, the same as any route that does not exist, so the feature is not advertised.
 * Each admin gets their OWN hub (keyed by user id) and can only pair and drive their own Mac.
 */
export function computerAllowedEmail(email: string | null | undefined): boolean {
  return isAdminEmail(email);
}
export async function requireComputerOwner(): Promise<{ id: string; email: string } | null> {
  const u = await currentUser();
  if (!u?.id || !u?.email || !computerAllowedEmail(u.email)) return null;
  if (await bannedMessage(u.id).catch(() => null)) return null;
  return { id: u.id, email: u.email };
}

/** CSRF guard for state-changing calls: the browser must send an Origin matching this site. */
export function sameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return false;
  try {
    const o = new URL(origin);
    const self = new URL(req.url);
    const app = process.env.APP_URL ? new URL(process.env.APP_URL) : null;
    return o.host === self.host || (!!app && o.host === app.host);
  } catch {
    return false;
  }
}

export function computerMaxSteps(): number {
  const n = Number(process.env.COMPUTER_MAX_STEPS);
  return Number.isInteger(n) && n >= 1 && n <= 60 ? n : 25;
}

const envNum = (name: string, def: number, min: number, max: number) => {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n >= min && n <= max ? n : def;
};
/** Estimated model spend cap per task (USD). */
export const computerMaxUsd = () => envNum("COMPUTER_MAX_USD_PER_TASK", 0.25, 0.01, 5);
/** Tasks per UTC day, counted durably in the Durable Object. */
export const computerMaxRunsPerDay = () => Math.floor(envNum("COMPUTER_MAX_RUNS_PER_DAY", 100, 1, 1000));
