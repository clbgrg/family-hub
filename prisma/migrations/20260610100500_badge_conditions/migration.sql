-- Badges: single (ruleType, threshold) -> ANDed JSON conditions array, plus
-- per-member appliesToUserIds (empty = everyone). DATA-PRESERVING: each
-- existing badge's rule is backfilled as a one-element conditions array
-- BEFORE the old columns are dropped. Earned user_badges rows are keyed by
-- badge key and are untouched.

-- Add the new columns first.
ALTER TABLE "badges"
ADD COLUMN "appliesToUserIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "conditions" JSONB NOT NULL DEFAULT '[]';

-- Backfill: existing single-rule badges become single-condition badges.
UPDATE "badges" SET "conditions" =
  jsonb_build_array(jsonb_build_object('ruleType', "ruleType"::text, 'threshold', "threshold"));

-- Drop the old single-rule columns and the enum.
ALTER TABLE "badges" DROP COLUMN "ruleType", DROP COLUMN "threshold";

-- DropEnum
DROP TYPE "BadgeRuleType";
