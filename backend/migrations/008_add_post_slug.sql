-- Add short slug to posts for clean share URLs (e.g. /post/aB3kR9)
ALTER TABLE posts ADD COLUMN IF NOT EXISTS slug VARCHAR(8);

-- Backfill existing posts with a unique base62 slug derived from their id
UPDATE posts SET slug = (
  WITH RECURSIVE base62 AS (
    SELECT id,
           '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz' AS chars,
           id AS n,
           '' AS result
    UNION ALL
    SELECT id, chars,
           n / 62,
           SUBSTR(chars, (n % 62)::int + 1, 1) || result
    FROM base62 WHERE n > 0
  )
  SELECT CASE WHEN result = '' THEN '0' ELSE result END
  FROM base62 WHERE n = 0 LIMIT 1
)
WHERE slug IS NULL;

-- Now enforce uniqueness and not-null
ALTER TABLE posts ALTER COLUMN slug SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS posts_slug_idx ON posts(slug);
