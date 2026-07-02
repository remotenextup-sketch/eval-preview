-- ================================================================
-- 004_merge_customer_profiles.sql
-- 顧客統合 RPC + customer_activity_logs テーブル
-- 実行場所: Supabase Dashboard → SQL Editor
-- ================================================================

-- ----------------------------------------------------------------
-- 1. customer_activity_logs テーブル新設
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS customer_activity_logs (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_profile_id UUID REFERENCES customer_profiles(id) ON DELETE SET NULL,
  actor_id            UUID REFERENCES users(id) ON DELETE SET NULL,
  action              TEXT NOT NULL,
  before_val          JSONB,
  after_val           JSONB,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_customer_activity_logs_profile
  ON customer_activity_logs(customer_profile_id, created_at DESC);

ALTER TABLE customer_activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated users can do everything" ON customer_activity_logs
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

GRANT ALL ON customer_activity_logs TO authenticated;
GRANT ALL ON customer_activity_logs TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- ----------------------------------------------------------------
-- 2. merge_customer_profiles 関数
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION merge_customer_profiles(
  p_source_customer_id uuid,
  p_target_customer_id uuid,
  p_actor_id           uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_source            customer_profiles%ROWTYPE;
  v_target            customer_profiles%ROWTYPE;
  v_moved_inquiries   int;
  v_moved_identities  int;
  v_new_memo          text;
BEGIN
  -- 自己統合禁止
  IF p_source_customer_id = p_target_customer_id THEN
    RAISE EXCEPTION 'source and target customer must be different';
  END IF;

  -- source / target を排他ロックで取得
  SELECT * INTO v_source
    FROM customer_profiles WHERE id = p_source_customer_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'source customer profile not found: %', p_source_customer_id;
  END IF;

  -- 統合済み source は拒否（再実行防止）
  IF v_source.memo LIKE '%[統合済み →%' THEN
    RAISE EXCEPTION 'source customer is already merged';
  END IF;

  SELECT * INTO v_target
    FROM customer_profiles WHERE id = p_target_customer_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'target customer profile not found: %', p_target_customer_id;
  END IF;

  -- inquiries を source → target へ付け替え
  UPDATE inquiries
    SET customer_profile_id = p_target_customer_id
    WHERE customer_profile_id = p_source_customer_id;
  GET DIAGNOSTICS v_moved_inquiries = ROW_COUNT;

  -- customer_identities を source → target へ付け替え
  UPDATE customer_identities
    SET customer_profile_id = p_target_customer_id
    WHERE customer_profile_id = p_source_customer_id;
  GET DIAGNOSTICS v_moved_identities = ROW_COUNT;

  -- target の集計値に source 分を加算
  UPDATE customer_profiles SET
    order_count   = v_target.order_count   + v_source.order_count,
    inquiry_count = v_target.inquiry_count + v_source.inquiry_count,
    return_count  = v_target.return_count  + v_source.return_count
  WHERE id = p_target_customer_id;

  -- source に統合済みマークを付ける（先に記録してから0化）
  v_new_memo := CONCAT_WS(
    E'\n',
    NULLIF(v_source.memo, ''),
    '[統合済み → ' || p_target_customer_id::text || ']'
  );
  UPDATE customer_profiles SET
    memo          = v_new_memo,
    order_count   = 0,
    inquiry_count = 0,
    return_count  = 0
  WHERE id = p_source_customer_id;

  -- customer_activity_logs に記録
  INSERT INTO customer_activity_logs (
    customer_profile_id,
    actor_id,
    action,
    before_val,
    after_val
  ) VALUES (
    p_target_customer_id,
    p_actor_id,
    'customer_merged',
    jsonb_build_object('source_customer_id', p_source_customer_id),
    jsonb_build_object(
      'moved_inquiries',  v_moved_inquiries,
      'moved_identities', v_moved_identities
    )
  );

  RETURN jsonb_build_object(
    'success',           true,
    'source',            p_source_customer_id,
    'target',            p_target_customer_id,
    'moved_inquiries',   v_moved_inquiries,
    'moved_identities',  v_moved_identities
  );
END;
$$;

GRANT EXECUTE ON FUNCTION merge_customer_profiles TO authenticated;
GRANT EXECUTE ON FUNCTION merge_customer_profiles TO service_role;
