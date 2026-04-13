-- CreateEnum
CREATE TYPE "UploadStatus" AS ENUM ('PENDING', 'UPLOADING', 'MERGING', 'COMPLETED', 'FAILED', 'EXPIRED');

-- CreateTable
CREATE TABLE "Upload" (
    "id" TEXT NOT NULL,
    "filename" VARCHAR(255) NOT NULL,
    "file_size" BIGINT NOT NULL,
    "file_type" VARCHAR(10) NOT NULL,
    "file_md5" VARCHAR(32) NOT NULL,
    "chunk_size" INTEGER NOT NULL,
    "total_chunks" INTEGER NOT NULL,
    "uploaded_chunks" JSONB NOT NULL DEFAULT '[]',
    "status" "UploadStatus" NOT NULL DEFAULT 'PENDING',
    "temp_path" TEXT,
    "final_path" TEXT,
    "error_message" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "expires_at" TIMESTAMP(3),
    "user_id" INTEGER NOT NULL,
    "media_id" TEXT,

    CONSTRAINT "Upload_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Upload_media_id_key" ON "Upload"("media_id");

-- CreateIndex
CREATE INDEX "Upload_file_md5_idx" ON "Upload"("file_md5");

-- CreateIndex
CREATE INDEX "Upload_user_id_status_idx" ON "Upload"("user_id", "status");

-- CreateIndex
CREATE INDEX "Upload_expires_at_idx" ON "Upload"("expires_at");

-- AddForeignKey
ALTER TABLE "Upload" ADD CONSTRAINT "Upload_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Upload" ADD CONSTRAINT "Upload_media_id_fkey" FOREIGN KEY ("media_id") REFERENCES "Media"("id") ON DELETE SET NULL ON UPDATE CASCADE;
