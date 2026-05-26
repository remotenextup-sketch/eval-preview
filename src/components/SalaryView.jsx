import React, { useState, useEffect, useRef } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { supabase } from './supabaseClient';
import { CURRENT_MONTH, RANK_SALARY, MASTER_PIN } from '../constants';

const FISCAL_YEARS = [
  { label: '全期間',   value: 'all'  },
  { label: '2024年度', value: '2024' },
  { label: '2025年度', value: '2025' },
  { label: '2026年度', value: '2026' },
];

function isInFiscalYear(month, fy) {
  if (fy === 'all') return true;
  const y = parseInt(fy);
  return month >= `${y}/04` && month <= `${y + 1}/03`;
}

function readAuth() {
  try { return JSON.parse(sessionStorage.getItem('salary_pin_auth')); } catch { return null; }
}

function saveAuth(auth) {
  sessionStorage.setItem('salary_pin_auth', JSON.stringify(auth));
}

function clearAuth() {
  sessionStorage.removeItem('salary_pin_auth');
}

export default function SalaryView({ users }) {
  // ── PIN認証 ──
  const [pinAuth, setPinAuth]       = useState(() => readAuth());
  const [pinUserId, setPinUserId]   = useState('');
  const [pinDigits, setPinDigits]   = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [pinMode, setPinMode]       = useState('auth'); // 'auth' | 'set'
  const [pinError, setPinError]     = useState('');
  const [pinLoading, setPinLoading] = useState(false);
  const pinInputRef                 = useRef(null);

  // ── 個人時給 ──
  const [salaryUser, setSalaryUser]         = useState(null);
  const [salaryHistory, setSalaryHistory]   = useState([]);
  const [completedByMonth, setCompletedByMonth] = useState({});
  const [salaryLoading, setSalaryLoading]   = useState(false);
  const [toggling, setToggling]             = useState(null);

  // ── ボーナス編集（個人ビュー） ──
  const [bonusEditing, setBonusEditing]     = useState({});
  const [savingBonusMonth, setSavingBonusMonth] = useState(null);

  // ── 管理者ビュー ──
  const [adminTab, setAdminTab]             = useState('list');
  const [allSalaryData, setAllSalaryData]   = useState([]);
  const [adminLoading, setAdminLoading]     = useState(false);
  const [adminMonth, setAdminMonth]         = useState(CURRENT_MONTH);
  const [bulkUsers, setBulkUsers]           = useState([]);
  const [bulkRate, setBulkRate]             = useState('');
  const [bulkNote, setBulkNote]             = useState('');
  const [bulkSaving, setBulkSaving]         = useState(false);
  const [salaryView, setSalaryView]         = useState(() => readAuth()?.type === 'admin' ? 'admin' : 'personal');
  const [graphFiscalYear, setGraphFiscalYear] = useState('all');

  // ── ボーナス編集（管理者ビュー） ──
  const [adminBonusEdit, setAdminBonusEdit] = useState({});
  const [savingAdminBonus, setSavingAdminBonus] = useState(null);

  const [addUsers, setAddUsers]             = useState([]);
  const [addAmount, setAddAmount]           = useState('');
  const [addMonth, setAddMonth]             = useState(() => {
    const [y, m] = CURRENT_MONTH.split('/').map(Number);
    const nm = m + 1;
    return `${nm > 12 ? y + 1 : y}/${String(nm > 12 ? nm - 12 : nm).padStart(2, '0')}`;
  });
  const [addNote, setAddNote]               = useState('');
  const [addConfirm, setAddConfirm]         = useState(false);
  const [addSaving, setAddSaving]           = useState(false);
  const [addToast, setAddToast]             = useState('');

  // モーダル表示時にPIN入力フォーカス
  useEffect(() => {
    if (!pinAuth) setTimeout(() => pinInputRef.current?.focus(), 100);
  }, [pinAuth, pinMode]);

  // 認証済みのユーザーに salaryUser をセット
  useEffect(() => {
    if (!users.length) return;
    if (pinAuth?.type === 'personal') {
      const u = users.find(u => u.id === pinAuth.userId);
      setSalaryUser(u ?? users[0]);
    } else if (pinAuth?.type === 'admin' && !salaryUser) {
      setSalaryUser(users[0]);
    }
  }, [pinAuth, users]);

  useEffect(() => {
    if (!salaryUser) return;
    setSalaryLoading(true);
    setBonusEditing({});
    const pName = salaryUser.progress_name ?? salaryUser.name;
    Promise.all([
      supabase.from('hourly_rate_history').select('*').eq('user_id', salaryUser.id).order('month'),
      supabase.from('evaluation_progress').select('achieved_month').eq('user_name', pName).eq('status', 'completed').not('achieved_month', 'is', null),
    ]).then(([hRes, pRes]) => {
      setSalaryHistory(hRes.data || []);
      const counts = {};
      (pRes.data || []).forEach(p => { if (/^\d{4}\/\d{2}$/.test(p.achieved_month)) counts[p.achieved_month] = (counts[p.achieved_month] || 0) + 1; });
      setCompletedByMonth(counts);
      setSalaryLoading(false);
    });
  }, [salaryUser]);

  useEffect(() => { if (salaryView === 'admin') loadAdminData(); }, [salaryView]);

  const loadAdminData = async () => {
    setAdminLoading(true);
    const { data } = await supabase.from('hourly_rate_history')
      .select('id, user_id, month, base_rate, item_bonus, bonus, bonus_note, total_rate, confirmed, note, users(name, rank, birth_year)')
      .order('month').limit(5000);
    setAllSalaryData(data || []);
    setAdminLoading(false);
  };

  // ── PIN認証ロジック ──
  const handlePinAuth = async () => {
    setPinError('');
    if (pinDigits === MASTER_PIN) {
      const auth = { type: 'admin' };
      saveAuth(auth);
      setPinAuth(auth);
      setSalaryView('admin');
      return;
    }
    if (!pinUserId) { setPinError('名前を選択してください'); return; }
    if (!/^\d{4}$/.test(pinDigits)) { setPinError('4桁の数字を入力してください'); return; }
    setPinLoading(true);
    const { data, error } = await supabase.from('users').select('pin_code').eq('id', pinUserId).single();
    if (error || !data) { setPinError('エラーが発生しました'); setPinLoading(false); return; }
    if (!data.pin_code) {
      setPinMode('set');
      setPinDigits('');
      setPinConfirm('');
      setPinLoading(false);
      return;
    }
    if (data.pin_code === pinDigits) {
      const auth = { type: 'personal', userId: pinUserId };
      saveAuth(auth);
      setPinAuth(auth);
    } else {
      setPinError('PINが正しくありません');
    }
    setPinLoading(false);
  };

  const handlePinSet = async () => {
    setPinError('');
    if (!/^\d{4}$/.test(pinDigits)) { setPinError('4桁の数字を入力してください'); return; }
    if (pinDigits !== pinConfirm) { setPinError('PINが一致しません'); return; }
    setPinLoading(true);
    const { error } = await supabase.from('users').update({ pin_code: pinDigits }).eq('id', pinUserId);
    if (error) { setPinError('PINの設定に失敗しました'); setPinLoading(false); return; }
    const auth = { type: 'personal', userId: pinUserId };
    saveAuth(auth);
    setPinAuth(auth);
    setPinLoading(false);
  };

  const handleLogout = () => {
    clearAuth();
    setPinAuth(null);
    setPinMode('auth');
    setPinDigits('');
    setPinConfirm('');
    setPinError('');
    setPinUserId('');
    setSalaryView('personal');
  };

  // ── 時給計算 ──
  const getRankInfo = (rank) => RANK_SALARY[rank] ?? { base: 1163, bonus: 0 };
  const calcMonth = (month, user) => {
    const { base, bonus } = getRankInfo(user?.rank ?? '');
    const count = completedByMonth[month] || 0;
    return { base_rate: base, item_bonus: bonus * count, total: base + bonus * count };
  };

  const toggleConfirm = async (month) => {
    if (!salaryUser || toggling) return;
    setToggling(month);
    const existing = salaryHistory.find(h => h.month === month);
    if (existing) {
      const newConfirmed = !existing.confirmed;
      await supabase.from('hourly_rate_history').update({ confirmed: newConfirmed }).eq('id', existing.id);
      setSalaryHistory(prev => prev.map(h => h.month === month ? { ...h, confirmed: newConfirmed } : h));
    } else {
      const { base_rate, item_bonus } = calcMonth(month, salaryUser);
      const { data } = await supabase.from('hourly_rate_history')
        .insert({ user_id: salaryUser.id, month, base_rate, item_bonus, confirmed: true })
        .select().single();
      if (data) setSalaryHistory(prev => [...prev, data].sort((a, b) => a.month.localeCompare(b.month)));
    }
    setToggling(null);
  };

  const calcAndSave = async () => {
    if (!salaryUser || toggling) return;
    setToggling(CURRENT_MONTH);
    const { base_rate, item_bonus } = calcMonth(CURRENT_MONTH, salaryUser);
    await supabase.from('hourly_rate_history').upsert(
      { user_id: salaryUser.id, month: CURRENT_MONTH, base_rate, item_bonus, confirmed: false },
      { onConflict: 'user_id,month' }
    );
    const { data } = await supabase.from('hourly_rate_history').select('*').eq('user_id', salaryUser.id).order('month');
    setSalaryHistory(data || []);
    setToggling(null);
  };

  // ── ボーナス保存（個人ビュー） ──
  const saveBonus = async (month) => {
    if (!salaryUser || savingBonusMonth) return;
    const hist = salaryHistory.find(h => h.month === month);
    const edit = bonusEditing[month] ?? {};
    const bonus = edit.bonus !== undefined ? (parseInt(edit.bonus) || 0) : (hist?.bonus ?? 0);
    const bonus_note = edit.bonus_note !== undefined ? (edit.bonus_note.trim() || null) : (hist?.bonus_note ?? null);

    // 変化なしはスキップ
    if (hist && bonus === (hist.bonus ?? 0) && bonus_note === (hist.bonus_note ?? null)) return;

    setSavingBonusMonth(month);
    if (hist) {
      const { data } = await supabase.from('hourly_rate_history')
        .update({ bonus, bonus_note })
        .eq('id', hist.id)
        .select().single();
      if (data) setSalaryHistory(prev => prev.map(h => h.id === hist.id ? data : h));
    } else {
      const { base_rate, item_bonus } = calcMonth(month, salaryUser);
      const { data } = await supabase.from('hourly_rate_history')
        .insert({ user_id: salaryUser.id, month, base_rate, item_bonus, bonus, bonus_note, confirmed: false })
        .select().single();
      if (data) setSalaryHistory(prev => [...prev, data].sort((a, b) => a.month.localeCompare(b.month)));
    }
    setSavingBonusMonth(null);
  };

  // ── ボーナス保存（管理者ビュー） ──
  const saveAdminBonus = async (row) => {
    const edit = adminBonusEdit[row.id];
    if (!edit || savingAdminBonus === row.id) return;
    setSavingAdminBonus(row.id);
    const bonus = edit.bonus !== undefined ? (parseInt(edit.bonus) || 0) : (row.bonus ?? 0);
    const bonus_note = edit.bonus_note !== undefined ? (edit.bonus_note.trim() || null) : (row.bonus_note ?? null);
    const { data } = await supabase.from('hourly_rate_history')
      .update({ bonus, bonus_note })
      .eq('id', row.id)
      .select('id, bonus, bonus_note, total_rate').single();
    if (data) setAllSalaryData(prev => prev.map(d => d.id === row.id ? { ...d, ...data } : d));
    setSavingAdminBonus(null);
  };

  const handleBulkUpdate = async () => {
    if (!bulkUsers.length || !bulkRate) return;
    setBulkSaving(true);
    for (const uid of bulkUsers) {
      await supabase.from('hourly_rate_history').upsert(
        { user_id: uid, month: adminMonth, base_rate: parseInt(bulkRate), item_bonus: 0, confirmed: false, note: bulkNote || null },
        { onConflict: 'user_id,month' }
      );
    }
    await loadAdminData();
    setBulkUsers([]); setBulkRate(''); setBulkNote('');
    setBulkSaving(false);
  };

  const handleAddAmount = async () => {
    if (!addAmount || !addUsers.length) return;
    setAddSaving(true);
    const amount = parseInt(addAmount);
    let successCount = 0;
    for (const uid of addUsers) {
      const user = users.find(u => u.id === uid);
      const { data: existing } = await supabase.from('hourly_rate_history')
        .select('id, base_rate').eq('user_id', uid).eq('month', addMonth).maybeSingle();
      if (existing) {
        const { error } = await supabase.from('hourly_rate_history')
          .update({ base_rate: existing.base_rate + amount, note: addNote || existing.note })
          .eq('id', existing.id);
        if (!error) successCount++;
      } else {
        const { data: recent } = await supabase.from('hourly_rate_history')
          .select('base_rate').eq('user_id', uid).order('month', { ascending: false }).limit(1).maybeSingle();
        const baseRate = recent?.base_rate ?? getRankInfo(user?.rank ?? '').base;
        const { error } = await supabase.from('hourly_rate_history').insert({
          user_id: uid, month: addMonth, base_rate: baseRate + amount, item_bonus: 0,
          confirmed: false, note: addNote || null,
        });
        if (!error) successCount++;
      }
    }
    await loadAdminData();
    setAddSaving(false);
    setAddConfirm(false);
    setAddToast(`${successCount}名に${amount}円加算しました`);
    setTimeout(() => setAddToast(''), 3000);
  };

  const exportCsv = () => {
    const rows = [
      ['名前','月','基本時給','項目ボーナス','ボーナス','合計'],
      ...allSalaryData.filter(d => d.month === adminMonth).map(d => [
        d.users?.name ?? d.user_id, d.month,
        d.base_rate, d.item_bonus ?? 0,
        d.bonus ?? 0,
        d.total_rate ?? (d.base_rate + (d.item_bonus ?? 0) + (d.bonus ?? 0)),
      ])
    ];
    const blob = new Blob(['﻿' + rows.map(r => r.join(',')).join('\n')], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `salary_${adminMonth.replace('/', '-')}.csv`; a.click();
    URL.revokeObjectURL(a.href);
  };

  // グラフ集計
  const filteredSalaryData = allSalaryData.filter(d => isInFiscalYear(d.month, graphFiscalYear));
  const userLatestInPeriod = (() => {
    const map = {};
    filteredSalaryData.forEach(d => {
      if (!map[d.user_id] || d.month > map[d.user_id].month) map[d.user_id] = d;
    });
    return Object.values(map);
  })();

  const rankData = (() => {
    const rankGroups = {};
    userLatestInPeriod.forEach(d => {
      const rank = d.users?.rank;
      if (!rank) return;
      const total = d.total_rate ?? (d.base_rate + (d.item_bonus ?? 0) + (d.bonus ?? 0));
      if (!rankGroups[rank]) rankGroups[rank] = [];
      rankGroups[rank].push(total);
    });
    return Object.entries(rankGroups).map(([rank, vals]) => ({
      rank,
      avg: Math.round(vals.reduce((a, b) => a + b, 0) / vals.length),
      max: Math.max(...vals),
      min: Math.min(...vals),
      count: vals.length,
    }));
  })();

  const ageData = (() => {
    const currentYear = new Date().getFullYear();
    const groups = { '20代': [], '30代': [], '40代': [], '50代以上': [], '不明': [] };
    userLatestInPeriod.forEach(d => {
      const birthYear = d.users?.birth_year;
      const total = d.total_rate ?? (d.base_rate + (d.item_bonus ?? 0) + (d.bonus ?? 0));
      if (!birthYear) { groups['不明'].push(total); return; }
      const age = currentYear - birthYear;
      if (age >= 50) groups['50代以上'].push(total);
      else if (age >= 40) groups['40代'].push(total);
      else if (age >= 30) groups['30代'].push(total);
      else if (age >= 20) groups['20代'].push(total);
      else groups['不明'].push(total);
    });
    return Object.entries(groups)
      .map(([label, vals]) => vals.length ? ({
        label,
        avg: Math.round(vals.reduce((a, b) => a + b, 0) / vals.length),
        count: vals.length,
      }) : null)
      .filter(Boolean);
  })();

  const allMonths = [...new Set([...Object.keys(completedByMonth), ...salaryHistory.map(h => h.month), CURRENT_MONTH])].sort();
  const chartData = allMonths.map(month => {
    const hist = salaryHistory.find(h => h.month === month);
    return {
      month,
      total: hist
        ? (hist.total_rate ?? hist.base_rate + (hist.item_bonus ?? 0) + (hist.bonus ?? 0))
        : calcMonth(month, salaryUser).total,
      confirmed: hist?.confirmed ?? false,
    };
  });
  const adminMonths = [...new Set([CURRENT_MONTH, ...allSalaryData.map(d => d.month)])].sort().reverse();
  const adminMonthData = allSalaryData.filter(d => d.month === adminMonth);
  const isAdmin = pinAuth?.type === 'admin';

  return (
    <div className="flex-1 flex flex-col overflow-hidden">

      {/* ── PIN認証モーダル ── */}
      {!pinAuth && (
        <div className="fixed inset-0 bg-slate-900/80 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-5">
            <div>
              <h2 className="text-base font-bold text-slate-800">
                {pinMode === 'set' ? 'PINを設定する' : '時給を確認する'}
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                {pinMode === 'set'
                  ? 'PINが未設定です。4桁の数字で新しいPINを設定してください。'
                  : '名前とPINを入力してください。'}
              </p>
            </div>

            {pinMode === 'auth' && (
              <div>
                <label className="text-xs font-medium text-slate-500 block mb-1">名前</label>
                <select
                  value={pinUserId}
                  onChange={e => setPinUserId(e.target.value)}
                  className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
                >
                  <option value="">選択してください</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
            )}

            <div>
              <label className="text-xs font-medium text-slate-500 block mb-1">
                {pinMode === 'set' ? '新しいPIN（4桁数字）' : 'PIN（4桁）'}
              </label>
              <input
                ref={pinInputRef}
                type="password"
                autoComplete="off"
                value={pinDigits}
                onChange={e => setPinDigits(e.target.value.replace(/\D/g, '').slice(0, 4))}
                onKeyDown={e => e.key === 'Enter' && (pinMode === 'auth' ? handlePinAuth() : handlePinSet())}
                inputMode="numeric"
                placeholder="••••"
                className="w-full text-center text-2xl tracking-[0.6em] border-2 border-slate-200 rounded-xl px-3 py-3 focus:outline-none focus:border-indigo-400 bg-slate-50 font-mono"
              />
              {pinMode === 'auth' && (
                <p className="text-xs text-slate-400 mt-1.5 text-center">管理者の方は管理者用PINを入力してください</p>
              )}
            </div>

            {pinMode === 'set' && (
              <div>
                <label className="text-xs font-medium text-slate-500 block mb-1">PINの確認</label>
                <input
                  type="password"
                  value={pinConfirm}
                  onChange={e => setPinConfirm(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  onKeyDown={e => e.key === 'Enter' && handlePinSet()}
                  inputMode="numeric"
                  placeholder="••••"
                  className="w-full text-center text-2xl tracking-[0.6em] border-2 border-slate-200 rounded-xl px-3 py-3 focus:outline-none focus:border-indigo-400 bg-slate-50 font-mono"
                />
              </div>
            )}

            {pinError && (
              <p className="text-xs text-red-500 text-center bg-red-50 rounded-lg py-2 px-3">{pinError}</p>
            )}

            <button
              onClick={pinMode === 'auth' ? handlePinAuth : handlePinSet}
              className={`w-full text-sm py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors font-medium ${
                pinLoading || pinDigits.length < 4 || (pinMode === 'set' && pinConfirm.length < 4)
                  ? 'opacity-40 cursor-not-allowed'
                  : ''
              }`}
            >
              {pinLoading
                ? '確認中...'
                : pinMode === 'auth'
                  ? '確認する'
                  : 'PINを設定して認証'}
            </button>

            {pinMode === 'set' && (
              <button
                onClick={() => { setPinMode('auth'); setPinDigits(''); setPinConfirm(''); setPinError(''); }}
                className="w-full text-xs text-slate-400 hover:text-slate-600"
              >
                ← 戻る
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── コンテンツ（認証済みのみ表示） ── */}
      {pinAuth && (
        <>
          {/* タブ切り替え＋ログアウト */}
          <div className="bg-white border-b border-slate-200 px-4 py-2 flex items-center gap-2 shrink-0">
            {isAdmin && (
              <div className="flex rounded-lg border border-slate-200 overflow-hidden text-xs">
                {[['personal','個人時給'],['admin','管理者ビュー']].map(([v,l]) => (
                  <button key={v} onClick={() => setSalaryView(v)}
                    className={`px-3 py-1.5 transition-colors ${salaryView === v ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>
                    {l}
                  </button>
                ))}
              </div>
            )}
            {!isAdmin && (
              <span className="text-xs text-slate-600 font-medium">
                個人時給 — <span className="text-indigo-600">{users.find(u => u.id === pinAuth.userId)?.name ?? ''}</span>
              </span>
            )}
            <div className="flex-1" />
            <button
              onClick={handleLogout}
              className="text-xs text-slate-400 hover:text-slate-600 px-2 py-1 rounded hover:bg-slate-100 transition-colors"
            >
              ログアウト
            </button>
          </div>

          {/* 個人時給ビュー */}
          {salaryView === 'personal' && (
            <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
              <div className="md:w-80 lg:w-96 shrink-0 bg-white border-r border-slate-200 flex flex-col overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-200 space-y-2 shrink-0">
                  {isAdmin ? (
                    <>
                      <label className="text-xs font-medium text-slate-500 block">メンバーを選択</label>
                      <select value={salaryUser?.id ?? ''} onChange={e => setSalaryUser(users.find(u => u.id === e.target.value) ?? null)}
                        className="w-full text-sm border border-slate-300 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400">
                        {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                      </select>
                    </>
                  ) : (
                    <p className="text-sm font-semibold text-slate-700">{salaryUser?.name}</p>
                  )}
                  {salaryUser?.rank && (
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-medium">{salaryUser.rank}</span>
                      {(() => {
                        const { base, bonus } = getRankInfo(salaryUser.rank);
                        return <span className="text-xs text-slate-500">基本 {base.toLocaleString()}円{bonus > 0 ? ` + ${bonus}円/件` : ''}</span>;
                      })()}
                    </div>
                  )}
                </div>

                <div className="flex-1 overflow-y-auto">
                  {salaryLoading ? (
                    <div className="text-center py-12 text-slate-400 text-sm">読み込み中...</div>
                  ) : allMonths.length === 0 ? (
                    <div className="text-center py-12 text-slate-400 text-sm">データなし</div>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {[...allMonths].reverse().map(month => {
                        const hist = salaryHistory.find(h => h.month === month);
                        const calc = calcMonth(month, salaryUser);
                        const base = hist?.base_rate ?? calc.base_rate;
                        const bonusVal = hist?.item_bonus ?? calc.item_bonus;
                        const bonusExtra = hist?.bonus ?? 0;
                        const total = hist
                          ? (hist.total_rate ?? (base + bonusVal + bonusExtra))
                          : calc.total;
                        const isConfirmed = hist?.confirmed ?? false;
                        const isCurrent = month === CURRENT_MONTH;
                        return (
                          <div key={month} className={`px-4 py-3 ${!isConfirmed ? 'bg-yellow-50' : ''}`}>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm font-medium text-slate-700">
                                {month}{isCurrent && <span className="ml-1 text-xs text-indigo-500 font-normal">今月</span>}
                              </span>
                              <button
                                onClick={() => toggleConfirm(month)}
                                disabled={toggling === month}
                                className={`text-xs px-2.5 py-1 rounded-lg border transition-colors font-medium ${
                                  toggling === month ? 'opacity-40 cursor-not-allowed bg-slate-100 text-slate-400 border-slate-200' :
                                  isConfirmed
                                    ? 'bg-green-50 text-green-700 border-green-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200'
                                    : 'bg-white text-slate-600 border-slate-300 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-300'
                                }`}
                              >
                                {toggling === month ? '...' : isConfirmed ? '✓ 確定済み' : '− 未確定'}
                              </button>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap mb-2">
                              <span>{base.toLocaleString()}円</span>
                              {bonusVal > 0 && <span className="text-green-600">+{bonusVal.toLocaleString()}円</span>}
                              {bonusExtra > 0 && <span className="text-purple-600">ボーナス+{bonusExtra.toLocaleString()}円</span>}
                              <span className="font-semibold text-slate-700 text-sm">{total.toLocaleString()}円</span>
                            </div>
                            {/* ボーナス入力 */}
                            <div className="space-y-1.5">
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-slate-400 w-12 shrink-0">ボーナス</span>
                                <input
                                  type="number"
                                  value={bonusEditing[month]?.bonus ?? (bonusExtra || '')}
                                  onChange={e => setBonusEditing(prev => ({ ...prev, [month]: { ...prev[month], bonus: e.target.value } }))}
                                  onBlur={() => saveBonus(month)}
                                  onKeyDown={e => e.key === 'Enter' && e.target.blur()}
                                  placeholder="0"
                                  className="w-24 text-xs border border-slate-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-purple-300"
                                />
                                <span className="text-xs text-slate-400">円</span>
                                {savingBonusMonth === month && <span className="text-xs text-slate-300">保存中</span>}
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-slate-400 w-12 shrink-0">備考</span>
                                <input
                                  type="text"
                                  value={bonusEditing[month]?.bonus_note ?? (hist?.bonus_note ?? '')}
                                  onChange={e => setBonusEditing(prev => ({ ...prev, [month]: { ...prev[month], bonus_note: e.target.value } }))}
                                  onBlur={() => saveBonus(month)}
                                  onKeyDown={e => e.key === 'Enter' && e.target.blur()}
                                  placeholder="備考"
                                  className="flex-1 text-xs border border-slate-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-purple-300"
                                />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto bg-slate-50 p-5 space-y-5">
                {salaryUser && (() => {
                  const { base, bonus } = getRankInfo(salaryUser.rank ?? '');
                  const curCalc = calcMonth(CURRENT_MONTH, salaryUser);
                  const curCount = completedByMonth[CURRENT_MONTH] ?? 0;
                  const curHist = salaryHistory.find(h => h.month === CURRENT_MONTH);
                  const curBonus = curHist?.bonus ?? 0;
                  return (
                    <>
                      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">今月 ({CURRENT_MONTH}) の時給</p>
                        <div className="flex flex-wrap gap-3 mb-4">
                          {[
                            { label: '基本時給', value: `${base.toLocaleString()}円` },
                            { label: '今月クリア', value: `${curCount}件`, hi: curCount > 0 },
                            { label: '項目ボーナス', value: `${(bonus * curCount).toLocaleString()}円`, hi: bonus * curCount > 0 },
                            { label: 'ボーナス', value: `${curBonus.toLocaleString()}円`, hi: curBonus > 0, purple: true },
                            { label: '推定時給', value: `${(curCalc.total + curBonus).toLocaleString()}円`, bold: true },
                          ].map(s => (
                            <div key={s.label} className={`rounded-xl px-4 py-3 text-center border flex-1 min-w-[80px] ${s.bold ? 'bg-indigo-50 border-indigo-200' : s.purple ? 'bg-purple-50 border-purple-100' : s.hi ? 'bg-green-50 border-green-100' : 'bg-slate-50 border-slate-100'}`}>
                              <p className={`text-lg font-bold ${s.bold ? 'text-indigo-700' : s.purple ? 'text-purple-700' : 'text-slate-800'}`}>{s.value}</p>
                              <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
                            </div>
                          ))}
                        </div>
                        <button onClick={calcAndSave} disabled={!!toggling}
                          className="w-full text-sm py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-40 font-medium">
                          {toggling === CURRENT_MONTH ? '保存中...' : '今月の時給を計算して保存'}
                        </button>
                      </div>

                      {chartData.length > 0 && (
                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">時給推移</p>
                          <ResponsiveContainer width="100%" height={200}>
                            <LineChart data={chartData} margin={{ top: 4, right: 16, left: -16, bottom: 0 }}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                              <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                              <YAxis tick={{ fontSize: 10 }} domain={['auto', 'auto']} />
                              <Tooltip formatter={v => [`${Number(v).toLocaleString()}円`, '時給']} />
                              <Line type="monotone" dataKey="total" stroke="#6366f1" strokeWidth={2.5}
                                dot={({ cx, cy, payload, index }) => (
                                  <circle key={index} cx={cx} cy={cy} r={5}
                                    fill={payload.confirmed ? '#6366f1' : '#fff'}
                                    stroke="#6366f1" strokeWidth={2} />
                                )} />
                            </LineChart>
                          </ResponsiveContainer>
                          <p className="text-xs text-slate-400 mt-1.5">塗りつぶし ◆ 確定済み　白抜き ◇ 未確定</p>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            </div>
          )}

          {/* 管理者ビュー */}
          {salaryView === 'admin' && isAdmin && (
            <div className="flex-1 overflow-y-auto bg-slate-50 p-5">
              <div className="space-y-6 max-w-5xl mx-auto">

                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="flex items-center border-b border-slate-200 px-4">
                    {[['list','一覧'],['bulk','一括更新'],['add','加算']].map(([v,l]) => (
                      <button key={v} onClick={() => setAdminTab(v)}
                        className={`text-sm px-4 py-3 font-medium transition-colors border-b-2 ${adminTab === v ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
                        {l}
                      </button>
                    ))}
                    <div className="flex-1" />
                    <div className="flex items-center gap-2 py-2">
                      <label className="text-xs text-slate-500">月</label>
                      <select value={adminMonth} onChange={e => setAdminMonth(e.target.value)}
                        className="text-xs border border-slate-300 rounded px-2 py-1 bg-white focus:outline-none">
                        {adminMonths.map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                      <button onClick={exportCsv}
                        className="text-xs px-3 py-1.5 bg-slate-700 text-white rounded-lg hover:bg-slate-800 transition-colors">
                        CSVエクスポート
                      </button>
                    </div>
                  </div>

                  {adminTab === 'list' && (
                    <div className="overflow-x-auto">
                      {adminLoading ? <p className="text-sm text-slate-400 text-center py-8">読み込み中...</p> : (
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b border-slate-200 bg-slate-50">
                              {['名前','ランク','基本時給','項目B','ボーナス','合計','確定','メモ'].map(h => (
                                <th key={h} className={`py-2.5 px-3 text-slate-500 font-medium ${['基本時給','項目B','合計'].includes(h) ? 'text-right' : h === '確定' ? 'text-center' : 'text-left'}`}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {adminMonthData.length === 0 ? (
                              <tr><td colSpan={8} className="text-center py-8 text-slate-400">この月のデータがありません</td></tr>
                            ) : adminMonthData.map(d => (
                              <tr key={d.id} className={`border-b border-slate-100 ${!d.confirmed ? 'bg-yellow-50' : ''}`}>
                                <td className="py-2 px-3 font-medium text-slate-700">{d.users?.name ?? '−'}</td>
                                <td className="py-2 px-3 text-slate-500">{d.users?.rank ?? '−'}</td>
                                <td className="py-2 px-3 text-right">{(d.base_rate ?? 0).toLocaleString()}円</td>
                                <td className="py-2 px-3 text-right text-green-600">+{d.item_bonus ?? 0}円</td>
                                <td className="py-2 px-3">
                                  <div className="flex flex-col gap-1">
                                    <div className="flex items-center gap-1">
                                      <input
                                        type="number"
                                        value={adminBonusEdit[d.id]?.bonus ?? (d.bonus || '')}
                                        onChange={e => setAdminBonusEdit(prev => ({ ...prev, [d.id]: { ...prev[d.id], bonus: e.target.value } }))}
                                        onBlur={() => saveAdminBonus(d)}
                                        onKeyDown={e => e.key === 'Enter' && e.target.blur()}
                                        placeholder="0"
                                        className="w-20 text-xs border border-slate-200 rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-purple-300"
                                      />
                                      <span className="text-slate-400">円</span>
                                      {savingAdminBonus === d.id && <span className="text-slate-300 text-xs">...</span>}
                                    </div>
                                    <input
                                      type="text"
                                      value={adminBonusEdit[d.id]?.bonus_note ?? (d.bonus_note ?? '')}
                                      onChange={e => setAdminBonusEdit(prev => ({ ...prev, [d.id]: { ...prev[d.id], bonus_note: e.target.value } }))}
                                      onBlur={() => saveAdminBonus(d)}
                                      onKeyDown={e => e.key === 'Enter' && e.target.blur()}
                                      placeholder="備考"
                                      className="w-28 text-xs border border-slate-200 rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-purple-300"
                                    />
                                  </div>
                                </td>
                                <td className="py-2 px-3 text-right font-semibold">
                                  {(d.total_rate ?? (d.base_rate ?? 0) + (d.item_bonus ?? 0) + (d.bonus ?? 0)).toLocaleString()}円
                                </td>
                                <td className="py-2 px-3 text-center">
                                  {d.confirmed
                                    ? <span className="text-green-600 font-medium">確定</span>
                                    : <span className="text-amber-500 font-medium">未確定</span>}
                                </td>
                                <td className="py-2 px-3 text-slate-400">{d.note ?? ''}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  )}

                  {adminTab === 'bulk' && (
                    <div className="p-5 space-y-4">
                      <p className="text-sm text-slate-600">対象月 <span className="font-semibold text-indigo-600">{adminMonth}</span> の基本時給を一括更新します</p>
                      <div>
                        <label className="text-xs font-medium text-slate-500 block mb-2">対象メンバーを選択</label>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 max-h-40 overflow-y-auto border border-slate-200 rounded-xl p-3 bg-slate-50">
                          {users.map(u => (
                            <label key={u.id} className="flex items-center gap-2 cursor-pointer">
                              <input type="checkbox" checked={bulkUsers.includes(u.id)}
                                onChange={e => setBulkUsers(prev => e.target.checked ? [...prev, u.id] : prev.filter(id => id !== u.id))}
                                className="w-3.5 h-3.5 accent-indigo-600" />
                              <span className="text-xs text-slate-700 truncate">{u.name}</span>
                            </label>
                          ))}
                        </div>
                        <button onClick={() => setBulkUsers(bulkUsers.length === users.length ? [] : users.map(u => u.id))}
                          className="text-xs text-indigo-600 hover:underline mt-1">
                          {bulkUsers.length === users.length ? '全解除' : '全選択'}
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs font-medium text-slate-500 block mb-1">基本時給 (円) *</label>
                          <input type="number" value={bulkRate} onChange={e => setBulkRate(e.target.value)} placeholder="例: 1300"
                            className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-slate-500 block mb-1">メモ（任意）</label>
                          <input type="text" value={bulkNote} onChange={e => setBulkNote(e.target.value)} placeholder="例: 最低賃金改定"
                            className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                        </div>
                      </div>
                      <button onClick={handleBulkUpdate} disabled={bulkSaving || !bulkUsers.length || !bulkRate}
                        className="w-full text-sm py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-40 font-medium">
                        {bulkSaving ? '更新中...' : `${bulkUsers.length}名 の基本時給を更新`}
                      </button>
                    </div>
                  )}

                  {adminTab === 'add' && (
                    <div className="p-5 space-y-4">
                      <p className="text-sm text-slate-600">対象メンバーの基本時給に一定額を加算します（最低賃金改定など）</p>
                      <div>
                        <label className="text-xs font-medium text-slate-500 block mb-2">対象メンバーを選択</label>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 max-h-40 overflow-y-auto border border-slate-200 rounded-xl p-3 bg-slate-50">
                          {users.map(u => (
                            <label key={u.id} className="flex items-center gap-2 cursor-pointer">
                              <input type="checkbox" checked={addUsers.includes(u.id)}
                                onChange={e => setAddUsers(prev => e.target.checked ? [...prev, u.id] : prev.filter(id => id !== u.id))}
                                className="w-3.5 h-3.5 accent-indigo-600" />
                              <span className="text-xs text-slate-700 truncate">{u.name}</span>
                            </label>
                          ))}
                        </div>
                        <button onClick={() => setAddUsers(addUsers.length === users.length ? [] : users.map(u => u.id))}
                          className="text-xs text-indigo-600 hover:underline mt-1">
                          {addUsers.length === users.length ? '全解除' : '全選択'}
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs font-medium text-slate-500 block mb-1">加算額 (円) *</label>
                          <input type="number" value={addAmount} onChange={e => setAddAmount(e.target.value)} placeholder="例: 62"
                            className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-slate-500 block mb-1">適用月</label>
                          <input type="text" value={addMonth} onChange={e => setAddMonth(e.target.value)} placeholder="2026/06"
                            className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                        </div>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-slate-500 block mb-1">メモ（任意）</label>
                        <input type="text" value={addNote} onChange={e => setAddNote(e.target.value)} placeholder="例: 最低賃金改定"
                          className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                      </div>
                      <button onClick={() => setAddConfirm(true)} disabled={!addUsers.length || !addAmount || !addMonth}
                        className="w-full text-sm py-2.5 bg-amber-500 text-white rounded-xl hover:bg-amber-600 transition-colors disabled:opacity-40 font-medium">
                        {addUsers.length}名に {addAmount ? `+${addAmount}円` : '加算額'} を適用
                      </button>
                    </div>
                  )}
                </div>

                {/* 年度切り替えボタン */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-medium text-slate-500">グラフ集計期間：</span>
                  <div className="flex rounded-lg border border-slate-200 overflow-hidden text-xs">
                    {FISCAL_YEARS.map(({ label, value }) => (
                      <button key={value} onClick={() => setGraphFiscalYear(value)}
                        className={`px-3 py-1.5 transition-colors ${graphFiscalYear === value ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>
                        {label}
                      </button>
                    ))}
                  </div>
                  {graphFiscalYear !== 'all' && (
                    <span className="text-xs text-slate-400">
                      {graphFiscalYear}/04 〜 {parseInt(graphFiscalYear) + 1}/03
                    </span>
                  )}
                </div>

                {/* ランク別平均時給 */}
                {rankData.length > 0 && (
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-slate-700">ランク別平均時給</h3>
                      <span className="text-xs text-slate-400">各ランクの直近レコードで集計</span>
                    </div>
                    <div className="p-5">
                      <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={rankData} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                          <XAxis dataKey="rank" tick={{ fontSize: 11 }} />
                          <YAxis tick={{ fontSize: 11 }} unit="円" domain={['auto', 'auto']} />
                          <Tooltip formatter={v => [`${Number(v).toLocaleString()}円`]} />
                          <Legend wrapperStyle={{ fontSize: 11 }} />
                          <Bar dataKey="avg" name="平均" fill="#6366f1" radius={[4,4,0,0]} />
                          <Bar dataKey="max" name="最高" fill="#34d399" radius={[4,4,0,0]} />
                          <Bar dataKey="min" name="最低" fill="#f87171" radius={[4,4,0,0]} />
                        </BarChart>
                      </ResponsiveContainer>
                      <div className="mt-3 flex flex-wrap gap-3">
                        {rankData.map(d => (
                          <div key={d.rank} className="bg-slate-50 rounded-xl p-3 text-center border border-slate-100 flex-1 min-w-[90px]">
                            <p className="text-xs font-semibold text-slate-600 mb-1">{d.rank}</p>
                            <p className="text-lg font-bold text-indigo-600">{d.avg.toLocaleString()}<span className="text-xs font-normal text-slate-400 ml-0.5">円</span></p>
                            <p className="text-xs text-slate-400 mt-0.5">{d.min.toLocaleString()}〜{d.max.toLocaleString()}円</p>
                            <p className="text-xs text-slate-300">{d.count}人</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* 年代別平均時給 */}
                {ageData.length > 0 && (
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-slate-700">年代別平均時給</h3>
                      <span className="text-xs text-slate-400">各メンバーの直近レコードで集計</span>
                    </div>
                    <div className="p-5">
                      <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={ageData} margin={{ top: 20, right: 8, left: -8, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                          <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                          <YAxis tick={{ fontSize: 11 }} unit="円" domain={['auto', 'auto']} />
                          <Tooltip formatter={v => [`${Number(v).toLocaleString()}円`, '平均時給']} />
                          <Bar dataKey="avg" name="平均時給" fill="#f59e0b" radius={[4,4,0,0]}
                            label={{ position: 'top', fontSize: 10, formatter: v => `${Number(v).toLocaleString()}円` }} />
                        </BarChart>
                      </ResponsiveContainer>
                      <p className="text-xs text-slate-400 mt-2">※ 生年未登録のメンバーは「不明」グループに含まれます</p>
                    </div>
                  </div>
                )}

              </div>
            </div>
          )}

          {/* 加算確認モーダル */}
          {addConfirm && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
                <h3 className="text-sm font-bold text-slate-800">加算を実行しますか？</h3>
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-slate-700 space-y-1">
                  <p>対象: <span className="font-semibold">{addUsers.length}名</span></p>
                  <p>加算額: <span className="font-semibold">+{addAmount}円</span></p>
                  <p>適用月: <span className="font-semibold">{addMonth}</span></p>
                  {addNote && <p>メモ: {addNote}</p>}
                  <p className="text-slate-500 pt-1">該当月のレコードがないメンバーは直近の時給に加算して新規作成します</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={handleAddAmount} disabled={addSaving}
                    className="flex-1 text-sm py-2 bg-amber-500 text-white rounded-xl hover:bg-amber-600 transition-colors disabled:opacity-50 font-medium">
                    {addSaving ? '処理中...' : '実行する'}
                  </button>
                  <button onClick={() => setAddConfirm(false)} disabled={addSaving}
                    className="flex-1 text-sm py-2 bg-white border border-slate-300 text-slate-600 rounded-xl hover:bg-slate-50 transition-colors">
                    キャンセル
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 加算トースト */}
          {addToast && (
            <div className="fixed bottom-6 right-6 z-50 bg-amber-500 text-white text-sm px-4 py-2.5 rounded-xl shadow-lg pointer-events-none">
              {addToast}
            </div>
          )}
        </>
      )}
    </div>
  );
}
