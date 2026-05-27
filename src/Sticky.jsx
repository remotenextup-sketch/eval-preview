import React, { useState, useEffect } from 'react';
import { supabase } from './components/supabaseClient';

export default function Sticky() {
  const [users, setUsers]               = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [items, setItems]               = useState([]);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState(null);
  const [debugInfo, setDebugInfo]       = useState('');

  // ユーザー一覧を入社順で取得し、前回のユーザーを復元
  useEffect(() => {
    supabase
      .from('users')
      .select('id, name, rank, progress_name, onboarding_at')
      .is('resigned_at', null)
      .order('onboarding_at', { ascending: true, nullsFirst: false })
      .then(({ data, error: err }) => {
        if (err) { console.error('[Sticky] users fetch error:', err); return; }
        if (!data) return;
        const valid = data.filter(u => u.name && u.name !== 'テンプレート');
        setUsers(valid);
        const savedId = localStorage.getItem('lastSelectedUserId');
        const restored = savedId ? valid.find(u => u.id === savedId) : null;
        setSelectedUser(restored ?? valid[0] ?? null);
      });
  }, []);

  // 選択ユーザーを保存
  useEffect(() => {
    if (selectedUser?.id) localStorage.setItem('lastSelectedUserId', selectedUser.id);
  }, [selectedUser?.id]);

  // 取り組み中項目を取得
  useEffect(() => {
    if (!selectedUser?.id) {
      setItems([]);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setItems([]);
    setError(null);
    setDebugInfo('');

    const pName = selectedUser.progress_name ?? selectedUser.name;
    console.log('[Sticky] fetch start — user:', selectedUser.name, '/ pName:', pName, '/ rank:', selectedUser.rank);

    (async () => {
      try {
        // ① evaluation_progress から in_progress 行を取得
        const { data: progress, error: progressErr } = await supabase
          .from('evaluation_progress')
          .select('id, item_no, rank')
          .eq('user_name', pName)
          .eq('status', 'in_progress')
          .order('item_no');

        console.log('[Sticky] progress rows:', progress?.length ?? 0,
          progressErr ? '/ ERROR: ' + progressErr.message : '');

        if (progressErr) throw progressErr;
        if (!progress?.length) {
          if (!cancelled) {
            setItems([]);
            setDebugInfo(`pName="${pName}" の取り組み中データなし`);
            setLoading(false);
          }
          return;
        }

        // ② progress の item_no 一覧で evaluation_items を取得
        //    rank でなく item_no で絞ることでrank不一致を回避
        const itemNos = [...new Set(progress.map(p => p.item_no))];
        console.log('[Sticky] item_nos to fetch:', itemNos);

        const { data: itemDefs, error: itemErr } = await supabase
          .from('evaluation_items')
          .select('no, item_name, rank')
          .in('no', itemNos);

        console.log('[Sticky] itemDefs rows:', itemDefs?.length ?? 0,
          itemErr ? '/ ERROR: ' + itemErr.message : '');

        if (itemErr) throw itemErr;

        // ③ rank+no の複合キーで優先マッチ、なければ no のみでフォールバック
        const byRankNo = {};
        const byNo     = {};
        for (const d of (itemDefs || [])) {
          byRankNo[`${d.no}_${d.rank}`] = d;
          if (!byNo[d.no]) byNo[d.no] = d; // 最初に見つかった定義を保持
        }

        const merged = progress
          .map(p => {
            const rank = p.rank || selectedUser.rank;
            const def  = byRankNo[`${p.item_no}_${rank}`] ?? byNo[p.item_no];
            if (!def) {
              console.warn('[Sticky] no itemDef for item_no:', p.item_no, 'rank:', rank);
              return null;
            }
            return { ...p, item_name: def.item_name, rank: rank || def.rank };
          })
          .filter(Boolean);

        console.log('[Sticky] merged items:', merged.length, merged.map(m => m.item_name));

        if (!cancelled) { setItems(merged); setLoading(false); }
      } catch (err) {
        console.error('[Sticky] fetch error:', err);
        if (!cancelled) { setError(err.message ?? 'エラーが発生しました'); setLoading(false); }
      }
    })();

    return () => { cancelled = true; };
  }, [selectedUser?.id]);

  const handleItemClick = (item) => {
    localStorage.setItem('stickySelectItem', JSON.stringify({
      userId: selectedUser.id,
      itemNo: item.item_no,
    }));
    if (window.opener && !window.opener.closed) {
      window.opener.focus();
    } else {
      window.open('/', '_blank');
    }
  };

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(135deg, #FFF9C4 0%, #FFF176 100%)' }}>
      {/* ヘッダー */}
      <div
        className="px-3 py-2.5 border-b border-yellow-300 flex items-center gap-2 sticky top-0"
        style={{ background: 'rgba(255, 249, 196, 0.95)', backdropFilter: 'blur(4px)' }}
      >
        <span className="text-base">📌</span>
        <select
          value={selectedUser?.id ?? ''}
          onChange={e => {
            const u = users.find(u => u.id === e.target.value);
            if (u) setSelectedUser(u);
          }}
          className="flex-1 text-xs border border-yellow-300 rounded px-2 py-1 bg-yellow-50 focus:outline-none focus:ring-1 focus:ring-yellow-400 min-w-0"
        >
          {users.length === 0 && <option value="">読み込み中...</option>}
          {users.map(u => (
            <option key={u.id} value={u.id}>{u.name}</option>
          ))}
        </select>
        <button
          onClick={() => window.close()}
          className="text-xs text-yellow-600 hover:text-yellow-800 px-1"
          title="閉じる"
        >
          ✕
        </button>
      </div>

      {/* 説明テキスト */}
      <p className="px-3 pt-2 pb-0 text-[10px] text-yellow-600 leading-relaxed">
        個人タブでステータスを「取り組み中」にした項目がここに表示されます
      </p>

      {/* 件数バッジ */}
      {!loading && !error && (
        <div className="px-3 py-1.5 flex items-center gap-1.5">
          <span className="text-xs font-semibold text-yellow-700">取り組み中</span>
          <span className="text-xs bg-yellow-400 text-yellow-900 font-bold px-1.5 py-0.5 rounded-full">
            {items.length}件
          </span>
        </div>
      )}

      {/* 項目リスト */}
      <div className="px-2 pb-4">
        {loading ? (
          <p className="text-xs text-yellow-600 text-center py-8">読み込み中...</p>
        ) : error ? (
          <div className="text-center py-8 px-3">
            <p className="text-2xl mb-2">⚠️</p>
            <p className="text-xs text-red-500 break-all">{error}</p>
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-10">
            <p className="text-2xl mb-2">✅</p>
            <p className="text-xs text-yellow-700">取り組み中の項目はありません</p>
            {debugInfo && (
              <p className="text-[10px] text-yellow-500 mt-2">{debugInfo}</p>
            )}
          </div>
        ) : (
          <div className="space-y-1.5 mt-0.5">
            {items.map(item => (
              <button
                key={item.id}
                onClick={() => handleItemClick(item)}
                className="w-full text-left px-3 py-2.5 rounded-lg border border-yellow-300 bg-white/60 hover:bg-white/90 transition-all shadow-sm active:scale-[0.98] group"
              >
                <p className="text-xs font-medium text-slate-700 leading-snug group-hover:text-indigo-700 transition-colors">
                  {item.item_name}
                </p>
                {item.rank && (
                  <p className="text-xs text-yellow-600 mt-0.5">{item.rank}</p>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
