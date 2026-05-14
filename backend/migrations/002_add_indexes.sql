-- Performance indexes for high-traffic queries

CREATE INDEX IF NOT EXISTS idx_posts_created_at    ON posts (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_user_id       ON posts (user_id);
CREATE INDEX IF NOT EXISTS idx_post_likes_post_id  ON post_likes (post_id);
CREATE INDEX IF NOT EXISTS idx_post_likes_user_id  ON post_likes (user_id);
CREATE INDEX IF NOT EXISTS idx_follows_follower    ON follows (follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_following   ON follows (following_id);
CREATE INDEX IF NOT EXISTS idx_conv_msgs_conv_id   ON conversation_messages (conversation_id, timestamp ASC);
CREATE INDEX IF NOT EXISTS idx_conv_parts_user     ON conversation_participants (user_id);
CREATE INDEX IF NOT EXISTS idx_users_email         ON users (email);
CREATE INDEX IF NOT EXISTS idx_audit_log_created   ON admin_audit_log (created_at DESC);
