-- CreateTable
CREATE TABLE "pinned_notes" (
    "id" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "authorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pinned_notes_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "pinned_notes" ADD CONSTRAINT "pinned_notes_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
