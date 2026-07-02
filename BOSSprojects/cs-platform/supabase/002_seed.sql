-- ================================================================
-- CS Platform: シードデータ
-- 実行場所: Supabase Dashboard → SQL Editor
-- 実行順序: 001_schema.sql の実行後に実行してください
--
-- ⚠️  初回専用（再実行すると inquiry_messages 等が重複します）
--     再実行する場合は以下を先に実行してください:
--       DELETE FROM snooze_schedules;
--       DELETE FROM activity_logs;
--       DELETE FROM comments;
--       DELETE FROM inquiry_messages;
--       DELETE FROM inquiries;
--       DELETE FROM users;
--
-- 事前準備（必須）:
--   Supabase Authentication 画面で以下の3ユーザーを先に作成してください
--   Email                      Password     用途
--   admin@cs-platform.test     password123  管理者
--   tanaka@cs-platform.test    password123  担当者A
--   suzuki@cs-platform.test    password123  担当者B
-- ================================================================

DO $$
DECLARE
  v_admin_id  UUID;
  v_tanaka_id UUID;
  v_suzuki_id UUID;
  v_mall_id   UUID;

  i01 UUID := 'b0000000-0000-0000-0000-000000000001';
  i02 UUID := 'b0000000-0000-0000-0000-000000000002';
  i03 UUID := 'b0000000-0000-0000-0000-000000000003';
  i04 UUID := 'b0000000-0000-0000-0000-000000000004';
  i05 UUID := 'b0000000-0000-0000-0000-000000000005';
  i06 UUID := 'b0000000-0000-0000-0000-000000000006';
  i07 UUID := 'b0000000-0000-0000-0000-000000000007';
  i08 UUID := 'b0000000-0000-0000-0000-000000000008';
  i09 UUID := 'b0000000-0000-0000-0000-000000000009';
  i10 UUID := 'b0000000-0000-0000-0000-000000000010';
  i11 UUID := 'b0000000-0000-0000-0000-000000000011';
  i12 UUID := 'b0000000-0000-0000-0000-000000000012';
  i13 UUID := 'b0000000-0000-0000-0000-000000000013';
  i14 UUID := 'b0000000-0000-0000-0000-000000000014';
  i15 UUID := 'b0000000-0000-0000-0000-000000000015';
  i16 UUID := 'b0000000-0000-0000-0000-000000000016';
  i17 UUID := 'b0000000-0000-0000-0000-000000000017';
  i18 UUID := 'b0000000-0000-0000-0000-000000000018';
  i19 UUID := 'b0000000-0000-0000-0000-000000000019';
  i20 UUID := 'b0000000-0000-0000-0000-000000000020';

BEGIN
  -- ----------------------------------------------------------------
  -- Auth ユーザーの UUID を email で引く
  -- 存在しない場合はここで止まります
  -- ----------------------------------------------------------------
  SELECT id INTO v_admin_id  FROM auth.users WHERE email = 'admin@cs-platform.test';
  SELECT id INTO v_tanaka_id FROM auth.users WHERE email = 'tanaka@cs-platform.test';
  SELECT id INTO v_suzuki_id FROM auth.users WHERE email = 'suzuki@cs-platform.test';

  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION '事前準備未完了: admin@cs-platform.test が Authentication に存在しません';
  END IF;
  IF v_tanaka_id IS NULL THEN
    RAISE EXCEPTION '事前準備未完了: tanaka@cs-platform.test が Authentication に存在しません';
  END IF;
  IF v_suzuki_id IS NULL THEN
    RAISE EXCEPTION '事前準備未完了: suzuki@cs-platform.test が Authentication に存在しません';
  END IF;

  -- ----------------------------------------------------------------
  -- public.users
  -- ----------------------------------------------------------------
  INSERT INTO users (id, email, display_name, role) VALUES
    (v_admin_id,  'admin@cs-platform.test',  '管理者',   'admin'),
    (v_tanaka_id, 'tanaka@cs-platform.test', '田中 誠',  'member'),
    (v_suzuki_id, 'suzuki@cs-platform.test', '鈴木 花子', 'member')
  ON CONFLICT (id) DO NOTHING;

  -- ----------------------------------------------------------------
  -- mall_id 取得
  -- ----------------------------------------------------------------
  SELECT id INTO v_mall_id FROM malls WHERE code = 'rakuten';

  -- ----------------------------------------------------------------
  -- inquiries（20件: open×12, pending×5, resolved×3）
  -- ----------------------------------------------------------------
  INSERT INTO inquiries (
    id, mall_id, inquiry_number, order_number, item_name,
    customer_name, subject, status, assignee_id,
    ai_intent, ai_confidence, ai_action,
    is_angry, needs_human, received_at
  ) VALUES
    (i01, v_mall_id, 'INQ-2026-0001', '372877-20260603-0001234567',
     'ステンレスボトル 500ml', '鈴木 裕美子',
     '商品が壊れていました。返品させてください',
     'open', v_tanaka_id,
     'return_request', 0.94, 'ESCALATE',
     true, true, now() - interval '2 hours'),

    (i02, v_mall_id, 'INQ-2026-0002', '372877-20260603-0002345678',
     'ウォーターボトル 1L', '杉本 志歩',
     '注文をキャンセルしたいです',
     'open', v_tanaka_id,
     'cancel_request', 0.97, 'AUTO_REPLY',
     false, false, now() - interval '3 hours'),

    (i03, v_mall_id, 'INQ-2026-0003', '372877-20260602-0003456789',
     'チェアマット 120×90cm', '軸屋 さゆり',
     '注文から1週間経ちますがまだ届きません',
     'open', v_suzuki_id,
     'shipping_inquiry', 0.91, 'AUTO_REPLY',
     false, false, now() - interval '4 hours'),

    (i04, v_mall_id, 'INQ-2026-0004', '372877-20260601-0004567890',
     'デスクチェア プレミアム', '徳山 君恵',
     '領収書を発行していただけますか',
     'open', NULL,
     'receipt_invoice', 0.99, 'AUTO_REPLY',
     false, false, now() - interval '5 hours'),

    (i05, v_mall_id, 'INQ-2026-0005', '372877-20260601-0005678901',
     'ステンレスボトル 500ml', '齋藤 駿',
     '色が注文と違うものが届きました。交換をお願いします',
     'open', v_tanaka_id,
     'return_request', 0.89, 'ESCALATE',
     false, true, now() - interval '6 hours'),

    (i06, v_mall_id, 'INQ-2026-0006', NULL,
     'ウォーターボトル 1L', '中村 真理',
     'この商品は食洗機対応ですか？',
     'open', NULL,
     'product_inquiry', 0.88, 'AUTO_REPLY',
     false, false, now() - interval '7 hours'),

    (i07, v_mall_id, 'INQ-2026-0007', '372877-20260531-0007890123',
     'チェアマット 90×120cm', '今井 知世',
     '配送先住所を変更したいです',
     'open', v_suzuki_id,
     'address_change', 0.95, 'ESCALATE',
     false, true, now() - interval '8 hours'),

    (i08, v_mall_id, 'INQ-2026-0008', '372877-20260531-0008901234',
     'デスクチェア エコノミー', '小林 太郎',
     '不在票が入っていました。再配達をお願いしたいです',
     'open', NULL,
     'redelivery_request', 0.92, 'AUTO_REPLY',
     false, false, now() - interval '9 hours'),

    (i09, v_mall_id, 'INQ-2026-0009', '372877-20260530-0009012345',
     'ステンレスボトル 350ml', '渡辺 愛',
     'クレジットカードへの請求がまだ確認できません',
     'open', v_tanaka_id,
     'payment_inquiry', 0.86, 'ASK_MORE',
     false, false, now() - interval '10 hours'),

    (i10, v_mall_id, 'INQ-2026-0010', '372877-20260529-0010123456',
     'デスクチェア プレミアム', '松本 和将',
     '購入した椅子の保証期間を教えてください',
     'open', NULL,
     'warranty_quality', 0.83, 'AUTO_REPLY',
     false, false, now() - interval '11 hours'),

    (i11, v_mall_id, 'INQ-2026-0011', '372877-20260529-0011234567',
     'デスクチェア プレミアム', '倉橋 昌幸',
     '組み立て部品が1つ入っていませんでした',
     'open', v_suzuki_id,
     'product_inquiry', 0.87, 'ESCALATE',
     false, true, now() - interval '12 hours'),

    (i12, v_mall_id, 'INQ-2026-0012', '372877-20260528-0012345678',
     'ステンレスボトル 500ml', '兵頭 裕加',
     'プレゼント用にラッピングをお願いできますか',
     'open', NULL,
     'gift_inquiry', 0.81, 'AUTO_REPLY',
     false, false, now() - interval '13 hours'),

    (i13, v_mall_id, 'INQ-2026-0013', NULL,
     NULL, '田中 幸子',
     '先日購入した商品について確認したいことがあります',
     'pending', v_tanaka_id,
     'unclear', 0.51, 'ASK_MORE',
     false, false, now() - interval '1 day'),

    (i14, v_mall_id, 'INQ-2026-0014', '372877-20260527-0014567890',
     'チェアマット 120×90cm', '佐藤 健一',
     '届いた商品に傷があります',
     'pending', v_suzuki_id,
     'return_request', 0.91, 'ESCALATE',
     false, true, now() - interval '1 day 2 hours'),

    (i15, v_mall_id, 'INQ-2026-0015', '372877-20260526-0015678901',
     'ウォーターボトル 1L', '加藤 恵',
     '返品したいのですが手続きを教えてください',
     'pending', v_tanaka_id,
     'return_request', 0.93, 'AUTO_REPLY',
     false, false, now() - interval '2 days'),

    (i16, v_mall_id, 'INQ-2026-0016', NULL,
     'デスクチェア エコノミー', '木村 大輔',
     'ブラック在庫はありますか？',
     'pending', NULL,
     'product_inquiry', 0.85, 'ASK_MORE',
     false, false, now() - interval '2 days 3 hours'),

    (i17, v_mall_id, 'INQ-2026-0017', '372877-20260524-0017890123',
     'ステンレスボトル 500ml', '伊藤 由美',
     '配送業者に問い合わせ中です',
     'pending', v_suzuki_id,
     'shipping_inquiry', 0.88, 'AUTO_REPLY',
     false, false, now() - interval '3 days'),

    (i18, v_mall_id, 'INQ-2026-0018', '372877-20260523-0018901234',
     'デスクチェア プレミアム', '山田 花子',
     'ありがとうございました',
     'resolved', v_tanaka_id,
     'acknowledgment', 0.97, 'AUTO_REPLY',
     false, false, now() - interval '4 days'),

    (i19, v_mall_id, 'INQ-2026-0019', '372877-20260522-0019012345',
     'チェアマット 90×120cm', '中島 俊介',
     '領収書の発行をお願いします',
     'resolved', v_suzuki_id,
     'receipt_invoice', 0.99, 'AUTO_REPLY',
     false, false, now() - interval '5 days'),

    (i20, v_mall_id, 'INQ-2026-0020', '372877-20260521-0020123456',
     'ウォーターボトル 1L', '前田 奈々',
     'やっぱりキャンセルをお願いします',
     'resolved', v_tanaka_id,
     'cancel_request', 0.96, 'AUTO_REPLY',
     false, false, now() - interval '6 days')
  ON CONFLICT (id) DO NOTHING;

  -- ----------------------------------------------------------------
  -- inquiry_messages（全行6値）
  -- ----------------------------------------------------------------
  INSERT INTO inquiry_messages (inquiry_id, direction, sender_type, body, is_ai_draft, sent_at) VALUES
    (i01, 'inbound',  'customer', '先日購入したステンレスボトルが届きましたが、蓋の部分が割れていました。こんな商品を送ってくるなんて信じられません。すぐに返品させてください。対応が遅ければ楽天にクレームを入れます。', false, now() - interval '2 hours'),
    (i01, 'outbound', 'system',   'この度はご不便をおかけし、誠に申し訳ございません。商品の状態を確認させていただきますので、お手数ですが商品の写真をお送りいただけますでしょうか。返品対応を速やかに進めてまいります。', true,  now() - interval '1 hour 50 min'),
    (i02, 'inbound',  'customer', '注文番号372877-20260603-0002345678の商品をキャンセルしたいです。まだ発送されていないでしょうか？', false, now() - interval '3 hours'),
    (i02, 'outbound', 'system',   'ご注文のキャンセルを承りました。現在発送準備の状況を確認しております。発送前であればキャンセルが可能です。しばらくお待ちください。', true,  now() - interval '2 hours 50 min'),
    (i03, 'inbound',  'customer', '1週間前に注文したチェアマットがまだ届きません。追跡番号を教えていただけますか？', false, now() - interval '4 hours'),
    (i03, 'outbound', 'system',   'ご注文いただいたチェアマットの配送状況を確認いたします。追跡番号は1234567890です。ヤマト運輸のサイトよりご確認いただけます。', true,  now() - interval '3 hours 50 min'),
    (i04, 'inbound',  'customer', 'デスクチェアの領収書を発行してください。宛名は「株式会社テスト商事」、但し書きは「事務用品代として」でお願いします。', false, now() - interval '5 hours'),
    (i04, 'outbound', 'system',   'ご注文いただきありがとうございます。領収書を発行いたします。宛名：株式会社テスト商事、但し書き：事務用品代として、で発行いたします。', true,  now() - interval '4 hours 50 min'),
    (i05, 'inbound',  'customer', '注文したのはブルーのボトルだったはずですが、届いたのはレッドでした。正しい色のものと交換していただけますか。', false, now() - interval '6 hours'),
    (i06, 'inbound',  'customer', 'このウォーターボトルは食洗機で洗えますか？購入前に確認させてください。', false, now() - interval '7 hours'),
    (i06, 'outbound', 'system',   'お問い合わせありがとうございます。当商品は食洗機非対応となっております。手洗いをお勧めいたします。ご検討のほどよろしくお願いいたします。', true,  now() - interval '6 hours 50 min'),
    (i07, 'inbound',  'customer', 'まだ発送前であれば配送先を変更したいです。新しい住所は東京都新宿区西新宿1-1-1です。', false, now() - interval '8 hours'),
    (i08, 'inbound',  'customer', '昨日不在票が入っていました。明日の午前中に再配達をお願いできますか？', false, now() - interval '9 hours'),
    (i08, 'outbound', 'system',   '再配達のご依頼ありがとうございます。配送業者（ヤマト運輸）へ直接ご連絡いただくか、下記URLよりお申し込みください。', true,  now() - interval '8 hours 50 min'),
    (i09, 'inbound',  'customer', '3日前に購入しましたが、クレジットカードの明細にまだ反映されていません。正常に決済されていますか？', false, now() - interval '10 hours'),
    (i10, 'inbound',  'customer', '先月購入したデスクチェアのガスシリンダーが故障しました。保証期間内でしょうか？', false, now() - interval '11 hours'),
    (i10, 'outbound', 'system',   '当商品の保証期間は購入日より1年間です。ご購入から1ヶ月とのことですので、保証対象となります。修理または交換の対応をさせていただきます。', true,  now() - interval '10 hours 50 min'),
    (i11, 'inbound',  'customer', 'デスクチェアを組み立てようとしたところ、ボルトが2本足りませんでした。送っていただけますか？', false, now() - interval '12 hours'),
    (i12, 'inbound',  'customer', '友人へのプレゼントなのでラッピングをお願いしたいのですが、対応していただけますか？', false, now() - interval '13 hours'),
    (i12, 'outbound', 'system',   'ご注文ありがとうございます。大変申し訳ございませんが、現在ラッピングサービスは承っておりません。ご了承いただけますと幸いです。', true,  now() - interval '12 hours 50 min'),
    (i13, 'inbound',  'customer', '先日購入した商品について確認したいことがあります。', false, now() - interval '1 day'),
    (i13, 'outbound', 'staff',    'お問い合わせありがとうございます。どのような点についてご確認されたいでしょうか？ご注文番号もあわせてお教えいただけますと幸いです。', false, now() - interval '23 hours'),
    (i14, 'inbound',  'customer', '届いたチェアマットに大きな傷がついていました。写真を添付します。', false, now() - interval '1 day 2 hours'),
    (i14, 'outbound', 'staff',    'この度は大変ご不便をおかけし申し訳ございません。写真を確認いたしました。代替品の発送手配を進めております。', false, now() - interval '25 hours'),
    (i15, 'inbound',  'customer', '返品したいのですが、どのように手続きすればよいですか？', false, now() - interval '2 days'),
    (i15, 'outbound', 'staff',    '返品手続きについてご案内いたします。①商品を未使用の状態で元の梱包にお戻しください ②着払いにてお送りください ③到着後3営業日以内に返金いたします。', false, now() - interval '47 hours'),
    (i18, 'inbound',  'customer', '先日の返品対応、とても丁寧にしていただきありがとうございました。また利用します。', false, now() - interval '4 days'),
    (i18, 'outbound', 'system',   'この度はご利用いただきありがとうございます。またのご利用を心よりお待ちしております。', true,  now() - interval '3 days 23 hours'),
    (i19, 'inbound',  'customer', '領収書を発行してください。宛名は「田中商事株式会社」です。', false, now() - interval '5 days'),
    (i19, 'outbound', 'staff',    '領収書を発行いたしました。以下のURLよりダウンロードいただけます。https://example.com/receipt/i19', false, now() - interval '4 days 22 hours'),
    (i20, 'inbound',  'customer', 'やっぱりキャンセルお願いします。', false, now() - interval '6 days'),
    (i20, 'outbound', 'staff',    'キャンセルを承りました。決済が完了していないため、費用は一切かかりません。またのご利用をお待ちしております。', false, now() - interval '5 days 23 hours');

  -- ----------------------------------------------------------------
  -- activity_logs
  -- ----------------------------------------------------------------
  INSERT INTO activity_logs (inquiry_id, actor_id, action, before_val, after_val, created_at) VALUES
    (i01, v_tanaka_id, 'assigned',       '{"assignee": null}',   '{"assignee_name": "田中 誠"}',   now() - interval '1 hour 55 min'),
    (i02, v_tanaka_id, 'assigned',       '{"assignee": null}',   '{"assignee_name": "田中 誠"}',   now() - interval '2 hours 55 min'),
    (i03, v_suzuki_id, 'assigned',       '{"assignee": null}',   '{"assignee_name": "鈴木 花子"}', now() - interval '3 hours 55 min'),
    (i05, v_tanaka_id, 'assigned',       '{"assignee": null}',   '{"assignee_name": "田中 誠"}',   now() - interval '5 hours 55 min'),
    (i07, v_suzuki_id, 'assigned',       '{"assignee": null}',   '{"assignee_name": "鈴木 花子"}', now() - interval '7 hours 55 min'),
    (i13, v_tanaka_id, 'replied',        NULL,                   '{"is_ai": false}',               now() - interval '23 hours'),
    (i13, v_tanaka_id, 'status_changed', '{"status": "open"}',   '{"status": "pending"}',          now() - interval '22 hours 30 min'),
    (i14, v_suzuki_id, 'replied',        NULL,                   '{"is_ai": false}',               now() - interval '25 hours'),
    (i14, v_suzuki_id, 'status_changed', '{"status": "open"}',   '{"status": "pending"}',          now() - interval '24 hours 30 min'),
    (i15, v_tanaka_id, 'replied',        NULL,                   '{"is_ai": false}',               now() - interval '47 hours'),
    (i15, v_tanaka_id, 'status_changed', '{"status": "open"}',   '{"status": "pending"}',          now() - interval '46 hours'),
    (i17, v_suzuki_id, 'snoozed',        NULL,                   '{"until": "明日 9:00"}',         now() - interval '2 days 12 hours'),
    (i17, v_suzuki_id, 'status_changed', '{"status": "open"}',   '{"status": "pending"}',          now() - interval '2 days 12 hours'),
    (i18, v_tanaka_id, 'replied',        NULL,                   '{"is_ai": true}',                now() - interval '3 days 23 hours'),
    (i18, v_tanaka_id, 'status_changed', '{"status": "open"}',   '{"status": "resolved"}',         now() - interval '3 days 22 hours'),
    (i19, v_suzuki_id, 'replied',        NULL,                   '{"is_ai": false}',               now() - interval '4 days 22 hours'),
    (i19, v_suzuki_id, 'status_changed', '{"status": "open"}',   '{"status": "resolved"}',         now() - interval '4 days 21 hours'),
    (i20, v_tanaka_id, 'replied',        NULL,                   '{"is_ai": false}',               now() - interval '5 days 23 hours'),
    (i20, v_tanaka_id, 'status_changed', '{"status": "open"}',   '{"status": "resolved"}',         now() - interval '5 days 22 hours');

  -- ----------------------------------------------------------------
  -- comments
  -- ----------------------------------------------------------------
  INSERT INTO comments (inquiry_id, author_id, body, created_at) VALUES
    (i01, v_admin_id, '怒り検知あり。田中さん優先対応をお願いします。写真確認後に返品ラベル発行してください。', now() - interval '1 hour 45 min'),
    (i05, v_admin_id, '色違い発送が確認できました。在庫確認後に正しい商品を再送します。',                   now() - interval '5 hours 30 min'),
    (i14, v_admin_id, '傷の写真を確認。製造不良の可能性あり。代替品在庫あり・発送手配済み。',               now() - interval '24 hours');

  -- ----------------------------------------------------------------
  -- snooze_schedules
  -- ----------------------------------------------------------------
  INSERT INTO snooze_schedules (inquiry_id, snoozed_by, snooze_until, reason, is_processed, created_at) VALUES
    (i17, v_suzuki_id,
     (now() + interval '1 day')::date + time '09:00:00',
     '配送業者の回答待ち。明日9時に確認する。',
     false,
     now() - interval '2 days 12 hours');

  -- ----------------------------------------------------------------
  -- resolved_at / first_reply_at の更新
  -- ----------------------------------------------------------------
  UPDATE inquiries SET
    first_reply_at = now() - interval '3 days 23 hours',
    resolved_at    = now() - interval '3 days 22 hours'
  WHERE id = i18;

  UPDATE inquiries SET
    first_reply_at = now() - interval '4 days 22 hours',
    resolved_at    = now() - interval '4 days 21 hours'
  WHERE id = i19;

  UPDATE inquiries SET
    first_reply_at = now() - interval '5 days 23 hours',
    resolved_at    = now() - interval '5 days 22 hours'
  WHERE id = i20;

  UPDATE inquiries SET
    snooze_until = (now() + interval '1 day')::date + time '09:00:00'
  WHERE id = i17;

END $$;

-- ================================================================
-- Phase 1+ 拡張テーブル シードデータ
-- ================================================================
DO $$
DECLARE
  v_admin_id UUID;
  t01 UUID := 'c0000000-0000-0000-0000-000000000001';
  t02 UUID := 'c0000000-0000-0000-0000-000000000002';
  t03 UUID := 'c0000000-0000-0000-0000-000000000003';
  t04 UUID := 'c0000000-0000-0000-0000-000000000004';
  t05 UUID := 'c0000000-0000-0000-0000-000000000005';
  t06 UUID := 'c0000000-0000-0000-0000-000000000006';
  t07 UUID := 'c0000000-0000-0000-0000-000000000007';
BEGIN
  SELECT id INTO v_admin_id FROM auth.users WHERE email = 'admin@cs-platform.test';

  -- ----------------------------------------------------------------
  -- knowledge（AI返信テンプレート）
  -- ----------------------------------------------------------------
  INSERT INTO knowledge (title, category, intent, mall_code, question_pattern, answer_template, quality_score, created_by) VALUES
    (
      '返品・交換対応テンプレート',
      '返品・交換',
      'return_request',
      'rakuten',
      '商品が壊れていた / 色違い / 不良品',
      'この度はご不便をおかけし、誠に申し訳ございません。商品の状態を確認させていただきますので、お手数ですが商品の写真をお送りいただけますでしょうか。確認後、速やかに返品・交換の手続きを進めてまいります。',
      0.85,
      v_admin_id
    ),
    (
      'キャンセル対応テンプレート',
      'キャンセル',
      'cancel_request',
      'rakuten',
      '注文をキャンセルしたい',
      'ご注文のキャンセルを承りました。現在の発送状況を確認しております。発送前であればキャンセルが可能です。しばらくお待ちいただけますでしょうか。',
      0.90,
      v_admin_id
    ),
    (
      '配送問い合わせテンプレート',
      '配送',
      'shipping_inquiry',
      'rakuten',
      '商品が届かない / 配送状況を確認したい',
      'ご注文いただいた商品の配送状況を確認いたします。追跡番号をお調べし、改めてご連絡いたします。しばらくお待ちください。',
      0.80,
      v_admin_id
    ),
    (
      '領収書発行テンプレート',
      '領収書・請求書',
      'receipt_invoice',
      NULL,
      '領収書を発行してほしい',
      'ご要望の領収書を発行いたします。宛名・但し書きをご確認の上、発行いたします。通常1〜2営業日以内にご対応いたします。',
      0.95,
      v_admin_id
    ),
    (
      '商品仕様問い合わせテンプレート',
      '商品情報',
      'product_inquiry',
      NULL,
      '商品の仕様・対応可否を確認したい',
      'お問い合わせありがとうございます。ご質問の商品について確認いたします。詳細は商品ページもあわせてご参照ください。',
      0.75,
      v_admin_id
    );

  -- ----------------------------------------------------------------
  -- tags
  -- ----------------------------------------------------------------
  INSERT INTO tags (id, name, color) VALUES
    (t01, '返品',       '#EF4444'),
    (t02, '交換',       '#F97316'),
    (t03, '配送遅延',   '#EAB308'),
    (t04, '商品質問',   '#3B82F6'),
    (t05, '不良品',     '#DC2626'),
    (t06, 'レビュー',   '#8B5CF6'),
    (t07, 'メーカー確認', '#10B981')
  ON CONFLICT (name) DO NOTHING;

  -- ----------------------------------------------------------------
  -- inquiry_tags
  -- ----------------------------------------------------------------
  INSERT INTO inquiry_tags (inquiry_id, tag_id) VALUES
    ('b0000000-0000-0000-0000-000000000001', t01),
    ('b0000000-0000-0000-0000-000000000001', t05),
    ('b0000000-0000-0000-0000-000000000003', t03),
    ('b0000000-0000-0000-0000-000000000005', t02),
    ('b0000000-0000-0000-0000-000000000006', t04),
    ('b0000000-0000-0000-0000-000000000011', t05),
    ('b0000000-0000-0000-0000-000000000011', t07),
    ('b0000000-0000-0000-0000-000000000014', t01),
    ('b0000000-0000-0000-0000-000000000014', t05)
  ON CONFLICT DO NOTHING;

END $$;
