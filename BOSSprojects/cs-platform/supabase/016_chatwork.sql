CREATE TABLE IF NOT EXISTS chatwork_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  api_token text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS chatwork_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id text NOT NULL,
  room_name text NOT NULL,
  description text,
  is_default boolean DEFAULT false,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS chatwork_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id text NOT NULL,
  display_name text NOT NULL,
  mention_name text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS chatwork_room_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid REFERENCES chatwork_rooms(id) ON DELETE CASCADE,
  member_id uuid REFERENCES chatwork_members(id) ON DELETE CASCADE,
  is_default_mention boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE(room_id, member_id)
);

CREATE TABLE IF NOT EXISTS chatwork_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type text NOT NULL,
  source_id uuid,
  inquiry_id uuid REFERENCES inquiries(id),
  mall text,
  room_id text,
  room_name text,
  mentioned_account_ids text[],
  mentioned_names text[],
  comment text,
  shared_body text,
  source_url text,
  chatwork_message_id text,
  shared_by uuid REFERENCES users(id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE chatwork_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE chatwork_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE chatwork_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE chatwork_room_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE chatwork_shares ENABLE ROW LEVEL SECURITY;

GRANT ALL ON chatwork_settings TO postgres;
GRANT ALL ON chatwork_settings TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON chatwork_settings TO authenticated;

GRANT ALL ON chatwork_rooms TO postgres;
GRANT ALL ON chatwork_rooms TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON chatwork_rooms TO authenticated;

GRANT ALL ON chatwork_members TO postgres;
GRANT ALL ON chatwork_members TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON chatwork_members TO authenticated;

GRANT ALL ON chatwork_room_members TO postgres;
GRANT ALL ON chatwork_room_members TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON chatwork_room_members TO authenticated;

GRANT ALL ON chatwork_shares TO postgres;
GRANT ALL ON chatwork_shares TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON chatwork_shares TO authenticated;

CREATE POLICY "auth_all" ON chatwork_settings FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON chatwork_rooms FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON chatwork_members FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON chatwork_room_members FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON chatwork_shares FOR ALL TO authenticated USING (true) WITH CHECK (true);
