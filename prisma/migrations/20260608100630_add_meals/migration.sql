-- CreateEnum
CREATE TYPE "MealSlot" AS ENUM ('BREAKFAST', 'LUNCH', 'DINNER');

-- CreateTable
CREATE TABLE "meals" (
    "id" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "slot" "MealSlot" NOT NULL,
    "title" TEXT NOT NULL,
    "notes" TEXT,
    "ingredients" TEXT,
    "time" TEXT,
    "cookId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "meals_date_slot_key" ON "meals"("date", "slot");

-- AddForeignKey
ALTER TABLE "meals" ADD CONSTRAINT "meals_cookId_fkey" FOREIGN KEY ("cookId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

