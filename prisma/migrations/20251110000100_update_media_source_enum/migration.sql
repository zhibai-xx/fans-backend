-- Alter enum MediaSource to new set (USER_UPLOAD, SYSTEM_INGEST, ADMIN_UPLOAD, EXTERNAL_FEED)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'MediaSource'
  ) THEN
    -- create new enum with desired values
    CREATE TYPE "MediaSource_new" AS ENUM ('USER_UPLOAD', 'SYSTEM_INGEST', 'ADMIN_UPLOAD', 'EXTERNAL_FEED');

    -- drop default temporarily
    ALTER TABLE "Media" ALTER COLUMN "source" DROP DEFAULT;

    -- migrate column to new enum via text cast
    ALTER TABLE "Media"
    ALTER COLUMN "source"
    TYPE "MediaSource_new"
    USING ("source"::text::"MediaSource_new");

    -- replace old enum
    ALTER TYPE "MediaSource" RENAME TO "MediaSource_old";
    ALTER TYPE "MediaSource_new" RENAME TO "MediaSource";

    -- restore default
    ALTER TABLE "Media" ALTER COLUMN "source" SET DEFAULT 'USER_UPLOAD';

    -- drop old enum type
    DROP TYPE "MediaSource_old";
  END IF;
END
$$;
