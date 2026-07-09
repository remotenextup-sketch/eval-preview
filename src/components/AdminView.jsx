import React, { useState, useEffect, useRef } from 'react';
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
} from '@dnd-kit/core';
import {
  SortableContext, useSortable, verticalListSortingStrategy, arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { supabase } from './supabaseClient';
import { RANK_OPTIONS } from '../constants';

// ── ItemCommentsSection ──────────────────────────────────────────
function ItemCommentsSection({ itemId, onCountChange }) {
  const [comments, setComments]     = useState([]);
  const [loading, setLoading]       = useState(false);
  const [authorName, setAuthorName] = useState('');
  const [content, setContent]       = useState('');
  const [saving, setSaving]         = useState(false);

  useEffect(() => {
    if (!itemId) return;
    setLoading(true);
    supabase.from('item_comments').select('*').eq('item_id', itemId)
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) console.error('コメント取得エラー:', error);
        setComments(data || []);
        setLoading(false);
      });
  }, [itemId]);

  const submit = async () => {
    if (!content.trim() || !authorName.trim()) return;
    setSaving(true);
    const { data, error } = await supabase.from('item_comments')
      .insert({ item_id: itemId, user_name: authorName.trim(), content: content.trim() })
      .select().single();
    if (error) {
      console.error('コメント投稿エラー:', error);
    } else if (data) {
      setComments(prev => [data, ...prev]);
      onCountChange(itemId, c => c + 1);
      setContent('');
    }
    setSaving(false);
  };

  const remove = async (commentId) => {
    const { error } = await supabase.from('item_comments').delete().eq('id', commentId);
    if (error) {
      console.error('コメント削除エラー:', error);
    } else {
      setComments(prev => prev.filter(c => c.id !== commentId));
      onCountChange(itemId, c => Math.max(0, c - 1));
    }
  };

  return (
    <div className="border-t border-slate-200 pt-4">
      <h4 className="text-sm font-semibold text-slate-700 mb-3">
        みんなのメモ・意見
        {comments.length > 0 && <span className="ml-2 text-xs font-normal text-slate-400">({comments.length}件)</span>}
      </h4>
      <div className="bg-slate-50 rounded-xl border border-slate-200 p-3 mb-3 space-y-2">
        <input type="text" value={authorName} onChange={e => setAuthorName(e.target.value)}
          placeholder="名前を入力"
          className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300" />
        <textarea value={content} onChange={e => setContent(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && e.metaKey) submit(); }}
          placeholder="この項目についてコメントや意見を書いてください..."
          rows={3}
          className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white resize-y focus:outline-none focus:ring-2 focus:ring-indigo-300" />
        <button onClick={submit} disabled={saving || !content.trim() || !authorName.trim()}
          className="w-full text-sm py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-40">
          {saving ? '投稿中...' : '投稿する'}
        </button>
      </div>
      {loading ? (
        <p className="text-xs text-slate-400 text-center py-4">読み込み中...</p>
      ) : comments.length === 0 ? (
        <p className="text-xs text-slate-400 text-center py-4">まだコメントがありません</p>
      ) : (
        <div className="space-y-2">
          {comments.map(c => (
            <div key={c.id} className="bg-white rounded-xl border border-slate-200 p-3">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-slate-700">{c.user_name || '匿名'}</span>
                  <span className="text-xs text-slate-400">
                    {new Date(c.created_at).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <button onClick={() => remove(c.id)}
                  className="text-slate-300 hover:text-red-500 transition-colors leading-none text-base" title="削除">🗑️</button>
              </div>
              <p className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">{c.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── AdminEditPane ────────────────────────────────────────────────
function AdminEditPane({
  selectedAdminItem, adminForm, setAdminForm, savingAdminForm,
  onSave, onArchive, onDelete, onDeselect, onSelectNew, setItemCommentCounts, availableRanks, onBack,
}) {
  const isNew = selectedAdminItem === 'new';
  const isArchived = !isNew && selectedAdminItem?.status === 'archived';
  const [toast, setToast] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleSave = async () => {
    const ok = await onSave();
    if (ok) {
      setToast('保存しました✓');
      setTimeout(() => setToast(''), 2500);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    const ok = await onDelete(selectedAdminItem);
    setDeleting(false);
    if (ok) { setShowDeleteConfirm(false); onDeselect(); }
  };

  if (!selectedAdminItem) {
    return (
      <div className="flex-1 flex items-center justify-center flex-col gap-3 text-slate-400">
        <p className="text-sm">項目を選択するか、新規追加してください</p>
        <button onClick={onSelectNew} className="text-sm px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors">＋ 新規追加</button>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="px-5 py-3.5 bg-white border-b border-slate-200 shrink-0 flex items-center gap-3">
        {onBack && <button onClick={onBack} className="text-indigo-600 text-sm font-medium hover:text-indigo-800">‹ 戻る</button>}
        <h3 className="text-sm font-semibold text-slate-700">{isNew ? '新規項目追加' : '項目を編集'}</h3>
        {!isNew && selectedAdminItem?.status && (
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${isArchived ? 'bg-slate-100 text-slate-400' : 'bg-green-100 text-green-700'}`}>
            {selectedAdminItem.status}
          </span>
        )}
      </div>
      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        <div>
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1.5">項目名 *</label>
          <textarea value={adminForm.item_name} onChange={e => setAdminForm(f => ({ ...f, item_name: e.target.value }))}
            placeholder="項目名を入力..." rows={3}
            className="w-full text-base border border-slate-300 rounded-xl px-4 py-3 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300 font-medium" />
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1.5">ランク *</label>
          <select value={adminForm.rank} onChange={e => setAdminForm(f => ({ ...f, rank: e.target.value }))}
            className="w-full text-sm border border-slate-300 rounded-xl px-4 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300">
            <option value="">ランクを選択</option>
            {(availableRanks || RANK_OPTIONS).map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1.5">詳細説明</label>
          <textarea value={adminForm.description} onChange={e => setAdminForm(f => ({ ...f, description: e.target.value }))}
            placeholder="詳細・達成基準・参考情報など..." rows={8}
            className="w-full text-sm border border-slate-300 rounded-xl px-4 py-3 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300 leading-relaxed" />
        </div>
        <label className="flex items-center gap-3 cursor-pointer select-none">
          <input type="checkbox" checked={adminForm.is_salary_item} onChange={e => setAdminForm(f => ({ ...f, is_salary_item: e.target.checked }))} className="w-4 h-4 accent-indigo-600" />
          <span className="text-sm text-slate-700 font-medium">昇給項目</span>
          <span className="text-xs text-slate-400">（評価に直結する項目）</span>
        </label>
        {!isNew && (
          <ItemCommentsSection
            itemId={selectedAdminItem?.id}
            onCountChange={(itemId, updater) =>
              setItemCommentCounts(prev => ({
                ...prev,
                [itemId]: typeof updater === 'function' ? updater(prev[itemId] || 0) : updater,
              }))
            }
          />
        )}
      </div>
      <div className="px-5 py-4 bg-white border-t border-slate-200 shrink-0 flex flex-wrap gap-2">
        <button onClick={handleSave} disabled={savingAdminForm || !(adminForm.item_name ?? '').trim() || !adminForm.rank}
          className="flex-1 text-sm py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-40 font-medium">
          {savingAdminForm ? '保存中...' : isNew ? '保存して全員に追加' : '変更を保存'}
        </button>
        {!isNew && !isArchived && (
          <button onClick={onArchive} className="text-sm px-4 py-2.5 bg-white border border-red-200 text-red-500 rounded-xl hover:bg-red-50 transition-colors">Archive</button>
        )}
        {!isNew && (
          <button onClick={() => setShowDeleteConfirm(true)}
            className="text-sm px-4 py-2.5 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors">削除</button>
        )}
        <button onClick={onDeselect}
          className="text-sm px-4 py-2.5 bg-white border border-slate-300 text-slate-600 rounded-xl hover:bg-slate-50 transition-colors">キャンセル</button>
      </div>
      {!isNew && <p className="text-xs text-slate-400 text-center pb-3">変更は即時反映されます</p>}
      {isNew && <p className="text-xs text-slate-400 text-center pb-3">保存後、全メンバーのevaluation_progressに自動追加されます</p>}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-green-600 text-white text-sm px-4 py-2.5 rounded-xl shadow-lg pointer-events-none">
          {toast}
        </div>
      )}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <h3 className="text-sm font-bold text-slate-800">項目を削除しますか？</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              「{selectedAdminItem?.item_name}」を削除します。<br />
              全メンバーのこの項目の進捗・エビデンス・質問も同時に削除されます。この操作は取り消せません。
            </p>
            <div className="flex gap-2">
              <button onClick={handleDelete} disabled={deleting}
                className="flex-1 text-sm py-2 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors disabled:opacity-50 font-medium">
                {deleting ? '削除中...' : '削除する'}
              </button>
              <button onClick={() => setShowDeleteConfirm(false)} disabled={deleting}
                className="flex-1 text-sm py-2 bg-white border border-slate-300 text-slate-600 rounded-xl hover:bg-slate-50 transition-colors">
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── SortableItemRow ──────────────────────────────────────────────
function SortableItemRow({ item, isSelected, onSelect, commentCount, isDragActive }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const hasComments = commentCount > 0;

  const bgClass = isDragging
    ? 'bg-indigo-50/80'
    : isSelected
    ? 'bg-indigo-50'
    : '';

  const inlineBg = !isDragging && !isSelected && hasComments ? { backgroundColor: '#FFF0F0' } : undefined;

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, ...inlineBg }}
      className={`flex items-center border-b border-slate-100 last:border-b-0 ${bgClass} ${isDragging ? 'shadow-md z-10 rounded-lg' : ''}`}
    >
      {/* ドラッグハンドル */}
      <span
        {...attributes}
        {...listeners}
        className="px-2 py-3 text-slate-300 hover:text-slate-500 cursor-grab active:cursor-grabbing select-none shrink-0 touch-none text-base leading-none"
        title="ドラッグして並び替え"
      >⠿</span>
      {/* 項目ボタン */}
      <button
        onClick={() => !isDragActive && onSelect(item)}
        disabled={isDragActive}
        className="flex-1 min-w-0 text-left px-2 py-2.5 flex items-start gap-2 disabled:pointer-events-none"
      >
        <span className="text-xs text-slate-400 w-6 shrink-0 mt-0.5">#{item.no}</span>
        <p className="flex-1 text-sm text-slate-800 leading-snug">{item.item_name}</p>
        <div className="flex items-center gap-1 shrink-0 mt-0.5">
          {hasComments && (
            <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full font-medium">💬 {commentCount}</span>
          )}
          {item.is_salary_item && <span className="text-xs bg-amber-100 text-amber-700 px-1 py-0.5 rounded">昇給</span>}
          {item.status !== 'active' && <span className="text-xs bg-slate-100 text-slate-400 px-1 py-0.5 rounded">{item.status}</span>}
        </div>
        <span className="text-slate-300 text-xs mt-0.5 shrink-0">›</span>
      </button>
    </div>
  );
}

// ── AdminLeftPane ────────────────────────────────────────────────
function AdminLeftPane({
  availableRanks, adminItems, selectedAdminItem, onSelectAdminItem,
  rankCommentSummary, itemCommentCounts, proposals, setMtgMode,
  savingProposal, proposalContent, setProposalContent, onSaveProposal,
  onAdoptProposal, onUpdateProposalStatus, selectedUser, addCustomRank,
}) {
  // ランク表示順（↑↓ボタンで変更）
  const [rankOrder, setRankOrder] = useState([...availableRanks]);
  // 各ランク内の項目ローカル順序
  const [localRankItems, setLocalRankItems] = useState({});
  // 順序変更済みで未保存のランク
  const [dirtyRanks, setDirtyRanks] = useState(new Set());
  const [savingOrder, setSavingOrder] = useState(false);
  // ドラッグ中のアイテムID
  const [activeDragId, setActiveDragId] = useState(null);
  const [jumpRankIdx, setJumpRankIdx] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');

  const rankInputRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const rankGroupRefs = useRef({});

  const jumpToRank = (rank) => {
    const el = rankGroupRefs.current[rank];
    const container = scrollContainerRef.current;
    if (!el || !container) return;
    const elTop = el.getBoundingClientRect().top;
    const containerTop = container.getBoundingClientRect().top;
    container.scrollBy({ top: elTop - containerTop - 8, behavior: 'smooth' });
  };

  const jumpToNextRank = () => {
    if (filteredRankGroups.length === 0) return;
    const nextIdx = (jumpRankIdx + 1) % filteredRankGroups.length;
    setJumpRankIdx(nextIdx);
    jumpToRank(filteredRankGroups[nextIdx].rank);
  };

  // availableRanks 変化時に rankOrder を同期
  useEffect(() => {
    setRankOrder(prev => {
      const next = prev.filter(r => availableRanks.includes(r));
      availableRanks.forEach(r => { if (!next.includes(r)) next.push(r); });
      return next;
    });
  }, [availableRanks]);

  // adminItems 変化時に localRankItems を再初期化
  useEffect(() => {
    const grouped = {};
    availableRanks.forEach(rank => {
      grouped[rank] = (adminItems || [])
        .filter(i => i.rank === rank)
        .sort((a, b) => (a.sort_order ?? a.no ?? 9999) - (b.sort_order ?? b.no ?? 9999));
    });
    setLocalRankItems(grouped);
    setDirtyRanks(new Set());
  }, [adminItems, availableRanks]);

  // 表示するランクグループ（アイテムがあるランクのみ）
  const rankGroups = rankOrder
    .map(rank => ({ rank, items: localRankItems[rank] || [] }))
    .filter(g => g.items.length > 0);

  const filteredRankGroups = searchQuery.trim()
    ? rankGroups
        .map(g => ({
          ...g,
          items: g.items.filter(item =>
            item.item_name?.toLowerCase().includes(searchQuery.toLowerCase())
          ),
        }))
        .filter(g => g.items.length > 0)
    : rankGroups;

  // ランクグループの ↑/↓ 移動
  const moveRankGroup = (rank, direction) => {
    const groupIdx = rankGroups.findIndex(g => g.rank === rank);
    const targetIdx = groupIdx + direction;
    if (targetIdx < 0 || targetIdx >= rankGroups.length) return;
    const targetRank = rankGroups[targetIdx].rank;
    setRankOrder(prev => {
      const a = prev.indexOf(rank);
      const b = prev.indexOf(targetRank);
      if (a === -1 || b === -1) return prev;
      const next = [...prev];
      [next[a], next[b]] = [next[b], next[a]];
      return next;
    });
  };

  // DnD センサー（5px 移動で開始）
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const handleDragStart = ({ active }) => setActiveDragId(active.id);

  const handleDragEnd = ({ active, over }) => {
    setActiveDragId(null);
    if (!over || active.id === over.id) return;

    let targetRank = null;
    for (const { rank, items } of rankGroups) {
      if (items.some(i => i.id === active.id)) { targetRank = rank; break; }
    }
    if (!targetRank) return;

    const items = localRankItems[targetRank] || [];
    const oldIdx = items.findIndex(i => i.id === active.id);
    const newIdx = items.findIndex(i => i.id === over.id);
    if (oldIdx === -1 || newIdx === -1 || oldIdx === newIdx) return;

    setLocalRankItems(prev => ({ ...prev, [targetRank]: arrayMove(items, oldIdx, newIdx) }));
    setDirtyRanks(prev => new Set([...prev, targetRank]));
  };

  // 順番を DB に保存（evaluation_items.sort_order を更新。no は変更しない）
  const saveOrder = async (rank) => {
    setSavingOrder(true);
    const items = localRankItems[rank] || [];

    // 既存の sort_order 値を昇順に並べて再割り当て（no は一切変更しない）
    const existingSortOrders = (adminItems || [])
      .filter(i => i.rank === rank)
      .map(i => i.sort_order ?? i.no ?? 0)
      .sort((a, b) => a - b);

    const updates = items.map((item, idx) => ({
      id: item.id,
      sort_order: existingSortOrders[idx] ?? (idx + 1),
    }));

    const results = await Promise.all(
      updates.map(({ id, sort_order }) =>
        supabase.from('evaluation_items').update({ sort_order }).eq('id', id)
      )
    );

    if (results.some(r => r.error)) {
      console.error('[saveOrder] error:', results.find(r => r.error)?.error);
    } else {
      const orderMap = Object.fromEntries(updates.map(u => [u.id, u.sort_order]));
      setLocalRankItems(prev => ({
        ...prev,
        [rank]: (prev[rank] || []).map(item => ({ ...item, sort_order: orderMap[item.id] ?? item.sort_order })),
      }));
      setDirtyRanks(prev => { const next = new Set(prev); next.delete(rank); return next; });
    }
    setSavingOrder(false);
  };

  const openProposals = proposals.filter(p => p.status === 'open');

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-4 pt-3 pb-2 bg-white border-b border-slate-200 shrink-0 space-y-2">
        <button
          onClick={() => onSelectAdminItem('new')}
          className={`w-full text-sm py-2 rounded-xl font-medium transition-colors ${selectedAdminItem === 'new' ? 'bg-indigo-600 text-white' : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200'}`}
        >＋ 新規項目を追加</button>
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="項目名で検索..."
            className="w-full text-xs border border-slate-200 rounded-lg px-3 py-1.5 pr-7 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-sm leading-none"
            >✕</button>
          )}
        </div>
        {filteredRankGroups.length > 0 && (
          <div className="flex items-center gap-1 overflow-x-auto pb-0.5" style={{ scrollbarWidth: 'none' }}>
            {filteredRankGroups.map(({ rank }, idx) => (
              <button key={rank} onClick={() => { setJumpRankIdx(idx); jumpToRank(rank); }}
                className="text-xs whitespace-nowrap px-2 py-1 rounded-full bg-slate-100 text-slate-600 hover:bg-indigo-100 hover:text-indigo-700 transition-colors shrink-0 font-medium">
                {rank}
              </button>
            ))}
            {filteredRankGroups.length > 1 && (
              <button onClick={jumpToNextRank}
                className="text-xs whitespace-nowrap px-2.5 py-1 rounded-full bg-indigo-600 text-white hover:bg-indigo-700 transition-colors shrink-0 font-medium ml-1">
                次→
              </button>
            )}
          </div>
        )}
        {rankCommentSummary.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {rankCommentSummary.map(r => (
              <span key={r.rank} className="text-xs bg-red-50 text-red-600 border border-red-100 px-2 py-0.5 rounded-full">
                {r.rank} 💬 {r.count}件
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto" ref={scrollContainerRef}>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="p-4 space-y-3">
            {searchQuery.trim() && filteredRankGroups.length === 0 && (
              <p className="text-xs text-slate-400 text-center py-8">該当する項目がありません</p>
            )}
            {filteredRankGroups.map(({ rank, items: rankItems }, groupIdx) => (
              <div key={rank} ref={el => { rankGroupRefs.current[rank] = el; }} className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                {/* ランクグループヘッダー */}
                <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-600">{rank}</span>
                  <div className="flex items-center gap-1.5">
                    {dirtyRanks.has(rank) && (
                      <button
                        onClick={() => saveOrder(rank)}
                        disabled={savingOrder}
                        className="text-xs px-2 py-0.5 bg-amber-500 text-white rounded-md hover:bg-amber-600 transition-colors disabled:opacity-50 font-medium"
                      >
                        {savingOrder ? '...' : '順番を保存'}
                      </button>
                    )}
                    <span className="text-xs text-slate-400">{rankItems.length}件</span>
                    <button
                      onClick={() => moveRankGroup(rank, -1)}
                      disabled={groupIdx === 0 || !!activeDragId || !!searchQuery.trim()}
                      className="text-xs w-6 h-6 flex items-center justify-center rounded border border-slate-300 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-default transition-colors font-bold"
                      title="上に移動"
                    >↑</button>
                    <button
                      onClick={() => moveRankGroup(rank, 1)}
                      disabled={groupIdx === filteredRankGroups.length - 1 || !!activeDragId || !!searchQuery.trim()}
                      className="text-xs w-6 h-6 flex items-center justify-center rounded border border-slate-300 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-default transition-colors font-bold"
                      title="下に移動"
                    >↓</button>
                  </div>
                </div>
                {/* ソータブルアイテムリスト */}
                <SortableContext items={rankItems.map(i => i.id)} strategy={verticalListSortingStrategy}>
                  <div>
                    {rankItems.map(item => (
                      <SortableItemRow
                        key={item.id}
                        item={item}
                        isSelected={selectedAdminItem !== 'new' && selectedAdminItem?.id === item.id}
                        onSelect={onSelectAdminItem}
                        commentCount={itemCommentCounts[item.id] || 0}
                        isDragActive={!!activeDragId}
                      />
                    ))}
                  </div>
                </SortableContext>
              </div>
            ))}
          </div>
        </DndContext>

        {/* 改善提案ボード */}
        <div className="px-4 pb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-700">
              改善提案ボード
              {openProposals.length > 0 && <span className="ml-2 text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full">{openProposals.length}件</span>}
            </h3>
            {openProposals.length > 0 && (
              <button onClick={() => setMtgMode(true)} className="text-xs px-2.5 py-1 bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition-colors">MTGモード</button>
            )}
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-3 mb-3 space-y-2 shadow-sm">
            <p className="text-xs text-slate-400">投稿者: <span className="font-medium text-slate-600">{selectedUser?.name ?? '（未選択）'}</span></p>
            <textarea value={proposalContent} onChange={e => setProposalContent(e.target.value)}
              placeholder="改善提案・アイデアを書いてください" rows={3}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300" />
            <button onClick={onSaveProposal} disabled={savingProposal || !proposalContent.trim() || !selectedUser}
              className="w-full text-sm py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-40">
              {savingProposal ? '送信中...' : '提案する'}
            </button>
          </div>
          <div className="space-y-2">
            {proposals.length === 0 && <p className="text-xs text-slate-400 text-center py-4">まだ提案がありません</p>}
            {proposals.map(p => (
              <div key={p.id} className={`bg-white rounded-xl border shadow-sm p-3 ${p.status === 'open' ? 'border-slate-200' : p.status === 'adopted' ? 'border-green-200 bg-green-50' : 'border-slate-100 bg-slate-50 opacity-60'}`}>
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium text-slate-700">{p.user_name || '匿名'}</span>
                    <span className="text-xs text-slate-400">{new Date(p.created_at).toLocaleDateString('ja-JP')}</span>
                  </div>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium shrink-0 ${p.status === 'open' ? 'bg-orange-100 text-orange-600' : p.status === 'adopted' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-400'}`}>
                    {p.status === 'open' ? '未対応' : p.status === 'adopted' ? '採用' : '解決済み'}
                  </span>
                </div>
                <p className="text-sm text-slate-800 whitespace-pre-wrap mb-2">{p.content}</p>
                {p.status === 'open' && (
                  <div className="flex gap-1.5">
                    <button onClick={() => onAdoptProposal(p)} className="text-xs px-2.5 py-1 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">採用</button>
                    <button onClick={() => onUpdateProposalStatus(p.id, 'resolved')} className="text-xs px-2.5 py-1 bg-white border border-slate-300 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors">解決済み</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ランク管理 */}
        <div className="px-4 pb-6 mt-2">
          <div className="border-t border-slate-200 pt-4">
            <h3 className="text-sm font-semibold text-slate-700 mb-2">ランク管理</h3>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {availableRanks.map(r => (
                <span key={r} className="text-xs bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full">{r}</span>
              ))}
            </div>
            <div className="flex gap-2">
              <input ref={rankInputRef} type="text" placeholder="新しいランク名..."
                className="flex-1 text-sm border border-slate-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
              <button onClick={() => {
                const val = rankInputRef.current?.value?.trim();
                if (val) { addCustomRank(val); rankInputRef.current.value = ''; }
              }} className="text-xs px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">追加</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── MtgOverlay ───────────────────────────────────────────────────
function MtgOverlay({ proposals, setMtgMode, onAdoptProposal, onUpdateProposalStatus }) {
  const openProposals = proposals.filter(p => p.status === 'open');
  return (
    <div className="fixed inset-0 bg-slate-900 z-50 flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-8 py-4 border-b border-slate-700 shrink-0">
        <h2 className="text-lg font-bold text-white">改善提案 MTGモード</h2>
        <button onClick={() => setMtgMode(false)} className="text-slate-400 hover:text-white text-sm px-3 py-1.5 border border-slate-600 rounded-lg transition-colors">閉じる</button>
      </div>
      <div className="flex-1 overflow-y-auto px-8 py-6 space-y-5">
        {openProposals.length === 0
          ? <p className="text-slate-500 text-center py-16 text-lg">未対応の提案はありません</p>
          : openProposals.map((p, idx) => (
            <div key={p.id} className="bg-slate-800 rounded-2xl p-6 border border-slate-700">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-2xl font-bold text-slate-500">{idx + 1}</span>
                    <span className="text-slate-400 text-sm">{p.user_name || '匿名'}</span>
                    <span className="text-slate-600 text-sm">{new Date(p.created_at).toLocaleDateString('ja-JP')}</span>
                  </div>
                  <p className="text-white text-xl leading-relaxed whitespace-pre-wrap">{p.content}</p>
                </div>
                <div className="flex flex-col gap-2 shrink-0">
                  <button onClick={() => onAdoptProposal(p)} className="text-sm px-4 py-2 bg-indigo-500 text-white rounded-xl hover:bg-indigo-400 transition-colors font-medium">採用して追加</button>
                  <button onClick={() => onUpdateProposalStatus(p.id, 'resolved')} className="text-sm px-4 py-2 bg-slate-700 text-slate-300 rounded-xl hover:bg-slate-600 transition-colors">解決済み</button>
                </div>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}

// ── AdminSpreadsheet ─────────────────────────────────────────────
function AdminSpreadsheet({ adminItems, itemCommentCounts, selectedAdminItem, onSelectAdminItem, availableRanks }) {
  const [allComments, setAllComments] = useState({});
  const [loading, setLoading]         = useState(false);
  const [rankFilter, setRankFilter]         = useState('all');
  const [searchQuery, setSearchQuery]       = useState('');
  const [commentOnly, setCommentOnly]       = useState(false);

  useEffect(() => {
    const ids = adminItems.filter(i => (itemCommentCounts[i.id] || 0) > 0).map(i => i.id);
    if (ids.length === 0) { setAllComments({}); return; }
    setLoading(true);
    supabase.from('item_comments')
      .select('item_id, user_name, content, created_at')
      .in('item_id', ids)
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        const grouped = {};
        (data || []).forEach(c => {
          if (!grouped[c.item_id]) grouped[c.item_id] = [];
          grouped[c.item_id].push(c);
        });
        setAllComments(grouped);
        setLoading(false);
      });
  }, [adminItems, itemCommentCounts]);

  // ランク別コメント件数（合計）
  const rankCommentCounts = React.useMemo(() => {
    const all = adminItems.reduce((sum, i) => sum + (itemCommentCounts[i.id] || 0), 0);
    const byRank = availableRanks.reduce((acc, r) => {
      acc[r] = adminItems
        .filter(i => i.rank === r)
        .reduce((sum, i) => sum + (itemCommentCounts[i.id] || 0), 0);
      return acc;
    }, {});
    return { all, ...byRank };
  }, [adminItems, itemCommentCounts, availableRanks]);

  const filtered = adminItems
    .filter(i => rankFilter === 'all' || i.rank === rankFilter)
    .filter(i => !commentOnly || (itemCommentCounts[i.id] || 0) > 0)
    .filter(i => !searchQuery.trim() || (i.item_name ?? '').includes(searchQuery.trim()))
    .sort((a, b) => {
      const ai = availableRanks.indexOf(a.rank);
      const bi = availableRanks.indexOf(b.rank);
      const ri = (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
      if (ri !== 0) return ri;
      return (a.sort_order ?? a.no ?? 9999) - (b.sort_order ?? b.no ?? 9999);
    });

  const rankLabel = (r) => {
    const n = rankCommentCounts[r] || 0;
    return n > 0 ? `${r}（${n}）` : r;
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* ランクタブ */}
      <div className="px-3 pt-2 pb-0 bg-white border-b border-slate-200 shrink-0 overflow-x-auto">
        <div className="flex gap-1 min-w-max pb-2">
          <button
            onClick={() => setRankFilter('all')}
            className={`text-xs px-2.5 py-1 rounded-lg whitespace-nowrap transition-colors ${rankFilter === 'all' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            {rankCommentCounts.all > 0 ? `全て（${rankCommentCounts.all}）` : '全て'}
          </button>
          {availableRanks.map(r => (
            <button key={r}
              onClick={() => setRankFilter(r)}
              className={`text-xs px-2.5 py-1 rounded-lg whitespace-nowrap transition-colors ${
                rankFilter === r ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {rankLabel(r)}
            </button>
          ))}
        </div>
      </div>

      {/* 検索・フィルターバー */}
      <div className="px-3 py-2 bg-white border-b border-slate-200 shrink-0 flex items-center gap-2">
        <div className="relative flex-1 max-w-xs">
          <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            placeholder="項目名で検索..."
            className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 pr-7 bg-white focus:outline-none" />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-sm leading-none">✕</button>
          )}
        </div>
        <button
          onClick={() => setCommentOnly(prev => !prev)}
          className={`text-xs px-2.5 py-1.5 rounded-lg border transition-colors whitespace-nowrap ${
            commentOnly
              ? 'bg-pink-500 text-white border-pink-500'
              : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
          }`}
        >
          コメントあり
        </button>
        <span className="text-xs text-slate-400">{filtered.length}件</span>
        {loading && <span className="text-xs text-slate-300">読込中...</span>}
      </div>

      {/* テーブル */}
      <div className="flex-1 overflow-auto">
        <table className="border-collapse text-xs" style={{ minWidth: 900, width: '100%' }}>
          <thead className="sticky top-0 z-10">
            <tr className="bg-slate-100 border-b-2 border-slate-300">
              <th className="sticky left-0 z-20 bg-slate-100 text-left px-3 py-2.5 font-semibold text-slate-600 border-r border-slate-200 whitespace-nowrap" style={{ width: 96 }}>ランク</th>
              <th className="text-left px-3 py-2.5 font-semibold text-slate-600 border-r border-slate-200" style={{ minWidth: 240 }}>項目</th>
              <th className="text-left px-3 py-2.5 font-semibold text-slate-600 border-r border-slate-200" style={{ minWidth: 180, maxWidth: 220 }}>詳細</th>
              <th className="text-left px-3 py-2.5 font-semibold text-slate-600 border-r border-slate-200" style={{ minWidth: 200 }}>改善案</th>
              <th className="text-left px-3 py-2.5 font-semibold text-slate-600" style={{ minWidth: 100 }}>記入者</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(item => {
              const comments    = allComments[item.id] || [];
              const isSelected  = selectedAdminItem?.id === item.id;
              const hasComments = comments.length > 0;
              const rowBg       = isSelected ? '#eef2ff' : hasComments ? '#fff8f8' : '#ffffff';
              return (
                <tr
                  key={item.id}
                  onClick={() => onSelectAdminItem(item)}
                  className="border-b border-slate-100 cursor-pointer transition-colors hover:brightness-95"
                  style={{ backgroundColor: rowBg }}
                >
                  {/* ランク（sticky） */}
                  <td className="sticky left-0 px-3 py-2.5 border-r border-slate-100 align-top" style={{ backgroundColor: rowBg }}>
                    {item.rank && (
                      <span className="inline-block text-[10px] px-1.5 py-0.5 rounded font-medium bg-slate-100 text-slate-600 whitespace-nowrap">
                        {item.rank}
                      </span>
                    )}
                  </td>
                  {/* 項目 */}
                  <td className="px-3 py-2.5 border-r border-slate-100 align-top">
                    <p className="text-slate-800 font-medium leading-snug line-clamp-4">{item.item_name}</p>
                    <div className="flex gap-1 mt-1 flex-wrap">
                      {item.is_salary_item && <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">昇給</span>}
                      {item.status !== 'active' && <span className="text-[10px] bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded">{item.status}</span>}
                    </div>
                  </td>
                  {/* 詳細 */}
                  <td className="px-3 py-2.5 border-r border-slate-100 align-top" style={{ maxWidth: 220 }}>
                    {item.description
                      ? <p className="text-slate-600 leading-relaxed whitespace-pre-line line-clamp-6">{item.description}</p>
                      : <span className="text-slate-300">—</span>}
                  </td>
                  {/* 改善案 */}
                  <td className="px-3 py-2.5 border-r border-slate-100 align-top">
                    {hasComments
                      ? <div className="space-y-2">{comments.map((c, i) => <p key={i} className="text-slate-700 leading-snug">{c.content}</p>)}</div>
                      : <span className="text-slate-300">—</span>}
                  </td>
                  {/* 記入者 */}
                  <td className="px-3 py-2.5 align-top">
                    {hasComments
                      ? <div className="space-y-2">{comments.map((c, i) => <p key={i} className="text-slate-500 whitespace-nowrap">{c.user_name || '匿名'}</p>)}</div>
                      : <span className="text-slate-300">—</span>}
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center py-12 text-slate-400">該当する項目がありません</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── AdminView (exported) ─────────────────────────────────────────
export default function AdminView({
  adminItems, selectedAdminItem, onSelectAdminItem,
  adminForm, setAdminForm, savingAdminForm,
  onSave, onArchive, onDelete, onDeselect, onSelectNew,
  mobileShowAdminEdit, setMobileShowAdminEdit,
  proposals, proposalContent, setProposalContent, savingProposal,
  onSaveProposal, onAdoptProposal, onUpdateProposalStatus,
  mtgMode, setMtgMode,
  itemCommentCounts, setItemCommentCounts,
  availableRanks, addCustomRank,
  selectedUser, rankCommentSummary,
}) {
  const leftPaneProps = {
    availableRanks, adminItems, selectedAdminItem, onSelectAdminItem,
    rankCommentSummary, itemCommentCounts, proposals, setMtgMode,
    savingProposal, proposalContent, setProposalContent,
    onSaveProposal, onAdoptProposal, onUpdateProposalStatus,
    selectedUser, addCustomRank,
  };

  const editPaneProps = {
    selectedAdminItem, adminForm, setAdminForm, savingAdminForm,
    onSave, onArchive, onDelete, onDeselect, onSelectNew, setItemCommentCounts, availableRanks,
  };

  const spreadsheetProps = {
    adminItems, itemCommentCounts, selectedAdminItem, onSelectAdminItem, availableRanks,
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* デスクトップレイアウト */}
      <div className="hidden md:grid flex-1 overflow-hidden" style={{ gridTemplateColumns: '1fr 440px' }}>
        <div className="bg-white border-r border-slate-200 overflow-hidden flex flex-col">
          <AdminSpreadsheet {...spreadsheetProps} />
        </div>
        <div className="overflow-hidden flex flex-col bg-slate-50">
          <AdminEditPane {...editPaneProps} onBack={null} />
        </div>
      </div>

      {/* モバイルレイアウト */}
      <div className="md:hidden flex-1 overflow-hidden relative">
        <div className={`absolute inset-0 bg-white transition-transform duration-200 ${mobileShowAdminEdit ? '-translate-x-full' : 'translate-x-0'}`}>
          <AdminLeftPane {...leftPaneProps} />
        </div>
        <div className={`absolute inset-0 bg-slate-50 transition-transform duration-200 ${mobileShowAdminEdit ? 'translate-x-0' : 'translate-x-full'}`}>
          <AdminEditPane
            {...editPaneProps}
            onBack={() => { setMobileShowAdminEdit(false); onDeselect(); }}
          />
        </div>
      </div>

      {mtgMode && <MtgOverlay proposals={proposals} setMtgMode={setMtgMode} onAdoptProposal={onAdoptProposal} onUpdateProposalStatus={onUpdateProposalStatus} />}
    </div>
  );
}
