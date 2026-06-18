-- Chore scheduling: active window (start/end), timed pause, and multi-assignee
-- rotation. All dates are client-local YYYY-MM-DD text; rotate defaults off.

-- AlterTable
ALTER TABLE "chores" ADD COLUMN "startDate" TEXT,
ADD COLUMN "endDate" TEXT,
ADD COLUMN "pausedUntil" TEXT,
ADD COLUMN "rotate" BOOLEAN NOT NULL DEFAULT false;
