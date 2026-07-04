CREATE TABLE IF NOT EXISTS boss_actions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inquiry_id        uuid REFERENCES inquiries(id),
  order_id          text,
  order_number      text,
  mall              text,
  action_type       text NOT NULL, -- exchange | cancel
  status            text NOT NULL DEFAULT 'pending', -- pending | success | failed
  ai_suggested      boolean DEFAULT false,
  ai_reason         text,
  ai_confidence     numeric,
  request_payload   jsonb,
  response_payload  jsonb,
  error_message     text,
  executed_by       uuid REFERENCES users(id),
  executed_at       timestamptz,
  created_at        timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS boss_actions_inquiry_idx     ON boss_actions (inquiry_id);
CREATE INDEX IF NOT EXISTS boss_actions_order_num_idx   ON boss_actions (order_number);
CREATE INDEX IF NOT EXISTS boss_actions_status_idx      ON boss_actions (status);

ALTER TABLE boss_actions ENABLE ROW LEVEL SECURITY;
GRANT ALL ON boss_actions TO postgres;
GRANT ALL ON boss_actions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON boss_actions TO authenticated;
CREATE POLICY "auth_all" ON boss_actions FOR ALL TO authenticated USING (true) WITH CHECK (true);
