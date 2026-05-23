-- Add notifications table for like, tag, and follow events

CREATE TABLE IF NOT EXISTS notifications (
    id              BIGSERIAL PRIMARY KEY,
    user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    sender_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type            TEXT NOT NULL CHECK (type IN ('LIKE', 'TAG', 'FOLLOW')),
    post_id         BIGINT REFERENCES posts(id) ON DELETE CASCADE,
    read            BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(user_id, read);

-- Trigger: create LIKE notification when post is liked
CREATE OR REPLACE FUNCTION create_like_notification()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO notifications (user_id, sender_id, type, post_id)
    SELECT p.user_id, NEW.user_id, 'LIKE', NEW.post_id
    FROM posts p
    WHERE p.id = NEW.post_id
    AND p.user_id != NEW.user_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_create_like_notification ON post_likes;
CREATE TRIGGER trigger_create_like_notification
    AFTER INSERT ON post_likes
    FOR EACH ROW
    EXECUTE FUNCTION create_like_notification();

-- Trigger: create TAG notification when user is tagged
CREATE OR REPLACE FUNCTION create_tag_notification()
RETURNS TRIGGER AS $$
DECLARE
    tagged_user TEXT;
BEGIN
    -- Extract tagged user IDs from JSONB array
    FOR tagged_user IN
        SELECT jsonb_array_elements_text(NEW.tagged_users)
    LOOP
        INSERT INTO notifications (user_id, sender_id, type, post_id)
        VALUES (tagged_user, NEW.user_id, 'TAG', NEW.id);
    END LOOP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_create_tag_notification ON posts;
CREATE TRIGGER trigger_create_tag_notification
    AFTER INSERT ON posts
    FOR EACH ROW
    EXECUTE FUNCTION create_tag_notification();

-- Trigger: create FOLLOW notification when user is followed
CREATE OR REPLACE FUNCTION create_follow_notification()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO notifications (user_id, sender_id, type)
    VALUES (NEW.following_id, NEW.follower_id, 'FOLLOW');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_create_follow_notification ON follows;
CREATE TRIGGER trigger_create_follow_notification
    AFTER INSERT ON follows
    FOR EACH ROW
    EXECUTE FUNCTION create_follow_notification();
