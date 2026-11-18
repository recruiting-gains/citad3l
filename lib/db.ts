import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

export class DatabaseUnavailable extends Error {}

function create(): PrismaClient {
  const url = process.env.DATABASE_URL;
  if (!url) throw new DatabaseUnavailable("DATABASE_URL is not configured");
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: url }), log: ["error"] });
}

// Lazy: nothing connects (or throws) until the first real query, so public pages render without a database.
const g = globalThis as unknown as { __prisma?: PrismaClient };
function client(): PrismaClient {
  if (!g.__prisma) g.__prisma = create();
  return g.__prisma;
}
export const prisma = new Proxy({} as PrismaClient, {
  get(_t, prop) {
    const c = client() as unknown as Record<string | symbol, unknown>;
    const v = c[prop];
    return typeof v === "function" ? (v as (...a: unknown[]) => unknown).bind(c) : v;
  },
});
export function dbConfigured() {
  return !!process.env.DATABASE_URL;
}
