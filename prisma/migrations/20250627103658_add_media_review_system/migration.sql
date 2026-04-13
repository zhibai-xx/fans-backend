-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "WeiboMedia" ADD COLUMN     "review_reason" VARCHAR(500),
ADD COLUMN     "review_status" "ReviewStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "reviewed_at" TIMESTAMP(3),
ADD COLUMN     "reviewed_by" INTEGER;

-- CreateIndex
CREATE INDEX "WeiboMedia_review_status_idx" ON "WeiboMedia"("review_status");

-- AddForeignKey
ALTER TABLE "WeiboMedia" ADD CONSTRAINT "WeiboMedia_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
