import React, { useState, useEffect } from 'react';
import { supabase } from './components/supabaseClient';

export default function Sticky() {
  const [users, setUsers]               = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [items, setItems]               = useState([]);
  const [loading, setLoading]           = useState(false);

  // ユーザー一覧を入社順で取得し、前回のユーザーを復元
  useEffect(() => {
    supabase
      .from('users')
      .select('id, name, rank, progress_name, onboarding_at')
      .is('resigned_at', null)
      .order('onboarding_at', { ascending: true, nullsFirst: false })
      .then(({ data }) => {
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
    if (!selectedUser) {
      console.log('[Sticky] selectedUser is null, skipping fetch');
      setItems([]);
      return;
    }
    setLoading(true);
    setItems([]);
    const pName = selectedUser.progress_name ?? selectedUser.name;
    console.log('[Sticky] fetching for user:', selectedUser.name, '/ pName:', pName, '/ rank:', selectedUser.rank);

    const itemsQuery = selectedUser.rank
      ? supabase.from('evaluation_items').select('no, item_name, rank').eq('rank', selectedUser.rank)
      : supabase.from('evaluation_items').select('no, item_name, rank');

    Promise.all([
      supabase
        .from('evaluation_progress')
        .select('id, item_no')
        .eq('user_name', pName)
        .eq('status', 'in_progress')
        .order('item_no'),
      itemsQuery,
    ]).then(([{ data: progress, error: progressErr }, { data: itemDefs, error: itemErr }]) => {
      console.log('[Sticky] progress rows:', progress?.length ?? 0, progressErr ? '/ error:' + progressErr.message : '');
      console.log('[Sticky] itemDefs rows:', itemDefs?.length ?? 0, itemErr ? '/ error:' + itemErr.message : '');
      const itemMap = Object.fromEntries((itemDefs || []).map(d => [d.no, d]));
      const merged = (progress || [])
        .map(p => ({ ...p, item_name: itemMap[p.item_no]?.item_name, rank: itemMap[p.item_no]?.rank }))
        .filter(p => p.item_name);
      console.log('[Sticky] merged in_progress items:', merged.length);
      setItems(merged);
      setLoading(false);
    });
  }, [selectedUser]);

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
      <div className="px-3 py-2.5 border-b border-yellow-300 flex items-center gap-2 sticky top-0"
           style={{ background: 'rgba(255, 249, 196, 0.95)', backdropFilter: 'blur(4px)' }}>
        <span className="text-base">📌</span>
        <select
          value={selectedUser?.id ?? ''}
          onChange={e => setSelectedUser(users.find(u => u.id === e.target.value) ?? null)}
          className="flex-1 text-xs border border-yellow-300 rounded px-2 py-1 bg-yellow-50 focus:outline-none focus:ring-1 focus:ring-yellow-400 min-w-0"
        >
          {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
        <button
          onClick={() => window.close()}
          className="text-xs text-yellow-600 hover:text-yellow-800 px-1"
          title="閉じる"
        >✕</button>
      </div>

      {/* 件数バッジ */}
      {!loading && (
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
        ) : items.length === 0 ? (
          <div className="text-center py-10">
            <p className="text-2xl mb-2">✅</p>
            <p className="text-xs text-yellow-700">取り組み中の項目はありません</p>
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
