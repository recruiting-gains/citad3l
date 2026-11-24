/**
 * Move inline data:image payloads out of Message.content and into the IMAGES R2 bucket.
 *
 * Dry-run (default) only needs DATABASE_URL and prints counts. It does not write.
 *
 *   DATABASE_URL='...' npx tsx scripts/migrate-images-to-r2.ts
 *
 * Apply mode needs the bucket too, which is only available after the deploy steps
 * in notes/r2-images-deploy.md. Do not run apply against production from this
 * overnight branch until that bucket exists and the Worker is serving /api/images.
 *
 *   DRY_RUN=0 DATABASE_URL='...' npx tsx scripts/migrate-images-to-r2.ts
 *
 * This Node entry point cannot see a Workers R2 binding. Apply mode therefore
 * exits unless you later add an S3-compatible adapter. The library function
 * migrateInlineImages() is what a Worker-side one-shot should call.
 */
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { migrateInlineImages } from "../lib/images-r2";

const dryRun = process.env.DRY_RUN !== "0";
const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is required (dry-run or apply).");
  process.exit(1);
}
if (!dryRun) {
  console.error("Apply mode is disabled in this script until the R2 bucket exists and a Worker binding can be used.");
  console.error("See notes/r2-images-deploy.md. Re-run with DRY_RUN unset to count only.");
  process.exit(2);
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url, max: 2 }) });

const result = await migrateInlineImages({
  list: async ({ offset, limit }) =>
    prisma.message.findMany({
      where: { content: { contains: "data:image" } },
      select: { id: true, userId: true, content: true },
      orderBy: { createdAt: "asc" },
      skip: offset,
      take: limit,
    }),
  updateContent: async () => {
    throw new Error("dry-run must not write");
  },
  bucket: null,
  dryRun: true,
});

const mb = (result.bytesMoved / (1024 * 1024)).toFixed(2);
console.log(
  JSON.stringify(
    {
      dryRun: true,
      scannedMatchingRows: result.scanned,
      wouldMigrate: result.migrated,
      skipped: result.skipped,
      bytesMoved: result.bytesMoved,
      approxMiB: mb,
    },
    null,
    2,
  ),
);
await prisma.$disconnect();
