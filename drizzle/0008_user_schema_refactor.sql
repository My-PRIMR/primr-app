-- Custom SQL migration file, put your code below! --

-- 1. Create new enum types
CREATE TYPE "product_role" AS ENUM ('learner', 'creator', 'lnd_manager', 'org_admin');
--> statement-breakpoint
CREATE TYPE "plan" AS ENUM ('free', 'pro', 'enterprise');
--> statement-breakpoint
CREATE TYPE "internal_role" AS ENUM ('staff', 'admin');
--> statement-breakpoint

-- 2. Add new columns (nullable first, so existing rows don't fail)
ALTER TABLE "users" ADD COLUMN "product_role" "product_role";
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "plan" "plan";
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "internal_role" "internal_role";
--> statement-breakpoint

-- 3. Migrate existing role data
UPDATE "users" SET "product_role" = CASE
  WHEN "role" = 'administrator' THEN 'org_admin'::"product_role"
  WHEN "role" = 'creator'       THEN 'creator'::"product_role"
  ELSE 'learner'::"product_role"
END;
--> statement-breakpoint

-- 4. Set defaults for all existing rows
UPDATE "users" SET "plan" = 'free' WHERE "plan" IS NULL;
--> statement-breakpoint

-- 5. Now enforce NOT NULL on the migrated columns
ALTER TABLE "users" ALTER COLUMN "product_role" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "product_role" SET DEFAULT 'learner';
--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "plan" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "plan" SET DEFAULT 'free';
--> statement-breakpoint

-- 6. Drop old column and enum
ALTER TABLE "users" DROP COLUMN "role";
--> statement-breakpoint
DROP TYPE IF EXISTS "user_role";
