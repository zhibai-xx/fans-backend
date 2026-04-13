/*
  Warnings:

  - The values [PENDING] on the enum `MediaStatus` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `deleted_by` on the `Media` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "MediaDeletionActor" AS ENUM ('USER', 'ADMIN');

-- AlterEnum
BEGIN;
CREATE TYPE "MediaStatus_new" AS ENUM ('PENDING_REVIEW', 'APPROVED', 'REJECTED', 'USER_DELETED', 'ADMIN_DELETED', 'SYSTEM_HIDDEN');
ALTER TABLE "Media" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Media" ALTER COLUMN "status" TYPE "MediaStatus_new" USING ("status"::text::"MediaStatus_new");
ALTER TYPE "MediaStatus" RENAME TO "MediaStatus_old";
ALTER TYPE "MediaStatus_new" RENAME TO "MediaStatus";
DROP TYPE "MediaStatus_old";
ALTER TABLE "Media" ALTER COLUMN "status" SET DEFAULT 'PENDING_REVIEW';
COMMIT;

-- DropIndex
DROP INDEX "Media_deleted_by_idx";

-- AlterTable
ALTER TABLE "Media" DROP COLUMN "deleted_by",
ADD COLUMN     "deleted_by_id" INTEGER,
ADD COLUMN     "deleted_by_type" "MediaDeletionActor",
ALTER COLUMN "status" SET DEFAULT 'PENDING_REVIEW';

-- CreateIndex
CREATE INDEX "Media_deleted_by_id_idx" ON "Media"("deleted_by_id");
