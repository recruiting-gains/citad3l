import { randomBytes } from "node:crypto";
import { prisma } from "./db";
import { appUrl } from "./config";

function makeCode(): string {
  return randomBytes(5).toString("base64url").replace(/[^a-zA-Z0-9]/g, "").slice(0, 8).toLowerCase();
}

export async function getOrCreateReferral(userId: string) {
  const existing = await prisma.referral.findUnique({ where: { userId } });
  if (existing) return existing;
  for (let i = 0; i < 5; i++) {
    const code = makeCode();
    try {
      return await prisma.referral.create({ data: { userId, code } });
    } catch {
      /* unique clash, retry */
    }
  }
  throw new Error("Could not create a referral code.");
}

export async function referralPayload(userId: string) {
  const row = await getOrCreateReferral(userId);
  return {
    code: row.code,
    url: `${appUrl()}/login?ref=${encodeURIComponent(row.code)}`,
    invited: [] as { email: string; joinedAt: string }[],
    payouts: false,
    blurb: "Share your link. A referral program will credit both of you when it launches — nothing is paid out yet.",
  };
}
