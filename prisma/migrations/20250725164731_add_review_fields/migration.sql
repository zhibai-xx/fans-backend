-- AlterTable
ALTER TABLE "Media" ADD COLUMN     "review_comment" VARCHAR(500),
ADD COLUMN     "reviewed_at" TIMESTAMP(3),
ADD COLUMN     "reviewed_by" INTEGER;

-- CreateIndex
CREATE INDEX "Media_reviewed_by_reviewed_at_idx" ON "Media"("reviewed_by", "reviewed_at");

-- AddForeignKey
ALTER TABLE "Media" ADD CONSTRAINT "Media_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
