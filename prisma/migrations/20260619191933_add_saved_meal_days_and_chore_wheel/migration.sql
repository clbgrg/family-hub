-- AlterTable
ALTER TABLE "chores" ADD COLUMN     "wheelEligible" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "saved_meals" ADD COLUMN     "defaultDays" INTEGER[] DEFAULT ARRAY[]::INTEGER[];
