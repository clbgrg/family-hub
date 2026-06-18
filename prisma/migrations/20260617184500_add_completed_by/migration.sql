-- Track who marked a chore completion (the session user), distinct from the
-- credited assignee (userId). Nullable + SetNull so existing rows and points
-- survive, and the marker's deletion doesn't remove the completion.

-- AlterTable
ALTER TABLE "chore_completions" ADD COLUMN "completedById" TEXT;

-- AddForeignKey
ALTER TABLE "chore_completions" ADD CONSTRAINT "chore_completions_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
