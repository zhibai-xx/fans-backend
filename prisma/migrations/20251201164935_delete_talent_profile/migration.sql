/*
  Warnings:

  - You are about to drop the `TalentAward` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `TalentDataCandidate` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `TalentEndorsement` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `TalentProfile` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `TalentWork` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "TalentAward" DROP CONSTRAINT "TalentAward_talent_id_fkey";

-- DropForeignKey
ALTER TABLE "TalentDataCandidate" DROP CONSTRAINT "TalentDataCandidate_approved_by_fkey";

-- DropForeignKey
ALTER TABLE "TalentDataCandidate" DROP CONSTRAINT "TalentDataCandidate_talent_id_fkey";

-- DropForeignKey
ALTER TABLE "TalentEndorsement" DROP CONSTRAINT "TalentEndorsement_talent_id_fkey";

-- DropForeignKey
ALTER TABLE "TalentWork" DROP CONSTRAINT "TalentWork_talent_id_fkey";

-- DropTable
DROP TABLE "TalentAward";

-- DropTable
DROP TABLE "TalentDataCandidate";

-- DropTable
DROP TABLE "TalentEndorsement";

-- DropTable
DROP TABLE "TalentProfile";

-- DropTable
DROP TABLE "TalentWork";

-- DropEnum
DROP TYPE "TalentCandidateStatus";

-- DropEnum
DROP TYPE "TalentDataSource";

-- DropEnum
DROP TYPE "TalentDataType";

-- DropEnum
DROP TYPE "TalentEndorsementStatus";

-- DropEnum
DROP TYPE "TalentWorkStatus";

-- DropEnum
DROP TYPE "TalentWorkType";
