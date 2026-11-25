-- Referral hardening (2026-11-24 pen test, H1/H2). Additive / relaxing only: no rows deleted or rewritten.
-- 1) Keep referral rows when either account is deleted (user links become NULL instead of deleting the row).
ALTER TABLE "ReferralAttribution" ALTER COLUMN "referrerUserId" DROP NOT NULL;
ALTER TABLE "ReferralAttribution" ALTER COLUMN "referredUserId" DROP NOT NULL;
ALTER TABLE "ReferralAttribution" DROP CONSTRAINT IF EXISTS "ReferralAttribution_referrerUserId_fkey";
ALTER TABLE "ReferralAttribution" ADD CONSTRAINT "ReferralAttribution_referrerUserId_fkey" FOREIGN KEY ("referrerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ReferralAttribution" DROP CONSTRAINT IF EXISTS "ReferralAttribution_referredUserId_fkey";
ALTER TABLE "ReferralAttribution" ADD CONSTRAINT "ReferralAttribution_referredUserId_fkey" FOREIGN KEY ("referredUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- 2) New columns (all nullable or defaulted).
ALTER TABLE "ReferralAttribution" ADD COLUMN IF NOT EXISTS "referrerEmailHash" TEXT;
ALTER TABLE "ReferralAttribution" ADD COLUMN IF NOT EXISTS "referredEmailHash" TEXT;
ALTER TABLE "ReferralAttribution" ADD COLUMN IF NOT EXISTS "referredCardFingerprint" TEXT;
ALTER TABLE "ReferralAttribution" ADD COLUMN IF NOT EXISTS "firstPaidAmountCents" INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS "ReferralAttribution_referrerEmailHash_idx" ON "ReferralAttribution"("referrerEmailHash");
CREATE INDEX IF NOT EXISTS "ReferralAttribution_referredEmailHash_idx" ON "ReferralAttribution"("referredEmailHash");
CREATE INDEX IF NOT EXISTS "ReferralAttribution_referredCardFingerprint_idx" ON "ReferralAttribution"("referredCardFingerprint");
-- 3) Referral Pro has its own end date on the entitlement.
ALTER TABLE "Entitlement" ADD COLUMN IF NOT EXISTS "referralProEndsAt" TIMESTAMP(3);
