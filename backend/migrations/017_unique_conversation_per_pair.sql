-- Enforce exactly one conversation per user pair.

-- Step 1: Add user_one / user_two columns (safe, idempotent)
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS user_one VARCHAR(255),
  ADD COLUMN IF NOT EXISTS user_two VARCHAR(255);

-- Step 2: Back-fill from existing participants
UPDATE conversations c
SET
  user_one = LEAST(p.u1, p.u2),
  user_two = GREATEST(p.u1, p.u2)
FROM (
  SELECT
    conversation_id,
    MIN(user_id) AS u1,
    MAX(user_id) AS u2
  FROM conversation_participants
  GROUP BY conversation_id
  HAVING COUNT(*) = 2
) p
WHERE p.conversation_id = c.id
  AND c.user_one IS NULL;

-- Step 3: Deduplicate — for each duplicate pair keep the oldest conversation,
-- move messages into it, then delete the duplicates.
DO $$
DECLARE
  dup RECORD;
  keep_id INTEGER;
  del_id  INTEGER;
BEGIN
  FOR dup IN
    SELECT
      user_one, user_two,
      array_agg(id ORDER BY id ASC) AS conv_ids
    FROM conversations
    WHERE user_one IS NOT NULL AND user_two IS NOT NULL
    GROUP BY user_one, user_two
    HAVING COUNT(*) > 1
  LOOP
    keep_id := dup.conv_ids[1];
    FOR i IN 2..array_length(dup.conv_ids, 1) LOOP
      del_id := dup.conv_ids[i];
      -- Move messages to the keeper first, then delete the duplicate
      UPDATE conversation_messages SET conversation_id = keep_id WHERE conversation_id = del_id;
      UPDATE conversation_participants SET conversation_id = keep_id
        WHERE conversation_id = del_id
          AND user_id NOT IN (SELECT user_id FROM conversation_participants WHERE conversation_id = keep_id);
      DELETE FROM conversation_participants WHERE conversation_id = del_id;
      DELETE FROM conversations WHERE id = del_id;
    END LOOP;
  END LOOP;
END $$;

-- Step 4: Unique index — blocks future duplicates at DB level
CREATE UNIQUE INDEX IF NOT EXISTS idx_conversations_unique_pair
  ON conversations (
    LEAST(user_one, user_two),
    GREATEST(user_one, user_two)
  )
  WHERE user_one IS NOT NULL AND user_two IS NOT NULL;
