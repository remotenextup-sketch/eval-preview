-- ================================================================
-- 003_customer_identities.sql
-- 顧客統合機能: customer_identities テーブル新設 + 既存テーブル拡張
-- 実行場所: Supabase Dashboard → SQL Editor
-- ================================================================

-- customer_profiles に新カラム追加（既存データへの影響なし）
ALTER TABLE customer_profiles
  ADD COLUMN IF NOT EXISTS display_name TEXT,
  ADD COLUMN IF NOT EXISTS primary_email TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS memo TEXT;

-- customer_identities: チャネル横断の顧客識別子管理
CREATE TABLE IF NOT EXISTS customer_identities (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_profile_id UUID NOT NULL REFERENCES customer_profiles(id) ON DELETE CASCADE,
  channel             TEXT NOT NULL
                      CHECK (channel IN ('email', 'rakuten', 'yahoo', 'line', 'manual')),
  identifier_type     TEXT NOT NULL
                      CHECK (identifier_type IN ('email', 'masked_email', 'order_number', 'line_user_id', 'phone', 'name')),
  identifier_value    TEXT NOT NULL,
  normalized_value    TEXT NOT NULL,
  confidence          NUMERIC(3,2) NOT NULL DEFAULT 1.00,
  verified            BOOLEAN NOT NULL DEFAULT false,
  source_inquiry_id   UUID REFERENCES inquiries(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_customer_identities_profile
  ON customer_identities(customer_profile_id);
CREATE INDEX IF NOT EXISTS idx_customer_identities_lookup
  ON customer_identities(identifier_type, normalized_value);

-- inquiries に source_channel / external_customer_key を追加
-- customer_profile_id は 001_schema.sql で既に追加済み
ALTER TABLE inquiries
  ADD COLUMN IF NOT EXISTS source_channel TEXT
    CHECK (source_channel IN ('email', 'rakuten', 'yahoo', 'line', 'manual')),
  ADD COLUMN IF NOT EXISTS external_customer_key TEXT;

-- RLS
ALTER TABLE customer_identities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated users can do everything" ON customer_identities
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

GRANT ALL ON customer_identities TO authenticated;
GRANT ALL ON customer_identities TO anon;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon;
