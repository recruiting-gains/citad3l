-- AlterTable
ALTER TABLE "Entitlement" ADD COLUMN IF NOT EXISTS "windowUsed" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Entitlement" ADD COLUMN IF NOT EXISTS "windowStart" TIMESTAMP(3);
ALTER TABLE "Entitlement" ADD COLUMN IF NOT EXISTS "windowEnd" TIMESTAMP(3);
ALTER TABLE "Entitlement" ADD COLUMN IF NOT EXISTS "weekUsed" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Entitlement" ADD COLUMN IF NOT EXISTS "weekStart" TIMESTAMP(3);
ALTER TABLE "Entitlement" ADD COLUMN IF NOT EXISTS "weekEnd" TIMESTAMP(3);

-- CreateTable
CREATE TABLE IF NOT EXISTS "UserModelSettings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "systemPrompt" TEXT NOT NULL DEFAULT '',
    "temperature" DOUBLE PRECISION,
    "maxTokens" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserModelSettings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "UserModelSettings_userId_modelId_key" ON "UserModelSettings"("userId", "modelId");

ALTER TABLE "UserModelSettings" DROP CONSTRAINT IF EXISTS "UserModelSettings_userId_fkey";
ALTER TABLE "UserModelSettings" ADD CONSTRAINT "UserModelSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "LoginSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "userAgent" TEXT,
    "ipHash" TEXT,

    CONSTRAINT "LoginSession_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "LoginSession_userId_revokedAt_idx" ON "LoginSession"("userId", "revokedAt");

ALTER TABLE "LoginSession" DROP CONSTRAINT IF EXISTS "LoginSession_userId_fkey";
ALTER TABLE "LoginSession" ADD CONSTRAINT "LoginSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "Referral" (
    "userId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Referral_pkey" PRIMARY KEY ("userId")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Referral_code_key" ON "Referral"("code");

ALTER TABLE "Referral" DROP CONSTRAINT IF EXISTS "Referral_userId_fkey";
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "GuestQuota" (
    "id" TEXT NOT NULL,
    "guestId" TEXT NOT NULL,
    "ipHash" TEXT NOT NULL,
    "used" INTEGER NOT NULL DEFAULT 0,
    "reserved" INTEGER NOT NULL DEFAULT 0,
    "dayUsed" INTEGER NOT NULL DEFAULT 0,
    "dayStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GuestQuota_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "GuestQuota_guestId_key" ON "GuestQuota"("guestId");
CREATE INDEX IF NOT EXISTS "GuestQuota_ipHash_idx" ON "GuestQuota"("ipHash");

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "bannedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "bannedReason" TEXT;

ALTER TABLE "Entitlement" ADD COLUMN IF NOT EXISTS "refundMarkedAt" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "AdminAuditLog" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetUserId" TEXT,
    "detail" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AdminAuditLog_createdAt_idx" ON "AdminAuditLog"("createdAt");
CREATE INDEX IF NOT EXISTS "AdminAuditLog_targetUserId_idx" ON "AdminAuditLog"("targetUserId");

ALTER TABLE "AdminAuditLog" DROP CONSTRAINT IF EXISTS "AdminAuditLog_actorUserId_fkey";
ALTER TABLE "AdminAuditLog" ADD CONSTRAINT "AdminAuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AdminAuditLog" DROP CONSTRAINT IF EXISTS "AdminAuditLog_targetUserId_fkey";
ALTER TABLE "AdminAuditLog" ADD CONSTRAINT "AdminAuditLog_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "FilterRefusalLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "guestId" TEXT,
    "direction" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "modelId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FilterRefusalLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "FilterRefusalLog_createdAt_idx" ON "FilterRefusalLog"("createdAt");
CREATE INDEX IF NOT EXISTS "FilterRefusalLog_userId_idx" ON "FilterRefusalLog"("userId");

ALTER TABLE "FilterRefusalLog" DROP CONSTRAINT IF EXISTS "FilterRefusalLog_userId_fkey";
ALTER TABLE "FilterRefusalLog" ADD CONSTRAINT "FilterRefusalLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
