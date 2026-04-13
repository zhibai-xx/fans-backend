/*
  Warnings:

  - You are about to drop the column `source_type` on the `Media` table. All the data in the column will be lost.
  - You are about to drop the `WeiboMedia` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `WeiboPost` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `WeiboSource` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `WeiboTask` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "MediaSource" AS ENUM ('USER_UPLOAD', 'WEIBO_CRAWL', 'API_IMPORT', 'BATCH_IMPORT');

-- DropForeignKey
ALTER TABLE "WeiboMedia" DROP CONSTRAINT "WeiboMedia_media_id_fkey";

-- DropForeignKey
ALTER TABLE "WeiboMedia" DROP CONSTRAINT "WeiboMedia_post_id_fkey";

-- DropForeignKey
ALTER TABLE "WeiboMedia" DROP CONSTRAINT "WeiboMedia_reviewed_by_fkey";

-- DropForeignKey
ALTER TABLE "WeiboPost" DROP CONSTRAINT "WeiboPost_source_id_fkey";

-- DropForeignKey
ALTER TABLE "WeiboTask" DROP CONSTRAINT "WeiboTask_source_id_fkey";

-- AlterTable
ALTER TABLE "Media" DROP COLUMN "source_type",
ADD COLUMN     "original_created_at" TIMESTAMP(3),
ADD COLUMN     "source" "MediaSource" NOT NULL DEFAULT 'USER_UPLOAD',
ADD COLUMN     "source_metadata" JSONB;

-- DropTable
DROP TABLE "WeiboMedia";

-- DropTable
DROP TABLE "WeiboPost";

-- DropTable
DROP TABLE "WeiboSource";

-- DropTable
DROP TABLE "WeiboTask";

-- DropEnum
DROP TYPE "DownloadStatus";

-- DropEnum
DROP TYPE "MediaSourceType";

-- DropEnum
DROP TYPE "ReviewStatus";

-- DropEnum
DROP TYPE "SourceType";

-- DropEnum
DROP TYPE "TaskStatus";

-- DropEnum
DROP TYPE "TaskType";

-- DropEnum
DROP TYPE "WeiboMediaType";

-- CreateIndex
CREATE INDEX "Media_source_original_created_at_idx" ON "Media"("source", "original_created_at");
