import type { FilterCategory, FilterVerdict } from "./filter";
import { prisma } from "./db";

/**
 * Record a refused prompt or reply. Stores only the category, direction, and
 * ids — never the prompt or response text.
 */
export async function logFilterRefusal(opts: {
  userId?: string | null;
  guestId?: string | null;
  direction: "input" | "output";
  verdict: FilterVerdict;
  modelId?: string | null;
}): Promise<void> {
  if (opts.verdict.allowed) return;
  const category: FilterCategory = opts.verdict.category;
  try {
    await prisma.filterRefusalLog.create({
      data: {
        userId: opts.userId ?? null,
        guestId: opts.guestId ?? null,
        direction: opts.direction,
        category,
        modelId: opts.modelId ?? null,
      },
    });
  } catch {
    /* logging must never break the request */
  }
}

export async function listFilterRefusals(take = 100) {
  const rows = await prisma.filterRefusalLog.findMany({
    orderBy: { createdAt: "desc" },
    take,
    include: { user: { select: { email: true } } },
  });
  return rows.map((r) => ({
    id: r.id,
    createdAt: r.createdAt.toISOString(),
    category: r.category,
    direction: r.direction,
    modelId: r.modelId,
    email: r.user?.email ?? null,
    guest: !r.userId && !!r.guestId,
  }));
}
