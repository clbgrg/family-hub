-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'MEMBER');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "pinHash" TEXT,
ADD COLUMN     "role" "Role" NOT NULL DEFAULT 'MEMBER';

