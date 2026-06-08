-- CreateEnum
CREATE TYPE "ChoreRecurrence" AS ENUM ('ONCE', 'DAILY', 'WEEKLY');

-- CreateTable
CREATE TABLE "chores" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "points" INTEGER NOT NULL DEFAULT 0,
    "recurrence" "ChoreRecurrence" NOT NULL DEFAULT 'DAILY',
    "daysOfWeek" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "order" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "assigneeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chore_completions" (
    "id" TEXT NOT NULL,
    "choreId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "localDate" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chore_completions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "chore_completions_choreId_localDate_key" ON "chore_completions"("choreId", "localDate");

-- AddForeignKey
ALTER TABLE "chores" ADD CONSTRAINT "chores_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chore_completions" ADD CONSTRAINT "chore_completions_choreId_fkey" FOREIGN KEY ("choreId") REFERENCES "chores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chore_completions" ADD CONSTRAINT "chore_completions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

