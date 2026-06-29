const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPO = process.env.GITHUB_REPO;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const AUTO_FIX_WEBHOOK_SECRET = process.env.AUTO_FIX_WEBHOOK_SECRET;
const CHATWORK_API_TOKEN = process.env.CHATWORK_API_TOKEN;
const CHATWORK_ROOM_ID = process.env.CHATWORK_ROOM_ID;

// Complete list of files Claude can choose from in Step 1
const AVAILABLE_FILES = [
  'src/App.jsx',
  'src/constants.js',
  'src/EvaluationProgress.jsx',
  'src/Sticky.jsx',
  'src/components/AdminView.jsx',
  'src/components/BugBoardModal.jsx',
  'src/components/Header.jsx',
  'src/components/ItemQuestions.jsx',
  'src/components/MemberView.jsx',
  'src/components/OverallView.jsx',
  'src/components/PersonalView.jsx',
  'src/components/SalaryView.jsx',
  'src/components/SettingsModal.jsx',
  'src/components/SurveyModal.jsx',
  'src/components/SurveyView.jsx',
];

async function notifyChatwork(message) {
  if (!CHATWORK_API_TOKEN || !CHATWORK_ROOM_ID) return;
  try {
    await fetch(`https://api.chatwork.com/v2/rooms/${CHATWORK_ROOM_ID}/messages`, {
      method: 'POST',
      headers: {
        'X-ChatWorkToken': CHATWORK_API_TOKEN,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `body=${encodeURIComponent(message)}`,
    });
  } catch (err) {
    console.error('[auto-fix] Chatwork error:', err.message);
  }
}

async function fetchSpecificFiles(paths) {
  if (!GITHUB_TOKEN || !GITHUB_REPO) throw new Error('GITHUB_TOKEN or GITHUB_REPO not configured');
  const [owner, repo] = GITHUB_REPO.split('/');

  const results = await Promise.all(
    paths.map(async (path) => {
      try {
        const res = await fetch(
          `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
          { headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, Accept: 'application/vnd.github.v3+json' } }
        );
        if (!res.ok) return null;
        const data = await res.json();
        return {
          path,
          sha: data.sha,
          content: Buffer.from(data.content, 'base64').toString('utf-8'),
        };
      } catch {
        return null;
      }
    })
  );

  return results.filter(Boolean);
}

function callClaude(prompt) {
  if (!ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY not configured');
  return fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
}

function parseClaudeJson(text) {
  const jsonStr = text.trim().replace(/^```(?:json)?\s*/m, '').replace(/\s*```$/m, '').trim();
  return JSON.parse(jsonStr);
}

// Step 1: Classify the report and identify which files need to change (no code sent)
async function classifyReport(report) {
  const fileList = AVAILABLE_FILES.join('\n');

  const prompt = `あなたはReactアプリケーションの自動修正エンジニアです。
バグ報告・改善要望を読んで、分類と修正対象ファイルをJSONで返してください。

## バグ報告・改善要望
タイトル：${report.title}
投稿者：${report.user_name}
種類：${report.tag ?? '未分類'}
優先度：${report.priority ?? '中'}
説明：${report.description}

## 修正可能なファイル一覧
${fileList}

## 分類基準
**ui**（自動対応：PR作成＋自動マージ）
- 文言・ラベルの変更
- 表示されない・見えない要素の修正
- 色・レイアウトの調整
- 入力方法・UIの変更

**db**（PR作成のみ：人間がレビュー後マージ）
- データの保存・取得ロジックの変更
- テーブル構造の変更
- 集計・計算ロジックの変更

**complex**（手動対応：コード修正なし）
- 認証・権限周りの変更
- 複数機能にまたがる大きな変更
- 要望内容が曖昧で判断できない

## 回答形式（JSONのみ・コードブロック不要）
{
  "category": "ui" | "db" | "complex",
  "files": ["src/components/BugBoardModal.jsx"]
}

注意：
- filesは上記ファイル一覧から最大3つ選ぶ（パスを正確に記載）
- categoryがcomplexの場合、filesは []
- JSONのみ返し、前後に説明文を入れない`;

  const res = await callClaude(prompt);
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Claude API error ${res.status}: ${err}`);
  }
  const data = await res.json();
  return parseClaudeJson(data.content[0].text);
}

// Step 2: Generate fix using only the identified files
async function generateFix(report, sourceFiles) {
  const filesText = sourceFiles
    .map(f => `### ${f.path}\n\`\`\`\n${f.content}\n\`\`\``)
    .join('\n\n');

  const prompt = `あなたはReactアプリケーションの自動修正エンジニアです。
バグ報告・改善要望に基づき、修正内容をJSON形式で返してください。

## バグ報告・改善要望
タイトル：${report.title}
投稿者：${report.user_name}
種類：${report.tag ?? '未分類'}
優先度：${report.priority ?? '中'}
説明：${report.description}

## 修正対象ファイル
${filesText}

## 回答形式（JSONのみ・コードブロック不要）
{
  "summary": "修正内容の1〜2行の要約（日本語）",
  "changes": [
    {
      "path": "変更するファイルのパス",
      "content": "変更後のファイル全体の内容（差分ではなく完全なファイル）"
    }
  ]
}

注意：
- contentは変更後のファイル全体を含める
- 確実に修正できる場合のみchangesを含め、不確かな場合はchangesを []
- JSONのみ返し、前後に説明文を入れない`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 16000,
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

async function createGitHubPR(changes, report, sourceFiles) {
  const [owner, repo] = GITHUB_REPO.split('/');
  const branchName = `auto-fix/${Date.now()}`;

  // Get main branch SHA
  const refRes = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/git/ref/heads/main`,
    { headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, Accept: 'application/vnd.github.v3+json' } }
  );
  if (!refRes.ok) throw new Error(`get main ref failed: ${refRes.status}`);
  const { object: { sha: mainSha } } = await refRes.json();

  // Create feature branch
  const branchRes = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/git/refs`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        'Content-Type': 'application/json',
        Accept: 'application/vnd.github.v3+json',
      },
      body: JSON.stringify({ ref: `refs/heads/${branchName}`, sha: mainSha }),
    }
  );
  if (!branchRes.ok) throw new Error(`create branch failed: ${branchRes.status}`);

  // Commit each changed file sequentially (each PUT needs the current file's SHA)
  for (const change of changes) {
    const existing = sourceFiles.find(f => f.path === change.path);
    const putRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${change.path}`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${GITHUB_TOKEN}`,
          'Content-Type': 'application/json',
          Accept: 'application/vnd.github.v3+json',
        },
        body: JSON.stringify({
          message: `fix: ${report.title}`,
          content: Buffer.from(change.content).toString('base64'),
          branch: branchName,
          ...(existing ? { sha: existing.sha } : {}),
        }),
      }
    );
    if (!putRes.ok) {
      const errText = await putRes.text();
      throw new Error(`commit ${change.path} failed: ${putRes.status} ${errText}`);
    }
  }

  // Open PR
  const prRes = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/pulls`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        'Content-Type': 'application/json',
        Accept: 'application/vnd.github.v3+json',
      },
      body: JSON.stringify({
        title: `fix: ${report.title}`,
        head: branchName,
        base: 'main',
        body: `## 自動修正PR\n\n**要望タイトル：** ${report.title}\n**投稿者：** ${report.user_name}\n**内容：** ${report.description}\n\n---\n*このPRは自動生成されました*`,
      }),
    }
  );
  if (!prRes.ok) {
    const errText = await prRes.text();
    throw new Error(`create PR failed: ${prRes.status} ${errText}`);
  }
  return prRes.json();
}

async function mergeGitHubPR(prNumber) {
  const [owner, repo] = GITHUB_REPO.split('/');
  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}/merge`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        'Content-Type': 'application/json',
        Accept: 'application/vnd.github.v3+json',
      },
      body: JSON.stringify({ merge_method: 'squash' }),
    }
  );
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`merge PR #${prNumber} failed: ${res.status} ${errText}`);
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  // Verify webhook secret
  if (AUTO_FIX_WEBHOOK_SECRET) {
    const auth = req.headers['authorization'];
    if (auth !== `Bearer ${AUTO_FIX_WEBHOOK_SECRET}`) return res.status(401).end();
  }

  const payload = req.body ?? {};

  if (payload.type !== 'INSERT') return res.status(200).end();

  const report = payload.record;
  if (!report?.title || !report?.description) return res.status(400).end();

  // Return 200 immediately so Supabase doesn't retry on timeout
  res.status(200).end();

  // Process in background — runs after the response is flushed
  (async () => {
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

      // Validate paths to prevent hallucinated files outside the known list
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

      // Create PR
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
  })();
}
