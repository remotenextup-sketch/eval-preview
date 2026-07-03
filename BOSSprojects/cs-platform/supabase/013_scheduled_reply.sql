ALTER TABLE inquiries
  ADD COLUMN IF NOT EXISTS scheduled_reply_body TEXT,
  ADD COLUMN IF NOT EXISTS scheduled_reply_at   TIMESTAMPTZ;
