-- CreateEnum
CREATE TYPE "MediaRecycleAction" AS ENUM ('SOFT_DELETE', 'RESTORE', 'HARD_DELETE', 'CLEANUP_SCHEDULED', 'CLEANUP_SUCCESS', 'CLEANUP_FAIL');

-- AlterTable
ALTER TABLE "Media" ADD COLUMN     "cleanup_scheduled_at" TIMESTAMP(3),
ADD COLUMN     "deleted_at" TIMESTAMP(3),
ADD COLUMN     "deleted_by" INTEGER,
ADD COLUMN     "deleted_reason" VARCHAR(500);

-- CreateTable
CREATE TABLE "MediaRecycleLog" (
    "id" TEXT NOT NULL,
    "media_id" TEXT NOT NULL,
    "action" "MediaRecycleAction" NOT NULL,
    "operator_id" INTEGER,
    "reason" VARCHAR(500),
    "meta" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MediaRecycleLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MediaRecycleLog_media_id_created_at_idx" ON "MediaRecycleLog"("media_id", "created_at");

-- CreateIndex
CREATE INDEX "MediaRecycleLog_action_created_at_idx" ON "MediaRecycleLog"("action", "created_at");

-- CreateIndex
CREATE INDEX "MediaRecycleLog_operator_id_created_at_idx" ON "MediaRecycleLog"("operator_id", "created_at");

-- CreateIndex
CREATE INDEX "Media_deleted_at_cleanup_scheduled_at_idx" ON "Media"("deleted_at", "cleanup_scheduled_at");

-- CreateIndex
CREATE INDEX "Media_deleted_by_idx" ON "Media"("deleted_by");

-- AddForeignKey
ALTER TABLE "MediaRecycleLog" ADD CONSTRAINT "MediaRecycleLog_media_id_fkey" FOREIGN KEY ("media_id") REFERENCES "Media"("id") ON DELETE CASCADE ON UPDATE CASCADE;
