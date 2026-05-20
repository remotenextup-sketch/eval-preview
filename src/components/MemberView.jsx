import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { RANK_OPTIONS, EMPTY_MEMBER_FORM, DEFAULT_DEPARTMENTS } from '../constants';

const RANK_PERIOD_DEFS = [
  { label: 'オンボーディング', from: 'onboarding_at',  to: 'trainee_at'    },
  { label: 'トレーニー',       from: 'trainee_at',     to: 'partner_at'    },
  { label: 'パートナー',       from: 'partner_at',     to: 'leader_at'     },
  { label: 'リーダー',         from: 'leader_at',      to: 'specialist_at' },
  { label: 'スペシャリスト',   from: 'specialist_at',  to: 'director_at'   },
  { label: 'ディレクター',     from: 'director_at',    to: null            },
];

function formatYM(dateStr) {
  if (!dateStr) return '';
  return dateStr.slice(0, 7).replace('-', '/');
}

function calcDays(fromStr, toStr) {
  if (!fromStr || !toStr) return null;
  const diff = new Date(toStr) - new Date(fromStr);
  return Math.max(0, Math.floor(diff / 86400000));
}

function RankPeriods({ user }) {
  const periods = RANK_PERIOD_DEFS
    .map(def => {
      const fromDate = user[def.from];
      if (!fromDate) return null;
      const toDate = def.to ? user[def.to] : null;
      const days = toDate ? calcDays(fromDate, toDate) : null;
      const label = def.label;
      const fromYM = formatYM(fromDate);
      const toYM = toDate ? formatYM(toDate) : null;
      return { label, fromYM, toYM, days };
    })
    .filter(Boolean);

  if (!periods.length) return <p className="text-xs text-slate-400">期間データなし</p>;

  return (
    <div className="space-y-1">
      {periods.map(p => (
        <div key={p.label} className="flex items-baseline gap-1.5 text-xs">
          <span className="text-slate-500 font-medium w-24 shrink-0">{p.label}:</span>
          <span className="text-slate-700">
            {p.fromYM}〜{p.toYM ? p.toYM : '現在（継続中）'}
            {p.days != null && <span className="text-slate-400 ml-1">（{p.days}日）</span>}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function MembersView({ onUsersRefresh, availableRanks = RANK_OPTIONS }) {
  const [data, setData]               = useState([]);
  const [loading, setLoading]         = useState(false);
  const [showResigned, setShowResigned] = useState(false);
  const [rankFilter, setRankFilter]   = useState('all');
  const [deptFilter, setDeptFilter]   = useState('all');
  const [showAdd, setShowAdd]         = useState(false);
  const [addForm, setAddForm]         = useState(EMPTY_MEMBER_FORM);
  const [savingAdd, setSavingAdd]     = useState(false);
  const [retireTarget, setRetireTarget] = useState(null);
  const [retireDate, setRetireDate]   = useState('');
  const [retiring, setRetiring]       = useState(false);
  const [editTarget, setEditTarget]   = useState(null);
  const [editForm, setEditForm]       = useState({});
  const [savingEdit, setSavingEdit]   = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting]       = useState(false);
  const [toast, setToast]             = useState(null);
  const [customDept, setCustomDept]   = useState('');
  const [expandedIds, setExpandedIds] = useState(new Set());

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2000);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    const { data: rows, error } = await supabase
      .from('users')
      .select('id, name, email, rank, department, mall, onboarding_at, resigned_at, progress_name, birth_year, trainee_at, partner_at, leader_at, specialist_at, director_at')
      .neq('name', 'テンプレート')
      .order('name');
    if (error) console.error('メンバー取得エラー:', error);
    setData(rows || []);
    setLoading(false);
  };

  const handleAdd = async () => {
    if (!addForm.name.trim() || !addForm.rank) return;
    setSavingAdd(true);
    const { error } = await supabase.from('users').insert({
      name:          addForm.name.trim(),
      email:         addForm.email.trim() || null,
      rank:          addForm.rank,
      department:    addForm.department,
      mall:          addForm.mall.trim() || null,
      onboarding_at: addForm.onboarding_at || null,
      birth_year:    addForm.birth_year ? parseInt(addForm.birth_year) : null,
      is_anonymized: false,
    });
    if (error) {
      console.error('メンバー追加エラー:', error);
      setToast({ type: 'error', message: `登録に失敗しました：${error.message}` });
    } else {
      await fetchData();
      onUsersRefresh();
      setShowAdd(false);
      setAddForm(EMPTY_MEMBER_FORM);
      setCustomDept('');
      setToast({ type: 'success', message: '登録完了 ✓' });
    }
    setSavingAdd(false);
  };

  const handleRetire = async () => {
    if (!retireTarget || !retireDate) return;
    setRetiring(true);
    const { error } = await supabase.from('users').update({ resigned_at: retireDate }).eq('id', retireTarget.id);
    if (error) {
      console.error('退職処理エラー:', error);
    } else {
      await fetchData();
      onUsersRefresh();
      setRetireTarget(null);
      setRetireDate('');
    }
    setRetiring(false);
  };

  const handleEdit = async () => {
    if (!editTarget) return;
    setSavingEdit(true);
    const changes = {};
    if (editForm.rank) changes.rank = editForm.rank;
    if (editForm.department !== undefined) changes.department = editForm.department.trim() ? [editForm.department.trim()] : (editTarget.department || []);
    if (editForm.mall !== undefined) changes.mall = editForm.mall.trim() || null;
    if (editForm.birth_year !== undefined) changes.birth_year = editForm.birth_year ? parseInt(editForm.birth_year) : null;

    const { error } = await supabase.from('users').update(changes).eq('id', editTarget.id);
    if (error) {
      console.error('メンバー編集エラー:', error);
      setSavingEdit(false);
      return;
    }
    if (changes.rank && changes.rank !== editTarget.rank) {
      const progressName = editTarget.progress_name ?? editTarget.name;
      const [{ data: existing }, { data: newItems }] = await Promise.all([
        supabase.from('evaluation_progress').select('item_no').eq('user_name', progressName),
        supabase.from('evaluation_items').select('no').eq('rank', changes.rank).eq('status', 'active'),
      ]);
      const existingNos = new Set((existing || []).map(p => p.item_no));
      const toInsert = (newItems || [])
        .filter(item => item.no != null && !existingNos.has(item.no))
        .map(item => ({ user_name: progressName, item_no: item.no, status: 'pending', user_id: editTarget.id }));
      if (toInsert.length > 0) {
        const { error: insErr } = await supabase.from('evaluation_progress').insert(toInsert);
        if (insErr) console.error('進捗追加エラー:', insErr);
      }
    }
    await fetchData();
    onUsersRefresh();
    setEditTarget(null);
    setSavingEdit(false);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const progressName = deleteTarget.progress_name ?? deleteTarget.name;
    const { data: progressRows } = await supabase.from('evaluation_progress').select('id').eq('user_name', progressName);
    const progressIds = (progressRows || []).map(r => r.id);
    if (progressIds.length > 0) {
      await supabase.from('evaluation_evidences').delete().in('progress_id', progressIds);
      await supabase.from('evaluation_progress').delete().in('id', progressIds);
    }
    const { error } = await supabase.from('users').delete().eq('id', deleteTarget.id);
    if (error) {
      setToast({ type: 'error', message: `削除に失敗しました：${error.message}` });
    } else {
      await fetchData();
      onUsersRefresh();
      setToast({ type: 'success', message: '削除しました ✓' });
    }
    setDeleteTarget(null);
    setDeleting(false);
  };

  const depts = [...new Set(data.flatMap(u => u.department || []))].filter(Boolean).sort();
  const filtered = data
    .filter(u => showResigned ? !!u.resigned_at : !u.resigned_at)
    .filter(u => rankFilter === 'all' || u.rank === rankFilter)
    .filter(u => deptFilter === 'all' || (u.department || []).includes(deptFilter));

  return (
    <div className="flex-1 overflow-y-auto flex flex-col">
      {toast && (
        <div className={`fixed top-5 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl shadow-lg text-sm font-medium pointer-events-none ${toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
          {toast.message}
        </div>
      )}
      <div className="sticky top-0 bg-white border-b border-slate-200 px-5 py-3 z-10 flex flex-wrap items-center gap-2 shrink-0">
        <div className="flex rounded-lg border border-slate-200 overflow-hidden text-xs shrink-0">
          {[['active', '在籍中'], ['resigned', '退職済み']].map(([v, l]) => (
            <button key={v} onClick={() => setShowResigned(v === 'resigned')}
              className={`px-3 py-1.5 transition-colors ${(v === 'resigned') === showResigned ? 'bg-slate-700 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>
              {l}
            </button>
          ))}
        </div>
        <select value={rankFilter} onChange={e => setRankFilter(e.target.value)}
          className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none">
          <option value="all">ランク: 全て</option>
          {availableRanks.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        {depts.length > 0 && (
          <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)}
            className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none">
            <option value="all">部署: 全て</option>
            {depts.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        )}
        <span className="text-xs text-slate-400">{filtered.length}名</span>
        {!showResigned && (
          <button onClick={() => { setAddForm(EMPTY_MEMBER_FORM); setShowAdd(true); }}
            className="ml-auto text-xs px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium">
            ＋ メンバー追加
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">読み込み中...</div>
      ) : filtered.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">該当するメンバーがいません</div>
      ) : (
        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map(u => {
            const isResigned = !!u.resigned_at;
            const isExpanded = expandedIds.has(u.id);
            const toggleExpand = () => setExpandedIds(prev => {
              const next = new Set(prev);
              next.has(u.id) ? next.delete(u.id) : next.add(u.id);
              return next;
            });
            return (
              <div key={u.id} className={`bg-white rounded-2xl border shadow-sm flex flex-col transition-shadow ${isResigned ? 'opacity-60 border-slate-200' : 'border-slate-200 hover:shadow-md'}`}>
                <button onClick={toggleExpand} className="p-4 flex flex-col gap-2 text-left w-full">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">{u.name}</p>
                      {u.email && <p className="text-xs text-slate-400 mt-0.5 truncate">{u.email}</p>}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {isResigned && <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full whitespace-nowrap">退職済み</span>}
                      <span className="text-slate-300 text-xs">{isExpanded ? '▲' : '▼'}</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {u.rank && <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">{u.rank}</span>}
                    {(u.department || []).map(d => (
                      <span key={d} className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{d}</span>
                    ))}
                    {u.mall && <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">{u.mall}</span>}
                  </div>
                  {u.onboarding_at && <p className="text-xs text-slate-400">入社: {u.onboarding_at}</p>}
                  {isResigned && u.resigned_at && <p className="text-xs text-slate-400">退職: {u.resigned_at}</p>}
                </button>

                {isExpanded && (
                  <div className="px-4 pb-3 pt-1 border-t border-slate-100 bg-slate-50 rounded-b-2xl">
                    <p className="text-xs font-semibold text-slate-500 mb-2">ランク在籍期間</p>
                    <RankPeriods user={u} />
                    {u.birth_year && (
                      <p className="text-xs text-slate-400 mt-2">生年: {u.birth_year}年</p>
                    )}
                  </div>
                )}

                <div className="flex gap-1.5 px-4 pb-4 pt-2 border-t border-slate-100">
                  {!isResigned && (
                    <>
                      <button
                        onClick={() => { setEditTarget(u); setEditForm({ rank: u.rank || '', department: (u.department || []).join(', '), mall: u.mall || '', birth_year: u.birth_year ? String(u.birth_year) : '' }); }}
                        className="flex-1 text-xs py-1.5 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors">
                        編集
                      </button>
                      <button
                        onClick={() => { setRetireTarget(u); setRetireDate(''); }}
                        className="text-xs px-3 py-1.5 bg-white border border-orange-200 text-orange-500 rounded-lg hover:bg-orange-50 transition-colors">
                        退職
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => setDeleteTarget(u)}
                    className="text-xs px-2 py-1.5 bg-white border border-red-200 text-red-400 rounded-lg hover:bg-red-50 hover:text-red-600 transition-colors"
                    title="完全削除">
                    🗑
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showAdd && (
        <div className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between shrink-0">
              <h3 className="text-sm font-semibold text-slate-700">メンバー追加</h3>
              <button onClick={() => setShowAdd(false)} className="text-slate-400 hover:text-slate-700 text-xl leading-none">✕</button>
            </div>
            <div className="overflow-y-auto p-5 space-y-3 flex-1">
              {[
                { key: 'name',          label: '名前 *',       placeholder: '山田太郎',          type: 'text'   },
                { key: 'email',         label: 'メール',       placeholder: 'taro@example.com', type: 'email'  },
                { key: 'mall',          label: '担当モール',   placeholder: '楽天',             type: 'text'   },
                { key: 'onboarding_at', label: '入社日',       placeholder: '',                  type: 'date'   },
                { key: 'birth_year',    label: '生年（例：1990）', placeholder: '1990',          type: 'number' },
              ].map(f => (
                <div key={f.key}>
                  <label className="text-xs font-medium text-slate-500 block mb-1">{f.label}</label>
                  <input type={f.type} value={addForm[f.key]}
                    onChange={e => setAddForm(p => ({ ...p, [f.key]: e.target.value }))}
                    placeholder={f.placeholder}
                    className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                </div>
              ))}
              <div>
                <label className="text-xs font-medium text-slate-500 block mb-1.5">部署</label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {[...new Set([...DEFAULT_DEPARTMENTS, ...depts])].map(d => (
                    <button key={d} type="button"
                      onClick={() => setAddForm(p => ({ ...p, department: p.department.includes(d) ? p.department.filter(x => x !== d) : [...p.department, d] }))}
                      className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${addForm.department.includes(d) ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-300 hover:border-indigo-400'}`}>
                      {d}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input value={customDept} onChange={e => setCustomDept(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); const v = customDept.trim(); if (v && !addForm.department.includes(v)) setAddForm(p => ({ ...p, department: [...p.department, v] })); setCustomDept(''); } }}
                    placeholder="その他（自由入力）"
                    className="flex-1 text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                  <button type="button" onClick={() => { const v = customDept.trim(); if (v && !addForm.department.includes(v)) setAddForm(p => ({ ...p, department: [...p.department, v] })); setCustomDept(''); }}
                    className="text-xs px-3 py-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors">追加</button>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 block mb-1">ランク *</label>
                <select value={addForm.rank} onChange={e => setAddForm(p => ({ ...p, rank: e.target.value }))}
                  className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300">
                  <option value="">選択してください</option>
                  {availableRanks.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            </div>
            <div className="px-5 py-4 border-t border-slate-200 flex gap-2 shrink-0">
              <button onClick={handleAdd} disabled={savingAdd || !addForm.name.trim() || !addForm.rank}
                className="flex-1 text-sm py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-40 font-medium">
                {savingAdd ? '追加中...' : '追加する'}
              </button>
              <button onClick={() => setShowAdd(false)} className="text-sm px-4 py-2 bg-white border border-slate-300 text-slate-600 rounded-xl hover:bg-slate-50">キャンセル</button>
            </div>
          </div>
        </div>
      )}

      {retireTarget && (
        <div className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="px-5 py-4 border-b border-slate-200">
              <h3 className="text-sm font-semibold text-slate-700">退職処理: {retireTarget.name}</h3>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-500 block mb-1">退職日 *</label>
                <input type="date" value={retireDate} onChange={e => setRetireDate(e.target.value)}
                  className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
              </div>
              <p className="text-xs text-slate-400">退職後はヘッダーのユーザー選択から除外されます。</p>
            </div>
            <div className="px-5 py-4 border-t border-slate-200 flex gap-2">
              <button onClick={handleRetire} disabled={retiring || !retireDate}
                className="flex-1 text-sm py-2 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors disabled:opacity-40 font-medium">
                {retiring ? '処理中...' : '退職確定'}
              </button>
              <button onClick={() => setRetireTarget(null)} className="text-sm px-4 py-2 bg-white border border-slate-300 text-slate-600 rounded-xl hover:bg-slate-50">キャンセル</button>
            </div>
          </div>
        </div>
      )}

      {editTarget && (
        <div className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-700">編集: {editTarget.name}</h3>
              <button onClick={() => setEditTarget(null)} className="text-slate-400 hover:text-slate-700 text-xl leading-none">✕</button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-500 block mb-1">ランク</label>
                <select value={editForm.rank} onChange={e => setEditForm(p => ({ ...p, rank: e.target.value }))}
                  className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300">
                  <option value="">変更しない</option>
                  {availableRanks.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
                {editForm.rank && editForm.rank !== editTarget.rank && (
                  <p className="text-xs text-amber-600 mt-1">※ ランク変更後、新しいランクの評価項目が自動追加されます</p>
                )}
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 block mb-1">部署</label>
                <input type="text" value={editForm.department}
                  onChange={e => setEditForm(p => ({ ...p, department: e.target.value }))}
                  placeholder="ECチーム"
                  className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 block mb-1">担当モール</label>
                <input type="text" value={editForm.mall}
                  onChange={e => setEditForm(p => ({ ...p, mall: e.target.value }))}
                  placeholder="楽天"
                  className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 block mb-1">生年（例：1990）</label>
                <input type="number" value={editForm.birth_year ?? ''}
                  onChange={e => setEditForm(p => ({ ...p, birth_year: e.target.value }))}
                  placeholder="1990"
                  className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
              </div>
            </div>
            <div className="px-5 py-4 border-t border-slate-200 flex gap-2">
              <button onClick={handleEdit} disabled={savingEdit}
                className="flex-1 text-sm py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-40 font-medium">
                {savingEdit ? '保存中...' : '保存する'}
              </button>
              <button onClick={() => setEditTarget(null)} className="text-sm px-4 py-2 bg-white border border-slate-300 text-slate-600 rounded-xl hover:bg-slate-50">キャンセル</button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 bg-black/50 z-40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="px-5 py-4 border-b border-slate-200">
              <h3 className="text-sm font-semibold text-red-600">メンバー完全削除</h3>
            </div>
            <div className="p-5 space-y-3">
              <p className="text-sm text-slate-700">
                <span className="font-semibold">{deleteTarget.name}</span>さんのデータを完全に削除します。この操作は取り消せません。
              </p>
              <p className="text-xs text-slate-400">評価進捗・エビデンスも含めてすべて削除されます。</p>
            </div>
            <div className="px-5 py-4 border-t border-slate-200 flex gap-2">
              <button onClick={handleDelete} disabled={deleting}
                className="flex-1 text-sm py-2 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors disabled:opacity-40 font-medium">
                {deleting ? '削除中...' : '完全に削除する'}
              </button>
              <button onClick={() => setDeleteTarget(null)} className="text-sm px-4 py-2 bg-white border border-slate-300 text-slate-600 rounded-xl hover:bg-slate-50">キャンセル</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
