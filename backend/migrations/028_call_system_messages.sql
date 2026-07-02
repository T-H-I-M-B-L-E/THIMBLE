ALTER TABLE conversation_messages ADD COLUMN IF NOT EXISTS is_system          BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE conversation_messages ADD COLUMN IF NOT EXISTS call_duration_secs INT;
