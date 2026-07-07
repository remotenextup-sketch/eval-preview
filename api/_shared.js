// Shared utilities for Edge Functions — no Node.js built-ins allowed

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPO = process.env.GITHUB_REPO;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const CHATWORK_API_TOKEN = process.env.CHATWORK_API_TOKEN;
const CHATWORK_ROOM_ID = process.env.CHATWORK_ROOM_ID;

export const AVAILABLE_FILES = [
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
  'src/components/SalaryView.jsx',
  'src/components/SettingsModal.jsx',
  'src/components/SurveyModal.jsx',
  'src/components/SurveyView.jsx',
];

// Edge Runtime has no Buffer — use Web APIs for base64
export function base64Decode(str) {
  return atob(str.replace(/\n/g, ''));
}

export function base64Encode(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export async function notifyChatwork(message) {
  if (!CHATWORK_API_TOKEN || !CHATWORK_ROOM_ID) {
    console.warn('[shared] Chatwork env vars not set, skipping notification');
    return;
  }
  try {
    const res = await fetch(`https://api.chatwork.com/v2/rooms/${CHATWORK_ROOM_ID}/messages`, {
      method: 'POST',
      headers: {
        'X-ChatWorkToken': CHATWORK_API_TOKEN,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `body=${encodeURIComponent(message)}`,
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.error(`[shared] Chatwork API error ${res.status}: ${errText}`);
    } else {
      console.log('[shared] Chatwork notification sent');
    }
  } catch (err) {
    console.error('[shared] Chatwork error:', err.message);
  }
}

export async function fetchSpecificFiles(paths) {
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
        return { path, sha: data.sha, content: base64Decode(data.content) };
      } catch {
        return null;
      }
    })
  );

  return results.filter(Boolean);
}

export function parseClaudeJson(text) {
  try {
    const jsonStr = text.trim().replace(/^```(?:json)?\s*/m, '').replace(/\s*```$/m, '').trim();
    return JSON.parse(jsonStr);
  } catch (e) {
    console.error('[shared] JSON parse failed. raw text:', text);
    throw new Error(`JSON parse failed: ${e.message}`);
  }
}

async function callClaudeRaw(prompt, maxTokens) {
  if (!ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY not configured');
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Claude API error ${res.status}: ${err}`);
  }
  const data = await res.json();
  return data.content[0].text;
}

// Step 1: Classify report and identify which files need changing (no code context)
export async function classifyReport(report) {
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
- PersonalView（src/components/PersonalView.jsx）に関する変更（行数が多すぎるため自動修正対象外）

## 回答形式（JSONのみ・コードブロック不要）
{
  "category": "ui" | "db" | "complex",
  "files": ["src/components/BugBoardModal.jsx"]
}

注意：
- filesは上記ファイル一覧から最大3つ選ぶ（パスを正確に記載）
- categoryがcomplexの場合、filesは []
- JSONのみ返し、前後に説明文を入れない`;

  try {
    const text = await callClaudeRaw(prompt, 1024);
    return parseClaudeJson(text);
  } catch {
    return { category: 'complex', files: [] };
  }
}

// Step 2: Generate fix using only the identified files
export async function generateFix(report, sourceFiles) {
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

  try {
    const text = await callClaudeRaw(prompt, 16000);
    return parseClaudeJson(text);
  } catch {
    return { summary: '', changes: [] };
  }
}

export async function createGitHubPR(changes, report, sourceFiles) {
  if (!GITHUB_TOKEN || !GITHUB_REPO) throw new Error('GITHUB_TOKEN or GITHUB_REPO not configured');
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
      headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, 'Content-Type': 'application/json', Accept: 'application/vnd.github.v3+json' },
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
        headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, 'Content-Type': 'application/json', Accept: 'application/vnd.github.v3+json' },
        body: JSON.stringify({
          message: `fix: ${report.title}`,
          content: base64Encode(change.content),
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
      headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, 'Content-Type': 'application/json', Accept: 'application/vnd.github.v3+json' },
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

export async function mergeGitHubPR(prNumber) {
  if (!GITHUB_TOKEN || !GITHUB_REPO) throw new Error('GITHUB_TOKEN or GITHUB_REPO not configured');
  const [owner, repo] = GITHUB_REPO.split('/');
  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}/merge`,
    {
      method: 'PUT',
      headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, 'Content-Type': 'application/json', Accept: 'application/vnd.github.v3+json' },
      body: JSON.stringify({ merge_method: 'squash' }),
    }
  );
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`merge PR #${prNumber} failed: ${res.status} ${errText}`);
  }
}
