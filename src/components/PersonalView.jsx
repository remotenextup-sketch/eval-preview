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

// ── QuestionAnswerCard ───────────────────────────────────────────
function QuestionAnswerCard({ q, onAnswer }) {
  const [showForm, setShowForm] = useState(false);
  const [answerText, setAnswerText] = useState('');
  const [answererName, setAnswererName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const isAnswered = q.status === 'answered';

  return (
    <div className={`rounded-xl border p-3 ${isAnswered ? 'bg-slate-100 border-slate-200' : 'bg-yellow-50 border-yellow-200'}`}>
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-1.5 flex-wrap">
          {q.evaluation_items?.item_name && (
            <span className="text-xs bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded">{q.evaluation_items.item_name}</span>
          )}
          {q.user_name && (
            <span className="text-xs text-slate-600 font-medium">{q.user_name}</span>
          )}
          <span className="text-xs text-slate-400">{new Date(q.created_at).toLocaleDateString('ja-JP')}</span>
        </div>
        <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium shrink-0 ${isAnswered ? 'bg-slate-300 text-slate-600' : 'bg-yellow-100 text-yellow-700'}`}>
          {isAnswered ? '回答済' : '未回答'}
        </span>
      </div>
      <p className="text-sm text-slate-800 mb-2">Q: {q.question}</p>
      {isAnswered ? (
        <div className="bg-white rounded-lg p-2.5 border border-green-200">
          <p className="text-xs text-green-700 font-medium">A（{q.answered_by}）</p>
          <p className="text-sm text-slate-700 mt-1 whitespace-pre-wrap">{q.answer}</p>
        </div>
      ) : !showForm ? (
        <button onClick={() => setShowForm(true)} className="text-xs text-indigo-600 hover:underline">回答する</button>
      ) : (
        <div className="space-y-1.5 mt-1">
          <input type="text" value={answererName} onChange={e => setAnswererName(e.target.value)}
            placeholder="回答者名..."
            className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-300" />
          <textarea value={answerText} onChange={e => setAnswerText(e.target.value)}
            placeholder="回答内容..." rows={2}
            className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white resize-none focus:outline-none focus:ring-1 focus:ring-indigo-300" />
          <div className="flex gap-1.5">
            <button onClick={async () => {
              if (!answerText.trim() || !answererName.trim()) return;
              setSubmitting(true);
              await onAnswer(q.id, answerText.trim(), answererName.trim());
              setSubmitting(false); setShowForm(false);
            }} disabled={submitting || !answerText.trim() || !answererName.trim()}
              className="text-xs px-2.5 py-1 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-40">
              {submitting ? '...' : '回答する'}
            </button>
            <button onClick={() => setShowForm(false)} className="text-xs px-2 py-1 bg-white border border-slate-200 text-slate-500 rounded-lg">キャンセル</button>
          </div>
        </div>
      )}
    </div>
  );
}

function MyQuestionsPanel() {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [rankFilter, setRankFilter] = useState('all');

  useEffect(() => {
    setLoading(true);
    supabase.from('item_questions')
      .select('*, evaluation_items(item_name, rank)')
      .order('created_at', { ascending: false })
      .then(({ data }) => { setQuestions(data || []); setLoading(false); });
  }, []);

  const handleAnswer = async (qId, answer, answeredBy) => {
    const { error } = await supabase.from('item_questions')
      .update({ answer, answered_by: answeredBy, status: 'answered' }).eq('id', qId);
    if (!error) setQuestions(prev => prev.map(q => q.id === qId ? { ...q, answer, answered_by: answeredBy, status: 'answered' } : q));
  };

  const ranks = Array.from(new Set(questions.map(q => q.evaluation_items?.rank).filter(Boolean))).sort();

  const filtered = questions.filter(q => {
    if (statusFilter === 'open' && q.status === 'answered') return false;
    if (statusFilter === 'answered' && q.status !== 'answered') return false;
    if (rankFilter !== 'all' && q.evaluation_items?.rank !== rankFilter) return false;
    return true;
  });

  const unansweredCount = questions.filter(q => q.status !== 'answered').length;

  return (
    <div className="flex-1 overflow-y-auto p-5 space-y-4">
      <div>
        <h2 className="text-base font-semibold text-slate-700">質問一覧</h2>
        <p className="text-xs text-slate-400 mt-0.5">未回答: {unansweredCount}件 / 全: {questions.length}件</p>
      </div>

      <div className="space-y-2">
        <div className="flex gap-1.5 flex-wrap">
          {[{ value: 'all', label: '全て' }, { value: 'open', label: '未回答のみ' }, { value: 'answered', label: '回答済みのみ' }].map(({ value, label }) => (
            <button key={value} onClick={() => setStatusFilter(value)}
              className={`text-xs px-3 py-1 rounded-full border transition-colors ${statusFilter === value ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'}`}>
              {label}
            </button>
          ))}
        </div>
        {ranks.length > 0 && (
          <div className="flex gap-1.5 flex-wrap">
            <button onClick={() => setRankFilter('all')}
              className={`text-xs px-3 py-1 rounded-full border transition-colors ${rankFilter === 'all' ? 'bg-violet-600 text-white border-violet-600' : 'bg-white text-slate-600 border-slate-200 hover:border-violet-300'}`}>
              全ランク
            </button>
            {ranks.map(r => (
              <button key={r} onClick={() => setRankFilter(r)}
                className={`text-xs px-3 py-1 rounded-full border transition-colors ${rankFilter === r ? 'bg-violet-600 text-white border-violet-600' : 'bg-white text-slate-600 border-slate-200 hover:border-violet-300'}`}>
                {r}
              </button>
            ))}
          </div>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-slate-400 text-center py-8">読み込み中...</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-8">質問がありません</p>
      ) : (
        <div className="space-y-2">
          {filtered.map(q => <QuestionAnswerCard key={q.id} q={q} onAnswer={handleAnswer} />)}
        </div>
      )}
    </div>
  );
}

// ── GanttPanel ───────────────────────────────────────────────────
const GANTT_MONTHS = (() => {
  const [y, m] = CURRENT_MONTH.split('/').map(Number);
  return Array.from({ length: 12 }, (_, i) => {
    const raw = m + i;
    const year = y + Math.floor((raw - 1) / 12);
    const month = ((raw - 1) % 12) + 1;
    return `${year}/${String(month).padStart(2, '0')}`;
  });
})();

// 月ごとの色（計画中セルに使用）
const MONTH_COLORS = {
  '01': '#bfdbfe', '02': '#a5f3fc', '03': '#ddd6fe', '04': '#fbcfe8',
  '05': '#fecdd3', '06': '#7dd3fc', '07': '#86efac', '08': '#fdba74',
  '09': '#fcd34d', '10': '#99f6e4', '11': '#e2e8f0', '12': '#c7d2fe',
};
const MONTH_COLORS_HOVER = {
  '01': '#93c5fd', '02': '#67e8f9', '03': '#c4b5fd', '04': '#f9a8d4',
  '05': '#fda4af', '06': '#38bdf8', '07': '#4ade80', '08': '#fb923c',
  '09': '#fbbf24', '10': '#2dd4bf', '11': '#94a3b8', '12': '#a5b4fc',
};

function GanttPanel({ items, plans, plansLoading, selectedUser, onCellClick }) {
  const planMap = {};
  for (const p of plans) {
    if (p.item_id && p.planned_month) {
      const key = `${p.item_id}/${p.planned_month}`;
      if (!planMap[key]) planMap[key] = p;
    }
  }

  const unachievedItems = items.filter(i => i.status !== 'completed');

  const getCellState = (item, month) => {
    if (!item.item_def_id) return 'empty';
    const plan = planMap[`${item.item_def_id}/${month}`];
    if (!plan) return 'empty';
    if (plan.status === 'achieved') return 'achieved';
    if (month <= CURRENT_MONTH) return 'overdue';
    return 'planned';
  };

  // 表示月の中で重複なく月番号を取得して凡例用に使う
  const legendMonths = [...new Set(GANTT_MONTHS.map(m => m.slice(5)))];

  if (plansLoading) {
    return <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">読み込み中...</div>;
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="px-4 py-2.5 border-b border-slate-200 bg-white shrink-0">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-slate-700">{selectedUser?.name} の目標管理</p>
            <p className="text-xs text-slate-400">セルをクリックして計画を登録・解除</p>
          </div>
          <div className="flex flex-col items-end gap-1">
            {/* ステータス凡例 */}
            <div className="flex items-center gap-2.5 text-xs text-slate-500">
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-green-500 inline-block opacity-80" />完了</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-red-400 inline-block" />期限切れ</span>
            </div>
            {/* 月別カラー凡例 */}
            <div className="flex items-center gap-1 flex-wrap justify-end">
              <span className="text-xs text-slate-400 mr-0.5">計画中:</span>
              {legendMonths.map(mm => (
                <span key={mm} className="flex items-center gap-0.5 text-xs text-slate-500">
                  <span
                    className="w-3 h-3 rounded-sm inline-block border border-white/50"
                    style={{ background: MONTH_COLORS[mm] }}
                  />
                  {parseInt(mm, 10)}月
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
      {unachievedItems.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">すべての項目が完了済みです</div>
      ) : (
        <div className="flex-1 overflow-auto">
          <table className="border-collapse" style={{ minWidth: 200 + GANTT_MONTHS.length * 56 }}>
            <thead className="sticky top-0 z-10 shadow-sm">
              <tr className="border-b border-slate-200">
                <th className="text-left text-xs font-medium text-slate-500 bg-white px-4 py-2 sticky left-0 z-20" style={{ width: 200, minWidth: 200 }}>項目</th>
                {GANTT_MONTHS.map(m => (
                  <th key={m} className={`text-center text-xs font-medium py-2 px-1 ${m === CURRENT_MONTH ? 'bg-indigo-50 text-indigo-600' : 'bg-white text-slate-500'}`} style={{ width: 56, minWidth: 56 }}>
                    <div>{m.slice(5)}月</div>
                    <div className="font-normal opacity-60">{m.slice(0, 4)}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {unachievedItems.map(item => (
                <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-2.5 text-xs text-slate-700 leading-snug bg-white sticky left-0 z-10 border-r border-slate-100" style={{ width: 200, minWidth: 200 }}>
                    <span className="text-slate-400 mr-1">#{item.item_no}</span>{item.item_name}
                  </td>
                  {GANTT_MONTHS.map(month => {
                    const isCurrent = month === CURRENT_MONTH;
                    const state = getCellState(item, month);
                    const plan = item.item_def_id ? planMap[`${item.item_def_id}/${month}`] : null;
                    const mm = month.slice(5); // '06' etc
                    let cellStyle = {};
                    let cellCls = '';
                    if (state === 'planned') {
                      cellStyle = { background: MONTH_COLORS[mm] };
                      cellCls = 'border border-white/40';
                    } else if (state === 'achieved') {
                      cellCls = 'bg-green-500 cursor-default opacity-80';
                    } else if (state === 'overdue') {
                      cellCls = 'bg-red-400 hover:bg-red-500';
                    } else {
                      cellCls = 'bg-slate-100 hover:bg-slate-200 border border-slate-200';
                    }
                    return (
                      <td key={month} className={`text-center py-2 px-1 ${isCurrent ? 'bg-indigo-50' : ''}`} style={{ width: 56, minWidth: 56 }}>
                        <button
                          onClick={() => state !== 'achieved' && onCellClick(item, month, plan ?? null)}
                          disabled={state === 'achieved'}
                          className={`w-8 h-8 rounded-lg transition-all ${cellCls}`}
                          style={cellStyle}
                          onMouseEnter={e => { if (state === 'planned') e.currentTarget.style.background = MONTH_COLORS_HOVER[mm]; }}
                          onMouseLeave={e => { if (state === 'planned') e.currentTarget.style.background = MONTH_COLORS[mm]; }}
                          title={state === 'achieved' ? '達成済み' : state === 'empty' ? '計画を登録' : '計画を解除'}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── PlanPanel ────────────────────────────────────────────────────
function PlanPanel({ plans, plansLoading, planForm, setPlanForm, savingPlan, onAddPlan, onAchievePlan, onDeletePlan, unachievedItems, selectedUser }) {
  const now = new Date();
  const getDaysLeft = (due) => due ? Math.ceil((new Date(due) - now) / 86400000) : null;
  const daysStyle = (d) => d === null ? '' : d < 0 ? 'text-red-500 font-semibold' : d <= 7 ? 'text-orange-500 font-semibold' : 'text-green-600';
  const daysLabel = (d) => d === null ? '' : d < 0 ? `${Math.abs(d)}日超過` : d === 0 ? '今日が期限' : `あと${d}日`;

  const cardBg = (d) => {
    if (d === null) return 'border-slate-200 bg-white';
    if (d < 0) return 'border-red-200 bg-red-50';
    if (d <= 7) return 'border-orange-200 bg-orange-50';
    return 'border-slate-200 bg-white';
  };

  return (
    <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-700">{selectedUser?.name} のクリア計画</h2>
          <p className="text-xs text-slate-400">期限を設定して項目クリアを管理します</p>
        </div>
        <span className="text-xs text-slate-400 bg-slate-100 px-2 py-1 rounded-full">{plans.length}件</span>
      </div>
      <div className="space-y-2">
        {plansLoading ? <p className="text-sm text-slate-400 text-center py-6">読み込み中...</p>
          : plans.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-sm text-slate-400">計画がありません</p>
              <p className="text-xs text-slate-300 mt-1">下のフォームから追加できます</p>
            </div>
          ) : plans.map(plan => {
            const days = getDaysLeft(plan.due_date);
            return (
              <div key={plan.id} className={`rounded-xl border p-3 shadow-sm ${cardBg(days)}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 leading-snug">{plan.evaluation_items?.item_name ?? '(不明)'}</p>
                    <div className="flex flex-wrap items-center gap-2 mt-1.5">
                      {plan.start_date && <span className="text-xs text-slate-400">開始: {plan.start_date}</span>}
                      {plan.due_date && <span className="text-xs text-slate-500">期限: {plan.due_date}</span>}
                      {days !== null && (
                        <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${
                          days < 0 ? 'bg-red-100 text-red-600' : days <= 7 ? 'bg-orange-100 text-orange-600' : 'bg-green-100 text-green-700'
                        }`}>{daysLabel(days)}</span>
                      )}
                      {plan.planned_month && <span className="text-xs text-indigo-500">予定月: {plan.planned_month}</span>}
                      {plan.created_by && <span className="text-xs text-slate-400">担当: {plan.created_by}</span>}
                    </div>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <button onClick={() => onAchievePlan(plan.id)} className="text-xs px-2 py-1 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">✓ 達成</button>
                    <button onClick={() => onDeletePlan(plan.id)} className="text-xs px-1.5 py-1 bg-white border border-slate-200 text-slate-400 rounded-lg hover:bg-red-50 hover:border-red-200 hover:text-red-500 transition-colors">🗑</button>
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
  kpiTarget, currentMonthCount,
}) {
  return (
    <div className="flex flex-col h-full">
      <div className="bg-white border-b border-slate-200 px-3 py-1.5 space-y-1 shrink-0">
        {!loading && kpiTarget && (
          <div className="bg-purple-50 border border-purple-100 rounded-lg p-2">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs font-semibold text-purple-700">今月の目標</p>
              <p className="text-xs font-bold text-purple-600">
                {currentMonthCount} / {kpiTarget.target_count}件
                <span className="ml-1 font-normal text-purple-400">
                  ({Math.round((currentMonthCount / kpiTarget.target_count) * 100)}%)
                </span>
              </p>
            </div>
            <div className="w-full bg-purple-100 rounded-full h-1.5 mb-1">
              <div
                className={`h-1.5 rounded-full transition-all ${
                  currentMonthCount >= kpiTarget.target_count * 1.2 ? 'bg-green-500' :
                  currentMonthCount <= kpiTarget.target_count * 0.8 ? 'bg-red-400' : 'bg-purple-500'
                }`}
                style={{ width: `${Math.min(100, Math.round((currentMonthCount / kpiTarget.target_count) * 100))}%` }}
              />
            </div>
            <div className="flex items-center justify-between">
              <p className="text-xs text-purple-400">
                {currentMonthCount >= kpiTarget.target_count
                  ? '今月の目標達成！'
                  : `目標まであと${kpiTarget.target_count - currentMonthCount}件`}
              </p>
              {salarySummary.remaining > 0 && (
                <p className="text-xs text-slate-400">ランクアップまで残り{salarySummary.remaining}件</p>
              )}
            </div>
            {kpiTarget.note && (
              <p className="text-xs text-slate-500 mt-1 italic border-t border-purple-100 pt-1">"{kpiTarget.note}"</p>
            )}
          </div>
        )}
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
  plans, plansLoading, onCellClick,
  detailProps,
  ngModal, setNgModal, ngReasonText, setNgReasonText, onConfirmNgReason,
  showQuestionsPanel, setShowQuestionsPanel,
  kpiTarget,
}) {
  const listPaneProps = {
    loading, salarySummary, statusFilter, setStatusFilter,
    monthFilter, setMonthFilter, filteredItems, items,
    availableMonths, statusCounts, selectedUser,
    kpiTarget, currentMonthCount,
  };

  const ganttPanelProps = {
    items, plans, plansLoading, selectedUser, onCellClick,
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
          {showQuestionsPanel ? (
            <MyQuestionsPanel selectedUser={selectedUser} />
          ) : selectedItem && detailProps && !showPlanView ? (
            <>
              <ItemDetail {...detailProps} onBack={null} />
              {showPersonalChart && <ChartModal {...chartProps} onClose={() => setShowPersonalChart(false)} />}
            </>
          ) : showPlanView ? (
            <GanttPanel {...ganttPanelProps} />
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
          {showQuestionsPanel ? (
            <MyQuestionsPanel selectedUser={selectedUser} />
          ) : showPlanView ? (
            <GanttPanel {...ganttPanelProps} />
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
