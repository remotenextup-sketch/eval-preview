-- ================================================================
-- 005_orders.sql
-- orders / order_items テーブル
-- モールAPI連携による購入履歴の受け皿
-- 実行場所: Supabase Dashboard → SQL Editor
-- ================================================================

-- ----------------------------------------------------------------
-- 1. orders テーブル
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS orders (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_profile_id UUID REFERENCES customer_profiles(id) ON DELETE SET NULL,
  mall_id             UUID REFERENCES malls(id) ON DELETE SET NULL,
  source_channel      TEXT NOT NULL,
  external_order_id   TEXT NOT NULL,
  order_number        TEXT,
  ordered_at          TIMESTAMPTZ NOT NULL,
  total_amount        NUMERIC(12, 2),
  currency            TEXT NOT NULL DEFAULT 'JPY',
  buyer_name          TEXT,
  buyer_email         TEXT,
  status              TEXT NOT NULL DEFAULT 'unknown',
  raw_payload         JSONB,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_orders_source_external UNIQUE (source_channel, external_order_id)
);

CREATE INDEX IF NOT EXISTS idx_orders_customer_profile
  ON orders(customer_profile_id, ordered_at DESC);

CREATE INDEX IF NOT EXISTS idx_orders_mall
  ON orders(mall_id, ordered_at DESC);

-- ----------------------------------------------------------------
-- 2. order_items テーブル
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS order_items (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id          UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  external_item_id  TEXT,
  sku               TEXT,
  item_name         TEXT,
  quantity          INT NOT NULL DEFAULT 1,
  unit_price        NUMERIC(12, 2),
  raw_payload       JSONB,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_items_order
  ON order_items(order_id);

-- ----------------------------------------------------------------
-- 3. updated_at 自動更新トリガー
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trg_orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ----------------------------------------------------------------
-- 4. RLS
-- ----------------------------------------------------------------
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated users can do everything" ON orders
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "authenticated users can do everything" ON order_items
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ----------------------------------------------------------------
-- 5. GRANT
-- ----------------------------------------------------------------
GRANT ALL ON orders TO authenticated;
GRANT ALL ON orders TO service_role;
GRANT ALL ON order_items TO authenticated;
GRANT ALL ON order_items TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
