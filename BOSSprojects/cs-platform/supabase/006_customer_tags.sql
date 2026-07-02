-- ================================================================
-- 006_customer_tags.sql
-- 顧客タグ定義 + 顧客へのタグ付け
-- 実行場所: Supabase Dashboard → SQL Editor
-- ================================================================

-- ----------------------------------------------------------------
-- 1. customer_tag_definitions テーブル
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS customer_tag_definitions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL UNIQUE,
  color      TEXT NOT NULL DEFAULT '#6B7280',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------
-- 2. customer_profile_tags テーブル（中間テーブル）
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS customer_profile_tags (
  customer_profile_id UUID NOT NULL REFERENCES customer_profiles(id) ON DELETE CASCADE,
  tag_id              UUID NOT NULL REFERENCES customer_tag_definitions(id) ON DELETE CASCADE,
  created_by          UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (customer_profile_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_customer_profile_tags_tag
  ON customer_profile_tags(tag_id);

-- ----------------------------------------------------------------
-- 3. シードデータ
-- ----------------------------------------------------------------
INSERT INTO customer_tag_definitions (name, color) VALUES
  ('VIP',          '#F59E0B'),
  ('要注意',       '#EF4444'),
  ('リピーター',   '#10B981'),
  ('新規',         '#3B82F6'),
  ('クレーム常連', '#8B5CF6')
ON CONFLICT (name) DO NOTHING;

-- ----------------------------------------------------------------
-- 4. RLS
-- ----------------------------------------------------------------
ALTER TABLE customer_tag_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_profile_tags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS customer_tag_definitions_all ON customer_tag_definitions;
DROP POLICY IF EXISTS customer_profile_tags_all ON customer_profile_tags;

CREATE POLICY customer_tag_definitions_all
ON customer_tag_definitions
FOR ALL TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY customer_profile_tags_all
ON customer_profile_tags
FOR ALL TO authenticated
USING (true)
WITH CHECK (true);

-- ----------------------------------------------------------------
-- 5. GRANT
-- ----------------------------------------------------------------
GRANT ALL ON customer_tag_definitions TO authenticated;
GRANT ALL ON customer_tag_definitions TO service_role;
GRANT ALL ON customer_profile_tags TO authenticated;
GRANT ALL ON customer_profile_tags TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
