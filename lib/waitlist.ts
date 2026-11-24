import { rateLimit } from "./ratelimit";
import { clientIp, hashIp } from "./guest";

export const WAITLIST_SOURCES = ["home", "faq", "pricing"] as const;
export type WaitlistSource = (typeof WAITLIST_SOURCES)[number];

/** Max accepted signups per IP hash per hour. */
export const WAITLIST_RATE_LIMIT = 5;
export const WAITLIST_RATE_WINDOW_MS = 60 * 60 * 1000;
export const WAITLIST_EMAIL_MAX = 254;
export const WAITLIST_SOURCE_MAX = 40;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type WaitlistStore = {
  create(data: { email: string; source: string; ipHash: string }): Promise<"created" | "exists">;
};

export type WaitlistOk = { ok: true };
export type WaitlistErr = { ok: false; code: "invalid_email" | "rate_limited"; message: string };
export type WaitlistResult = WaitlistOk | WaitlistErr;

export function normalizeWaitlistEmail(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const email = raw.trim().toLowerCase();
  if (!email || email.length > WAITLIST_EMAIL_MAX) return null;
  if (!EMAIL_RE.test(email)) return null;
  return email;
}

export function normalizeWaitlistSource(raw: unknown): string {
  if (typeof raw !== "string") return "home";
  const s = raw.trim().toLowerCase().slice(0, WAITLIST_SOURCE_MAX);
  return (WAITLIST_SOURCES as readonly string[]).includes(s) ? s : "home";
}

/** Hidden field: if a bot fills it, treat the request as a success and store nothing. */
export function isHoneypot(raw: unknown): boolean {
  if (raw == null) return false;
  if (typeof raw !== "string") return true;
  return raw.trim().length > 0;
}

export async function addWaitlistSignup(
  input: { email: unknown; source?: unknown; website?: unknown; ip: string },
  store: WaitlistStore,
  limit = rateLimit,
): Promise<WaitlistResult> {
  if (isHoneypot(input.website)) return { ok: true };

  const email = normalizeWaitlistEmail(input.email);
  if (!email) {
    return { ok: false, code: "invalid_email", message: "Enter a valid email address." };
  }
  const source = normalizeWaitlistSource(input.source);
  const ipHash = hashIp(input.ip || "0.0.0.0");
  if (!limit(`waitlist:${ipHash}`, WAITLIST_RATE_LIMIT, WAITLIST_RATE_WINDOW_MS)) {
    return { ok: false, code: "rate_limited", message: "Too many tries from this network. Please wait and try again." };
  }
  await store.create({ email, source, ipHash });
  return { ok: true };
}

export function ipFromRequest(req: Request): string {
  return clientIp(req);
}

export async function prismaWaitlistStore(): Promise<WaitlistStore> {
  const { prisma } = await import("./db");
  return {
    async create(data) {
      try {
        await prisma.waitlistSignup.create({ data });
        return "created";
      } catch (e) {
        if (typeof e === "object" && e && "code" in e && (e as { code: string }).code === "P2002") {
          return "exists";
        }
        throw e;
      }
    },
  };
}

export async function listWaitlist(take = 200): Promise<{
  count: number;
  signups: { id: string; email: string; source: string; createdAt: string }[];
}> {
  const { prisma } = await import("./db");
  const [count, rows] = await Promise.all([
    prisma.waitlistSignup.count(),
    prisma.waitlistSignup.findMany({
      orderBy: { createdAt: "desc" },
      take,
      select: { id: true, email: true, source: true, createdAt: true },
    }),
  ]);
  return {
    count,
    signups: rows.map((r) => ({
      id: r.id,
      email: r.email,
      source: r.source,
      createdAt: r.createdAt.toISOString(),
    })),
  };
}
