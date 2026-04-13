CREATE TYPE "TagSource" AS ENUM ('ADMIN', 'USER');
CREATE TYPE "TagStatus" AS ENUM ('ACTIVE', 'BLOCKED');
CREATE TYPE "TagCreatorType" AS ENUM ('USER', 'ADMIN');

ALTER TABLE "Tag" ADD COLUMN "normalized_name" VARCHAR(30);
ALTER TABLE "Tag" ADD COLUMN "source" "TagSource" NOT NULL DEFAULT 'USER';
ALTER TABLE "Tag" ADD COLUMN "status" "TagStatus" NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "Tag" ADD COLUMN "created_by_id" INTEGER;
ALTER TABLE "Tag" ADD COLUMN "created_by_type" "TagCreatorType";

UPDATE "Tag"
SET "normalized_name" = lower(regexp_replace(trim("name"), E'\\s+', ' ', 'g'))
WHERE "normalized_name" IS NULL;

WITH ranked AS (
  SELECT
    id,
    "normalized_name",
    row_number() OVER (PARTITION BY "normalized_name" ORDER BY "created_at", id) AS rn
  FROM "Tag"
)
UPDATE "Tag" t
SET "normalized_name" = left(t."normalized_name" || '-' || substr(t.id, 1, 6), 30)
FROM ranked r
WHERE t.id = r.id AND r.rn > 1;

ALTER TABLE "Tag" ALTER COLUMN "normalized_name" SET NOT NULL;

CREATE UNIQUE INDEX "Tag_normalized_name_key" ON "Tag"("normalized_name");
CREATE INDEX "Tag_normalized_name_idx" ON "Tag"("normalized_name");
CREATE INDEX "Tag_source_status_idx" ON "Tag"("source", "status");
