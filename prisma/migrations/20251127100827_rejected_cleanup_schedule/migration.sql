-- AlterTable
ALTER TABLE "Media" ADD COLUMN     "rejected_cleanup_completed_at" TIMESTAMP(3),
ADD COLUMN     "rejected_cleanup_scheduled_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Media_rejected_cleanup_scheduled_at_status_idx" ON "Media"("rejected_cleanup_scheduled_at", "status");
