-- products table (new)
CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id text,
  sku text,
  product_name text NOT NULL,
  mall text,
  asin text,
  rakuten_item_code text,
  yahoo_item_code text,
  supplier text,
  category text,
  price numeric,
  cost numeric,
  is_active boolean DEFAULT true,
  memo text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES users(id)
);

-- templates table (new) — user reply templates
CREATE TABLE IF NOT EXISTS templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_name text NOT NULL,
  mall text,
  category text,
  body text NOT NULL,
  is_active boolean DEFAULT true,
  memo text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES users(id),
  updated_by uuid REFERENCES users(id)
);

-- master_change_logs (new) — audit trail
CREATE TABLE IF NOT EXISTS master_change_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name text NOT NULL,
  record_id text NOT NULL,
  old_values jsonb,
  new_values jsonb,
  changed_by uuid REFERENCES users(id),
  changed_at timestamptz DEFAULT now()
);

-- Add columns to knowledge_cases if missing
ALTER TABLE knowledge_cases ADD COLUMN IF NOT EXISTS reason_category text;
ALTER TABLE knowledge_cases ADD COLUMN IF NOT EXISTS memo text;
ALTER TABLE knowledge_cases ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES users(id);

-- RLS & grants for new tables
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE master_change_logs ENABLE ROW LEVEL SECURITY;

GRANT ALL ON products TO postgres; GRANT ALL ON products TO service_role; GRANT SELECT,INSERT,UPDATE,DELETE ON products TO authenticated;
GRANT ALL ON templates TO postgres; GRANT ALL ON templates TO service_role; GRANT SELECT,INSERT,UPDATE,DELETE ON templates TO authenticated;
GRANT ALL ON master_change_logs TO postgres; GRANT ALL ON master_change_logs TO service_role; GRANT SELECT,INSERT,UPDATE,DELETE ON master_change_logs TO authenticated;

CREATE POLICY "auth_all" ON products FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON templates FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON master_change_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);
