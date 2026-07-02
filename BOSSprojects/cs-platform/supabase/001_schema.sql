-- ================================================================
-- CS Platform: スキーマ定義
-- 実行場所: Supabase Dashboard → SQL Editor
-- 実行順序: このファイルを先に実行し、次に 002_seed.sql を実行
--
-- ⚠️  初回専用
--     再実行する場合は以下を先に実行してテーブルを削除してください:
--       DROP TABLE IF EXISTS snooze_schedules, activity_logs,
--         comments, inquiry_messages, inquiries, malls, users CASCADE;
-- ================================================================

CREATE TABLE users (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email         TEXT NOT NULL UNIQUE,
  display_name  TEXT NOT NULL,
  avatar_url    TEXT,
  role          TEXT NOT NULL DEFAULT 'member'
                CHECK (role IN ('admin', 'manager', 'member')),
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE malls (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code       TEXT NOT NULL UNIQUE,
  name       TEXT NOT NULL,
  is_active  BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO malls (code, name) VALUES ('rakuten', '楽天市場')
  ON CONFLICT (code) DO NOTHING;

CREATE TABLE inquiries (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mall_id         UUID NOT NULL REFERENCES malls(id),
  external_id     TEXT,
  inquiry_number  TEXT,
  order_number    TEXT,
  item_name       TEXT,
  customer_name   TEXT,
  subject         TEXT,
  status          TEXT NOT NULL DEFAULT 'open'
                  CHECK (status IN ('open', 'pending', 'resolved', 'spam')),
  assignee_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  ai_intent       TEXT,
  ai_confidence   NUMERIC(3,2),
  ai_action       TEXT,
  is_angry        BOOLEAN NOT NULL DEFAULT false,
  needs_human     BOOLEAN NOT NULL DEFAULT false,
  snooze_until    TIMESTAMPTZ,
  first_reply_at  TIMESTAMPTZ,
  resolved_at     TIMESTAMPTZ,
  received_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_inquiries_status   ON inquiries(status);
CREATE INDEX idx_inquiries_assignee ON inquiries(assignee_id);
CREATE INDEX idx_inquiries_received ON inquiries(received_at DESC);
CREATE INDEX idx_inquiries_snooze   ON inquiries(snooze_until)
  WHERE snooze_until IS NOT NULL;

CREATE TABLE inquiry_messages (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inquiry_id   UUID NOT NULL REFERENCES inquiries(id) ON DELETE CASCADE,
  direction    TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  sender_type  TEXT NOT NULL CHECK (sender_type IN ('customer', 'staff', 'system', 'ai')),
  sender_id    UUID REFERENCES users(id) ON DELETE SET NULL,
  body         TEXT NOT NULL,
  is_ai_draft  BOOLEAN NOT NULL DEFAULT false,
  ai_modified  BOOLEAN NOT NULL DEFAULT false,
  sent_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_messages_inquiry ON inquiry_messages(inquiry_id, sent_at);

CREATE TABLE comments (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inquiry_id UUID NOT NULL REFERENCES inquiries(id) ON DELETE CASCADE,
  author_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_comments_inquiry ON comments(inquiry_id);

CREATE TABLE activity_logs (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inquiry_id UUID NOT NULL REFERENCES inquiries(id) ON DELETE CASCADE,
  actor_id   UUID REFERENCES users(id) ON DELETE SET NULL,
  action     TEXT NOT NULL,
  before_val JSONB,
  after_val  JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_activity_inquiry ON activity_logs(inquiry_id, created_at DESC);

CREATE TABLE snooze_schedules (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inquiry_id   UUID NOT NULL REFERENCES inquiries(id) ON DELETE CASCADE,
  snoozed_by   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  snooze_until TIMESTAMPTZ NOT NULL,
  reason       TEXT,
  is_processed BOOLEAN NOT NULL DEFAULT false,
  processed_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_snooze_pending ON snooze_schedules(snooze_until)
  WHERE is_processed = false;

-- ================================================================
-- RLS（Phase 0: 認証済みユーザーは全データ読み書き可）
-- ================================================================
ALTER TABLE users            ENABLE ROW LEVEL SECURITY;
ALTER TABLE malls            ENABLE ROW LEVEL SECURITY;
ALTER TABLE inquiries        ENABLE ROW LEVEL SECURITY;
ALTER TABLE inquiry_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments         ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs    ENABLE ROW LEVEL SECURITY;
ALTER TABLE snooze_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated users can do everything" ON users
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated users can do everything" ON malls
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated users can do everything" ON inquiries
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated users can do everything" ON inquiry_messages
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated users can do everything" ON comments
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated users can do everything" ON activity_logs
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated users can do everything" ON snooze_schedules
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ================================================================
-- Phase 1+ 拡張テーブル
-- ================================================================

-- activity_logs.action の想定値（CHECK制約なし・拡張容易性を優先）
-- assigned / replied / status_changed / snoozed / commented
-- ai_draft_generated / ai_draft_accepted / ai_draft_edited
-- knowledge_applied / manufacturer_contacted
-- 将来: ai_classified / tag_added / tag_removed / customer_profile_updated など

-- customer_profiles: 顧客情報蓄積（注文・問い合わせ・返品・リスク履歴）
CREATE TABLE customer_profiles (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_name  TEXT,
  customer_email TEXT,
  order_count    INT NOT NULL DEFAULT 0,
  inquiry_count  INT NOT NULL DEFAULT 0,
  return_count   INT NOT NULL DEFAULT 0,
  risk_score     NUMERIC(3,2) NOT NULL DEFAULT 0.00,
  last_order_at  TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- inquiries に顧客プロファイルリンクを追加（nullable・既存データへの影響なし）
ALTER TABLE inquiries
  ADD COLUMN customer_profile_id UUID REFERENCES customer_profiles(id) ON DELETE SET NULL;

-- knowledge: AI返信テンプレート・FAQ・ナレッジ検索用
CREATE TABLE knowledge (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title            TEXT NOT NULL,
  category         TEXT NOT NULL,
  intent           TEXT,
  mall_code        TEXT,
  question_pattern TEXT,
  answer_template  TEXT NOT NULL,
  is_active        BOOLEAN NOT NULL DEFAULT true,
  quality_score    NUMERIC(3,2) NOT NULL DEFAULT 0.00,
  usage_count      INT NOT NULL DEFAULT 0,
  success_count    INT NOT NULL DEFAULT 0,
  last_used_at     TIMESTAMPTZ,
  created_by       UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- tags: 問い合わせタグマスタ
CREATE TABLE tags (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL UNIQUE,
  color      TEXT NOT NULL DEFAULT '#6B7280',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- inquiry_tags: 問い合わせ↔タグ 中間テーブル
CREATE TABLE inquiry_tags (
  inquiry_id UUID NOT NULL REFERENCES inquiries(id) ON DELETE CASCADE,
  tag_id     UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (inquiry_id, tag_id)
);

-- ai_logs: AI呼び出し記録・精度改善追跡（classify / draft / search）
CREATE TABLE ai_logs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inquiry_id        UUID REFERENCES inquiries(id) ON DELETE SET NULL,
  action_type       TEXT NOT NULL CHECK (action_type IN ('classify', 'draft', 'search')),
  model             TEXT NOT NULL,
  prompt_tokens     INT,
  completion_tokens INT,
  result            JSONB,
  confidence        NUMERIC(3,2),
  latency_ms        INT,
  feedback          TEXT CHECK (feedback IN ('accepted', 'edited', 'rejected')),
  feedback_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- manufacturer_contacts: WeChat・メーカー連絡履歴
CREATE TABLE manufacturer_contacts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inquiry_id   UUID NOT NULL REFERENCES inquiries(id) ON DELETE CASCADE,
  channel      TEXT NOT NULL CHECK (channel IN ('wechat', 'email', 'phone', 'other')),
  direction    TEXT NOT NULL CHECK (direction IN ('outbound', 'inbound')),
  body         TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'waiting'
               CHECK (status IN ('waiting', 'replied', 'closed', 'escalated')),
  contacted_by UUID REFERENCES users(id) ON DELETE SET NULL,
  contacted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_knowledge_category  ON knowledge(category);
CREATE INDEX idx_knowledge_intent    ON knowledge(intent) WHERE intent IS NOT NULL;
CREATE INDEX idx_ai_logs_inquiry     ON ai_logs(inquiry_id, created_at DESC);
CREATE INDEX idx_ai_logs_feedback    ON ai_logs(feedback) WHERE feedback IS NOT NULL;
CREATE INDEX idx_mfr_contacts        ON manufacturer_contacts(inquiry_id, contacted_at DESC);

ALTER TABLE customer_profiles     ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge             ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE inquiry_tags          ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_logs               ENABLE ROW LEVEL SECURITY;
ALTER TABLE manufacturer_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated users can do everything" ON customer_profiles
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated users can do everything" ON knowledge
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated users can do everything" ON tags
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated users can do everything" ON inquiry_tags
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated users can do everything" ON ai_logs
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated users can do everything" ON manufacturer_contacts
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ================================================================
-- テーブル・シーケンスへのアクセス権付与
-- ================================================================
GRANT ALL ON ALL TABLES    IN SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES    IN SCHEMA public TO anon;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon;
