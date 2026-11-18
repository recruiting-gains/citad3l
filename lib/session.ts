import { auth } from "@/auth";
import { prisma } from "./db";
export async function currentUser() {
  const s = await auth();
  const id = s?.user?.id;
  if (!id) return null;
  return prisma.user.findUnique({ where: { id }, select: { id: true, email: true, name: true } });
}
export function labelFor(u: { name: string | null; email: string | null }) {
  return u.name || u.email?.split("@")[0] || "there";
}
