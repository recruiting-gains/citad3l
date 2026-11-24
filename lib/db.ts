import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { getCloudflareContext } from "@opennextjs/cloudflare";

export class DatabaseUnavailable extends Error {}

type HyperdriveBinding = { connectionString: string };
type CfCtx = { env: Record<string, unknown>; ctx: object };

/** Cloudflare request context when running on Workers; undefined in Node/tests. */
function cfContext(): CfCtx | undefined {
  try {
    return getCloudflareContext() as unknown as CfCtx;
  } catch {
    return undefined;
  }
}

function hyperdrive(cf: CfCtx | undefined): HyperdriveBinding | undefined {
  const hd = cf?.env?.HYPERDRIVE as HyperdriveBinding | undefined;
  return hd && typeof hd.connectionString === "string" && hd.connectionString ? hd : undefined;
}

function create(url: string): PrismaClient {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: url, max: 5 }), log: ["error"] });
}

// Workers: sockets can't be shared across requests, so build one client per request
// (keyed on the request's ExecutionContext) over Hyperdrive, which does the real pooling.
// Node/tests: one lazy global client from DATABASE_URL.
const perRequest = new WeakMap<object, PrismaClient>();
const g = globalThis as unknown as { __prisma?: PrismaClient };

function client(): PrismaClient {
  const cf = cfContext();
  const hd = hyperdrive(cf);
  if (hd && cf?.ctx) {
    let c = perRequest.get(cf.ctx);
    if (!c) {
      c = create(hd.connectionString);
      perRequest.set(cf.ctx, c);
    }
    return c;
  }
  if (!g.__prisma) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new DatabaseUnavailable("DATABASE_URL is not configured");
    g.__prisma = create(url);
  }
  return g.__prisma;
}

// Lazy: nothing connects (or throws) until the first real query, so public pages render without a database.
export const prisma = new Proxy({} as PrismaClient, {
  get(_t, prop) {
    const c = client() as unknown as Record<string | symbol, unknown>;
    const v = c[prop];
    return typeof v === "function" ? (v as (...a: unknown[]) => unknown).bind(c) : v;
  },
});
export function dbConfigured() {
  return !!process.env.DATABASE_URL || !!hyperdrive(cfContext());
}
