-- CreateTable
CREATE TABLE "VideoQuality" (
    "id" TEXT NOT NULL,
    "media_id" TEXT NOT NULL,
    "quality" VARCHAR(20) NOT NULL,
    "url" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "bitrate" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VideoQuality_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VideoQuality_media_id_quality_idx" ON "VideoQuality"("media_id", "quality");

-- AddForeignKey
ALTER TABLE "VideoQuality" ADD CONSTRAINT "VideoQuality_media_id_fkey" FOREIGN KEY ("media_id") REFERENCES "Media"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
