import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { supabase } from './supabaseClient';
import { CURRENT_MONTH, ADMIN_PASSWORD, RANK_SALARY } from '../constants';

export default function SalaryView({ users }) {
  const [salaryUser, setSalaryUser]         = useState(null);
  const [salaryHistory, setSalaryHistory]   = useState([]);
  const [completedByMonth, setCompletedByMonth] = useState({});
  const [salaryLoading, setSalaryLoading]   = useState(false);
  const [toggling, setToggling]             = useState(null);

  const [adminUnlocked, setAdminUnlocked]   = useState(false);
  const [adminInput, setAdminInput]         = useState('');
  const [adminPwError, setAdminPwError]     = useState(false);
  const [adminTab, setAdminTab]             = useState('list');
  const [allSalaryData, setAllSalaryData]   = useState([]);
  const [adminLoading, setAdminLoading]     = useState(false);
  const [adminMonth, setAdminMonth]         = useState(CURRENT_MONTH);
  const [bulkUsers, setBulkUsers]           = useState([]);
  const [bulkRate, setBulkRate]             = useState('');
  const [bulkNote, setBulkNote]             = useState('');
  const [bulkSaving, setBulkSaving]         = useState(false);
  const [salaryView, setSalaryView]         = useState('personal');

  useEffect(() => { if (users.length && !salaryUser) setSalaryUser(users[0]); }, [users]);

  useEffect(() => {
    if (!salaryUser) return;
    setSalaryLoading(true);
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

  useEffect(() => { if (salaryView === 'admin' && adminUnlocked) loadAdminData(); }, [salaryView, adminUnlocked]);

  const loadAdminData = async () => {
    setAdminLoading(true);
    const { data } = await supabase.from('hourly_rate_history')
      .select('id, user_id, month, base_rate, item_bonus, total_rate, confirmed, note, users(name, rank)')
      .order('month').limit(5000);
    setAllSalaryData(data || []);
    setAdminLoading(false);
  };

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

  const unlockAdmin = () => {
    if (adminInput === ADMIN_PASSWORD) { setAdminUnlocked(true); setAdminInput(''); setAdminPwError(false); }
    else setAdminPwError(true);
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

  const exportCsv = () => {
    const rows = [
      ['名前','月','基本時給','ボーナス','合計'],
      ...allSalaryData.filter(d => d.month === adminMonth).map(d => [
        d.users?.name ?? d.user_id, d.month,
        d.base_rate, d.item_bonus ?? 0,
        d.total_rate ?? (d.base_rate + (d.item_bonus ?? 0)),
      ])
    ];
    const blob = new Blob(['﻿' + rows.map(r => r.join(',')).join('\n')], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `salary_${adminMonth.replace('/', '-')}.csv`; a.click();
    URL.revokeObjectURL(a.href);
  };

  const allMonths = [...new Set([...Object.keys(completedByMonth), ...salaryHistory.map(h => h.month), CURRENT_MONTH])].sort();
  const chartData = allMonths.map(month => {
    const hist = salaryHistory.find(h => h.month === month);
    return {
      month,
      total: hist ? (hist.total_rate ?? hist.base_rate + (hist.item_bonus ?? 0)) : calcMonth(month, salaryUser).total,
      confirmed: hist?.confirmed ?? false,
    };
  });
  const adminMonths = [...new Set([CURRENT_MONTH, ...allSalaryData.map(d => d.month)])].sort().reverse();
  const adminMonthData = allSalaryData.filter(d => d.month === adminMonth);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="bg-white border-b border-slate-200 px-4 py-2 flex items-center gap-2 shrink-0">
        <div className="flex rounded-lg border border-slate-200 overflow-hidden text-xs">
          {[['personal','個人時給'],['admin','管理者ビュー']].map(([v,l]) => (
            <button key={v} onClick={() => setSalaryView(v)}
              className={`px-3 py-1.5 transition-colors ${salaryView === v ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {salaryView === 'personal' && (
        <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
          <div className="md:w-80 lg:w-96 shrink-0 bg-white border-r border-slate-200 flex flex-col overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 space-y-2 shrink-0">
              <label className="text-xs font-medium text-slate-500 block">メンバーを選択</label>
              <select value={salaryUser?.id ?? ''} onChange={e => setSalaryUser(users.find(u => u.id === e.target.value) ?? null)}
                className="w-full text-sm border border-slate-300 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400">
                {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
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
                    const total = hist?.total_rate ?? (base + bonusVal);
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
                        <div className="flex items-center gap-3 text-xs text-slate-500">
                          <span>{base.toLocaleString()}円</span>
                          {bonusVal > 0 && <span className="text-green-600">+{bonusVal}円</span>}
                          <span className="font-semibold text-slate-700 text-sm">{total.toLocaleString()}円</span>
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
              return (
                <>
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">今月 ({CURRENT_MONTH}) の時給</p>
                    <div className="flex flex-wrap gap-3 mb-4">
                      {[
                        { label: '基本時給', value: `${base.toLocaleString()}円` },
                        { label: '今月クリア', value: `${curCount}件`, hi: curCount > 0 },
                        { label: 'ボーナス', value: `${(bonus * curCount).toLocaleString()}円`, hi: bonus * curCount > 0 },
                        { label: '推定時給', value: `${curCalc.total.toLocaleString()}円`, bold: true },
                      ].map(s => (
                        <div key={s.label} className={`rounded-xl px-4 py-3 text-center border flex-1 min-w-[80px] ${s.bold ? 'bg-indigo-50 border-indigo-200' : s.hi ? 'bg-green-50 border-green-100' : 'bg-slate-50 border-slate-100'}`}>
                          <p className={`text-lg font-bold ${s.bold ? 'text-indigo-700' : 'text-slate-800'}`}>{s.value}</p>
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
                      <p className="text-xs text-slate-400 mt-1.5">
                        塗りつぶし ◆ 確定済み　白抜き ◇ 未確定
                      </p>
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        </div>
      )}

      {salaryView === 'admin' && (
        <div className="flex-1 overflow-y-auto p-5">
          {!adminUnlocked ? (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 max-w-sm mx-auto mt-8">
              <h3 className="text-sm font-semibold text-slate-700 mb-1">管理者認証</h3>
              <p className="text-xs text-slate-400 mb-4">パスワードを入力してください</p>
              <div className="flex gap-2">
                <input type="password" value={adminInput} onChange={e => setAdminInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && unlockAdmin()} placeholder="パスワード"
                  className={`flex-1 text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300 ${adminPwError ? 'border-red-400' : 'border-slate-300'}`} />
                <button onClick={unlockAdmin} className="text-sm px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">確認</button>
              </div>
              {adminPwError && <p className="text-xs text-red-500 mt-2">パスワードが違います</p>}
            </div>
          ) : (
            <div className="space-y-4 max-w-5xl mx-auto">
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="flex items-center border-b border-slate-200 px-4">
                  {[['list','一覧'],['bulk','一括更新']].map(([v,l]) => (
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
                            {['名前','ランク','基本時給','ボーナス','合計','確定','メモ'].map(h => (
                              <th key={h} className={`py-2.5 px-4 text-slate-500 font-medium ${['基本時給','ボーナス','合計'].includes(h) ? 'text-right' : h === '確定' ? 'text-center' : 'text-left'}`}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {adminMonthData.length === 0 ? (
                            <tr><td colSpan={7} className="text-center py-8 text-slate-400">この月のデータがありません</td></tr>
                          ) : adminMonthData.map(d => (
                            <tr key={d.id} className={`border-b border-slate-100 ${!d.confirmed ? 'bg-yellow-50' : ''}`}>
                              <td className="py-2.5 px-4 font-medium text-slate-700">{d.users?.name ?? '−'}</td>
                              <td className="py-2.5 px-4 text-slate-500">{d.users?.rank ?? '−'}</td>
                              <td className="py-2.5 px-4 text-right">{(d.base_rate ?? 0).toLocaleString()}円</td>
                              <td className="py-2.5 px-4 text-right text-green-600">+{d.item_bonus ?? 0}円</td>
                              <td className="py-2.5 px-4 text-right font-semibold">{(d.total_rate ?? (d.base_rate ?? 0) + (d.item_bonus ?? 0)).toLocaleString()}円</td>
                              <td className="py-2.5 px-4 text-center">
                                {d.confirmed
                                  ? <span className="text-green-600 font-medium">確定</span>
                                  : <span className="text-amber-500 font-medium">未確定</span>}
                              </td>
                              <td className="py-2.5 px-4 text-slate-400">{d.note ?? ''}</td>
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
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
