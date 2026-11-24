import { auth } from "@/auth";
import { prisma } from "./db";
export async function currentUser() {
  try {
    const s = await auth();
    const id = s?.user?.id;
    if (!id) return null;
    return await prisma.user.findUnique({ where: { id }, select: { id: true, email: true, name: true } });
  } catch {
    return null; // auth or database unavailable (e.g. public preview without Postgres) → treat as signed out
  }
}
export function labelFor(u: { name: string | null; email: string | null }) {
  return u.name || u.email?.split("@")[0] || "there";
}
