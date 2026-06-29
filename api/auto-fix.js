export const config = { runtime: 'edge' };

import {
  AVAILABLE_FILES,
  notifyChatwork,
  fetchSpecificFiles,
  classifyReport,
  generateFix,
  createGitHubPR,
  mergeGitHubPR,
} from './_shared.js';

const AUTO_FIX_WEBHOOK_SECRET = process.env.AUTO_FIX_WEBHOOK_SECRET;

export default async function handler(request, context) {
  if (request.method !== 'POST') return new Response(null, { status: 405 });

  // Verify webhook secret
  if (AUTO_FIX_WEBHOOK_SECRET) {
    const auth = request.headers.get('authorization');
    if (auth !== `Bearer ${AUTO_FIX_WEBHOOK_SECRET}`) return new Response(null, { status: 401 });
  }

  const payload = await request.json().catch(() => ({}));

  if (payload.type !== 'INSERT') return new Response(null, { status: 200 });

  const report = payload.record;
  if (!report?.title || !report?.description) return new Response(null, { status: 400 });

  // waitUntil keeps the Edge function alive until the promise resolves
  context.waitUntil((async () => {
    console.log(`[auto-fix] report="${report.title}" id=${report.id}`);
    try {
      // ── Step 1: classify and identify relevant files (lightweight, no code) ──
      const { category, files } = await classifyReport(report);
      console.log(`[auto-fix] step1 category=${category} files=${files?.join(',')}`);

      if (category === 'complex') {
        await notifyChatwork(
          `[info][title]⚠️ 手動対応が必要な要望が届きました[/title]\n` +
          `件名：${report.title}\n` +
          `投稿者：${report.user_name}\n` +
          `内容：${report.description}\n` +
          `[/info]`
        );
        return;
      }

      if (!files?.length) {
        await notifyChatwork(
          `[info][title]⚠️ 修正対象ファイルが特定できませんでした[/title]\n` +
          `件名：${report.title}\n` +
          `手動での確認をお願いします。\n` +
          `[/info]`
        );
        return;
      }

      const validFiles = files.filter(f => AVAILABLE_FILES.includes(f));

      // ── Step 2: fetch only the identified files, then generate fix ────────────
      const sourceFiles = await fetchSpecificFiles(validFiles);
      console.log(`[auto-fix] step2 fetched ${sourceFiles.length}/${validFiles.length} files`);

      const { summary, changes } = await generateFix(report, sourceFiles);
      console.log(`[auto-fix] changes=${changes?.length ?? 0}`);

      if (!changes?.length) {
        await notifyChatwork(
          `[info][title]⚠️ 自動修正案が生成できませんでした[/title]\n` +
          `件名：${report.title}\n` +
          `内容：${report.description}\n` +
          `手動での確認をお願いします。\n` +
          `[/info]`
        );
        return;
      }

      const pr = await createGitHubPR(changes, report, sourceFiles);
      console.log(`[auto-fix] PR #${pr.number} created: ${pr.html_url}`);

      // ── ui: auto-merge ──────────────────────────────────────────────────────
      if (category === 'ui') {
        await mergeGitHubPR(pr.number);
        console.log(`[auto-fix] PR #${pr.number} auto-merged`);
        await notifyChatwork(
          `[info][title]✅ 自動修正が完了しました[/title]\n` +
          `要望：${report.title}\n` +
          `修正内容：${summary}\n` +
          `PR：${pr.html_url}\n` +
          `[/info]`
        );
        return;
      }

      // ── db: PR only ─────────────────────────────────────────────────────────
      await notifyChatwork(
        `[info][title]🔧 PRが作成されました。確認をお願いします[/title]\n` +
        `要望：${report.title}\n` +
        `修正内容：${summary}\n` +
        `PR URL：${pr.html_url}\n` +
        `[/info]`
      );
    } catch (err) {
      console.error('[auto-fix] background error:', err);
      await notifyChatwork(
        `[info][title]❌ 自動修正に失敗しました[/title]\n` +
        `要望：${report.title}\n` +
        `エラー：${err.message}\n` +
        `[/info]`
      );
    }
  })());

  return new Response('ok', { status: 200 });
}
