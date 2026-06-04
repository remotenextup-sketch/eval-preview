export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token  = process.env.CHATWORK_API_TOKEN;
  const roomId = process.env.CHATWORK_ROOM_ID;

  if (!token || !roomId) {
    return res.status(200).json({ skipped: true, reason: 'env not configured' });
  }

  const { title, resolvedBy, comment } = req.body ?? {};
  if (!title || !resolvedBy || !comment) {
    return res.status(400).json({ error: 'title, resolvedBy, comment are required' });
  }

  const message =
    `[info][title]✅ バグ・改善要望が解決されました[/title]\n` +
    `件名：${title}\n` +
    `解決者：${resolvedBy}\n` +
    `解決コメント：${comment}\n` +
    `[/info]`;

  try {
    const response = await fetch(
      `https://api.chatwork.com/v2/rooms/${roomId}/messages`,
      {
        method: 'POST',
        headers: {
          'X-ChatWorkToken': token,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `body=${encodeURIComponent(message)}`,
      }
    );

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error('[notify-chatwork] Chatwork API error:', data);
    }
    return res.status(200).json({ ok: response.ok, data });
  } catch (err) {
    console.error('[notify-chatwork] fetch error:', err);
    return res.status(200).json({ ok: false, error: err.message });
  }
}
