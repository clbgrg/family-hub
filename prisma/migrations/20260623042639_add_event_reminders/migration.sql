-- AlterTable
ALTER TABLE "calendar_events" ADD COLUMN     "reminders" INTEGER[] DEFAULT ARRAY[]::INTEGER[];
