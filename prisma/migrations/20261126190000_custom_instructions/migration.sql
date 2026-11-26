-- Custom instructions (2026-11-26). Additive only: one new table. No changes to existing tables or rows.
-- CreateTable
CREATE TABLE IF NOT EXISTS "CustomInstructions" (
    "userId" TEXT NOT NULL,
    "text" TEXT NOT NULL DEFAULT '',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomInstructions_pkey" PRIMARY KEY ("userId")
);

-- AddForeignKey (deleting an account deletes its instructions)
DO $$ BEGIN
  ALTER TABLE "CustomInstructions" ADD CONSTRAINT "CustomInstructions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
