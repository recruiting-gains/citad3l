import { prisma } from "./db";

export async function bannedMessage(userId: string): Promise<string | null> {
  try {
    const u = await prisma.user.findUnique({ where: { id: userId }, select: { bannedAt: true, bannedReason: true } });
    if (u?.bannedAt) return u.bannedReason || "This account is suspended.";
    return null;
  } catch {
    return null;
  }
}
