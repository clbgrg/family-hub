-- Multi-assignee chores: replace Chore.assigneeId with a chore_assignments
-- join table (each assignee completes their own copy and earns points).
-- DATA-PRESERVING: existing single assignees are backfilled into the join
-- table BEFORE the column is dropped. Existing completions already satisfy
-- the widened (choreId, userId, localDate) unique constraint.

-- CreateTable
CREATE TABLE "chore_assignments" (
    "choreId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "chore_assignments_pkey" PRIMARY KEY ("choreId","userId")
);

-- AddForeignKey
ALTER TABLE "chore_assignments" ADD CONSTRAINT "chore_assignments_choreId_fkey" FOREIGN KEY ("choreId") REFERENCES "chores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chore_assignments" ADD CONSTRAINT "chore_assignments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: every existing chore keeps its single assignee.
INSERT INTO "chore_assignments" ("choreId", "userId")
SELECT "id", "assigneeId" FROM "chores";

-- Widen the completion uniqueness to per-assignee-per-day.
DROP INDEX "chore_completions_choreId_localDate_key";
CREATE UNIQUE INDEX "chore_completions_choreId_userId_localDate_key" ON "chore_completions"("choreId", "userId", "localDate");

-- Drop the old single-assignee column.
ALTER TABLE "chores" DROP CONSTRAINT "chores_assigneeId_fkey";
ALTER TABLE "chores" DROP COLUMN "assigneeId";
