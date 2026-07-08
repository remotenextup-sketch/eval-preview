CREATE TABLE IF NOT EXISTS shared_board_items (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date         date NOT NULL DEFAULT CURRENT_DATE,
  title        text NOT NULL,
  content      text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS shared_board_checks (
  item_id    uuid NOT NULL REFERENCES shared_board_items(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (item_id, user_id)
);

ALTER TABLE shared_board_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared_board_checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated full access" ON shared_board_items
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "authenticated full access" ON shared_board_checks
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

GRANT ALL ON shared_board_items TO anon, authenticated;
GRANT ALL ON shared_board_checks TO anon, authenticated;
