CREATE TABLE IF NOT EXISTS ads (
  id                TEXT PRIMARY KEY,
  title             TEXT NOT NULL,
  sponsor_name      TEXT NOT NULL,
  description       TEXT NOT NULL DEFAULT '',
  image_url         TEXT NOT NULL,
  video_url         TEXT NOT NULL DEFAULT '',
  redirect_url      TEXT NOT NULL,
  placement         TEXT NOT NULL DEFAULT 'feed',
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  start_date        TIMESTAMPTZ NOT NULL,
  end_date          TIMESTAMPTZ NOT NULL,
  click_count       BIGINT NOT NULL DEFAULT 0,
  impression_count  BIGINT NOT NULL DEFAULT 0,
  last_served_at    TIMESTAMPTZ,
  created_by        TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Hot path: pick active ads for a placement. last_served_at sorts the
-- rotation ("least recently served first") so we don't keep showing the
-- same ad to the same user.
CREATE INDEX IF NOT EXISTS idx_ads_active_window
  ON ads (placement, is_active, start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_ads_last_served
  ON ads (last_served_at NULLS FIRST);

-- Per-(ad, user, day) impression dedupe so refreshing the feed doesn't
-- inflate impressions. Click events are not deduped — each real click
-- counts.
CREATE TABLE IF NOT EXISTS ad_impressions (
  ad_id      TEXT NOT NULL REFERENCES ads(id) ON DELETE CASCADE,
  user_id    TEXT NOT NULL,
  served_on  DATE NOT NULL DEFAULT CURRENT_DATE,
  PRIMARY KEY (ad_id, user_id, served_on)
);
