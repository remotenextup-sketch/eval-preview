-- =============================================
-- 024_email_message_sync.sql
-- =============================================

-- =============================================
-- [事前確認] 既存インデックス・制約の確認（実行して結果を確認してから続行）
-- =============================================
-- SELECT indexname, indexdef
-- FROM pg_indexes
-- WHERE tablename = 'inquiry_messages' AND indexname LIKE '%external%';
--
-- SELECT conname, contype, pg_get_constraintdef(oid)
-- FROM pg_constraint
-- WHERE conrelid = 'inquiry_messages'::regclass;
--
-- 現在確認済み（migration 009/010 の履歴から）:
--   idx_inquiry_messages_inquiry_external は UNIQUE INDEX（TABLE CONSTRAINT ではない）
--   → DROP INDEX IF EXISTS で削除可能、ALTER TABLE DROP CONSTRAINT は不要

-- =============================================
-- STEP 0: 重複チェック（STEP 1 の source_channel カラム追加前に実行）
-- im.source_channel はまだ存在しないため inquiries.source_channel を使用する
-- 0件であることを確認してから次へ進む
-- =============================================
-- SELECT
--   i.source_channel AS effective_channel,
--   im.external_message_id,
--   COUNT(*)
-- FROM inquiry_messages im
-- JOIN inquiries i ON im.inquiry_id = i.id
-- WHERE im.external_message_id IS NOT NULL
-- GROUP BY i.source_channel, im.external_message_id
-- HAVING COUNT(*) > 1;
--
-- 重複が見つかった場合は以下で内容を確認し、統合・削除を個別に判断すること
-- （メッセージ本文や direction が異なる可能性があるため自動削除は行わない）
-- SELECT
--   i.source_channel,
--   im.external_message_id,
--   im.id,
--   im.inquiry_id,
--   im.direction,
--   im.sender_type,
--   LEFT(im.body, 80) AS body_preview,
--   im.sent_at,
--   im.created_at,
--   ROW_NUMBER() OVER (
--     PARTITION BY i.source_channel, im.external_message_id
--     ORDER BY im.created_at DESC
--   ) AS rn
-- FROM inquiry_messages im
-- JOIN inquiries i ON im.inquiry_id = i.id
-- WHERE im.external_message_id IN (
--   SELECT im2.external_message_id
--   FROM inquiry_messages im2
--   JOIN inquiries i2 ON im2.inquiry_id = i2.id
--   WHERE im2.external_message_id IS NOT NULL
--   GROUP BY i2.source_channel, im2.external_message_id
--   HAVING COUNT(*) > 1
-- )
-- ORDER BY i.source_channel, im.external_message_id, im.created_at DESC;

-- =============================================
-- STEP 1: inquiry_messages に source_channel 追加
-- =============================================
ALTER TABLE inquiry_messages
  ADD COLUMN IF NOT EXISTS source_channel TEXT;

-- 既存行を inquiries から補完（楽天データは 'rakuten'、メールは 'email' になる）
UPDATE inquiry_messages im
SET source_channel = i.source_channel
FROM inquiries i
WHERE im.inquiry_id = i.id
  AND im.source_channel IS NULL;

-- NULL 件数の確認（0 件であることを確認してから NOT NULL 制約を追加する）
-- SELECT COUNT(*) FROM inquiry_messages WHERE source_channel IS NULL;
--
-- 上記が 0 件の場合のみ以下を実行:
ALTER TABLE inquiry_messages
  ALTER COLUMN source_channel SET NOT NULL;
-- ※ NULL が残る場合はここで停止すること。'unknown' 等での自動補完は行わない。
--   孤立メッセージ等の原因を調査してから対処すること。

-- =============================================
-- STEP 2: metadata カラム追加（RFC Message-ID、送信者アドレス等を格納）
-- =============================================
ALTER TABLE inquiry_messages
  ADD COLUMN IF NOT EXISTS metadata JSONB;

-- =============================================
-- STEP 3: ユニーク制約を (source_channel, external_message_id) に変更
--
-- 旧: idx_inquiry_messages_inquiry_external → (inquiry_id, external_message_id)
-- 新: idx_inquiry_messages_channel_external → (source_channel, external_message_id)
--
-- external_message_id が NULL を許容する理由:
--   staff が手動入力したメモや内部コメント等は外部IDを持たない。
--   PostgreSQL の UNIQUE INDEX は NULL != NULL のため、
--   NULL を含む行同士は衝突しない（意図しない重複登録は発生しない）。
--   source_channel は STEP 1 で NOT NULL 化済み。
--
-- PostgREST onConflict は部分インデックス（WHERE句付き）を使えないため
-- WHERE 句なしの全行インデックスにする（migration 010 と同じ理由）。
-- =============================================
DROP INDEX IF EXISTS idx_inquiry_messages_inquiry_external;

CREATE UNIQUE INDEX IF NOT EXISTS idx_inquiry_messages_channel_external
  ON inquiry_messages(source_channel, external_message_id);

-- ※ idx_messages_inquiry (inquiry_id, sent_at) は 001_schema.sql で作成済みのため追加不要
