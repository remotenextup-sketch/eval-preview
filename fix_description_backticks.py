#!/usr/bin/env python3
"""
evaluation_items の description にある Notion code-block 変換ミスを修正する。
バッククォートで囲まれた説明文からバッククォートを除去する。
"""

import re
import requests

SUPABASE_URL = "https://dlkmrtqvroxkizpetpos.supabase.co"
SUPABASE_KEY = (
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9"
    ".eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRsa21ydHF2cm94a2l6cGV0cG9zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgyMDMyODEsImV4cCI6MjA5Mzc3OTI4MX0"
    ".0gci1duCUXa1md7PfFa7_ERTUtDPWMQ7cWgXLQo45qk"
)

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
}


def strip_backticks(text: str) -> str:
    if not text:
        return text

    # ケース1: description 全体が ` ... ` で囲まれている
    stripped = text.strip()
    if stripped.startswith('`') and stripped.endswith('`') and len(stripped) > 1:
        inner = stripped[1:-1]
        # 途中にバッククォートがない場合のみ除去（コードスパンではなくcode block）
        if '`' not in inner:
            return inner.strip()

    # ケース2: 先頭が ` で始まり末尾が ` で終わる（改行含む場合）
    if text.startswith('`'):
        last_bt = text.rstrip().rfind('`')
        if last_bt > 0:
            inner = text[1:last_bt]
            # 除去後も ` が残る場合はスキップ
            if '`' not in inner:
                return inner.strip()

    # ケース3: 本文中に `段落` 形式で埋め込まれた code block を平文に変換
    # 行頭バッククォートで始まり末尾バッククォートで終わるブロックを除去
    result = re.sub(r'(?m)^`(.+?)`$', r'\1', text, flags=re.DOTALL)
    if result != text:
        return result

    return text


def main():
    # バッククォートを含む description を取得
    res = requests.get(
        f"{SUPABASE_URL}/rest/v1/evaluation_items",
        headers={**HEADERS, "Prefer": "count=exact"},
        params={"description": "like.`%", "select": "id,no,rank,item_name,description"},
    )
    if res.status_code not in (200, 206):
        print(f"取得失敗: {res.status_code} {res.text[:200]}")
        return

    items = res.json()
    print(f"バッククォートで始まる description: {len(items)}件")

    fixed = 0
    for item in items:
        original = item["description"]
        cleaned = strip_backticks(original)
        if cleaned == original:
            print(f"  スキップ (変化なし): #{item['no']} {item['rank']} {item['item_name'][:30]}")
            continue

        patch = requests.patch(
            f"{SUPABASE_URL}/rest/v1/evaluation_items",
            headers={**HEADERS, "Prefer": "return=minimal"},
            params={"id": f"eq.{item['id']}"},
            json={"description": cleaned},
        )
        if patch.status_code in (200, 204):
            print(f"  ✅ 修正: #{item['no']} {item['rank']} {item['item_name'][:40]}")
            fixed += 1
        else:
            print(f"  ❌ 更新失敗: #{item['no']} {res.text[:100]}")

    print(f"\n✅ 完了: {fixed}/{len(items)}件修正")


if __name__ == "__main__":
    main()
