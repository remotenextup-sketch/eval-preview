-- 商品マスタ シードデータ (53件)

DO $$
DECLARE
  pid uuid;
BEGIN

  -- 海外変換プラグ
  INSERT INTO products (product_name, dropbox_url, rakuten_url, return_shipping_fee, warranty_days, is_active, sale_status)
  VALUES ('海外変換プラグ', 'https://www.dropbox.com/work/001%20Nextup%E5%85%B1%E6%9C%89/001%E5%95%86%E5%93%81/002%E6%B5%B7%E5%A4%96%E5%A4%89%E6%8F%9B%E3%83%97%E3%83%A9%E3%82%B0', 'https://grp07.ias.rakuten.co.jp/redirect_rpp/?s=80mzhtMg7vA&l=m3sfg9fLxQ4&v=9BXO9lFCPQiz7GLZZplQ2oDPt85igmZ_0iofM_Z7TUE&d=2025-12-23&q=Next%E3%82%AA%E3%83%B3%E3%83%A9%E3%82%A4%E3%83%B3&j=A1gm5N5yy1s&r=CfzqOs4JSuxasU3B8j4PvBzf1ElfR8SfgpAujxZO_3ts67i2qls3SVc-Rl3y_j_U6vF-V8enLOs&ii=nXczyeGjzvu6F_XmIb9E5Q&si=9KOxQl6BQ4Q&ci=VHykNsUQqSw&as=dFFQAC3K2XA&cp=w1AackVRueI&lg=sYksZGVVJZHPydHtWN11m7oX9eYhv0Tl&ap=&ft=ITs1qSiMuGw&e=IE0wiWDnCZE', 613, 365, true, 'active')
  ON CONFLICT DO NOTHING
  RETURNING id INTO pid;
  IF pid IS NOT NULL THEN
    INSERT INTO product_knowledge (product_id, synonyms, features, campaign_name, campaign_detail, present_item, present_summary, is_active)
    VALUES (pid, ARRAY['海外変換プラグ','旅行用アダプター','電圧変換プラグ','USB充電器','モバイルバッテリー用プラグ'], NULL, 'レビュー投稿→プレゼント①', '【Amazon・Yahoo】レビュー投稿→チラシ内お申し込みフォームから申し込み→プレゼント発送【楽天】レビュー投稿→レビュー投稿完了・プレゼントお申込み受付メールのフォームから希望商品選択（アイマスクor10%クーポン）→プレゼント発送', 'アイマスク', 'Amazon・Yahooレビュー投稿→チラシ内お申し込みフォームから申し込み→プレゼント発送
楽天レビュー投稿→レビュー投稿完了・プレゼントお申込み受付メールのフォームから希望商品選択（アイマスクor10%クーポン）→プレゼント発送', true);
  END IF;

  -- 静音ジェル
  INSERT INTO products (product_name, dropbox_url, rakuten_url, return_shipping_fee, warranty_days, is_active, sale_status)
  VALUES ('静音ジェル', NULL, 'https://item.rakuten.co.jp/next-online/10000163/?variantId=10000163', 371, 30, true, 'active')
  ON CONFLICT DO NOTHING
  RETURNING id INTO pid;
  IF pid IS NOT NULL THEN
    INSERT INTO product_knowledge (product_id, synonyms, features, campaign_name, campaign_detail, present_item, present_summary, is_active)
    VALUES (pid, ARRAY['静音ジェル'], '- 耐荷重: 100kg
- 極厚の高強度ジェル
- 防振・防音効果
- 震度7まで対応
- 圧倒的吸着力
- 防災士監修
- 家具のズレ防止・床の凹み防止
- 洗濯機・冷蔵庫・棚などに使用可能
- 騒音対策・振動吸収', 'レビュー投稿→プレゼント③', '【Amazon・Yahoo】レビュー投稿→チラシ内お申し込みフォームから申し込み→プレゼント発送【楽天】レビュー投稿→レビュー投稿完了・プレゼントお申込み受付メールのフォームから希望商品選択（耐震ジェルor10%クーポン）→プレゼント発送', '耐震ジェルブルーorクリア4枚', 'キャンペーン内容: 【Amazon・Yahoo】レビュー投稿→チラシ内お申し込みフォームから申し込み→プレゼント発送【楽天】レビュー投稿→レビュー投稿完了・プレゼントお申込み受付メールのフォームから希望商品選択（耐震ジェルor10%クーポン）→プレゼント発送
プレゼント対象商品（or): 耐震ジェルブルーorクリア4枚', true);
  END IF;

  -- 耐震ジェル
  INSERT INTO products (product_name, dropbox_url, rakuten_url, return_shipping_fee, warranty_days, is_active, sale_status)
  VALUES ('耐震ジェル', NULL, 'https://item.rakuten.co.jp/next-online/taishin008/', 371, 30, true, 'active')
  ON CONFLICT DO NOTHING
  RETURNING id INTO pid;
  IF pid IS NOT NULL THEN
    INSERT INTO product_knowledge (product_id, synonyms, features, campaign_name, campaign_detail, present_item, present_summary, is_active)
    VALUES (pid, ARRAY['耐震ジェル','耐震マット'], NULL, 'レビュー投稿→プレゼント', '【Amazon・Yahoo】レビュー投稿→チラシ内お申し込みフォームから申し込み→プレゼント発送【楽天】レビュー投稿→レビュー投稿完了・プレゼントお申込み受付メールのフォームから希望商品選択（耐震ジェルor10%クーポン）→プレゼント発送', '耐震ジェルブルーorクリア4枚', 'レビュー投稿→チラシ内お申し込みフォームから申し込み→プレゼント発送。楽天ではレビュー投稿完了後、希望商品選択（耐震ジェルブルーorクリア4枚）→プレゼント発送。', true);
  END IF;

  -- 両面テープ
  INSERT INTO products (product_name, dropbox_url, rakuten_url, return_shipping_fee, warranty_days, is_active, sale_status)
  VALUES ('両面テープ', NULL, 'https://item.rakuten.co.jp/next-online/10000140/', 546, 30, true, 'active')
  ON CONFLICT DO NOTHING
  RETURNING id INTO pid;
  IF pid IS NOT NULL THEN
    INSERT INTO product_knowledge (product_id, synonyms, features, campaign_name, campaign_detail, present_item, present_summary, is_active)
    VALUES (pid, ARRAY['両面テープ','超強力粘着テープ','はがせる両面テープ','DIY用両面テープ','魔法のテープ'], '- サイズ展開: 幅3cm×長さ1M、幅5cm×長さ1M〜5M
- 厚み: 0.2cm
- 透明
- はがせる両面テープ
- 超強力粘着
- 跡が残らない
- 防水・耐熱
- 洗って再利用可能
- 地震対策・転倒防止
- DIY・収納・固定用
- マスキングテープ付属', '①レビュー投稿でプレゼント②インスタ投稿していただいた方に両面テープ3cm×1m(一個)プレゼント※インスタのみの投稿でもOK。その場合、耐震ジェルのプレゼントではなく、両面テープのみ→詳細は下記のその他キャンペーン記載③インスタ投稿していただいた方にアマゾンギフト券（コード）送付→詳細は下記のその他キャンペーン記載', '①【Amazon・Yahoo】レビュー投稿→チラシ内お申し込みフォームから申し込み→プレゼント発送【楽天】レビュー投稿→レビュー投稿完了・プレゼントお申込み受付メールのフォームから希望商品選択（耐震ジェルor10%クーポン）→プレゼント発送②Amazon、楽天、Yahooにて両面テープ極を購入したお客様が、インスタ投稿チラシの内容に沿ってお申し込みいただいたら、更に両面テープ3cm×1m(1個)プレゼント', '耐震ジェルブルーorクリア4枚', '1. レビュー投稿でプレゼント
2. インスタ投稿で両面テープ3cm×1mプレゼント
3. アマゾンギフト券（コード）送付', true);
  END IF;

  -- 非常用トイレ
  INSERT INTO products (product_name, dropbox_url, rakuten_url, return_shipping_fee, warranty_days, is_active, sale_status)
  VALUES ('非常用トイレ', NULL, 'https://item.rakuten.co.jp/next-online/toire15/?variantId=toire15', 707, 30, true, 'active')
  ON CONFLICT DO NOTHING
  RETURNING id INTO pid;
  IF pid IS NOT NULL THEN
    INSERT INTO product_knowledge (product_id, synonyms, features, campaign_name, campaign_detail, present_item, present_summary, is_active)
    VALUES (pid, ARRAY['非常用トイレ','防災トイレ','緊急用トイレ','アウトドアトイレ'], '- 15回分セット（50回分・100回分も展開あり）
- パッケージサイズ: 22.2cm×13.8cm×5.4cm
- 重量: 620g
- 15年保存可能
- 日本製凝固剤
- 日本製排便袋
- 消臭・抗菌機能
- コンパクトで持ち運び便利
- 車・登山・渋滞・災害用
- 防災士監修
- キャンプ・アウトドアにも使用可能', 'レビュー投稿でプレゼント', '【Amazon・Yahoo】レビュー投稿→チラシ内お申し込みフォームから申し込み→プレゼント発送【楽天】レビュー投稿→レビュー投稿完了・プレゼントお申込み受付メールのフォームから希望商品選択（耐震ジェルor10%クーポン）→プレゼント発送', '耐震ジェルブルーorクリア4枚', 'キャンペーン名: レビュー投稿でプレゼント
内容:
- 【Amazon・Yahoo】レビュー投稿→チラシ内お申し込みフォームから申し込み→プレゼント発送
- 【楽天】レビュー投稿→レビュー投稿完了・プレゼントお申込み受付メールのフォームから希望商品選択（耐震ジェルor10%クーポン）→プレゼント発送
プレゼント対象商品: 耐震ジェルブルーorクリア4枚', true);
  END IF;

  -- 防振マット
  INSERT INTO products (product_name, dropbox_url, rakuten_url, return_shipping_fee, warranty_days, is_active, sale_status)
  VALUES ('防振マット', NULL, 'https://item.rakuten.co.jp/next-online/10000165/', 371, 30, true, 'active')
  ON CONFLICT DO NOTHING
  RETURNING id INTO pid;
  IF pid IS NOT NULL THEN
    INSERT INTO product_knowledge (product_id, synonyms, features, campaign_name, campaign_detail, present_item, present_summary, is_active)
    VALUES (pid, ARRAY['防振マット','振動吸収マット','防音マット'], '- サイズ: 60mm×60mm×10mm
- セット数: 4枚入り
- 防振・振動吸収機能
- 防災士監修
- 洗濯機かさ上げ（高さ調整・底上げ）
- 防音・揺れ防止・騒音対策
- 滑り止め機能
- 傷防止
- 漏水事故防止・排水溝詰まり防止
- 冷蔵庫などの家電にも使用可能
- 1年保証', 'レビュー投稿でプレゼント', '【Amazon・Yahoo】レビュー投稿→チラシ内お申し込みフォームから申し込み→プレゼント発送【楽天】レビュー投稿→レビュー投稿完了・プレゼントお申込み受付メールのフォームから希望商品選択（耐震ジェルor10%クーポン）→プレゼント発送', '耐震ジェルブルーorクリア4枚', 'キャンペーン名: レビュー投稿でプレゼント
内容:
- 【Amazon・Yahoo】レビュー投稿→チラシ内お申し込みフォームから申し込み→プレゼント発送
- 【楽天】レビュー投稿→レビュー投稿完了・プレゼントお申込み受付メールのフォームから希望商品選択（耐震ジェルor10%クーポン）→プレゼント発送
プレゼント対象商品: 耐震ジェルブルーorクリア4枚', true);
  END IF;

  -- ソファーマット
  INSERT INTO products (product_name, dropbox_url, rakuten_url, return_shipping_fee, warranty_days, is_active, sale_status)
  VALUES ('ソファーマット', NULL, 'https://item.rakuten.co.jp/next-online/10000166/', 371, 30, true, 'active')
  ON CONFLICT DO NOTHING
  RETURNING id INTO pid;
  IF pid IS NOT NULL THEN
    INSERT INTO product_knowledge (product_id, synonyms, features, campaign_name, campaign_detail, present_item, present_summary, is_active)
    VALUES (pid, ARRAY['ソファーマットクリア','ソファーマットブラウン','ソファーマットホワイト','ソファーマットブラック','ソファーマットアイボリー','ソファマット'], NULL, 'レビュー投稿でプレゼント', '【Yahoo】レビュー投稿→チラシ内お申し込みフォームから申し込み→プレゼント発送【楽天】レビュー投稿→レビュー投稿完了・プレゼントお申込み受付メールのフォームから希望商品選択（耐震ジェルor10%クーポン）→プレゼント発送', '耐震ジェルブルーorクリア4枚', 'レビュー投稿でプレゼント。Yahoo: チラシ内お申し込みフォームから申し込み→プレゼント発送。楽天: レビュー投稿完了後、希望商品選択（耐震ジェルor10%クーポン）→プレゼント発送。', true);
  END IF;

  -- 一酸化炭素チェッカー
  INSERT INTO products (product_name, dropbox_url, rakuten_url, return_shipping_fee, warranty_days, is_active, sale_status)
  VALUES ('一酸化炭素チェッカー', NULL, 'https://item.rakuten.co.jp/next-online/10000164/', 546, 30, true, 'active')
  ON CONFLICT DO NOTHING
  RETURNING id INTO pid;
  IF pid IS NOT NULL THEN
    INSERT INTO product_knowledge (product_id, synonyms, features, campaign_name, campaign_detail, present_item, present_summary, is_active)
    VALUES (pid, ARRAY['一酸化炭素チェッカー','COチェッカー','一酸化炭素警報機','キャンプ用一酸化炭素センサー','コードレス一酸化炭素測定器'], '- 重量: 180g
- 乾電池式（コードレス）
- 一酸化炭素濃度検知
- 大音量アラーム
- CO濃度表示機能
- キャンプ・車中泊・暖房器具使用時の安全対策用
- 天井取り付け可能
- 持ち運び可能な軽量設計', 'レビュー投稿でウィンドスクリーン・一年の延長保証（通常６ヶ月）プレゼント', '【楽天】レビュー投稿→レビュー投稿完了・プレゼントお申込み受付メールのフォームから希望商品選択（ウィンドスクリーンor10%クーポン）→プレゼント発送＋１年の延長保証', 'ウィンドスクリーン', 'レビュー投稿でウィンドスクリーン・一年の延長保証（通常６ヶ月）プレゼント', true);
  END IF;

  -- CO2測定器（エアマネ）
  INSERT INTO products (product_name, dropbox_url, rakuten_url, return_shipping_fee, warranty_days, is_active, sale_status)
  VALUES ('CO2測定器（エアマネ）', NULL, 'https://item.rakuten.co.jp/next-online/10000169/', 546, 365, true, 'active')
  ON CONFLICT DO NOTHING
  RETURNING id INTO pid;
  IF pid IS NOT NULL THEN
    INSERT INTO product_knowledge (product_id, synonyms, features, campaign_name, campaign_detail, present_item, present_summary, is_active)
    VALUES (pid, ARRAY['CO2測定器（エアマネ）','エアマネ','CO2センサー','二酸化炭素測定器'], NULL, 'レビュー投稿で保証3年間に延長（通常は１年間）', '楽天市場、Yahooにて購入いただいたお客様が購入モールでレビュー投稿をしてお申し込みフォームに申し込んだら完了', '保証３年間に延長', 'レビュー投稿で保証3年間に延長（通常は1年間）', true);
  END IF;

  -- ウィンドスクリーン24cm(小)
  INSERT INTO products (product_name, dropbox_url, rakuten_url, return_shipping_fee, warranty_days, is_active, sale_status)
  VALUES ('ウィンドスクリーン24cm(小)', NULL, 'https://item.rakuten.co.jp/next-online/10000136/', 371, 30, true, 'active')
  ON CONFLICT DO NOTHING
  RETURNING id INTO pid;
  IF pid IS NOT NULL THEN
    INSERT INTO product_knowledge (product_id, synonyms, features, campaign_name, campaign_detail, present_item, present_summary, is_active)
    VALUES (pid, ARRAY['ウィンドスクリーン24cm(小)','サボテン鉢','防風板','キャンプ用ウィンドスクリーン','BBQ用防風板'], '- 高さ24cmタイプ
- 全長: 84cm
- 高さ: 24cm
- 厚み: 2cm
- 重量: 270g
- 枚数: 10枚
- 折りたたみ式
- 軽量コンパクト
- 収納袋付き
- キャンプ・BBQ・焚き火用防風板
- リフレクター・反射板として使用可能', NULL, NULL, 'ウィンドスクリーン用ハードケース', 'ウィンドスクリーン用ハードケースまたは10%クーポン', true);
  END IF;

  -- ウィンドスクリーン60cm
  INSERT INTO products (product_name, dropbox_url, rakuten_url, return_shipping_fee, warranty_days, is_active, sale_status)
  VALUES ('ウィンドスクリーン60cm', NULL, 'https://item.rakuten.co.jp/next-online/10000136/?variantId=10000225', 803, 30, true, 'active')
  ON CONFLICT DO NOTHING
  RETURNING id INTO pid;
  IF pid IS NOT NULL THEN
    INSERT INTO product_knowledge (product_id, synonyms, features, campaign_name, campaign_detail, present_item, present_summary, is_active)
    VALUES (pid, ARRAY['ウィンドスクリーン60cm','高さ60cm防風板','キャンプ用ウィンドスクリーン','BBQ用風除け','折りたたみ式防風板'], '- 高さ60cmタイプ
- 全長: 120cm
- 高さ: 60cm
- 重量: 2100g
- 枚数: 8枚
- 折りたたみ式
- 収納袋付き
- 大型サイズ
- キャンプ・BBQ・焚き火用防風板
- リフレクター・反射板として使用可能
- ペグ付きで倒れにくい', NULL, NULL, 'なし', NULL, true);
  END IF;

  -- 洗濯機かさ上げ台（ふんばるゾウ）
  INSERT INTO products (product_name, dropbox_url, rakuten_url, return_shipping_fee, warranty_days, is_active, sale_status)
  VALUES ('洗濯機かさ上げ台（ふんばるゾウ）', NULL, 'https://grp07.ias.rakuten.co.jp/redirect_rpp/?s=80mzhtMg7vA&l=m3sfg9fLxQ4&v=9BXO9lFCPQiz7GLZZplQ2oDPt85igmZ_0iofM_Z7TUE&d=2025-12-23&q=Next%E3%82%AA%E3%83%B3%E3%83%A9%E3%82%A4%E3%83%B3&j=A1gm5N5yy1s&r=CfzqOs4JSuxasU3B8j4PvBzf1ElfR8SfgpAujxZO_3ts67i2qls3SVc-Rl3y_j_U6vF-V8enLOs&ii=Iem7VEYfd6u6F_XmIb9E5Q&si=9KOxQl6BQ4Q&ci=VHykNsUQqSw&as=dFFQAC3K2XA&cp=w1AackVRueI&lg=sYksZGVVJZHPydHtWN11m7oX9eYhv0Tl&ap=&ft=ITs1qSiMuGw&e=IE0wiWDnCZE', 707, 30, true, 'active')
  ON CONFLICT DO NOTHING
  RETURNING id INTO pid;
  IF pid IS NOT NULL THEN
    INSERT INTO product_knowledge (product_id, synonyms, features, campaign_name, campaign_detail, present_item, present_summary, is_active)
    VALUES (pid, ARRAY['洗濯機かさ上げ台','ふんばるゾウ','かさ上げ台','嵩上げ台','かさあげ台'], NULL, 'レビュー投稿でプレゼント', '【Yahoo】レビュー投稿→チラシ内お申し込みフォームから申し込み→プレゼント発送【楽天】レビュー投稿→レビュー投稿完了・プレゼントお申込み受付メールのフォームから希望商品選択（防振マットor10%クーポン）→プレゼント発送', '防振マット', 'レビュー投稿→チラシ内お申し込みフォームから申し込み→プレゼント発送（Yahoo）; レビュー投稿完了・プレゼントお申込み受付メールのフォームから希望商品選択（防振マットor10%クーポン）→プレゼント発送（楽天）', true);
  END IF;

  -- 防災バッグ
  INSERT INTO products (product_name, dropbox_url, rakuten_url, return_shipping_fee, warranty_days, is_active, sale_status)
  VALUES ('防災バッグ', NULL, 'https://item.rakuten.co.jp/next-online/10000183/?variantId=normal-inventory', 803, 365, true, 'active')
  ON CONFLICT DO NOTHING
  RETURNING id INTO pid;
  IF pid IS NOT NULL THEN
    INSERT INTO product_knowledge (product_id, synonyms, features, campaign_name, campaign_detail, present_item, present_summary, is_active)
    VALUES (pid, ARRAY['防災バッグ','サバイバルバッグ','緊急用リュック','防災リュック','非常用バッグ'], NULL, '①レビュー投稿でプレゼント②インスタ投稿していただいた方に両面テープ3cm×1m(一個)プレゼント※インスタのみの投稿でもOK。その場合、耐震ジェルのプレゼントではなく、両面テープのみ→詳細は下記のその他キャンペーン記載③インスタ投稿していただいた方にアマゾンギフト券（コード）送付→詳細は下記他キャンペーン記載', '【Yahoo】レビュー投稿→チラシ内お申し込みフォームから申し込み→プレゼント発送【楽天】レビュー投稿→レビュー投稿完了・プレゼントお申込み受付メールのフォームから希望商品選択（非常用トイレor10%クーポン）→プレゼント発送', '非常用トイレ15回', '- レビュー投稿でプレゼント
- インスタ投稿で両面テーププレゼント
- インスタ投稿でアマゾンギフト券送付', true);
  END IF;

  -- 防災バッグ（単品）
  INSERT INTO products (product_name, dropbox_url, rakuten_url, return_shipping_fee, warranty_days, is_active, sale_status)
  VALUES ('防災バッグ（単品）', NULL, 'https://item.rakuten.co.jp/next-online/10000191/?variantId=normal-inventory', 803, 365, true, 'active')
  ON CONFLICT DO NOTHING
  RETURNING id INTO pid;
  IF pid IS NOT NULL THEN
    INSERT INTO product_knowledge (product_id, synonyms, features, campaign_name, campaign_detail, present_item, present_summary, is_active)
    VALUES (pid, ARRAY['防災バッグ単品','防災バッグ単体'], '- サイズ: 42cm×31cm
- 防災リュック単品（中身なし）
- おしゃれなデザイン（リビングに馴染む）
- 大容量
- 防水性能
- ポケット多数
- 軽量
- 女性・子供にも背負いやすいサイズ
- 1人用
- 防災士推奨', 'レビュー投稿でプレゼント', '【Yahoo】レビュー投稿→チラシ内お申し込みフォームから申し込み→プレゼント発送【楽天】レビュー投稿→レビュー投稿完了・プレゼントお申込み受付メールのフォームから希望商品選択（耐震マットor10%クーポン）→プレゼント発送', '耐震ジェルブルーorクリア4枚', 'レビュー投稿でプレゼント: 耐震ジェルブルーまたはクリア4枚', true);
  END IF;

  -- 洗濯機キャスター
  INSERT INTO products (product_name, dropbox_url, rakuten_url, return_shipping_fee, warranty_days, is_active, sale_status)
  VALUES ('洗濯機キャスター', NULL, 'https://item.rakuten.co.jp/next-online/10000181/?variantId=normal-inventory', 707, 90, true, 'active')
  ON CONFLICT DO NOTHING
  RETURNING id INTO pid;
  IF pid IS NOT NULL THEN
    INSERT INTO product_knowledge (product_id, synonyms, features, campaign_name, campaign_detail, present_item, present_summary, is_active)
    VALUES (pid, ARRAY['洗濯機キャスター','キャスター付き洗濯機台','防振洗濯機キャスター','洗濯機移動台','洗濯機用キャスター'], '- サイズ: 104mm×100mm×62mm（1個あたり）
- 耐荷重: 500kg
- 伸縮式で洗濯機のサイズに合わせて調整可能
- キャスター付きで移動が簡単
- 防振機能付き（振動音抑制）
- ズレ防止機能
- 水平器付き
- ドラム式・縦型洗濯機対応
- 洗濯機下のスペース確保で掃除が楽', 'レビュー投稿でプレゼント', '【Yahoo】レビュー投稿→チラシ内お申し込みフォームから申し込み→プレゼント発送【楽天】レビュー投稿→レビュー投稿完了・プレゼントお申込み受付メールのフォームから希望商品選択（防振マットor10%クーポン）→プレゼント発送', '防振マット', 'レビュー投稿でプレゼント
- 【Yahoo】レビュー投稿→チラシ内お申し込みフォームから申し込み→プレゼント発送
- 【楽天】レビュー投稿→レビュー投稿完了・プレゼントお申込み受付メールのフォームから希望商品選択（防振マットor10%クーポン）→プレゼント発送
プレゼント対象商品: 防振マット', true);
  END IF;

  -- 冷蔵庫マット
  INSERT INTO products (product_name, dropbox_url, rakuten_url, return_shipping_fee, warranty_days, is_active, sale_status)
  VALUES ('冷蔵庫マット', NULL, 'https://grp07.ias.rakuten.co.jp/redirect_rpp/?s=80mzhtMg7vA&l=m3sfg9fLxQ4&v=9BXO9lFCPQiz7GLZZplQ2oDPt85igmZ_0iofM_Z7TUE&d=2025-12-23&q=Next%E3%82%AA%E3%83%B3%E3%83%A9%E3%82%A4%E3%83%B3&j=A1gm5N5yy1s&r=CfzqOs4JSuxasU3B8j4PvBzf1ElfR8SfgpAujxZO_3ts67i2qls3SVc-Rl3y_j_U6vF-V8enLOs&ii=QU0vQi36RIm6F_XmIb9E5Q&si=9KOxQl6BQ4Q&ci=VHykNsUQqSw&as=dFFQAC3K2XA&cp=w1AackVRueI&lg=sYksZGVVJZHPydHtWN11m7oX9eYhv0Tl&ap=&ft=ITs1qSiMuGw&e=IE0wiWDnCZE', 1377, 365, true, 'active')
  ON CONFLICT DO NOTHING
  RETURNING id INTO pid;
  IF pid IS NOT NULL THEN
    INSERT INTO product_knowledge (product_id, synonyms, features, campaign_name, campaign_detail, present_item, present_summary, is_active)
    VALUES (pid, ARRAY['冷蔵庫マット'], NULL, NULL, 'インスタ投稿アカウントは鍵がかかっていない状態にて申し込み対象になります。投稿が外部から確認が取れないとこちらの意図するものと異なるのが理由です。', '300円クーポン, ハンディモップ, 防振マット', '- インスタ投稿アカウントは鍵がかかっていない状態で申し込み対象
- プレゼント対象商品: 300円クーポン, ハンディモップ, 防振マット
- 楽天で冷蔵庫マット購入者がインスタグラムにチラシ内容に沿って申し込みで両面テープ1個プレゼント', true);
  END IF;

  -- 面ファスナー
  INSERT INTO products (product_name, dropbox_url, rakuten_url, return_shipping_fee, warranty_days, is_active, sale_status)
  VALUES ('面ファスナー', NULL, 'https://item.rakuten.co.jp/next-online/10000207/', 371, 30, true, 'active')
  ON CONFLICT DO NOTHING
  RETURNING id INTO pid;
  IF pid IS NOT NULL THEN
    INSERT INTO product_knowledge (product_id, synonyms, features, campaign_name, campaign_detail, present_item, present_summary, is_active)
    VALUES (pid, ARRAY['面ファスナー','マジックテープ','フックとループ'], NULL, 'レビュー投稿でプレゼント', '【Amazon・Yahoo】レビュー投稿→チラシ内お申し込みフォームから申し込み→プレゼント発送【楽天】レビュー投稿→レビュー投稿完了・プレゼントお申込み受付メールのフォームから希望商品選択（耐震ジェルor10%クーポン）→プレゼント発送', '耐震ジェルブルーorクリア4枚', 'レビュー投稿→チラシ内お申し込みフォームから申し込み→プレゼント発送（Amazon・Yahoo）
レビュー投稿完了・プレゼントお申込み受付メールのフォームから希望商品選択（耐震ジェルor10%クーポン）→プレゼント発送（楽天）', true);
  END IF;

  -- ティッシュケース
  INSERT INTO products (product_name, dropbox_url, rakuten_url, return_shipping_fee, warranty_days, is_active, sale_status)
  VALUES ('ティッシュケース', NULL, 'https://item.rakuten.co.jp/next-online/10000175/', 626, 30, true, 'active')
  ON CONFLICT DO NOTHING
  RETURNING id INTO pid;
  IF pid IS NOT NULL THEN
    INSERT INTO product_knowledge (product_id, synonyms, features, campaign_name, campaign_detail, present_item, present_summary, is_active)
    VALUES (pid, ARRAY['ティッシュケース','ティッシュボックス','ティッシュ収納','ティッシュホルダー','デザインティッシュケース'], NULL, 'レビュー投稿でプレゼント', '【楽天】レビュー投稿→レビュー投稿完了・プレゼントお申込み受付メールのフォームから希望商品選択（小物ケースor10%クーポン）→プレゼント発送', '300円クーポン', 'レビュー投稿→レビュー投稿完了・プレゼントお申込み受付メールのフォームから希望商品選択（小物ケースor10%クーポン）→プレゼント発送', true);
  END IF;

  -- チェアマット
  INSERT INTO products (product_name, dropbox_url, rakuten_url, return_shipping_fee, warranty_days, is_active, sale_status)
  VALUES ('チェアマット', NULL, 'https://item.rakuten.co.jp/next-online/10000306/?variantId=normal-inventory', 948, 365, true, 'active')
  ON CONFLICT DO NOTHING
  RETURNING id INTO pid;
  IF pid IS NOT NULL THEN
    INSERT INTO product_knowledge (product_id, synonyms, features, campaign_name, campaign_detail, present_item, present_summary, is_active)
    VALUES (pid, ARRAY['チェアマット','フロアマット','デスクマット','滑り止めマット','防カビマット'], NULL, 'レビュー投稿でプレゼント', '【楽天】レビュー投稿→レビュー投稿完了・プレゼントお申込み受付メールのフォームから希望商品選択（耐震ジェルor10%クーポン）→プレゼント発送', '耐震ジェルブルーorクリア4枚', 'レビュー投稿→レビュー投稿完了・プレゼントお申込み受付メールのフォームから希望商品選択（耐震ジェルor10%クーポン）→プレゼント発送', true);
  END IF;

  -- キッチンマット
  INSERT INTO products (product_name, dropbox_url, rakuten_url, return_shipping_fee, warranty_days, is_active, sale_status)
  VALUES ('キッチンマット', NULL, 'https://item.rakuten.co.jp/next-online/10000304/', 803, 30, true, 'active')
  ON CONFLICT DO NOTHING
  RETURNING id INTO pid;
  IF pid IS NOT NULL THEN
    INSERT INTO product_knowledge (product_id, synonyms, features, campaign_name, campaign_detail, present_item, present_summary, is_active)
    VALUES (pid, ARRAY['キッチンマット','PVCマット','防カビキッチンマット','滑り止めマット'], '- 厚さ: 1.5mm
- 素材: PVC
- 防カビ・撥水・防水
- 透明（可視光線透過率80-90%）
- 床暖房対応
- 滑り止め機能
- 洗濯不要（拭くだけ）
- 耐熱性あり
- サイズ展開: 120×45、180×45、180×60、240×45、240×60、270×60
- 床保護・傷防止', 'レビュー投稿でプレゼント', '【楽天】レビュー投稿→レビュー投稿完了・プレゼントお申込み受付メールのフォームから希望商品選択（耐震ジェルor10%クーポン）→プレゼント発送', '耐震ジェルブルーorクリア4枚', 'レビュー投稿でプレゼント: 耐震ジェルブルーまたはクリア4枚', true);
  END IF;

  -- 卓上ミラー
  INSERT INTO products (product_name, dropbox_url, rakuten_url, return_shipping_fee, warranty_days, is_active, sale_status)
  VALUES ('卓上ミラー', NULL, 'https://item.rakuten.co.jp/next-online/10000220/', 371, 30, true, 'active')
  ON CONFLICT DO NOTHING
  RETURNING id INTO pid;
  IF pid IS NOT NULL THEN
    INSERT INTO product_knowledge (product_id, synonyms, features, campaign_name, campaign_detail, present_item, present_summary, is_active)
    VALUES (pid, ARRAY['卓上ミラーMサイズ','卓上ミラーLサイズ','卓上ミラーSサイズ','折りたたみ式ミラー','折りたたみミラー','折畳ミラー','折り畳みミラー'], '- サイズ: 205mm×150mm
- 重量: 500g
- 素材: PVCレザー
- 角度調整可能
- 折りたたみ式（薄さ10mm）
- 持ち運び可能
- 大きめサイズ（頭から胸元まで映る）
- 5サイズ・12色展開
- 撥水性レザー
- お手入れ簡単
- プレゼントに最適', 'レビュー投稿でプレゼント', '【楽天】レビュー投稿→レビュー投稿完了・プレゼントお申込み受付メールのフォームから希望商品選択（卓上ミラーMサイズor10%クーポン）→プレゼント発送', '卓上ミラーＳサイズ', 'レビュー投稿→レビュー投稿完了・プレゼントお申込み受付メールのフォームから希望商品選択（卓上ミラーMサイズor10%クーポン）→プレゼント発送', true);
  END IF;

  -- 掃除機スタンド
  INSERT INTO products (product_name, dropbox_url, rakuten_url, return_shipping_fee, warranty_days, is_active, sale_status)
  VALUES ('掃除機スタンド', NULL, 'https://item.rakuten.co.jp/next-online/10000230/', 803, 30, true, 'active')
  ON CONFLICT DO NOTHING
  RETURNING id INTO pid;
  IF pid IS NOT NULL THEN
    INSERT INTO product_knowledge (product_id, synonyms, features, campaign_name, campaign_detail, present_item, present_summary, is_active)
    VALUES (pid, ARRAY['掃除機スタンド','ダイソン掃除機スタンド','コードレスクリーナースタンド','多機種対応掃除機スタンド','充電スタンド','収納スペース一体型スタンド'], '- サイズ: 126.5cm×31cm×22cm
- 重量: 4kg
- 素材: スチール
- ダイソン掃除機スタンド
- 多機種対応（V6、V7、V8、V10、V11、V12、V15、V18、DC35、DC45など）
- コードレスクリーナー対応
- 壁への穴あけ不要
- アタッチメント収納可能
- 立てて充電可能
- 収納スペース一体型', 'レビュー投稿でプレゼント', '【楽天】レビュー投稿→レビュー投稿完了・プレゼントお申込み受付メールのフォームから希望商品選択（ハンディモップor10%クーポン）→プレゼント発送', 'ハンディモップ', 'レビュー投稿→レビュー投稿完了・プレゼントお申込み受付メールのフォームから希望商品選択（ハンディモップor10%クーポン）→プレゼント発送', true);
  END IF;

  -- レンジガード
  INSERT INTO products (product_name, dropbox_url, rakuten_url, return_shipping_fee, warranty_days, is_active, sale_status)
  VALUES ('レンジガード', NULL, 'https://item.rakuten.co.jp/next-online/10000232/', 626, 30, true, 'active')
  ON CONFLICT DO NOTHING
  RETURNING id INTO pid;
  IF pid IS NOT NULL THEN
    INSERT INTO product_knowledge (product_id, synonyms, features, campaign_name, campaign_detail, present_item, present_summary, is_active)
    VALUES (pid, ARRAY['レンジガード','キッチンガード','油はねガード','コンロ用ガード'], '- サイズ: 72.5cm×37cm×0.35cm
- 重量: 4kg
- 素材: 鉄（ステンレス製）
- 折りたたみ式でコンパクト収納
- 油はねガード・揚げ物ガード
- ガスコンロ・IH対応
- 選べるパネル高さ（4面・5面・8面）', 'レビュー投稿でプレゼント', '【楽天】レビュー投稿→レビュー投稿完了・プレゼントお申込み受付メールのフォームから希望商品選択（揚げ物鍋用トングor10%クーポン）→プレゼント発送', '揚げ物用トング', 'レビュー投稿→レビュー投稿完了・プレゼントお申込み受付メールのフォームから希望商品選択（揚げ物鍋用トングor10%クーポン）→プレゼント発送', true);
  END IF;

  -- 揚げ物鍋
  INSERT INTO products (product_name, dropbox_url, rakuten_url, return_shipping_fee, warranty_days, is_active, sale_status)
  VALUES ('揚げ物鍋', NULL, 'https://grp07.ias.rakuten.co.jp/redirect_rpp/?s=80mzhtMg7vA&l=m3sfg9fLxQ4&v=9BXO9lFCPQiz7GLZZplQ2oDPt85igmZ_0iofM_Z7TUE&d=2025-12-23&q=Next%E3%82%AA%E3%83%B3%E3%83%A9%E3%82%A4%E3%83%B3&j=A1gm5N5yy1s&r=CfzqOs4JSuxasU3B8j4PvBzf1ElfR8SfgpAujxZO_3ts67i2qls3SVc-Rl3y_j_U6vF-V8enLOs&ii=CI_6rw2zI0i6F_XmIb9E5Q&si=9KOxQl6BQ4Q&ci=VHykNsUQqSw&as=dFFQAC3K2XA&cp=w1AackVRueI&lg=sYksZGVVJZHPydHtWN11m7oX9eYhv0Tl&ap=&ft=ITs1qSiMuGw&e=IE0wiWDnCZE', 626, 30, true, 'active')
  ON CONFLICT DO NOTHING
  RETURNING id INTO pid;
  IF pid IS NOT NULL THEN
    INSERT INTO product_knowledge (product_id, synonyms, features, campaign_name, campaign_detail, present_item, present_summary, is_active)
    VALUES (pid, ARRAY['揚げ物鍋','鍋'], NULL, 'レビュー投稿でプレゼント', '【楽天】レビュー投稿→レビュー投稿完了→プレゼント発送', '料理用温度計', 'レビュー投稿でプレゼント', true);
  END IF;

  -- 掃除ブラシ
  INSERT INTO products (product_name, dropbox_url, rakuten_url, return_shipping_fee, warranty_days, is_active, sale_status)
  VALUES ('掃除ブラシ', NULL, 'https://item.rakuten.co.jp/next-online/10000240/?variantId=10000240', 626, 30, true, 'active')
  ON CONFLICT DO NOTHING
  RETURNING id INTO pid;
  IF pid IS NOT NULL THEN
    INSERT INTO product_knowledge (product_id, synonyms, features, campaign_name, campaign_detail, present_item, present_summary, is_active)
    VALUES (pid, ARRAY['掃除ブラシ','クリーンブラシ','ランドリーブラシ','洗濯ブラシ'], NULL, 'レビュー投稿でプレゼント', NULL, '防振マット', 'レビュー投稿でプレゼント、防振マット', true);
  END IF;

  -- 女優ミラー
  INSERT INTO products (product_name, dropbox_url, rakuten_url, return_shipping_fee, warranty_days, is_active, sale_status)
  VALUES ('女優ミラー', NULL, 'https://item.rakuten.co.jp/next-online/10000250/', 707, 30, true, 'active')
  ON CONFLICT DO NOTHING
  RETURNING id INTO pid;
  IF pid IS NOT NULL THEN
    INSERT INTO product_knowledge (product_id, synonyms, features, campaign_name, campaign_detail, present_item, present_summary, is_active)
    VALUES (pid, ARRAY['女優ミラー','三面鏡','LEDミラー','コスメ収納ミラー'], '- サイズ: 205mm×150mm
- 重量: 500g
- 素材: PVCレザー
- 三色調光LED（明るさ無段階調整）
- 角度調整可能な三面鏡
- 拡大鏡付き
- 大容量コスメ収納（引き出し・仕切り付き）
- USB充電式（コードレス使用可能）
- 折りたたみ式', 'レビュー投稿でプレゼント', NULL, '卓上ミラーＳサイズ', 'レビュー投稿でプレゼント、卓上ミラーＳサイズ', true);
  END IF;

  -- ペットトリマーα
  INSERT INTO products (product_name, dropbox_url, rakuten_url, return_shipping_fee, warranty_days, is_active, sale_status)
  VALUES ('ペットトリマーα', NULL, 'https://item.rakuten.co.jp/next-online/pet-trimera/?variantId=pet-trimera', 626, 180, true, 'active')
  ON CONFLICT DO NOTHING
  RETURNING id INTO pid;
  IF pid IS NOT NULL THEN
    INSERT INTO product_knowledge (product_id, synonyms, features, campaign_name, campaign_detail, present_item, present_summary, is_active)
    VALUES (pid, ARRAY['ペットトリマーα','トリミングバリカン','ペット用バリカン','バリカン'], '- 重量: 約220g
- 液晶画面でバッテリー残量表示
- 静音設計
- USB充電式（コードレス使用可能）
- 充電時間: 3〜4時間
- 5段階刃調節
- アタッチメント4種付属（3mm、6mm、9mm、12mm）
- 犬用・猫用対応
- 水洗い可能
- トリマー監修マニュアル付
- 1年保証', '①レビュー投稿で替刃・一年の延長保証（通常６ヶ月）プレゼント②インスタ投稿していただいた方は替刃もう一つプレゼント※インスタのみの投稿でもOK。その場合替刃は一つ→詳細は下記のその他キャンペーン記載', '①【Yahoo】レビュー投稿→チラシ内お申し込みフォームから申し込み→プレゼント発送【楽天】レビュー投稿→レビュー投稿完了・プレゼントお申込み受付メールのフォームから希望商品選択（専用替刃or10%クーポン）→プレゼント発送②楽天市場、Yahooにてペットトリマーαを購入したお客様が、インスタ投稿チラシの内容に沿ってお申し込みいただいたら、更に追加で替刃一個プレゼント', 'ペットトリマーα専用替刃', '①レビュー投稿→チラシ内お申し込みフォームから申し込み→プレゼント発送
②楽天市場、Yahooでペットトリマーα購入者がインスタ投稿で申し込み→替刃一個プレゼント
プレゼント対象商品: ペットトリマーα専用替刃
キャンペーン名: ①レビュー投稿で替刃・一年の延長保証プレゼント
②インスタ投稿で替刃もう一つプレゼント', true);
  END IF;

  -- ペット給水器
  INSERT INTO products (product_name, dropbox_url, rakuten_url, return_shipping_fee, warranty_days, is_active, sale_status)
  VALUES ('ペット給水器', NULL, 'https://grp07.ias.rakuten.co.jp/redirect_rpp/?s=80mzhtMg7vA&l=m3sfg9fLxQ4&v=9BXO9lFCPQiz7GLZZplQ2oDPt85igmZ_0iofM_Z7TUE&d=2025-12-23&q=Next%E3%82%AA%E3%83%B3%E3%83%A9%E3%82%A4%E3%83%B3&j=A1gm5N5yy1s&r=CfzqOs4JSuxasU3B8j4PvBzf1ElfR8SfgpAujxZO_3ts67i2qls3SVc-Rl3y_j_U6vF-V8enLOs&ii=Sp4oGpzT_Ei6F_XmIb9E5Q&si=9KOxQl6BQ4Q&ci=VHykNsUQqSw&as=dFFQAC3K2XA&cp=w1AackVRueI&lg=sYksZGVVJZHPydHtWN11m7oX9eYhv0Tl&ap=&ft=ITs1qSiMuGw&e=IE0wiWDnCZE', 707, 365, true, 'active')
  ON CONFLICT DO NOTHING
  RETURNING id INTO pid;
  IF pid IS NOT NULL THEN
    INSERT INTO product_knowledge (product_id, synonyms, features, campaign_name, campaign_detail, present_item, present_summary, is_active)
    VALUES (pid, ARRAY['ペット給水器','自動給水器','水飲み器','ペット用水入れ','ペット用給水器','ペット給水機','給水機','給水器'], NULL, NULL, 'インスタ投稿アカウントは鍵がかかっていない状態にて申し込み対象になります。投稿が外部から確認が取れないとこちらの意図するものと異なるのが理由です。', '自動給水器専用フィルター（１枚入り）', '自動給水器専用フィルター（1枚入り）プレゼント。楽天で自動給水器購入者がインスタ投稿チラシに沿って申し込むと、追加でフィルター（2枚入り・パッケージ付き）プレゼント。', true);
  END IF;

  -- ペットトリマーβ
  INSERT INTO products (product_name, dropbox_url, rakuten_url, return_shipping_fee, warranty_days, is_active, sale_status)
  VALUES ('ペットトリマーβ', NULL, 'https://item.rakuten.co.jp/next-online/pet-trimerb/?variantId=pet-trimerb', 546, 180, true, 'active')
  ON CONFLICT DO NOTHING
  RETURNING id INTO pid;
  IF pid IS NOT NULL THEN
    INSERT INTO product_knowledge (product_id, synonyms, features, campaign_name, campaign_detail, present_item, present_summary, is_active)
    VALUES (pid, ARRAY['ペットトリマーβ','電動爪やすり','ペット用爪研ぎ','ペット用グルーミングツール','爪研ぎ','爪やすり'], NULL, 'レビュー投稿で１年の延長保証（通常６ヶ月）', '楽天市場、Yahooにて購入いただいたお客様が、購入モールでレビュー投稿をしてお申し込みフォームに申し込んだら完了', '保証1年間に延長', 'レビュー投稿で１年の延長保証（通常６ヶ月）', true);
  END IF;

  -- ペットスケーラー
  INSERT INTO products (product_name, dropbox_url, rakuten_url, return_shipping_fee, warranty_days, is_active, sale_status)
  VALUES ('ペットスケーラー', NULL, 'https://item.rakuten.co.jp/next-online/10000167/?variantId=10000167', 803, 180, true, 'active')
  ON CONFLICT DO NOTHING
  RETURNING id INTO pid;
  IF pid IS NOT NULL THEN
    INSERT INTO product_knowledge (product_id, synonyms, features, campaign_name, campaign_detail, present_item, present_summary, is_active)
    VALUES (pid, ARRAY['ペットスケーラー','ペット用スケーラー','ペット体重計','ペット用体重計'], NULL, 'レビュー投稿でプレゼント', '楽天市場はレビューしたら申し込み完了Yahoo・Amazonは購入いただいたお客様が購入モールでレビュー投稿をしてお申し込みフォームに申し込んだら完了', '光る首輪', '光る首輪をプレゼント。2024/02/26までに購入し、レビュー投稿があれば1年保証適用。ただし、光る首輪のプレゼントはなし。', true);
  END IF;

  -- エチケットカッター
  INSERT INTO products (product_name, dropbox_url, rakuten_url, return_shipping_fee, warranty_days, is_active, sale_status)
  VALUES ('エチケットカッター', NULL, 'https://item.rakuten.co.jp/next-online/10000229/', 371, 30, true, 'active')
  ON CONFLICT DO NOTHING
  RETURNING id INTO pid;
  IF pid IS NOT NULL THEN
    INSERT INTO product_knowledge (product_id, synonyms, features, campaign_name, campaign_detail, present_item, present_summary, is_active)
    VALUES (pid, ARRAY['エチケットカッター','眉毛カッター','鼻毛カッター','耳毛カッター'], '- サイズ: 18mm×130mm
- 重量: 134.5g
- 素材: アルミ
- USB充電式
- 水洗い可能（本体は充電口を除く）
- 1台4役（鼻毛・眉毛・ヒゲ・耳毛）
- 軽量設計
- メンズ・レディース兼用
- 複数のアタッチメント付属', 'レビュー投稿で6ヶ月の延長保証（通常30日）', '【楽天】レビュー投稿→レビュー投稿完了→プレゼント発送', 'エチケットカッター収納袋, 保証期間6ヶ月に延長', 'レビュー投稿で6ヶ月の延長保証（通常30日）、エチケットカッター収納袋', true);
  END IF;

  -- 給水器フィルター
  INSERT INTO products (product_name, dropbox_url, rakuten_url, return_shipping_fee, warranty_days, is_active, sale_status)
  VALUES ('給水器フィルター', NULL, 'https://item.rakuten.co.jp/next-online/10000186/', 371, 30, true, 'active')
  ON CONFLICT DO NOTHING
  RETURNING id INTO pid;
  IF pid IS NOT NULL THEN
    INSERT INTO product_knowledge (product_id, synonyms, features, campaign_name, campaign_detail, present_item, present_summary, is_active)
    VALUES (pid, ARRAY['給水器フィルター','ペット用給水器フィルター','水フィルター','ペット給水器','フィルター交換用商品'], NULL, NULL, '【楽天】レビュー投稿→レビュー投稿完了→プレゼント発送', 'フィルター1枚', 'レビュー投稿→レビュー投稿完了→プレゼント発送', true);
  END IF;

  -- ペットトリマーα専用替刃
  INSERT INTO products (product_name, dropbox_url, rakuten_url, return_shipping_fee, warranty_days, is_active, sale_status)
  VALUES ('ペットトリマーα専用替刃', NULL, 'https://item.rakuten.co.jp/next-online/10000192/?variantId=normal-inventory', 371, 30, true, 'active')
  ON CONFLICT DO NOTHING
  RETURNING id INTO pid;
  IF pid IS NOT NULL THEN
    INSERT INTO product_knowledge (product_id, synonyms, features, campaign_name, campaign_detail, present_item, present_summary, is_active)
    VALUES (pid, ARRAY['ペットトリマーα替刃','ペットトリマーα専用替刃','トリミング用替刃','静音設計トリマー','コードレスバリカン替刃'], '- ペットトリマーα専用の替刃
- 静音設計
- 軽量
- 水洗い可能
- 犬用・猫用対応
- コードレス充電式バリカン用', NULL, NULL, 'なし', NULL, true);
  END IF;

  -- シーツハンガー
  INSERT INTO products (product_name, dropbox_url, rakuten_url, return_shipping_fee, warranty_days, is_active, sale_status)
  VALUES ('シーツハンガー', NULL, 'https://item.rakuten.co.jp/next-online/10000260/', 803, 30, true, 'active')
  ON CONFLICT DO NOTHING
  RETURNING id INTO pid;
  IF pid IS NOT NULL THEN
    INSERT INTO product_knowledge (product_id, synonyms, features, campaign_name, campaign_detail, present_item, present_summary, is_active)
    VALUES (pid, ARRAY['シーツハンガー','シーツ干しハンガー','ランドリーハンガー','洗濯物ハンガー','シーツ用ハンガー'], NULL, 'レビュー投稿でプレゼント', '【楽天】
レビュー投稿→レビュー投稿完了・プレゼントお申込み受付メールのフォームから希望商品選択（アイマスクor10%クーポン）→プレゼント発送', 'ハンディモップ', 'レビュー投稿でプレゼント：レビュー投稿完了後、希望商品（アイマスクまたは10%クーポン）を選択し、プレゼント発送', true);
  END IF;

  -- ホットアイマスク
  INSERT INTO products (product_name, dropbox_url, rakuten_url, return_shipping_fee, warranty_days, is_active, sale_status)
  VALUES ('ホットアイマスク', NULL, 'https://item.rakuten.co.jp/next-online/10000235/', 371, 30, true, 'active')
  ON CONFLICT DO NOTHING
  RETURNING id INTO pid;
  IF pid IS NOT NULL THEN
    INSERT INTO product_knowledge (product_id, synonyms, features, campaign_name, campaign_detail, present_item, present_summary, is_active)
    VALUES (pid, ARRAY['ホットアイマスク','アイマスク','温感アイマスク','リラックスアイマスク','目元ケアアイマスク'], '- サイズ: 周囲最大61cm×最小51cm
- バッテリー: 1200mAh
- 外カバー素材: シルク100%
- USB充電式（コードレス）
- 繰り返し使える
- 充電長持ち
- 温感機能
- 洗える（外カバー）
- 遮光機能
- 男女兼用
- 目元ケア・リラックス用', NULL, '【楽天】レビュー投稿→レビュー投稿完了→プレゼント発送', 'ホットアイマスクカバー※色指定不可', 'レビュー投稿→レビュー投稿完了→プレゼント発送。プレゼント対象商品: ホットアイマスクカバー（色指定不可）', true);
  END IF;

  -- ペットサークル
  INSERT INTO products (product_name, dropbox_url, rakuten_url, return_shipping_fee, warranty_days, is_active, sale_status)
  VALUES ('ペットサークル', NULL, 'https://item.rakuten.co.jp/next-online/10000272/', 1377, 30, true, 'active')
  ON CONFLICT DO NOTHING
  RETURNING id INTO pid;
  IF pid IS NOT NULL THEN
    INSERT INTO product_knowledge (product_id, synonyms, features, campaign_name, campaign_detail, present_item, present_summary, is_active)
    VALUES (pid, ARRAY['ペットサークル','ペットフェンス'], '- 素材: PVC
- 防水・撥水・抗菌
- 床暖房対応
- 滑り止め付き
- ひっかき傷に強い
- 防炎性能
- お手入れ簡単（拭くだけ）
- クッション性あり
- 犬・猫・ペット用マット
- 大判サイズ
- シニア犬にも安心', NULL, '【楽天】レビュー投稿→レビュー投稿完了→プレゼント発送', '光る首輪', 'レビュー投稿→レビュー投稿完了→プレゼント発送。プレゼント対象商品: 光る首輪', true);
  END IF;

  -- ペットリュック
  INSERT INTO products (product_name, dropbox_url, rakuten_url, return_shipping_fee, warranty_days, is_active, sale_status)
  VALUES ('ペットリュック', NULL, 'https://item.rakuten.co.jp/next-online/10000273/', 803, 30, true, 'active')
  ON CONFLICT DO NOTHING
  RETURNING id INTO pid;
  IF pid IS NOT NULL THEN
    INSERT INTO product_knowledge (product_id, synonyms, features, campaign_name, campaign_detail, present_item, present_summary, is_active)
    VALUES (pid, ARRAY['ペットリュック','ペット用リュック','キャットバッグ','ドッグバックパック','ペットキャリーリュック'], NULL, NULL, '【楽天】レビュー投稿→レビュー投稿完了・プレゼントお申込み受付メールのフォームから希望商品選択→プレゼント発送', '光る首輪, 肉球ポインター', 'レビュー投稿→レビュー投稿完了・プレゼントお申込み受付メールのフォームから希望商品選択→プレゼント発送', true);
  END IF;

  -- ホットアイマスクカバー
  INSERT INTO products (product_name, dropbox_url, rakuten_url, return_shipping_fee, warranty_days, is_active, sale_status)
  VALUES ('ホットアイマスクカバー', NULL, 'https://item.rakuten.co.jp/next-online/10000237/', 371, 30, true, 'active')
  ON CONFLICT DO NOTHING
  RETURNING id INTO pid;
  IF pid IS NOT NULL THEN
    INSERT INTO product_knowledge (product_id, synonyms, features, campaign_name, campaign_detail, present_item, present_summary, is_active)
    VALUES (pid, ARRAY['ホットアイマスクカバー','ホットアイマスク','アイマスクカバー','シルクアイマスク','目元ケアカバー'], '- サイズ: 周囲最大61cm×最小51cm
- バッテリー: 1200mAh
- 外カバー素材: シルク100%
- ホットアイマスク専用替えカバー
- 洗濯可能
- PureWarmth専用
- 繰り返し使える
- 3D立体型
- 低反発
- 目元ケア・リラックス用', NULL, '【楽天】レビュー投稿→レビュー投稿完了→プレゼント発送', 'ホットアイマスク収納ポーチ', 'レビュー投稿→レビュー投稿完了→プレゼント発送
プレゼント対象商品: ホットアイマスク収納ポーチ', true);
  END IF;

  -- メイクブラシセット
  INSERT INTO products (product_name, dropbox_url, rakuten_url, return_shipping_fee, warranty_days, is_active, sale_status)
  VALUES ('メイクブラシセット', NULL, 'https://item.rakuten.co.jp/next-online/10000280/?variantId=10000280', NULL, 30, true, 'active')
  ON CONFLICT DO NOTHING
  RETURNING id INTO pid;
  IF pid IS NOT NULL THEN
    INSERT INTO product_knowledge (product_id, synonyms, features, campaign_name, campaign_detail, present_item, present_summary, is_active)
    VALUES (pid, ARRAY['メイクブラシセット','メイクブラシ10本セット','ブラシケース付きメイクブラシ','高級毛メイクブラシ','藤嶋遥監修メイクブラシ','初心者向けメイクブラシセット'], '- メイクブラシ10本セット
- ブラシケース付き（スタンドとしても使用可能）
- 柔らかい高級毛
- 各ブラシに番号表示あり（使い方がわかりやすい）
- 藤嶋遥監修
- 手に馴染む新構造
- ブラック色で高級感
- 初心者にも使いやすい
- ギフト対応可能', NULL, '【楽天】レビュー投稿→レビュー投稿完了→プレゼント発送', 'メイクブラシ1本', 'レビュー投稿→レビュー投稿完了→プレゼント発送。プレゼント対象商品: メイクブラシ1本', true);
  END IF;

  -- シリコンマット
  INSERT INTO products (product_name, dropbox_url, rakuten_url, return_shipping_fee, warranty_days, is_active, sale_status)
  VALUES ('シリコンマット', NULL, NULL, NULL, NULL, true, 'active')
  ON CONFLICT DO NOTHING
  RETURNING id INTO pid;
  IF pid IS NOT NULL THEN
    INSERT INTO product_knowledge (product_id, synonyms, features, campaign_name, campaign_detail, present_item, present_summary, is_active)
    VALUES (pid, ARRAY['シリコンマット','ペット用シリコンマット','犬用シリコンマット','防滑シリコンマット','トイレシートマット','ペットマット'], NULL, NULL, NULL, '光る首輪', '光る首輪', true);
  END IF;

  -- 料理温度計
  INSERT INTO products (product_name, dropbox_url, rakuten_url, return_shipping_fee, warranty_days, is_active, sale_status)
  VALUES ('料理温度計', NULL, 'https://item.rakuten.co.jp/next-online/10000277/?variantId=10000277', NULL, 30, true, 'active')
  ON CONFLICT DO NOTHING
  RETURNING id INTO pid;
  IF pid IS NOT NULL THEN
    INSERT INTO product_knowledge (product_id, synonyms, features, campaign_name, campaign_detail, present_item, present_summary, is_active)
    VALUES (pid, ARRAY['料理温度計','キッチン用温度計','デジタル温度計','食品温度計','肉用温度計'], NULL, NULL, NULL, 'なし', 'プレゼント対象商品: なし', true);
  END IF;

  -- ペットカートクッション
  INSERT INTO products (product_name, dropbox_url, rakuten_url, return_shipping_fee, warranty_days, is_active, sale_status)
  VALUES ('ペットカートクッション', NULL, 'https://item.rakuten.co.jp/next-online/10000275/?variantId=10000275', NULL, 30, true, 'active')
  ON CONFLICT DO NOTHING
  RETURNING id INTO pid;
  IF pid IS NOT NULL THEN
    INSERT INTO product_knowledge (product_id, synonyms, features, campaign_name, campaign_detail, present_item, present_summary, is_active)
    VALUES (pid, ARRAY['ペットカートクッション','ペット用カートクッション','クッション付きペットカート','ペットカート用クッション'], NULL, NULL, NULL, '携帯折りたたみ皿', '携帯折りたたみ皿', true);
  END IF;

  -- ペットカートフック
  INSERT INTO products (product_name, dropbox_url, rakuten_url, return_shipping_fee, warranty_days, is_active, sale_status)
  VALUES ('ペットカートフック', NULL, 'https://item.rakuten.co.jp/next-online/10000275/?variantId=10000275', NULL, 30, true, 'active')
  ON CONFLICT DO NOTHING
  RETURNING id INTO pid;
  IF pid IS NOT NULL THEN
    INSERT INTO product_knowledge (product_id, synonyms, features, campaign_name, campaign_detail, present_item, present_summary, is_active)
    VALUES (pid, ARRAY['ペットカートフック','ペットカート用フック','フック付きペットカート','ペット用カートフック','カートフック'], NULL, NULL, NULL, 'フック用ピンチ黒, 光る首輪', 'フック用ピンチ黒, 光る首輪', true);
  END IF;

  -- 拡大鏡
  INSERT INTO products (product_name, dropbox_url, rakuten_url, return_shipping_fee, warranty_days, is_active, sale_status)
  VALUES ('拡大鏡', NULL, 'https://item.rakuten.co.jp/next-online/10000224/?variantId=10000224', 626, 30, true, 'active')
  ON CONFLICT DO NOTHING
  RETURNING id INTO pid;
  IF pid IS NOT NULL THEN
    INSERT INTO product_knowledge (product_id, synonyms, features, campaign_name, campaign_detail, present_item, present_summary, is_active)
    VALUES (pid, ARRAY['拡大鏡','美容用拡大鏡','化粧用拡大鏡','スキンケア拡大鏡','ライト付き拡大鏡'], NULL, NULL, NULL, '卓上ミラーＳサイズ', '卓上ミラーＳサイズ', true);
  END IF;

  -- 給餌器
  INSERT INTO products (product_name, dropbox_url, rakuten_url, return_shipping_fee, warranty_days, is_active, sale_status)
  VALUES ('給餌器', NULL, 'https://item.rakuten.co.jp/next-online/10000271/', 707, 365, true, 'active')
  ON CONFLICT DO NOTHING
  RETURNING id INTO pid;
  IF pid IS NOT NULL THEN
    INSERT INTO product_knowledge (product_id, synonyms, features, campaign_name, campaign_detail, present_item, present_summary, is_active)
    VALUES (pid, ARRAY['給餌器','自動給餌器','ペット用給餌器','電子給餌器','フードディスペンサー','給餌機'], NULL, NULL, NULL, '光る首輪, 肉球ポインター', '光る首輪, 肉球ポインター', true);
  END IF;

  -- 犬のベッド
  INSERT INTO products (product_name, dropbox_url, rakuten_url, return_shipping_fee, warranty_days, is_active, sale_status)
  VALUES ('犬のベッド', NULL, 'https://item.rakuten.co.jp/next-online/10000267/', 803, 30, true, 'active')
  ON CONFLICT DO NOTHING
  RETURNING id INTO pid;
  IF pid IS NOT NULL THEN
    INSERT INTO product_knowledge (product_id, synonyms, features, campaign_name, campaign_detail, present_item, present_summary, is_active)
    VALUES (pid, ARRAY['犬のベッド','ペット用ベッド','犬用クッション','洗える犬のベッド','耐久性のある犬のベッド'], NULL, NULL, NULL, '光る首輪', '光る首輪', true);
  END IF;

  -- ペットカート
  INSERT INTO products (product_name, dropbox_url, rakuten_url, return_shipping_fee, warranty_days, is_active, sale_status)
  VALUES ('ペットカート', NULL, 'https://item.rakuten.co.jp/next-online/10000270/', 1210, 30, true, 'active')
  ON CONFLICT DO NOTHING
  RETURNING id INTO pid;
  IF pid IS NOT NULL THEN
    INSERT INTO product_knowledge (product_id, synonyms, features, campaign_name, campaign_detail, present_item, present_summary, is_active)
    VALUES (pid, ARRAY['ペットカート','ペットキャリー','ペット用カート','キャリーカート'], NULL, NULL, NULL, '光る首輪', '光る首輪', true);
  END IF;

  -- 犬のドライブボックス
  INSERT INTO products (product_name, dropbox_url, rakuten_url, return_shipping_fee, warranty_days, is_active, sale_status)
  VALUES ('犬のドライブボックス', NULL, 'https://item.rakuten.co.jp/next-online/10000268/', 803, 30, true, 'active')
  ON CONFLICT DO NOTHING
  RETURNING id INTO pid;
  IF pid IS NOT NULL THEN
    INSERT INTO product_knowledge (product_id, synonyms, features, campaign_name, campaign_detail, present_item, present_summary, is_active)
    VALUES (pid, ARRAY['犬のドライブボックス','ペット用カーシート','サポートボックス','キャリーバッグ','車用ペットシート'], NULL, NULL, NULL, '光る首輪', '光る首輪', true);
  END IF;

  -- ペットシーツ
  INSERT INTO products (product_name, dropbox_url, rakuten_url, return_shipping_fee, warranty_days, is_active, sale_status)
  VALUES ('ペットシーツ', NULL, 'https://item.rakuten.co.jp/next-online/10000274/', 626, 30, true, 'active')
  ON CONFLICT DO NOTHING
  RETURNING id INTO pid;
  IF pid IS NOT NULL THEN
    INSERT INTO product_knowledge (product_id, synonyms, features, campaign_name, campaign_detail, present_item, present_summary, is_active)
    VALUES (pid, ARRAY['ペットシーツ','犬用トイレシーツ','吸収シート','ペット用マット','おしっこガード'], NULL, NULL, NULL, '光る首輪', '光る首輪', true);
  END IF;

  -- 光る首輪
  INSERT INTO products (product_name, dropbox_url, rakuten_url, return_shipping_fee, warranty_days, is_active, sale_status)
  VALUES ('光る首輪', NULL, 'https://item.rakuten.co.jp/next-online/10000228/', 371, 30, true, 'active')
  ON CONFLICT DO NOTHING
  RETURNING id INTO pid;
  IF pid IS NOT NULL THEN
    INSERT INTO product_knowledge (product_id, synonyms, features, campaign_name, campaign_detail, present_item, present_summary, is_active)
    VALUES (pid, ARRAY['光る首輪','光る犬用首輪','LED首輪','サボテン型光る首輪','ペット用光る首輪'], NULL, NULL, NULL, 'なし', NULL, true);
  END IF;

  -- メイクボックス
  INSERT INTO products (product_name, dropbox_url, rakuten_url, return_shipping_fee, warranty_days, is_active, sale_status)
  VALUES ('メイクボックス', NULL, 'https://item.rakuten.co.jp/next-online/10000221/', 707, NULL, true, 'active')
  ON CONFLICT DO NOTHING
  RETURNING id INTO pid;
  IF pid IS NOT NULL THEN
    INSERT INTO product_knowledge (product_id, synonyms, features, campaign_name, campaign_detail, present_item, present_summary, is_active)
    VALUES (pid, ARRAY['メイクボックス','メイクアップボックス','化粧ボックス','ビューティーボックス','ミラーボックス'], NULL, NULL, NULL, '卓上ミラーＳサイズ', '卓上ミラーＳサイズ', true);
  END IF;

  -- 拡大鏡
  INSERT INTO products (product_name, dropbox_url, rakuten_url, return_shipping_fee, warranty_days, is_active, sale_status)
  VALUES ('拡大鏡', NULL, 'https://item.rakuten.co.jp/next-online/10000224/', 626, 30, true, 'active')
  ON CONFLICT DO NOTHING
  RETURNING id INTO pid;
  IF pid IS NOT NULL THEN
    INSERT INTO product_knowledge (product_id, synonyms, features, campaign_name, campaign_detail, present_item, present_summary, is_active)
    VALUES (pid, ARRAY[]::text[], NULL, NULL, NULL, '卓上ミラーＳサイズ', '卓上ミラーＳサイズ', true);
  END IF;

  -- ドライブシート
  INSERT INTO products (product_name, dropbox_url, rakuten_url, return_shipping_fee, warranty_days, is_active, sale_status)
  VALUES ('ドライブシート', NULL, NULL, NULL, NULL, true, 'active')
  ON CONFLICT DO NOTHING
  RETURNING id INTO pid;
  IF pid IS NOT NULL THEN
    INSERT INTO product_knowledge (product_id, synonyms, features, campaign_name, campaign_detail, present_item, present_summary, is_active)
    VALUES (pid, ARRAY[]::text[], NULL, NULL, NULL, '光る首輪(2024/02/27より開始)', '光る首輪（2024/02/27より開始）', true);
  END IF;

END $$;
