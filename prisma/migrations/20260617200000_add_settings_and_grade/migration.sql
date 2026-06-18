-- Household key/value settings + an optional grade on school items.

-- CreateTable
CREATE TABLE "settings" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("key")
);

-- AlterTable
ALTER TABLE "school_items" ADD COLUMN "grade" TEXT;
