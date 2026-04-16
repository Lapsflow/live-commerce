-- Migration: Add username and seller profile fields
-- Retroactive migration for schema changes made in commit 4a61eb7

-- Step 1: Add username column (nullable first)
ALTER TABLE "User" ADD COLUMN "username" TEXT;

-- Step 2: Populate username from existing email
UPDATE "User"
SET "username" = CASE
    WHEN "email" IS NOT NULL AND "email" LIKE '%@%'
    THEN LOWER(SPLIT_PART("email", '@', 1))
    ELSE CONCAT('user_', LOWER(SUBSTRING("id", 1, 8)))
END
WHERE "username" IS NULL;

-- Step 3: Handle duplicate usernames (add suffix)
WITH duplicates AS (
    SELECT
        id,
        username,
        ROW_NUMBER() OVER (PARTITION BY username ORDER BY "createdAt") - 1 as dup_number
    FROM "User"
    WHERE username IN (
        SELECT username FROM "User"
        GROUP BY username HAVING COUNT(*) > 1
    )
)
UPDATE "User" u
SET username = CONCAT(d.username, '_', d.dup_number)
FROM duplicates d
WHERE u.id = d.id AND d.dup_number > 0;

-- Step 4: Make username NOT NULL and UNIQUE
ALTER TABLE "User" ALTER COLUMN "username" SET NOT NULL;
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- Step 5: Make email nullable
ALTER TABLE "User" ALTER COLUMN "email" DROP NOT NULL;

-- Step 6: Make phone NOT NULL (set placeholder first)
UPDATE "User" SET "phone" = '010-0000-0000' WHERE "phone" IS NULL;
ALTER TABLE "User" ALTER COLUMN "phone" SET NOT NULL;

-- Step 7: Add seller profile array fields
ALTER TABLE "User" ADD COLUMN "categories" TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE "User" ADD COLUMN "regions" TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE "User" ADD COLUMN "timeSlots" TEXT[] NOT NULL DEFAULT '{}';

-- Step 8: Update seed accounts with correct usernames
UPDATE "User" SET "username" = 'master' WHERE "email" = 'master@live-commerce.com';
UPDATE "User" SET "username" = 'admin1' WHERE "email" = 'admin1@live-commerce.com';
UPDATE "User" SET "username" = 'admin2' WHERE "email" = 'admin2@live-commerce.com';
UPDATE "User" SET "username" = 'seller1' WHERE "email" = 'seller1@live-commerce.com';
UPDATE "User" SET "username" = 'seller2' WHERE "email" = 'seller2@live-commerce.com';
UPDATE "User" SET "username" = 'seller3' WHERE "email" = 'seller3@live-commerce.com';
UPDATE "User" SET "username" = 'seller4' WHERE "email" = 'seller4@live-commerce.com';
UPDATE "User" SET "username" = 'seller5' WHERE "email" = 'seller5@live-commerce.com';
