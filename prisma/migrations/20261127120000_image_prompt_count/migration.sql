-- Image and video asks that came back as an image prompt (2026-11-27).
-- One counter per Chicago day and plan. No prompt text, no user id.
CREATE TABLE IF NOT EXISTS "ImagePromptCount" (
    "day" TEXT NOT NULL,
    "plan" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ImagePromptCount_pkey" PRIMARY KEY ("day", "plan")
);
