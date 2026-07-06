-- knowledge_templates に使用回数カラムを追加
ALTER TABLE knowledge_templates
  ADD COLUMN IF NOT EXISTS use_count INT NOT NULL DEFAULT 0;

-- use_count を安全にインクリメントする関数
CREATE OR REPLACE FUNCTION increment_template_use_count(template_id INT)
RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE knowledge_templates SET use_count = use_count + 1 WHERE id = template_id;
$$;

GRANT EXECUTE ON FUNCTION increment_template_use_count(INT) TO authenticated, service_role;
