import React, { useState, useEffect, useRef } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { supabase } from './supabaseClient';
import ItemQuestionSection from './ItemQuestions';
import { STATUSES, STATUS_MAP, FILTER_TABS, CURRENT_MONTH } from '../constants';

// ── PeerEvidenceSection ──────────────────────────────────────────
function PeerEvidenceSection({ itemNo, selfUserName }) {
  const [evidences, setEvidences] = useState([]);
  const [loading, setLoading]     = useState(false);
  const [open, setOpen]           = useState(false);

  useEffect(() => {
    if (!itemNo) return;
    setLoading(true);
    setEvidences([]);
    setOpen(false);
    supabase
      .from('evaluation_progress')
      .select('user_name, achieved_month, evaluation_evidences(*)')
      .eq('item_no', itemNo)
      .eq('status', 'completed')
      .neq('user_name', selfUserName)
      .then(({ data, error }) => {
        if (error) console.error('参考エビデンス取得エラー:', error);
        const flat = (data || [])
          .filter(row => row.evaluation_evidences?.length > 0)
          .flatMap(row =>
            row.evaluation_evidences
              .filter(ev => ev.quality !== 'bad')
              .map(ev => ({ ...ev, user_name: row.user_name, achieved_month: row.achieved_month }))
          );
        setEvidences(flat);
        setLoading(false);
      });
  }, [itemNo, selfUserName]);

  if (loading) {
    return (
      <section>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">みんなのエビデンス</p>
        <p className="text-xs text-slate-400 text-center py-2">読み込み中...</p>
      </section>
    );
  }

  return (
    <section>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-wide py-1 hover:text-slate-700 transition-colors"
      >
        <span>みんなのエビデンス</span>
        <span className="normal-case font-normal text-indigo-500">
          {open ? '閉じる ▲' : evidences.length > 0 ? `参考エビデンスを見る（${evidences.length}件） ▼` : '参考エビデンスを見る ▼'}
        </span>
      </button>
      {open && (
        <div className="mt-2 space-y-2">
          {evidences.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-3 bg-slate-50 rounded-xl border border-slate-100">まだエビデンスがありません</p>
          ) : (
            evidences.map((ev, i) => (
              <div key={ev.id ?? i} className="bg-indigo-50 rounded-xl border border-indigo-100 p-3">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-xs font-medium text-slate-700">{ev.user_name}</span>
                  {ev.achieved_month && <span className="text-xs text-slate-400">{ev.achieved_month}</span>}
                </div>
                {ev.evidence_type === 'image' ? (
                  <a href={ev.content} target="_blank" rel="noreferrer">
                    <img src={ev.content} alt="evidence" className="rounded-lg max-w-full object-cover" style={{ maxHeight: 200 }} />
                  </a>
                ) : (
                  <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">📝 {ev.content}</p>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </section>
  );
}

// ── ItemDetail ───────────────────────────────────────────────────
function ItemDetail({
  item, onBack, onStatusChange, onMemoChange,
  evidenceText, onEvidenceTextChange, onAddText, onImageUpload, isUploading,
  onDeleteEvidence, onUpdateEvidenceQuality,
}) {
  const [localMemo, setLocalMemo] = useState(item.memo ?? '');
  const debounceRef = useRef(null);
  const fileRef = useRef(null);
  const evidences = item.evaluation_evidences ?? [];
  const st = STATUS_MAP[item.status] ?? STATUS_MAP.pending;

  useEffect(() => { setLocalMemo(item.memo ?? ''); }, [item.id, item.memo]);

  const handleMemoChange = val => {
    setLocalMemo(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => onMemoChange(item.id, val), 800);
  };

  const idx = STATUSES.findIndex(s => s.value === item.status);
  const prevSt = idx > 0 ? STATUSES[idx - 1] : null;
  const nextSt = idx < STATUSES.length - 1 ? STATUSES[idx + 1] : null;

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className={`px-4 py-3 border-b border-slate-200 shrink-0 ${st.bg}`}>
        <div className="flex items-start gap-2">
          {onBack && <button onClick={onBack} className="text-indigo-600 text-sm font-medium shrink-0 pt-0.5 hover:text-indigo-800">‹ 戻る</button>}
          <div className="flex-1 min-w-0">
            <p className="text-xs text-slate-400">#{item.item_no}</p>
            <p className="text-base font-semibold text-slate-800 leading-snug mt-0.5">{item.item_name}</p>
            <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-full font-medium ${st.badge}`}>{st.label}</span>
            {item.achieved_month && <span className="ml-2 text-xs text-slate-400">{item.achieved_month}</span>}
          </div>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
        {item.description && (
          <p className="text-xs text-slate-500 bg-white rounded-xl p-3 border border-slate-200 whitespace-pre-wrap leading-relaxed">{item.description}</p>
        )}
        <section>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">ステータス</p>
          <div className="flex gap-2 mb-3">
            {prevSt && <button onClick={() => onStatusChange(item.id, prevSt.value)} className="text-xs px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-600 hover:bg-slate-50 transition-colors">← {prevSt.label}</button>}
            {nextSt ? <button onClick={() => onStatusChange(item.id, nextSt.value)} className="text-xs px-3 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 transition-colors">{nextSt.label} →</button>
              : <span className="text-xs text-emerald-600 font-semibold self-center">✓ 完了済み</span>}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {STATUSES.map(s => (
              <button key={s.value} onClick={() => onStatusChange(item.id, s.value)}
                className={`text-xs px-2.5 py-1.5 rounded-lg transition-colors ${item.status === s.value ? `${s.badge} font-bold ring-1 ring-offset-1 ring-current` : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
                {s.label}
              </button>
            ))}
          </div>
        </section>
        <section>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">メモ</p>
          <textarea value={localMemo} onChange={e => handleMemoChange(e.target.value)} placeholder="進捗メモ・コメントを入力..." rows={4}
            className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none" />
        </section>
        <PeerEvidenceSection itemNo={item.item_no} selfUserName={item.user_name} />
        <section>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
            エビデンス{evidences.length > 0 && <span className="ml-1 normal-case font-normal text-slate-400">({evidences.length}件)</span>}
          </p>
          {evidences.length > 0 && (
            <div className="space-y-2 mb-3">
              {evidences.map(ev => {
                const isBad = ev.quality === 'bad';
                return (
                  <div key={ev.id} className={`rounded-xl border p-3 ${isBad ? 'bg-red-50 border-red-100' : ev.quality === 'good' ? 'bg-green-50 border-green-100' : 'bg-white border-slate-200'}`}>
                    <div className="flex items-start gap-2">
                      <div className="flex-1 min-w-0">
                        {ev.evidence_type === 'image' ? (
                          <a href={ev.content} target="_blank" rel="noreferrer">
                            <img src={ev.content} alt="evidence" className="rounded-lg max-w-full object-cover" style={{ maxHeight: 200 }} />
                          </a>
                        ) : (
                          <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">📝 {ev.content}</p>
                        )}
                      </div>
                      <div className="flex flex-col gap-1 shrink-0">
                        <button onClick={() => onUpdateEvidenceQuality(ev.id, 'good')} title="良い"
                          className={`text-xs px-1.5 py-0.5 rounded transition-colors ${ev.quality === 'good' ? 'bg-green-500 text-white' : 'bg-white border border-slate-200 text-slate-400 hover:bg-green-50'}`}>👍</button>
                        <button onClick={() => onUpdateEvidenceQuality(ev.id, 'bad')} title="やり直し"
                          className={`text-xs px-1.5 py-0.5 rounded transition-colors ${isBad ? 'bg-red-500 text-white' : 'bg-white border border-slate-200 text-slate-400 hover:bg-red-50'}`}>👎</button>
                        <button onClick={() => onDeleteEvidence(ev.id)} title="削除"
                          className="text-xs px-1.5 py-0.5 rounded bg-white border border-slate-200 text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors">🗑</button>
                      </div>
                    </div>
                    {isBad && <span className="inline-block mt-1.5 text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">
                      やり直し{ev.ng_reason ? `：${ev.ng_reason}` : ''}
                    </span>}
                  </div>
                );
              })}
            </div>
          )}
          <div className="flex gap-2">
            <input type="text" value={evidenceText} onChange={e => onEvidenceTextChange(e.target.value)} onKeyDown={e => e.key === 'Enter' && e.preventDefault()}
              placeholder="テキストエビデンスを入力..."
              className="flex-1 text-xs border border-slate-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300" />
            <button onClick={onAddText} disabled={!evidenceText.trim()} className="text-xs px-3 py-2 bg-slate-700 text-white rounded-xl hover:bg-slate-800 transition-colors disabled:opacity-40">追加</button>
          </div>
          <button onClick={() => fileRef.current?.click()} disabled={isUploading}
            className={`mt-2 w-full flex items-center justify-center gap-2 text-xs py-3 border-2 border-dashed rounded-xl transition-colors ${isUploading ? 'opacity-50 cursor-not-allowed border-slate-300 text-slate-400' : 'border-slate-300 text-slate-400 hover:border-indigo-400 hover:text-indigo-500 cursor-pointer'}`}>
            {isUploading ? '⏳ アップロード中...' : '📷 画像をアップロード'}
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => { if (e.target.files?.[0]) onImageUpload(e.target.files[0]); e.target.value = ''; }} />
        </section>
        <ItemQuestionSection itemId={item.item_def_id} itemName={item.item_name} />
      </div>
    </div>
  );
}

// ── PlanPanel ────────────────────────────────────────────────────
function PlanPanel({ plans, plansLoading, planForm, setPlanForm, savingPlan, onAddPlan, onAchievePlan, onDeletePlan, unachievedItems, selectedUser }) {
  const now = new Date();
  const getDaysLeft = (due) => due ? Math.ceil((new Date(due) - now) / 86400000) : null;
  const daysStyle = (d) => d === null ? '' : d < 0 ? 'text-red-500 font-semibold' : d <= 7 ? 'text-orange-500 font-semibold' : 'text-green-600';
  const daysLabel = (d) => d === null ? '' : d < 0 ? `${Math.abs(d)}日超過` : d === 0 ? '今日が期限' : `あと${d}日`;

  return (
    <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4">
      <div>
        <h2 className="text-base font-semibold text-slate-700">{selectedUser?.name} のクリア計画</h2>
        <p className="text-xs text-slate-400 mb-4">期限を設定して項目クリアを管理します</p>
      </div>
      <div className="space-y-2">
        {plansLoading ? <p className="text-sm text-slate-400 text-center py-6">読み込み中...</p>
          : plans.length === 0 ? <p className="text-sm text-slate-400 text-center py-6">計画がありません</p>
          : plans.map(plan => {
            const days = getDaysLeft(plan.due_date);
            return (
              <div key={plan.id} className={`bg-white rounded-xl border p-3 shadow-sm ${days !== null && days < 0 ? 'border-red-200 bg-red-50' : 'border-slate-200'}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-800 leading-snug">{plan.evaluation_items?.item_name ?? '(不明)'}</p>
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      {plan.due_date && <span className="text-xs text-slate-500">期限: {plan.due_date}</span>}
                      {days !== null && <span className={`text-xs ${daysStyle(days)}`}>{daysLabel(days)}</span>}
                      {plan.planned_month && <span className="text-xs text-indigo-500">予定月: {plan.planned_month}</span>}
                      {plan.created_by && plan.created_by !== 'self' && <span className="text-xs text-slate-400">担当: {plan.created_by}</span>}
                    </div>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <button onClick={() => onAchievePlan(plan.id)} className="text-xs px-2 py-1 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">達成</button>
                    <button onClick={() => onDeletePlan(plan.id)} className="text-xs px-2 py-1 bg-white border border-slate-300 text-slate-500 rounded-lg hover:bg-red-50 hover:border-red-200 hover:text-red-500 transition-colors">削除</button>
                  </div>
                </div>
              </div>
            );
          })}
      </div>
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3">
        <h3 className="text-sm font-semibold text-slate-700">計画を追加</h3>
        <div>
          <label className="text-xs font-medium text-slate-500 block mb-1">項目を選択 *</label>
          <select value={planForm.item_id} onChange={e => setPlanForm(p => ({ ...p, item_id: e.target.value }))}
            className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300">
            <option value="">選択してください</option>
            {unachievedItems.map(i => (
              <option key={i.item_def_id} value={i.item_def_id}>#{i.item_no} {i.item_name}</option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">期限 *</label>
            <input type="date" value={planForm.due_date} onChange={e => setPlanForm(p => ({ ...p, due_date: e.target.value }))}
              className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">予定月</label>
            <input type="text" value={planForm.planned_month} onChange={e => setPlanForm(p => ({ ...p, planned_month: e.target.value }))}
              placeholder="2026/06"
              className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">開始日</label>
            <input type="date" value={planForm.start_date} onChange={e => setPlanForm(p => ({ ...p, start_date: e.target.value }))}
              className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">作成者</label>
            <input type="text" value={planForm.created_by} onChange={e => setPlanForm(p => ({ ...p, created_by: e.target.value }))}
              placeholder="self または担当者名"
              className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
          </div>
        </div>
        <button onClick={onAddPlan} disabled={savingPlan || !planForm.item_id || !planForm.due_date}
          className="w-full text-sm py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-40 font-medium">
          {savingPlan ? '保存中...' : '計画を追加'}
        </button>
      </div>
    </div>
  );
}

// ── ListPane ─────────────────────────────────────────────────────
function ListPane({
  loading, salarySummary, statusFilter, setStatusFilter,
  monthFilter, setMonthFilter, filteredItems, items,
  availableMonths, statusCounts, selectedUser, onItemClick, activeId,
}) {
  return (
    <div className="flex flex-col h-full">
      <div className="bg-white border-b border-slate-200 px-3 py-1.5 space-y-1 shrink-0">
        {!loading && salarySummary.total > 0 && (
          <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-2">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs font-semibold text-indigo-700">昇給項目の進捗</p>
              <p className="text-xs font-bold text-indigo-600">{salarySummary.done}/{salarySummary.total}件</p>
            </div>
            <div className="w-full bg-indigo-100 rounded-full h-1.5 mb-1">
              <div className="bg-indigo-500 h-1.5 rounded-full transition-all"
                style={{ width: `${salarySummary.total > 0 ? Math.round((salarySummary.done / salarySummary.total) * 100) : 0}%` }} />
            </div>
            <p className="text-xs text-indigo-400 text-right">
              {salarySummary.remaining > 0 ? `残り${salarySummary.remaining}件でランク卒業` : 'ランク卒業達成！'}
            </p>
          </div>
        )}
        <div className="flex flex-wrap gap-1">
          {FILTER_TABS.map(tab => (
            <button key={tab.value} onClick={() => setStatusFilter(tab.value)}
              className={`text-xs px-2 py-0.5 rounded-full font-medium transition-colors ${statusFilter === tab.value ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
              {tab.label}{tab.value !== 'all' && <span className="ml-1 opacity-70">({statusCounts[tab.value] ?? 0})</span>}
            </button>
          ))}
        </div>
        {availableMonths.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-1 border-t border-slate-100">
            <button onClick={() => setMonthFilter('all')} className={`text-xs px-2 py-0.5 rounded-full transition-colors ${monthFilter === 'all' ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>全月</button>
            {availableMonths.map(m => (
              <button key={m} onClick={() => setMonthFilter(m)} className={`text-xs px-2 py-0.5 rounded-full transition-colors ${monthFilter === m ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>{m}</button>
            ))}
          </div>
        )}
        <p className="text-xs text-slate-400">{selectedUser?.rank && `ランク「${selectedUser.rank}」 `}{filteredItems.length}件表示 / 全{items.length}件</p>
      </div>
      <div className="flex-1 overflow-y-auto">
        {loading ? <div className="text-center py-16 text-slate-400 text-sm">読み込み中...</div>
          : filteredItems.length === 0 ? <div className="text-center py-16 text-slate-400 text-sm">該当する項目がありません</div>
          : (
            <div className="divide-y divide-slate-100">
              {filteredItems.map(item => {
                const st = STATUS_MAP[item.status] ?? STATUS_MAP.pending;
                const evidences = item.evaluation_evidences ?? [];
                const isActive = item.id === activeId;
                return (
                  <div key={item.id} onClick={() => onItemClick(item)}
                    className={`px-4 py-3 cursor-pointer flex items-start gap-2 border-l-4 transition-colors ${st.border} ${isActive ? 'bg-indigo-50' : `${st.bg} hover:brightness-95`}`}>
                    <span className="text-xs text-slate-400 w-8 shrink-0 pt-0.5">#{item.item_no}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-800 leading-snug">{item.item_name}</p>
                      <div className="flex flex-wrap items-center gap-1.5 mt-1">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${st.badge}`}>{st.label}</span>
                        {item.achieved_month && <span className="text-xs text-slate-400">{item.achieved_month}</span>}
                        {item.memo && <span className="text-xs text-slate-400">📝</span>}
                        {evidences.length > 0 && <span className="text-xs text-slate-400">📎{evidences.length}</span>}
                      </div>
                    </div>
                    <span className="text-slate-300 text-xs pt-0.5">›</span>
                  </div>
                );
              })}
            </div>
          )}
      </div>
    </div>
  );
}

// ── TimelineGraph ────────────────────────────────────────────────
function TimelineGraph({ timelineData, selectedUser, items, currentMonthCount, statusCounts }) {
  return (
    <div className="flex-1 flex flex-col p-6 overflow-y-auto">
      <h2 className="text-lg font-semibold text-slate-700 mb-1">{selectedUser?.name} の月別クリア数</h2>
      <p className="text-xs text-slate-400 mb-5">項目を選択すると詳細が表示されます</p>
      {timelineData.length > 0 ? (
        <>
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm mb-5">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={timelineData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip formatter={v => [`${v}件`, 'クリア数']} />
                <Bar dataKey="count" radius={[6,6,0,0]}>
                  {timelineData.map((e,i) => <Cell key={i} fill={e.month === CURRENT_MONTH ? '#6366f1' : '#a5b4fc'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: '総クリア数', value: `${items.filter(i => i.status === 'completed').length}件` },
              { label: '今月クリア', value: `${currentMonthCount}件`, hi: currentMonthCount > 0 },
              { label: '取り組み中', value: `${statusCounts.in_progress ?? 0}件` },
            ].map(s => (
              <div key={s.label} className={`bg-white rounded-xl p-4 border text-center ${s.hi ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200'}`}>
                <p className="text-2xl font-bold text-slate-800">{s.value}</p>
                <p className="text-xs text-slate-500 mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-slate-400 text-sm">まだクリアした項目がありません</p>
        </div>
      )}
    </div>
  );
}

// ── ChartModal ───────────────────────────────────────────────────
function ChartModal({ onClose, timelineData, items, currentMonthCount, statusCounts, selectedUser }) {
  return (
    <div className="absolute inset-0 z-20 flex flex-col justify-end" style={{ background: 'rgba(0,0,0,0.45)' }}>
      <div className="bg-white rounded-t-2xl shadow-2xl flex flex-col" style={{ maxHeight: '72%' }}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 shrink-0">
          <span className="text-sm font-semibold text-slate-700">{selectedUser?.name} の月別クリア数</span>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-xl w-7 h-7 flex items-center justify-center">✕</button>
        </div>
        <div className="overflow-y-auto p-5">
          {timelineData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={timelineData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                  <Tooltip formatter={v => [`${v}件`, 'クリア数']} />
                  <Bar dataKey="count" radius={[4,4,0,0]}>
                    {timelineData.map((e,i) => <Cell key={i} fill={e.month === CURRENT_MONTH ? '#6366f1' : '#a5b4fc'} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div className="grid grid-cols-3 gap-3 mt-4">
                {[
                  { label: '総クリア数', value: `${items.filter(i => i.status === 'completed').length}件` },
                  { label: '今月クリア', value: `${currentMonthCount}件`, hi: currentMonthCount > 0 },
                  { label: '取り組み中', value: `${statusCounts.in_progress ?? 0}件` },
                ].map(s => (
                  <div key={s.label} className={`rounded-xl p-3 border text-center ${s.hi ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 bg-slate-50'}`}>
                    <p className="text-xl font-bold text-slate-800">{s.value}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="text-center text-slate-400 text-sm py-8">まだクリアした項目がありません</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── PersonalView (exported) ──────────────────────────────────────
export default function PersonalView({
  selectedUser, items, loading,
  filteredItems, statusCounts, availableMonths, salarySummary,
  statusFilter, setStatusFilter, monthFilter, setMonthFilter,
  selectedItem, setSelectedItem, mobileShowDetail, setMobileShowDetail,
  showPersonalChart, setShowPersonalChart, showPlanView, setShowPlanView,
  timelineData, currentMonthCount,
  plans, plansLoading, planForm, setPlanForm, savingPlan,
  onAddPlan, onAchievePlan, onDeletePlan,
  detailProps,
  ngModal, setNgModal, ngReasonText, setNgReasonText, onConfirmNgReason,
}) {
  const listPaneProps = {
    loading, salarySummary, statusFilter, setStatusFilter,
    monthFilter, setMonthFilter, filteredItems, items,
    availableMonths, statusCounts, selectedUser,
  };

  const planPanelProps = {
    plans, plansLoading, planForm, setPlanForm, savingPlan,
    onAddPlan, onAchievePlan, onDeletePlan,
    unachievedItems: items.filter(i => i.status !== 'completed' && i.item_def_id),
    selectedUser,
  };

  const chartProps = { timelineData, items, currentMonthCount, statusCounts, selectedUser };

  return (
    <>
      {/* PC: 2ペイン */}
      <div className="hidden md:grid flex-1 overflow-hidden" style={{ gridTemplateColumns: '380px 1fr' }}>
        <div className="bg-white border-r border-slate-200 overflow-hidden flex flex-col">
          <ListPane {...listPaneProps} onItemClick={setSelectedItem} activeId={selectedItem?.id} />
        </div>
        <div className="overflow-hidden flex flex-col bg-slate-50 relative">
          {selectedItem && detailProps && !showPlanView ? (
            <>
              <ItemDetail {...detailProps} onBack={null} />
              {showPersonalChart && <ChartModal {...chartProps} onClose={() => setShowPersonalChart(false)} />}
            </>
          ) : showPlanView ? (
            <PlanPanel {...planPanelProps} />
          ) : showPersonalChart ? (
            <TimelineGraph {...chartProps} />
          ) : (
            <div className="flex-1 flex items-center justify-center text-slate-300 text-sm">
              項目を選択するか 📊 バッジでクリア推移を表示
            </div>
          )}
        </div>
      </div>

      {/* モバイル */}
      <div className="md:hidden flex-1 overflow-hidden relative">
        <div className={`absolute inset-0 bg-white transition-transform duration-200 ${mobileShowDetail ? '-translate-x-full' : 'translate-x-0'}`}>
          <ListPane {...listPaneProps} onItemClick={item => { setSelectedItem(item); setMobileShowDetail(true); }} activeId={selectedItem?.id} />
        </div>
        <div className={`absolute inset-0 bg-slate-50 transition-transform duration-200 ${mobileShowDetail ? 'translate-x-0' : 'translate-x-full'} relative`}>
          {showPlanView ? (
            <PlanPanel {...planPanelProps} />
          ) : selectedItem && detailProps ? (
            <>
              <ItemDetail {...detailProps} onBack={() => setMobileShowDetail(false)} />
              {showPersonalChart && <ChartModal {...chartProps} onClose={() => setShowPersonalChart(false)} />}
            </>
          ) : <div className="flex items-center justify-center h-full text-slate-400 text-sm">← 項目を選択してください</div>}
        </div>
        {showPersonalChart && !mobileShowDetail && (
          <ChartModal {...chartProps} onClose={() => setShowPersonalChart(false)} />
        )}
      </div>

      {/* NGモーダル */}
      {ngModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="px-5 py-4 border-b border-slate-200">
              <h3 className="text-sm font-semibold text-slate-700">やり直し理由を入力</h3>
            </div>
            <div className="p-5">
              <textarea value={ngReasonText} onChange={e => setNgReasonText(e.target.value)}
                placeholder="やり直しの理由を入力（任意）..."
                rows={3} autoFocus
                className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-red-300" />
              <p className="text-xs text-slate-400 mt-1.5">空白のまま確定することもできます</p>
            </div>
            <div className="px-5 py-4 border-t border-slate-200 flex gap-2">
              <button onClick={onConfirmNgReason}
                className="flex-1 text-sm py-2 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors font-medium">
                やり直し確定
              </button>
              <button onClick={() => { setNgModal(null); setNgReasonText(''); }}
                className="text-sm px-4 py-2 bg-white border border-slate-300 text-slate-600 rounded-xl hover:bg-slate-50">
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
