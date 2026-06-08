/*
  Warnings:

  - You are about to drop the column `label` on the `calendar_events` table. All the data in the column will be lost.
  - You are about to drop the column `rrule` on the `calendar_events` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "calendar_events" DROP COLUMN "label",
DROP COLUMN "rrule",
ADD COLUMN     "ical_event" JSONB;
