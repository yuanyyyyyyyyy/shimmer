-- Add user_id to review_cache for per-user AI summary caching
-- Created: 2026-06-20

ALTER TABLE review_cache
  ADD COLUMN user_id BIGINT UNSIGNED DEFAULT 0 COMMENT 'Owner user ID (0=anonymous/global)' AFTER year;

-- Drop old unique index and create new composite unique index
ALTER TABLE review_cache
  DROP INDEX IF EXISTS uk_year;

ALTER TABLE review_cache
  ADD UNIQUE INDEX uk_year_user (year, user_id);
