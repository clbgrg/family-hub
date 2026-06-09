-- CreateEnum
CREATE TYPE "BadgeRuleType" AS ENUM ('STREAK', 'TOTAL_POINTS', 'TOTAL_COMPLETIONS', 'POINTS_IN_DAY');

-- CreateTable
CREATE TABLE "badges" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "description" TEXT,
    "ruleType" "BadgeRuleType" NOT NULL,
    "threshold" INTEGER NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "badges_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "badges_key_key" ON "badges"("key");

