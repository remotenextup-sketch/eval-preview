-- products に新カラム追加
ALTER TABLE products ADD COLUMN IF NOT EXISTS parent_product_id uuid REFERENCES products(id);
ALTER TABLE products ADD COLUMN IF NOT EXISTS brand text;
ALTER TABLE products ADD COLUMN IF NOT EXISTS sale_status text DEFAULT 'active';
ALTER TABLE products ADD COLUMN IF NOT EXISTS warranty_days integer;
ALTER TABLE products ADD COLUMN IF NOT EXISTS return_shipping_fee numeric;
ALTER TABLE products ADD COLUMN IF NOT EXISTS dropbox_url text;
ALTER TABLE products ADD COLUMN IF NOT EXISTS rakuten_url text;

-- product_knowledge テーブル（CS回答用情報）
CREATE TABLE IF NOT EXISTS product_knowledge (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES products(id) ON DELETE CASCADE,
  synonyms text[],
  features text,
  notes text,
  campaign_name text,
  campaign_detail text,
  present_item text,
  present_condition text,
  present_summary text,
  ai_notes text,
  priority integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_by uuid REFERENCES users(id),
  updated_by uuid REFERENCES users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- support_actions に product_id 追加
ALTER TABLE support_actions ADD COLUMN IF NOT EXISTS product_id uuid REFERENCES products(id);

-- インデックス
CREATE INDEX IF NOT EXISTS products_sku_idx ON products(sku);
CREATE INDEX IF NOT EXISTS products_name_idx ON products(product_name);
CREATE INDEX IF NOT EXISTS product_knowledge_product_id_idx ON product_knowledge(product_id);

-- RLS & grants
ALTER TABLE product_knowledge ENABLE ROW LEVEL SECURITY;
GRANT ALL ON product_knowledge TO postgres;
GRANT ALL ON product_knowledge TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON product_knowledge TO authenticated;
CREATE POLICY "auth_all" ON product_knowledge FOR ALL TO authenticated USING (true) WITH CHECK (true);
