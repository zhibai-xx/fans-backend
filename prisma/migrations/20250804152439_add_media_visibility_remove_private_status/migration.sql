/*
  Warnings:

  - The values [PRIVATE] on the enum `MediaStatus` will be removed. If these variants are still used in the database, this will fail.

*/
-- CreateEnum
CREATE TYPE "MediaVisibility" AS ENUM ('VISIBLE', 'HIDDEN');

-- AlterEnum
BEGIN;
CREATE TYPE "MediaStatus_new" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
ALTER TABLE "Media" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Media" ALTER COLUMN "status" TYPE "MediaStatus_new" USING ("status"::text::"MediaStatus_new");
ALTER TYPE "MediaStatus" RENAME TO "MediaStatus_old";
ALTER TYPE "MediaStatus_new" RENAME TO "MediaStatus";
DROP TYPE "MediaStatus_old";
ALTER TABLE "Media" ALTER COLUMN "status" SET DEFAULT 'PENDING';
COMMIT;

-- AlterTable
ALTER TABLE "Media" ADD COLUMN     "visibility" "MediaVisibility" NOT NULL DEFAULT 'VISIBLE';
