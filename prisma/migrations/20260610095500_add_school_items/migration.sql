-- Structured school items (assignable, check-off-able, gamified into the same
-- points pool as chores). Purely additive.

-- CreateTable
CREATE TABLE "school_items" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "points" INTEGER NOT NULL DEFAULT 0,
    "dueDate" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "school_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "school_item_completions" (
    "id" TEXT NOT NULL,
    "schoolItemId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "localDate" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "school_item_completions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "school_items_userId_dueDate_idx" ON "school_items"("userId", "dueDate");

-- CreateIndex
CREATE UNIQUE INDEX "school_item_completions_schoolItemId_key" ON "school_item_completions"("schoolItemId");

-- AddForeignKey
ALTER TABLE "school_items" ADD CONSTRAINT "school_items_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "school_item_completions" ADD CONSTRAINT "school_item_completions_schoolItemId_fkey" FOREIGN KEY ("schoolItemId") REFERENCES "school_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "school_item_completions" ADD CONSTRAINT "school_item_completions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
