/*
  Warnings:

  - Made the column `uuid` on table `User` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "SourceType" AS ENUM ('PERSONAL', 'STUDIO', 'OFFICIAL', 'BRAND', 'OTHER');

-- CreateEnum
CREATE TYPE "TaskType" AS ENUM ('FULL', 'INCREMENTAL', 'MANUAL');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "WeiboMediaType" AS ENUM ('IMAGE', 'GIF', 'VIDEO', 'LIVE_PHOTO');

-- CreateEnum
CREATE TYPE "DownloadStatus" AS ENUM ('PENDING', 'DOWNLOADING', 'COMPLETED', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "MediaSourceType" AS ENUM ('UPLOAD', 'WEIBO', 'BILIBILI', 'OTHER');

-- AlterTable
ALTER TABLE "Media" ADD COLUMN     "source_type" "MediaSourceType" NOT NULL DEFAULT 'UPLOAD';

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "uuid" SET NOT NULL;

-- CreateTable
CREATE TABLE "WeiboSource" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "user_id" VARCHAR(20) NOT NULL,
    "username" VARCHAR(50),
    "nickname" VARCHAR(50),
    "avatar_url" TEXT,
    "source_type" "SourceType" NOT NULL DEFAULT 'PERSONAL',
    "priority" INTEGER NOT NULL DEFAULT 1,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_crawl_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WeiboSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeiboTask" (
    "id" TEXT NOT NULL,
    "source_id" TEXT NOT NULL,
    "task_type" "TaskType" NOT NULL DEFAULT 'INCREMENTAL',
    "status" "TaskStatus" NOT NULL DEFAULT 'PENDING',
    "since_date" TIMESTAMP(3),
    "total_posts" INTEGER NOT NULL DEFAULT 0,
    "media_count" INTEGER NOT NULL DEFAULT 0,
    "error_message" TEXT,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WeiboTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeiboPost" (
    "id" TEXT NOT NULL,
    "source_id" TEXT NOT NULL,
    "bid" VARCHAR(20),
    "text" TEXT NOT NULL,
    "article_url" TEXT,
    "topics" VARCHAR(500),
    "at_users" VARCHAR(500),
    "location" VARCHAR(100),
    "created_time" TIMESTAMP(3) NOT NULL,
    "source_info" VARCHAR(100),
    "attitudes_count" INTEGER NOT NULL DEFAULT 0,
    "comments_count" INTEGER NOT NULL DEFAULT 0,
    "reposts_count" INTEGER NOT NULL DEFAULT 0,
    "is_processed" BOOLEAN NOT NULL DEFAULT false,
    "is_filtered" BOOLEAN NOT NULL DEFAULT false,
    "filter_reason" VARCHAR(500),
    "filter_category" VARCHAR(50),
    "filter_confidence" DOUBLE PRECISION,
    "raw_data" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WeiboPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeiboMedia" (
    "id" TEXT NOT NULL,
    "post_id" TEXT NOT NULL,
    "media_id" TEXT,
    "original_url" TEXT NOT NULL,
    "file_type" "WeiboMediaType" NOT NULL,
    "file_size" BIGINT,
    "width" INTEGER,
    "height" INTEGER,
    "duration" INTEGER,
    "download_status" "DownloadStatus" NOT NULL DEFAULT 'PENDING',
    "local_path" TEXT,
    "error_message" TEXT,
    "downloaded_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WeiboMedia_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WeiboSource_user_id_idx" ON "WeiboSource"("user_id");

-- CreateIndex
CREATE INDEX "WeiboSource_is_active_priority_idx" ON "WeiboSource"("is_active", "priority");

-- CreateIndex
CREATE INDEX "WeiboTask_source_id_status_idx" ON "WeiboTask"("source_id", "status");

-- CreateIndex
CREATE INDEX "WeiboTask_created_at_idx" ON "WeiboTask"("created_at");

-- CreateIndex
CREATE INDEX "WeiboPost_source_id_created_time_idx" ON "WeiboPost"("source_id", "created_time");

-- CreateIndex
CREATE INDEX "WeiboPost_is_processed_idx" ON "WeiboPost"("is_processed");

-- CreateIndex
CREATE INDEX "WeiboPost_is_filtered_idx" ON "WeiboPost"("is_filtered");

-- CreateIndex
CREATE INDEX "WeiboPost_created_time_idx" ON "WeiboPost"("created_time");

-- CreateIndex
CREATE INDEX "WeiboMedia_post_id_idx" ON "WeiboMedia"("post_id");

-- CreateIndex
CREATE INDEX "WeiboMedia_download_status_idx" ON "WeiboMedia"("download_status");

-- CreateIndex
CREATE INDEX "WeiboMedia_media_id_idx" ON "WeiboMedia"("media_id");

-- AddForeignKey
ALTER TABLE "WeiboTask" ADD CONSTRAINT "WeiboTask_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "WeiboSource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeiboPost" ADD CONSTRAINT "WeiboPost_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "WeiboSource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeiboMedia" ADD CONSTRAINT "WeiboMedia_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "WeiboPost"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeiboMedia" ADD CONSTRAINT "WeiboMedia_media_id_fkey" FOREIGN KEY ("media_id") REFERENCES "Media"("id") ON DELETE SET NULL ON UPDATE CASCADE;
