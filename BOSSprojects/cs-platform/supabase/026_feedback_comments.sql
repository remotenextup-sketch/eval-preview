CREATE TABLE IF NOT EXISTS feedback_comments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feedback_id UUID NOT NULL REFERENCES feedback_items(id) ON DELETE CASCADE,
  author_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  author_email TEXT NOT NULL,
  body        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_feedback_comments_feedback ON feedback_comments(feedback_id, created_at);

ALTER TABLE feedback_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated users can do everything" ON feedback_comments
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
