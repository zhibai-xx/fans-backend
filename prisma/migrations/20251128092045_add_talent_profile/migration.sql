-- CreateEnum
CREATE TYPE "TalentWorkType" AS ENUM ('MOVIE', 'TV_SERIES', 'VARIETY', 'SHORT_FILM', 'OTHER');

-- CreateEnum
CREATE TYPE "TalentWorkStatus" AS ENUM ('ANNOUNCED', 'FILMING', 'POST_PRODUCTION', 'RELEASED');

-- CreateEnum
CREATE TYPE "TalentEndorsementStatus" AS ENUM ('ONGOING', 'COMPLETED', 'UPCOMING');

-- CreateEnum
CREATE TYPE "TalentCandidateStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "TalentDataSource" AS ENUM ('WIKIDATA', 'WIKIPEDIA', 'MANUAL');

-- CreateEnum
CREATE TYPE "TalentDataType" AS ENUM ('WORK', 'AWARD', 'ENDORSEMENT');

-- CreateTable
CREATE TABLE "TalentProfile" (
    "id" TEXT NOT NULL,
    "slug" VARCHAR(50) NOT NULL,
    "stage_name" VARCHAR(120) NOT NULL,
    "birth_name" VARCHAR(120),
    "birth_date" TIMESTAMP(3),
    "birthplace" VARCHAR(200),
    "biography" VARCHAR(2000),
    "hero_image_url" VARCHAR(500),
    "avatar_url" VARCHAR(500),
    "height_cm" INTEGER,
    "agency" VARCHAR(200),
    "blood_type" VARCHAR(5),
    "wikipedia_url" VARCHAR(500),
    "wikidata_id" VARCHAR(120),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TalentProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TalentWork" (
    "id" TEXT NOT NULL,
    "talent_id" TEXT NOT NULL,
    "type" "TalentWorkType" NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "role" VARCHAR(120),
    "status" "TalentWorkStatus",
    "year" INTEGER,
    "description" VARCHAR(500),
    "cover_url" VARCHAR(500),
    "order_index" INTEGER NOT NULL DEFAULT 0,
    "is_hidden" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TalentWork_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TalentAward" (
    "id" TEXT NOT NULL,
    "talent_id" TEXT NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "organization" VARCHAR(200),
    "year" INTEGER,
    "category" VARCHAR(200),
    "result" VARCHAR(100),
    "is_highlight" BOOLEAN NOT NULL DEFAULT false,
    "is_hidden" BOOLEAN NOT NULL DEFAULT false,
    "notes" VARCHAR(500),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TalentAward_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TalentEndorsement" (
    "id" TEXT NOT NULL,
    "talent_id" TEXT NOT NULL,
    "brand" VARCHAR(200) NOT NULL,
    "role" VARCHAR(200),
    "status" "TalentEndorsementStatus" NOT NULL DEFAULT 'ONGOING',
    "start_date" TIMESTAMP(3),
    "end_date" TIMESTAMP(3),
    "is_featured" BOOLEAN NOT NULL DEFAULT false,
    "is_hidden" BOOLEAN NOT NULL DEFAULT false,
    "description" VARCHAR(500),
    "contract_url" VARCHAR(500),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TalentEndorsement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TalentDataCandidate" (
    "id" TEXT NOT NULL,
    "talent_id" TEXT NOT NULL,
    "source" "TalentDataSource" NOT NULL,
    "item_type" "TalentDataType" NOT NULL,
    "payload" JSONB NOT NULL,
    "diff_hash" VARCHAR(120),
    "status" "TalentCandidateStatus" NOT NULL DEFAULT 'PENDING',
    "notes" VARCHAR(500),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "reviewed_at" TIMESTAMP(3),
    "approved_by" INTEGER,

    CONSTRAINT "TalentDataCandidate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TalentProfile_slug_key" ON "TalentProfile"("slug");

-- CreateIndex
CREATE INDEX "TalentWork_talent_id_type_idx" ON "TalentWork"("talent_id", "type");

-- CreateIndex
CREATE INDEX "TalentWork_talent_id_order_index_idx" ON "TalentWork"("talent_id", "order_index");

-- CreateIndex
CREATE INDEX "TalentAward_talent_id_year_idx" ON "TalentAward"("talent_id", "year");

-- CreateIndex
CREATE INDEX "TalentEndorsement_talent_id_status_idx" ON "TalentEndorsement"("talent_id", "status");

-- CreateIndex
CREATE INDEX "TalentEndorsement_talent_id_is_featured_idx" ON "TalentEndorsement"("talent_id", "is_featured");

-- CreateIndex
CREATE INDEX "TalentDataCandidate_talent_id_status_idx" ON "TalentDataCandidate"("talent_id", "status");

-- CreateIndex
CREATE INDEX "TalentDataCandidate_diff_hash_idx" ON "TalentDataCandidate"("diff_hash");

-- AddForeignKey
ALTER TABLE "TalentWork" ADD CONSTRAINT "TalentWork_talent_id_fkey" FOREIGN KEY ("talent_id") REFERENCES "TalentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TalentAward" ADD CONSTRAINT "TalentAward_talent_id_fkey" FOREIGN KEY ("talent_id") REFERENCES "TalentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TalentEndorsement" ADD CONSTRAINT "TalentEndorsement_talent_id_fkey" FOREIGN KEY ("talent_id") REFERENCES "TalentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TalentDataCandidate" ADD CONSTRAINT "TalentDataCandidate_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TalentDataCandidate" ADD CONSTRAINT "TalentDataCandidate_talent_id_fkey" FOREIGN KEY ("talent_id") REFERENCES "TalentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
