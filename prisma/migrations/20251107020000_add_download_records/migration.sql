-- CreateTable
CREATE TABLE "DownloadRecord" (
    "id" TEXT NOT NULL,
    "user_id" INTEGER NOT NULL,
    "media_id" TEXT NOT NULL,
    "media_type" "MediaType" NOT NULL,
    "file_name" VARCHAR(255),
    "file_type" VARCHAR(50),
    "file_size" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DownloadRecord_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "DownloadRecord" ADD CONSTRAINT "DownloadRecord_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DownloadRecord" ADD CONSTRAINT "DownloadRecord_media_id_fkey" FOREIGN KEY ("media_id") REFERENCES "Media"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Indexes
CREATE INDEX "DownloadRecord_user_id_created_at_idx" ON "DownloadRecord"("user_id", "created_at");
CREATE INDEX "DownloadRecord_media_id_created_at_idx" ON "DownloadRecord"("media_id", "created_at");
