-- AlterTable
ALTER TABLE "calendar_events" ADD COLUMN     "parentId" TEXT,
ADD COLUMN     "recurrenceId" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "calendar_events_parentId_idx" ON "calendar_events"("parentId");

-- AddForeignKey
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "calendar_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
