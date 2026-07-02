-- ================================================================
-- 008_intake.sql
-- intake API 対応: malls に email 追加、inquiries 拡張
-- 実行場所: Supabase Dashboard → SQL Editor
-- ================================================================

-- ----------------------------------------------------------------
-- 事前確認: UNIQUE制約追加前に重複がないか確認（0件であること）
-- 以下をSQL Editorで実行してから本ファイルを適用すること
-- ----------------------------------------------------------------
-- SELECT source_channel, external_id, COUNT(*) AS cnt
-- FROM inquiries
-- WHERE source_channel IS NOT NULL
--   AND external_id IS NOT NULL
-- GROUP BY source_channel, external_id
-- HAVING COUNT(*) > 1;
-- ----------------------------------------------------------------

-- 1. malls に email チャネルを追加
INSERT INTO malls (code, name)
VALUES ('email', 'メール')
ON CONFLICT (code) DO NOTHING;

-- 2. inquiries に raw_payload カラム追加
ALTER TABLE inquiries
  ADD COLUMN IF NOT EXISTS raw_payload JSONB;

-- 3. inquiries に (source_channel, external_id) の UNIQUE 制約を追加
--    NULL値はUNIQUE制約の対象外のため、既存のNULLレコードには影響しない
ALTER TABLE inquiries
  ADD CONSTRAINT uq_inquiries_source_external
  UNIQUE (source_channel, external_id);
