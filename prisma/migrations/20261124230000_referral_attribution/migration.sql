-- Referral promo (2026-11-24). Additive only: one new table. No changes to existing tables or rows.
-- CreateTable
CREATE TABLE IF NOT EXISTS "ReferralAttribution" (
    "id" TEXT NOT NULL,
    "referrerUserId" TEXT NOT NULL,
    "referredUserId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'link',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reason" TEXT,
    "referredCustomerId" TEXT,
    "firstPaidInvoiceId" TEXT,
    "firstPaidAt" TIMESTAMP(3),
    "rewardKind" TEXT,
    "rewardCents" INTEGER NOT NULL DEFAULT 0,
    "rewardDays" INTEGER NOT NULL DEFAULT 0,
    "rewardEndsAt" TIMESTAMP(3),
    "referrerCustomerId" TEXT,
    "referrerCreditTxnId" TEXT,
    "reversalTxnId" TEXT,
    "creditedAt" TIMESTAMP(3),
    "reversedAt" TIMESTAMP(3),
    "flagReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReferralAttribution_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ReferralAttribution_referredUserId_key" ON "ReferralAttribution"("referredUserId");
CREATE INDEX IF NOT EXISTS "ReferralAttribution_referrerUserId_status_idx" ON "ReferralAttribution"("referrerUserId", "status");
CREATE INDEX IF NOT EXISTS "ReferralAttribution_referredCustomerId_idx" ON "ReferralAttribution"("referredCustomerId");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "ReferralAttribution" ADD CONSTRAINT "ReferralAttribution_referrerUserId_fkey" FOREIGN KEY ("referrerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "ReferralAttribution" ADD CONSTRAINT "ReferralAttribution_referredUserId_fkey" FOREIGN KEY ("referredUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
