import { prisma } from "./db";
import type { Project } from "./types";
export async function listProjects(userId: string): Promise<Project[]> {
  const rows = await prisma.project.findMany({ where: { userId }, orderBy: { updatedAt: "desc" }, include: { _count: { select: { conversations: true } } } });
  return rows.map((p) => ({ id: p.id, name: p.name, instructions: p.instructions, updatedAt: p.updatedAt.toISOString(), conversationCount: p._count.conversations }));
}
