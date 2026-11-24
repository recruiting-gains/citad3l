import { prisma } from "./db";
import { memoryGuestStore, type GuestStore } from "./guest";

export function prismaGuestStore(): GuestStore {
  return {
    async get(id) {
      const r = await prisma.guestQuota.findUnique({ where: { guestId: id } });
      return r ? { used: r.used, reserved: r.reserved, ipHash: r.ipHash, dayUsed: r.dayUsed, dayStart: r.dayStart } : null;
    },
    async save(id, ipHash, used, reserved, dayUsed, dayStart) {
      await prisma.guestQuota.upsert({
        where: { guestId: id },
        create: { guestId: id, ipHash, used, reserved, dayUsed, dayStart },
        update: { ipHash, used, reserved, dayUsed, dayStart },
      });
    },
    async ipDayUsed(ipHash, since) {
      const rows = await prisma.guestQuota.findMany({
        where: { ipHash, dayStart: { gte: since } },
        select: { dayUsed: true },
      });
      return rows.reduce((a, r) => a + r.dayUsed, 0);
    },
  };
}

export async function guestStore(): Promise<GuestStore> {
  try {
    // Probe the table; fall back to memory if the database isn't ready.
    await prisma.$queryRaw`SELECT 1`;
    return prismaGuestStore();
  } catch {
    return memoryGuestStore();
  }
}
