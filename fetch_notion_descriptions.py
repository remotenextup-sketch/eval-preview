#!/usr/bin/env python3
"""
Notion APIから評価項目のページ本文（blocks）を取得し、
Supabaseのevaluation_itemsテーブルのdescriptionに反映するスクリプト。
descriptionが空のレコードのみ更新する。
"""

import os
import sys
import time
import requests

NOTION_TOKEN = os.environ.get("NOTION_TOKEN", "")
NOTION_DATABASE_ID = os.environ.get("NOTION_DATABASE_ID", "2949340132c3802787feda11ff95377d")
NOTION_VERSION = "2022-06-28"

SUPABASE_URL = "https://dlkmrtqvroxkizpetpos.supabase.co"
SUPABASE_KEY = (
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9"
    ".eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRsa21ydHF2cm94a2l6cGV0cG9zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgyMDMyODEsImV4cCI6MjA5Mzc3OTI4MX0"
    ".0gci1duCUXa1md7PfFa7_ERTUtDPWMQ7cWgXLQo45qk"
)

NOTION_HEADERS = {
    "Authorization": f"Bearer {NOTION_TOKEN}",
    "Notion-Version": NOTION_VERSION,
    "Content-Type": "application/json",
}
SUPABASE_HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=minimal",
}


# ─── Notion helper ────────────────────────────────────────────────

def rich_text_to_md(blocks):
    """Notion rich text array → Markdown 文字列（リンクは [text](url) 形式）"""
    parts = []
    for b in blocks:
        text = b.get("plain_text", "")
        if not text:
            continue
        href = b.get("href")
        ann = b.get("annotations", {})
        if href:
            text = f"[{text}]({href})"
        elif ann.get("bold"):
            text = f"**{text}**"
        elif ann.get("italic"):
            text = f"*{text}*"
        elif ann.get("code"):
            text = f"`{text}`"
        parts.append(text)
    return "".join(parts)


BLOCK_TO_MD = {
    "paragraph":            lambda t: t,
    "heading_1":            lambda t: f"# {t}",
    "heading_2":            lambda t: f"## {t}",
    "heading_3":            lambda t: f"### {t}",
    "bulleted_list_item":   lambda t: f"- {t}",
    "numbered_list_item":   lambda t: f"1. {t}",
    "quote":                lambda t: f"> {t}",
    "code":                 lambda t: f"`{t}`",
    "callout":              lambda t: t,
}


def blocks_to_md(blocks):
    """ブロック配列 → Markdown 文字列"""
    lines = []
    for b in blocks:
        btype = b.get("type", "")
        if btype not in BLOCK_TO_MD:
            continue
        rt = b.get(btype, {}).get("rich_text", [])
        text = rich_text_to_md(rt).strip()
        if not text:
            continue
        lines.append(BLOCK_TO_MD[btype](text))
    return "\n".join(lines).strip()


def fetch_page_blocks(page_id):
    """ページのブロック（本文）を取得"""
    results = []
    cursor = None
    while True:
        params = {"page_size": 100}
        if cursor:
            params["start_cursor"] = cursor
        res = requests.get(
            f"https://api.notion.com/v1/blocks/{page_id}/children",
            headers=NOTION_HEADERS,
            params=params,
        )
        if res.status_code == 429:
            retry = int(res.headers.get("Retry-After", 2))
            time.sleep(retry)
            continue
        if res.status_code != 200:
            return []
        data = res.json()
        results.extend(data.get("results", []))
        if data.get("has_more") and data.get("next_cursor"):
            cursor = data["next_cursor"]
        else:
            break
    return results


def fetch_notion_pages():
    """Notionデータベースの全ページを取得（ページネーション対応）"""
    pages = []
    cursor = None
    while True:
        body = {"page_size": 100}
        if cursor:
            body["start_cursor"] = cursor
        res = requests.post(
            f"https://api.notion.com/v1/databases/{NOTION_DATABASE_ID}/query",
            headers=NOTION_HEADERS, json=body,
        )
        if res.status_code == 429:
            retry = int(res.headers.get("Retry-After", 2))
            time.sleep(retry)
            continue
        if res.status_code != 200:
            print(f"❌ Notion API エラー (status={res.status_code}): {res.text[:400]}")
            sys.exit(1)
        data = res.json()
        pages.extend(data.get("results", []))
        if data.get("has_more") and data.get("next_cursor"):
            cursor = data["next_cursor"]
        else:
            break
    return pages


def extract_page_meta(page):
    """タイトル・ランクを抽出"""
    props = page.get("properties", {})
    title_blocks = props.get("人事評価項目", {}).get("title", [])
    item_name = "".join(b.get("plain_text", "") for b in title_blocks).strip()
    rank_sel = props.get("ランク", {}).get("select")
    rank = rank_sel.get("name", "").strip() if rank_sel else None
    return item_name, rank


# ─── Supabase helper ──────────────────────────────────────────────

def update_description(item_name, rank, description):
    """descriptionが空のレコードのみUPDATE。更新件数を返す。"""
    if not description:
        return 0

    res = requests.get(
        f"{SUPABASE_URL}/rest/v1/evaluation_items",
        headers={**SUPABASE_HEADERS, "Prefer": "count=exact"},
        params={
            "item_name": f"eq.{item_name}",
            "rank": f"eq.{rank}",
            "or": "(description.is.null,description.eq.)",
            "select": "id",
        },
    )
    if res.status_code not in (200, 206):
        return 0

    records = res.json()
    if not records:
        return 0

    ids = ",".join(r["id"] for r in records)
    patch = requests.patch(
        f"{SUPABASE_URL}/rest/v1/evaluation_items",
        headers=SUPABASE_HEADERS,
        params={"id": f"in.({ids})"},
        json={"description": description},
    )
    if patch.status_code not in (200, 204):
        print(f"  ❌ UPDATE失敗 [{item_name[:30]}]: {patch.text[:100]}")
        return 0
    return len(records)


def verify():
    res = requests.get(
        f"{SUPABASE_URL}/rest/v1/evaluation_items",
        headers={**SUPABASE_HEADERS, "Prefer": "count=exact"},
        params={"description": "not.is.null", "select": "id"},
    )
    count = res.headers.get("content-range", "?/?").split("/")[-1]
    print(f"  description 設定済み: {count}件")


# ─── Main ─────────────────────────────────────────────────────────

def main():
    print("▶ Step 1: Notionから全ページを取得...")
    pages = fetch_notion_pages()
    print(f"  取得件数: {len(pages)}件")

    print("▶ Step 2: 各ページの本文を取得してSupabaseに反映...")
    updated = skipped_no_content = skipped_no_match = 0

    for i, page in enumerate(pages):
        item_name, rank = extract_page_meta(page)
        if not item_name or not rank:
            continue

        # Notion rate limit 対策
        if i > 0 and i % 50 == 0:
            print(f"  ... {i}/{len(pages)}件処理済み")
            time.sleep(1)

        blocks = fetch_page_blocks(page["id"])
        description = blocks_to_md(blocks)

        if not description:
            skipped_no_content += 1
            continue

        count = update_description(item_name, rank, description)
        if count == 0:
            skipped_no_match += 1
        else:
            updated += count

        time.sleep(0.12)  # Notion API rate limit

    print(f"\n▶ Step 3: 件数確認...")
    verify()

    print(f"\n✅ 完了")
    print(f"  更新:                   {updated}件")
    print(f"  本文なし(スキップ):      {skipped_no_content}件")
    print(f"  DB一致なし(スキップ):   {skipped_no_match}件")


if __name__ == "__main__":
    main()
