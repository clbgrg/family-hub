-- Up-for-grabs (claimable) chores + an optional fixed reward per chore.

-- AlterTable
ALTER TABLE "chores" ADD COLUMN "claimable" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "rewardId" TEXT;

-- AddForeignKey
ALTER TABLE "chores" ADD CONSTRAINT "chores_rewardId_fkey" FOREIGN KEY ("rewardId") REFERENCES "rewards"("id") ON DELETE SET NULL ON UPDATE CASCADE;
