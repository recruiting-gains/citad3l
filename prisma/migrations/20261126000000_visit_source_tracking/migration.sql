-- Visitor source tracking (2026-11-25). Additive only: two new tables. No changes to existing tables or rows.
-- CreateTable
CREATE TABLE IF NOT EXISTS "VisitSource" (
    "id" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "medium" TEXT,
    "campaign" TEXT,
    "content" TEXT,
    "referrerHost" TEXT,
    "landingPath" TEXT NOT NULL DEFAULT '/',
    "tagged" BOOLEAN NOT NULL DEFAULT false,
    "visitorHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VisitSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "SourceAttribution" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "userId" TEXT,
    "guestId" TEXT,
    "source" TEXT NOT NULL,
    "medium" TEXT,
    "campaign" TEXT,
    "content" TEXT,
    "referrerHost" TEXT,
    "visitorHash" TEXT,
    "plan" TEXT,
    "amountCents" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SourceAttribution_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "VisitSource_day_source_idx" ON "VisitSource"("day", "source");
CREATE INDEX IF NOT EXISTS "VisitSource_createdAt_idx" ON "VisitSource"("createdAt");
CREATE UNIQUE INDEX IF NOT EXISTS "SourceAttribution_kind_userId_key" ON "SourceAttribution"("kind", "userId");
CREATE UNIQUE INDEX IF NOT EXISTS "SourceAttribution_kind_guestId_key" ON "SourceAttribution"("kind", "guestId");
CREATE INDEX IF NOT EXISTS "SourceAttribution_day_kind_source_idx" ON "SourceAttribution"("day", "kind", "source");
