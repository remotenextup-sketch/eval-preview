export const config = { runtime: 'edge' };

import {
  AVAILABLE_FILES,
  notifyChatwork,
  fetchSpecificFiles,
  parseClaudeJson,
  classifyReport,
  generateFix,
  createGitHubPR,
  mergeGitHubPR,
} from './_shared.js';

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

// Analyze all open bugs at once and return priority + approach + plan per bug
async function bulkAnalyze(bugs) {
  if (!ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY not configured');

  const bugList = bugs
    .slice(0, 30)
    .map((b, i) =>
      `${i + 1}. [ID:${b.id}]\n` +
      `   タイトル：${b.title}\n` +
      `   投稿者：${b.user_name ?? '不明'}\n` +
      `   種類：${b.tag ?? '未分類'}　優先度：${b.priority ?? '中'}\n` +
      `   内容：${(b.description ?? '').slice(0, 200)}`
    )
    .join('\n\n');

  const prompt = `あなたはバグ・改善要望管理システムのAIアドバイザーです。
以下の未解決案件を分析し、各案件への対応案をJSONで返してください。

## 未解決案件一覧
${bugList}

## 回答形式（JSONのみ・コードブロック不要）
{
  "reports": [
    {
      "id": "案件のID（上記 ID: の値をそのまま）",
      "title": "タイトル",
      "priority": "high" | "medium" | "low",
      "approach": "auto_fix" | "manual" | "needs_info",
      "plan": "具体的な対応案（1〜2文、日本語）"
    }
  ]
}

## 分類基準
priority:
- high：バグで業務影響がある、または高優先度タグ
- medium：改善要望・中優先度
- low：質問・連絡・低優先度または軽微な改善

approach:
- auto_fix：UIの文言・表示・色・レイアウトの変更（コード自動修正可能）
- manual：ロジック・DB・認証周りの変更（人間がレビュー必要）
- needs_info：内容が曖昧で追加情報が必要

JSONのみ返し、前後に説明文を入れない`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Claude API error ${res.status}: ${err}`);
  }
  const data = await res.json();
  return parseClaudeJson(data.content[0].text);
}

function buildChatworkReport(reports) {
  const byPriority = { high: [], medium: [], low: [] };
  for (const r of reports) {
    (byPriority[r.priority] ?? byPriority.medium).push(r);
  }

  const section = (label, items) => {
    if (!items.length) return '';
    const lines = items.map(r => `・${r.title}：${r.plan}`).join('\n');
    return `■ ${label}\n${lines}\n`;
  };

  return (
    `[info][title]🤖 未対応案件 AI分析レポート[/title]\n` +
    section('高優先度', byPriority.high) +
    section('中優先度', byPriority.medium) +
    section('低優先度', byPriority.low) +
    `[/info]`
  );
}

async function runAutoFix(bug) {
  console.log(`[bulk-consult] auto-fix start: "${bug.title}"`);
  try {
    const { category, files } = await classifyReport(bug);
    if (category === 'complex' || !files?.length) return;

    const validFiles = files.filter(f => AVAILABLE_FILES.includes(f));
    const sourceFiles = await fetchSpecificFiles(validFiles);
    const { summary, changes } = await generateFix(bug, sourceFiles);
    if (!changes?.length) return;

    const pr = await createGitHubPR(changes, bug, sourceFiles);
    console.log(`[bulk-consult] PR #${pr.number} created: ${pr.html_url}`);

    if (category === 'ui') {
      await mergeGitHubPR(pr.number);
      console.log(`[bulk-consult] PR #${pr.number} auto-merged`);
      await notifyChatwork(
        `[info][title]✅ 自動修正が完了しました[/title]\n` +
        `要望：${bug.title}\n` +
        `修正内容：${summary}\n` +
        `PR：${pr.html_url}\n` +
        `[/info]`
      );
    } else {
      await notifyChatwork(
        `[info][title]🔧 PRが作成されました。確認をお願いします[/title]\n` +
        `要望：${bug.title}\n` +
        `修正内容：${summary}\n` +
        `PR URL：${pr.html_url}\n` +
        `[/info]`
      );
    }
  } catch (err) {
    console.error(`[bulk-consult] auto-fix failed for "${bug.title}":`, err.message);
    await notifyChatwork(
      `[info][title]❌ 自動修正に失敗しました[/title]\n` +
      `要望：${bug.title}\n` +
      `エラー：${err.message}\n` +
      `[/info]`
    );
  }
}

export default async function handler(request, context) {
  if (request.method !== 'POST') return new Response(null, { status: 405 });

  const body = await request.json().catch(() => ({}));
  const bugs = (body.bugs ?? []).filter(b => b.status === 'open');

  if (!bugs.length) {
    return new Response(JSON.stringify({ skipped: true, reason: 'no open bugs' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Return 200 immediately; analysis runs in the background
  context.waitUntil((async () => {
    console.log(`[bulk-consult] analyzing ${bugs.length} open bugs`);
    try {
      const { reports } = await bulkAnalyze(bugs);
      console.log(`[bulk-consult] got ${reports?.length ?? 0} report(s)`);

      // Send summary to Chatwork
      await notifyChatwork(buildChatworkReport(reports ?? []));

      // Trigger auto-fix sequentially for items Claude flagged as auto_fix
      const autoFixTargets = bugs.filter(b =>
        reports?.find(r => String(r.id) === String(b.id) && r.approach === 'auto_fix')
      );
      console.log(`[bulk-consult] auto-fix targets: ${autoFixTargets.length}`);
      for (const bug of autoFixTargets) {
        try {
          await runAutoFix(bug);
        } catch (err) {
          console.error(`[bulk-consult] unhandled error in runAutoFix for "${bug.title}":`, err.message);
        }
      }
    } catch (err) {
      console.error('[bulk-consult] background error:', err);
      await notifyChatwork(
        `[info][title]❌ 一括AI分析に失敗しました[/title]\n` +
        `エラー：${err.message}\n` +
        `[/info]`
      );
    }
  })());

  return new Response(JSON.stringify({ ok: true, count: bugs.length }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
