import React, { useState, useEffect } from 'react';
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Cell,
} from 'recharts';
import { CURRENT_MONTH, RANK_TRANSITIONS, RANK_CHART_COLORS, DEPT_COLORS, MASTER_PIN } from '../constants';
import { supabase } from './supabaseClient';

export default function OverallView({ overallLoading, completedProgress, stuckProgress, allItemDefs, allUsersData }) {
  const [expandedStuck, setExpandedStuck]   = useState(null);
  const [rankActiveOnly, setRankActiveOnly] = useState(true);
  const [overallChartMode, setOverallChartMode] = useState('all');
  const [overallIndivUser, setOverallIndivUser] = useState(null);

  // ── 昇格実績モード ──
  const [promoFilter, setPromoFilter] = useState({ fy: 'all', age: 'all', dept: 'all' });
  const [kpiTargets, setKpiTargets]   = useState([]);
  const [kpiCompletions, setKpiCompletions] = useState({});
  const [kpiLoaded, setKpiLoaded]     = useState(false);
  const [kpiSaving, setKpiSaving]     = useState(false);
  const [kpiForm, setKpiForm]         = useState({ user_id: '', target_month: CURRENT_MONTH, target_count: '', note: '', created_by: '' });
  const [kpiAdminAuth, setKpiAdminAuth] = useState(() => sessionStorage.getItem('kpi_admin_auth') === 'true');
  const [kpiPinInput, setKpiPinInput] = useState('');
  const [kpiPinError, setKpiPinError] = useState('');

  useEffect(() => {
    if (overallChartMode !== 'promotion' || kpiLoaded) return;
    Promise.all([
      supabase.from('kpi_targets').select('*, users(name, rank)').order('created_at', { ascending: false }),
      supabase.from('evaluation_progress').select('user_id').eq('status', 'completed').eq('achieved_month', CURRENT_MONTH),
    ]).then(([kpi, prog]) => {
      setKpiTargets(kpi.data || []);
      const counts = {};
      (prog.data || []).forEach(p => { if (p.user_id) counts[p.user_id] = (counts[p.user_id] || 0) + 1; });
      setKpiCompletions(counts);
      setKpiLoaded(true);
    });
  }, [overallChartMode, kpiLoaded]);

  if (overallLoading) return <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">読み込み中...</div>;

  const overallMonthlyData = (() => {
    const counts = {};
    completedProgress.forEach(p => { if (/^\d{4}\/\d{2}$/.test(p.achieved_month ?? '')) counts[p.achieved_month] = (counts[p.achieved_month] || 0) + 1; });
    return Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)).map(([month, count]) => ({ month, count }));
  })();

  const stuckItemsRanking = (() => {
    if (!allItemDefs.length) return [];
    const itemMap = {};
    allItemDefs.forEach(d => { if (d.no != null) itemMap[d.no] = d; });
    const groups = {};
    stuckProgress.forEach(p => {
      if (!p.item_no) return;
      if (!groups[p.item_no]) groups[p.item_no] = { item_no: p.item_no, users: [], totalDays: 0 };
      groups[p.item_no].users.push(p.user_name);
      groups[p.item_no].totalDays += Math.floor((Date.now() - new Date(p.created_at)) / 86400000);
    });
    return Object.values(groups).filter(g => itemMap[g.item_no])
      .map(g => ({ ...g, item_name: itemMap[g.item_no].item_name, rank: itemMap[g.item_no].rank, count: g.users.length, avgDays: Math.round(g.totalDays / g.users.length) }))
      .sort((a, b) => b.count - a.count).slice(0, 10);
  })();

  const rankDurationData = (() => {
    const base = rankActiveOnly ? allUsersData.filter(u => !u.resigned_at) : allUsersData;
    return RANK_TRANSITIONS.map(t => {
      const durations = base.filter(u => u[t.from] && u[t.to])
        .map(u => Math.floor((new Date(u[t.to]) - new Date(u[t.from])) / 86400000)).filter(d => d > 0);
      if (!durations.length) return null;
      const avg = Math.round(durations.reduce((a, b) => a + b, 0) / durations.length);
      return { label: t.label, avg, min: Math.min(...durations), max: Math.max(...durations), count: durations.length };
    }).filter(Boolean);
  })();

  const rankMonthlyData = (() => {
    if (!allItemDefs.length || !completedProgress.length) return { ranks: [], data: [] };
    const itemRankMap = {};
    allItemDefs.forEach(d => { if (d.no != null) itemRankMap[d.no] = d.rank; });
    const counts = {};
    completedProgress.forEach(p => {
      if (!/^\d{4}\/\d{2}$/.test(p.achieved_month ?? '')) return;
      const rank = itemRankMap[p.item_no];
      if (!rank) return;
      const key = `${p.achieved_month}||${rank}`;
      counts[key] = (counts[key] || 0) + 1;
    });
    const months = [...new Set(completedProgress.filter(p => /^\d{4}\/\d{2}$/.test(p.achieved_month ?? '')).map(p => p.achieved_month))].sort();
    const ranks = [...new Set(Object.values(itemRankMap))].filter(Boolean);
    const data = months.map(month => {
      const row = { month };
      ranks.forEach(r => { row[r] = counts[`${month}||${r}`] || 0; });
      return row;
    });
    return { ranks, data };
  })();

  const fiscalYearData = (() => {
    if (!allItemDefs.length || !completedProgress.length) return { ranks: [], data: [] };
    const itemRankMap = {};
    allItemDefs.forEach(d => { if (d.no != null) itemRankMap[d.no] = d.rank; });
    const counts = {};
    completedProgress.forEach(p => {
      if (!/^\d{4}\/\d{2}$/.test(p.achieved_month ?? '')) return;
      const rank = itemRankMap[p.item_no];
      if (!rank) return;
      const [year, month] = p.achieved_month.split('/').map(Number);
      const fy = month >= 4 ? year : year - 1;
      const key = `${fy}||${rank}`;
      counts[key] = (counts[key] || 0) + 1;
    });
    const fiscalYears = [...new Set(completedProgress
      .filter(p => /^\d{4}\/\d{2}$/.test(p.achieved_month ?? ''))
      .map(p => { const [y, m] = p.achieved_month.split('/').map(Number); return m >= 4 ? y : y - 1; })
    )].sort();
    const ranks = [...new Set(Object.values(itemRankMap))].filter(Boolean);
    const data = fiscalYears.map(fy => {
      const row = { fy: `${fy}年度` };
      ranks.forEach(r => { row[r] = counts[`${fy}||${r}`] || 0; });
      return row;
    });
    return { ranks, data };
  })();

  const departmentMonthlyData = (() => {
    if (!allUsersData.length || !completedProgress.length) return { departments: [], data: [] };
    const userDeptMap = {};
    allUsersData.forEach(u => { const pname = u.progress_name ?? u.name; const dept = Array.isArray(u.department) ? u.department[0] : null; if (pname && dept) userDeptMap[pname] = dept; });
    const counts = {};
    completedProgress.forEach(p => { const dept = userDeptMap[p.user_name]; if (!dept || !/^\d{4}\/\d{2}$/.test(p.achieved_month ?? '')) return; const key = `${dept}||${p.achieved_month}`; counts[key] = (counts[key] || 0) + 1; });
    const months = [...new Set(completedProgress.filter(p => /^\d{4}\/\d{2}$/.test(p.achieved_month ?? '')).map(p => p.achieved_month))].sort();
    const departments = [...new Set(Object.values(userDeptMap))].sort();
    const data = months.map(month => { const row = { month }; departments.forEach(d => { row[d] = counts[`${d}||${month}`] || 0; }); return row; });
    return { departments, data };
  })();

  const individualData = overallIndivUser ? (() => {
    const pName = overallIndivUser.progress_name ?? overallIndivUser.name;
    const counts = {};
    completedProgress.filter(p => p.user_name === pName)
      .forEach(p => { if (/^\d{4}\/\d{2}$/.test(p.achieved_month ?? '')) counts[p.achieved_month] = (counts[p.achieved_month] || 0) + 1; });
    return Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)).map(([month, count]) => ({ month, count }));
  })() : [];

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-8">
      <section>
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <h2 className="text-base font-semibold text-slate-700">月次クリア数</h2>
          <div className="flex flex-wrap rounded-lg border border-slate-200 overflow-hidden text-xs">
            {[['all','全体'],['rank','ランク別'],['personal','個人別'],['fiscal','年度別'],['department','部門別'],['tenure','在籍期間'],['promotion','昇格実績']].map(([v,l]) => (
              <button key={v} onClick={() => setOverallChartMode(v)}
                className={`px-3 py-1.5 transition-colors ${overallChartMode === v ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>
                {l}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
          {overallChartMode === 'all' && (
            overallMonthlyData.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={overallMonthlyData} margin={{ top: 8, right: 16, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip formatter={v => [`${v}件`, 'クリア数']} />
                  <Line type="monotone" dataKey="count" stroke="#6366f1" strokeWidth={2.5} dot={{ r: 4, fill: '#6366f1' }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : <p className="text-slate-400 text-sm text-center py-8">データなし</p>
          )}

          {overallChartMode === 'rank' && (
            rankMonthlyData.data.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={rankMonthlyData.data} margin={{ top: 8, right: 16, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {rankMonthlyData.ranks.map((rank, i) => (
                    <Bar key={rank} dataKey={rank} stackId="a" fill={RANK_CHART_COLORS[i % RANK_CHART_COLORS.length]}
                      radius={i === rankMonthlyData.ranks.length - 1 ? [4,4,0,0] : [0,0,0,0]} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            ) : <p className="text-slate-400 text-sm text-center py-8">データなし</p>
          )}

          {overallChartMode === 'fiscal' && (
            fiscalYearData.data.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={fiscalYearData.data} margin={{ top: 8, right: 16, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="fy" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {fiscalYearData.ranks.map((rank, i) => (
                    <Bar key={rank} dataKey={rank} stackId="a" fill={RANK_CHART_COLORS[i % RANK_CHART_COLORS.length]}
                      radius={i === fiscalYearData.ranks.length - 1 ? [4,4,0,0] : [0,0,0,0]} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            ) : <p className="text-slate-400 text-sm text-center py-8">データなし</p>
          )}

          {overallChartMode === 'department' && (
            departmentMonthlyData.data.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={departmentMonthlyData.data} margin={{ top: 8, right: 16, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {departmentMonthlyData.departments.map((dept, i) => (
                    <Line key={dept} type="monotone" dataKey={dept} stroke={DEPT_COLORS[i % DEPT_COLORS.length]} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            ) : <p className="text-slate-400 text-sm text-center py-8">データなし</p>
          )}

          {overallChartMode === 'tenure' && (() => {
            const today = new Date();
            const active = allUsersData.filter(u => !u.resigned_at && u.onboarding_at && u.name !== 'テンプレート');
            if (!active.length) return <p className="text-slate-400 text-sm text-center py-8">データなし</p>;
            const allDays = active.map(u => Math.floor((today - new Date(u.onboarding_at)) / 86400000));
            const avg = Math.round(allDays.reduce((a,b) => a+b,0) / allDays.length);
            const rankGroups = [...new Set(active.map(u => u.rank).filter(Boolean))].map(rank => {
              const days = active.filter(u => u.rank === rank).map(u => Math.floor((today - new Date(u.onboarding_at)) / 86400000));
              return { rank, avg: Math.round(days.reduce((a,b) => a+b,0) / days.length), count: days.length };
            });
            const sortedUsers = [...active].map(u => ({ ...u, days: Math.floor((today - new Date(u.onboarding_at)) / 86400000) })).sort((a,b) => b.days - a.days);
            return (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: '平均在籍期間', value: `${avg}日`, sub: `約${Math.round(avg/30.44)}ヶ月` },
                    { label: '最長在籍', value: `${Math.max(...allDays)}日`, sub: sortedUsers[0]?.name },
                    { label: '最短在籍', value: `${Math.min(...allDays)}日`, sub: sortedUsers[sortedUsers.length-1]?.name },
                  ].map(s => (
                    <div key={s.label} className="bg-slate-50 rounded-xl p-3 text-center border border-slate-100">
                      <p className="text-xs text-slate-500 mb-1">{s.label}</p>
                      <p className="text-xl font-bold text-indigo-600">{s.value}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{s.sub}</p>
                    </div>
                  ))}
                </div>
                {rankGroups.length > 0 && (
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={rankGroups} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="rank" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} unit="日" />
                      <Tooltip formatter={v => [`${v}日`]} />
                      <Bar dataKey="avg" name="平均在籍日数" fill="#6366f1" radius={[4,4,0,0]}>
                        {rankGroups.map((_, i) => <Cell key={i} fill={RANK_CHART_COLORS[i % RANK_CHART_COLORS.length]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
                <div className="overflow-auto max-h-48">
                  <table className="w-full text-xs">
                    <thead><tr className="border-b border-slate-200 text-left text-slate-500">
                      <th className="pb-1.5 pr-3">名前</th><th className="pb-1.5 pr-3">ランク</th><th className="pb-1.5 pr-3">在籍日数</th><th className="pb-1.5">入社日</th>
                    </tr></thead>
                    <tbody className="divide-y divide-slate-100">
                      {sortedUsers.map(u => (
                        <tr key={u.id} className="py-1.5">
                          <td className="py-1.5 pr-3 font-medium text-slate-700">{u.name}</td>
                          <td className="py-1.5 pr-3"><span className="bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded text-xs">{u.rank}</span></td>
                          <td className="py-1.5 pr-3 text-slate-600">{u.days}日 <span className="text-slate-400">({Math.round(u.days/30.44)}ヶ月)</span></td>
                          <td className="py-1.5 text-slate-400">{u.onboarding_at}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })()}

          {overallChartMode === 'personal' && (
            <div>
              <div className="mb-4 flex items-center gap-3">
                <label className="text-xs font-medium text-slate-500">メンバー</label>
                <select
                  value={overallIndivUser?.id ?? ''}
                  onChange={e => setOverallIndivUser(allUsersData.find(u => u.id === e.target.value) ?? null)}
                  className="text-sm border border-slate-300 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
                >
                  <option value="">選択してください</option>
                  {allUsersData.filter(u => !u.resigned_at && u.name !== 'テンプレート').map(u => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
                {overallIndivUser?.rank && <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">{overallIndivUser.rank}</span>}
              </div>
              {!overallIndivUser ? (
                <p className="text-slate-400 text-sm text-center py-8">メンバーを選択してください</p>
              ) : individualData.length > 0 ? (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={individualData} margin={{ top: 8, right: 16, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip formatter={v => [`${v}件`, 'クリア数']} />
                    <Bar dataKey="count" radius={[6,6,0,0]}>
                      {individualData.map((e, i) => <Cell key={i} fill={e.month === CURRENT_MONTH ? '#6366f1' : '#a5b4fc'} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-slate-400 text-sm text-center py-8">クリアデータがありません</p>
              )}
            </div>
          )}
        </div>
      </section>

      {overallChartMode === 'promotion' && (() => {
        const getFY = d => { if (!d) return null; const [y,m] = d.split('-').map(Number); return m >= 4 ? y : y - 1; };
        const getAge = b => { if (!b) return null; const a = 2026 - b; return a >= 20 && a < 30 ? '20代' : a >= 30 && a < 40 ? '30代' : a >= 40 && a < 50 ? '40代' : null; };
        const base = allUsersData.filter(u => u.name !== 'テンプレート');
        let filtered = [...base];
        if (promoFilter.fy !== 'all') { const fy = parseInt(promoFilter.fy); filtered = filtered.filter(u => getFY(u.leader_at) === fy); }
        if (promoFilter.age !== 'all') filtered = filtered.filter(u => getAge(u.birth_year) === promoFilter.age);
        if (promoFilter.dept !== 'all') filtered = filtered.filter(u => (Array.isArray(u.department) ? u.department[0] : u.department) === promoFilter.dept);
        const total = filtered.length;
        const reached = filtered.filter(u => u.leader_at);
        const rate = total ? Math.round(reached.length / total * 100) : 0;
        const durations = reached.filter(u => u.onboarding_at).map(u => Math.floor((new Date(u.leader_at) - new Date(u.onboarding_at)) / 86400000));
        const avgDays = durations.length ? Math.round(durations.reduce((a,b) => a+b,0) / durations.length) : 0;

        const fyData = (() => { const c = {}; base.filter(u => u.leader_at).forEach(u => { const fy = getFY(u.leader_at); if (fy) c[`${fy}年度`] = (c[`${fy}年度`]||0)+1; }); return Object.entries(c).sort(([a],[b])=>a.localeCompare(b)).map(([fy,count])=>({fy,count})); })();
        const distData = (() => {
          const ds = base.filter(u=>u.leader_at && u.onboarding_at).map(u=>Math.floor((new Date(u.leader_at)-new Date(u.onboarding_at))/86400000));
          return [{label:'〜6ヶ月',min:0,max:180},{label:'6〜12ヶ月',min:181,max:365},{label:'1〜1.5年',min:366,max:547},{label:'1.5〜2年',min:548,max:730},{label:'2年〜',min:731,max:Infinity}].map(b=>({label:b.label,count:ds.filter(d=>d>=b.min&&d<=b.max).length}));
        })();
        const deptData = (() => { const m = {}; base.forEach(u=>{const d=Array.isArray(u.department)?u.department[0]:u.department; if(!d)return; if(!m[d])m[d]={t:0,r:0}; m[d].t++; if(u.leader_at)m[d].r++;}); return Object.entries(m).map(([dept,{t,r}])=>({dept,rate:t?Math.round(r/t*100):0,reached:r,total:t})).sort((a,b)=>b.rate-a.rate); })();
        const depts = [...new Set(base.map(u=>Array.isArray(u.department)?u.department[0]:u.department).filter(Boolean))].sort();

        const currentKpi = kpiTargets.filter(k => k.target_month === CURRENT_MONTH);
        const warnList = currentKpi.filter(k => (kpiCompletions[k.user_id]||0) < k.target_count);

        return (
          <>
            <section className="space-y-4">
              <div className="flex flex-wrap gap-2 items-center">
                <span className="text-xs font-medium text-slate-500">フィルター:</span>
                {[['fy','年度',['all','全期間'],['2024','2024年度'],['2025','2025年度'],['2026','2026年度']],
                  ['age','年代',['all','全体'],['20代','20代'],['30代','30代'],['40代','40代']],
                ].map(([key, label, ...opts]) => (
                  <div key={key} className="flex items-center gap-1">
                    <span className="text-xs text-slate-400">{label}:</span>
                    <select value={promoFilter[key]} onChange={e => setPromoFilter(p=>({...p,[key]:e.target.value}))}
                      className="text-xs border border-slate-200 rounded-lg px-2 py-1 bg-white focus:outline-none">
                      {opts.map(([v,l])=><option key={v} value={v}>{l}</option>)}
                    </select>
                  </div>
                ))}
                <div className="flex items-center gap-1">
                  <span className="text-xs text-slate-400">部門:</span>
                  <select value={promoFilter.dept} onChange={e => setPromoFilter(p=>({...p,dept:e.target.value}))}
                    className="text-xs border border-slate-200 rounded-lg px-2 py-1 bg-white focus:outline-none">
                    <option value="all">全体</option>
                    {depts.map(d=><option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[
                  {label:'総在籍人数',value:`${total}名`,sub:'退職者含む'},
                  {label:'リーダー以上到達',value:`${reached.length}名`,sub:`到達率 ${rate}%`},
                  {label:'平均到達期間',value:`${avgDays}日`,sub:`約${Math.round(avgDays/30.44)}ヶ月`},
                ].map(s=>(
                  <div key={s.label} className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm text-center">
                    <p className="text-xs text-slate-500 mb-1">{s.label}</p>
                    <p className="text-2xl font-bold text-indigo-600">{s.value}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{s.sub}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="grid md:grid-cols-3 gap-4">
              <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
                <p className="text-xs font-semibold text-slate-600 mb-3">年度別リーダー到達人数</p>
                {fyData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={160}>
                    <BarChart data={fyData} margin={{top:4,right:4,left:-20,bottom:0}}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="fy" tick={{fontSize:10}} />
                      <YAxis tick={{fontSize:10}} allowDecimals={false} />
                      <Tooltip formatter={v=>[`${v}名`]} />
                      <Bar dataKey="count" name="到達人数" fill="#6366f1" radius={[4,4,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <p className="text-slate-400 text-xs text-center py-8">データなし</p>}
              </div>
              <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
                <p className="text-xs font-semibold text-slate-600 mb-3">到達期間の分布</p>
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={distData} margin={{top:4,right:4,left:-20,bottom:0}}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="label" tick={{fontSize:9}} />
                    <YAxis tick={{fontSize:10}} allowDecimals={false} />
                    <Tooltip formatter={v=>[`${v}名`]} />
                    <Bar dataKey="count" name="人数" fill="#34d399" radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
                <p className="text-xs font-semibold text-slate-600 mb-3">部門別到達率</p>
                {deptData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={160}>
                    <BarChart data={deptData.slice(0,8)} layout="vertical" margin={{top:4,right:8,left:30,bottom:0}}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                      <XAxis type="number" tick={{fontSize:10}} unit="%" domain={[0,100]} />
                      <YAxis dataKey="dept" type="category" tick={{fontSize:9}} width={48} />
                      <Tooltip formatter={v=>[`${v}%`]} />
                      <Bar dataKey="rate" name="到達率" fill="#f59e0b" radius={[0,4,4,0]}>
                        {deptData.slice(0,8).map((_,i)=><Cell key={i} fill={DEPT_COLORS[i%DEPT_COLORS.length]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : <p className="text-slate-400 text-xs text-center py-8">データなし</p>}
              </div>
            </section>

            <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-slate-700">KPI目標管理（今月: {CURRENT_MONTH}）</h3>
                {!kpiAdminAuth && (
                  <div className="flex items-center gap-2">
                    <input type="password" value={kpiPinInput} onChange={e=>setKpiPinInput(e.target.value)}
                      placeholder="PIN" maxLength={4}
                      className="w-20 text-xs border border-slate-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-300"
                      onKeyDown={e=>{if(e.key==='Enter'){if(kpiPinInput===MASTER_PIN){setKpiAdminAuth(true);sessionStorage.setItem('kpi_admin_auth','true');setKpiPinError('');}else setKpiPinError('PINが違います');}}} />
                    <button onClick={()=>{if(kpiPinInput===MASTER_PIN){setKpiAdminAuth(true);sessionStorage.setItem('kpi_admin_auth','true');setKpiPinError('');}else setKpiPinError('PINが違います');}}
                      className="text-xs px-2.5 py-1 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">認証</button>
                    {kpiPinError && <span className="text-xs text-red-500">{kpiPinError}</span>}
                  </div>
                )}
              </div>
              {!kpiAdminAuth ? (
                <p className="text-xs text-slate-400 text-center py-4">管理者PINで認証してください</p>
              ) : !kpiLoaded ? (
                <p className="text-xs text-slate-400 text-center py-4">読み込み中...</p>
              ) : (
                <div className="space-y-5">
                  {warnList.length > 0 && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                      <p className="text-xs font-semibold text-amber-700 mb-2">そろそろクリアさせたい人 ({warnList.length}名)</p>
                      <div className="flex flex-wrap gap-2">
                        {warnList.map(k => {
                          const actual = kpiCompletions[k.user_id] || 0;
                          const rate = Math.round(actual / k.target_count * 100);
                          return (
                            <div key={k.id} className={`text-xs px-2.5 py-1.5 rounded-lg border font-medium ${rate <= 50 ? 'bg-red-50 border-red-200 text-red-700' : 'bg-amber-50 border-amber-200 text-amber-700'}`}>
                              {k.users?.name} ({actual}/{k.target_count} = {rate}%)
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {currentKpi.length > 0 && (
                    <div className="overflow-auto">
                      <table className="w-full text-xs">
                        <thead><tr className="border-b border-slate-200 text-left text-slate-500">
                          <th className="pb-2 pr-3">名前</th><th className="pb-2 pr-3">ランク</th>
                          <th className="pb-2 pr-3 text-right">目標</th><th className="pb-2 pr-3 text-right">実績</th>
                          <th className="pb-2 text-right">達成率</th>
                        </tr></thead>
                        <tbody className="divide-y divide-slate-100">
                          {currentKpi.map(k => {
                            const actual = kpiCompletions[k.user_id] || 0;
                            const r = Math.round(actual / k.target_count * 100);
                            const rowCls = r >= 120 ? 'bg-green-50 text-green-700' : r <= 80 ? 'bg-red-50 text-red-700' : '';
                            return (
                              <tr key={k.id} className={rowCls}>
                                <td className="py-2 pr-3 font-medium">{k.users?.name ?? '—'}</td>
                                <td className="py-2 pr-3 text-slate-500">{k.users?.rank ?? '—'}</td>
                                <td className="py-2 pr-3 text-right">{k.target_count}件</td>
                                <td className="py-2 pr-3 text-right">{actual}件</td>
                                <td className="py-2 text-right font-bold">{r}%</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}

                  <div className="border-t border-slate-100 pt-4">
                    <p className="text-xs font-semibold text-slate-600 mb-3">目標を設定</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-slate-500 block mb-1">メンバー *</label>
                        <select value={kpiForm.user_id} onChange={e=>setKpiForm(p=>({...p,user_id:e.target.value}))}
                          className="w-full text-xs border border-slate-300 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-300">
                          <option value="">選択してください</option>
                          {allUsersData.filter(u=>!u.resigned_at && u.name!=='テンプレート').map(u=><option key={u.id} value={u.id}>{u.name}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-slate-500 block mb-1">対象月 *</label>
                        <input type="text" value={kpiForm.target_month} onChange={e=>setKpiForm(p=>({...p,target_month:e.target.value}))}
                          placeholder="2026/05"
                          className="w-full text-xs border border-slate-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-300" />
                      </div>
                      <div>
                        <label className="text-xs text-slate-500 block mb-1">目標件数 *</label>
                        <input type="number" min="1" value={kpiForm.target_count} onChange={e=>setKpiForm(p=>({...p,target_count:e.target.value}))}
                          className="w-full text-xs border border-slate-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-300" />
                      </div>
                      <div>
                        <label className="text-xs text-slate-500 block mb-1">作成者</label>
                        <input type="text" value={kpiForm.created_by} onChange={e=>setKpiForm(p=>({...p,created_by:e.target.value}))}
                          placeholder="担当者名"
                          className="w-full text-xs border border-slate-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-300" />
                      </div>
                      <div className="col-span-2">
                        <label className="text-xs text-slate-500 block mb-1">コメント</label>
                        <input type="text" value={kpiForm.note} onChange={e=>setKpiForm(p=>({...p,note:e.target.value}))}
                          placeholder="育成担当からのコメント"
                          className="w-full text-xs border border-slate-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-300" />
                      </div>
                    </div>
                    <button
                      onClick={async () => {
                        if (!kpiForm.user_id || !kpiForm.target_month || !kpiForm.target_count) return;
                        setKpiSaving(true);
                        const { data, error } = await supabase.from('kpi_targets').upsert({
                          user_id: kpiForm.user_id,
                          target_month: kpiForm.target_month,
                          target_count: parseInt(kpiForm.target_count),
                          note: kpiForm.note || null,
                          created_by: kpiForm.created_by || null,
                        }, { onConflict: 'user_id,target_month' }).select('*, users(name, rank)');
                        if (!error && data) {
                          setKpiTargets(prev => {
                            const ids = new Set(data.map(d => d.id));
                            return [...prev.filter(k => !ids.has(k.id)), ...data];
                          });
                          setKpiForm(p => ({ ...p, user_id: '', target_count: '', note: '', created_by: '' }));
                        }
                        setKpiSaving(false);
                      }}
                      disabled={kpiSaving || !kpiForm.user_id || !kpiForm.target_month || !kpiForm.target_count}
                      className="mt-3 w-full text-sm py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-40 font-medium">
                      {kpiSaving ? '保存中...' : '目標を保存'}
                    </button>
                  </div>
                </div>
              )}
            </section>
          </>
        );
      })()}

      {overallChartMode !== 'promotion' && <section>
        <h2 className="text-base font-semibold text-slate-700 mb-4">詰まりやすい項目 TOP10</h2>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden divide-y divide-slate-100">
          {stuckItemsRanking.length === 0 ? <p className="text-slate-400 text-sm text-center py-8">データなし</p>
            : stuckItemsRanking.map((item, idx) => (
            <div key={item.item_no}>
              <button onClick={() => setExpandedStuck(prev => prev === item.item_no ? null : item.item_no)}
                className="w-full px-5 py-3.5 flex items-center gap-3 text-left hover:bg-slate-50 transition-colors">
                <span className={`text-sm font-bold w-6 shrink-0 ${idx < 3 ? 'text-orange-500' : 'text-slate-400'}`}>{idx + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-800 line-clamp-1">{item.item_name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded">{item.rank}</span>
                    <span className="text-xs text-slate-500">未達成 {item.count}人</span>
                    <span className="text-xs text-slate-400">平均 {item.avgDays}日</span>
                  </div>
                </div>
                <span className="text-slate-400 text-xs shrink-0">{expandedStuck === item.item_no ? '▲' : '▼'}</span>
              </button>
              {expandedStuck === item.item_no && (
                <div className="px-5 pb-3.5 pt-1.5 bg-slate-50 border-t border-slate-100">
                  <p className="text-xs text-slate-500 mb-2 font-medium">該当メンバー（{item.count}人）</p>
                  <div className="flex flex-wrap gap-1.5">
                    {item.users.map((u,i) => <span key={i} className="text-xs bg-white border border-slate-200 text-slate-600 px-2 py-0.5 rounded-full">{u}</span>)}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>}

      {overallChartMode !== 'promotion' && <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-slate-700">ランク別平均クリア期間</h2>
          <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer select-none">
            <input type="checkbox" checked={rankActiveOnly} onChange={e => setRankActiveOnly(e.target.checked)} className="w-3.5 h-3.5 accent-indigo-600" />
            現役メンバーのみ
          </label>
        </div>
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
          {rankDurationData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={rankDurationData} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} unit="日" />
                  <Tooltip formatter={v => [`${v}日`]} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="avg" name="平均" fill="#6366f1" radius={[4,4,0,0]} />
                  <Bar dataKey="min" name="最短" fill="#34d399" radius={[4,4,0,0]} />
                  <Bar dataKey="max" name="最長" fill="#f87171" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
              <div className="mt-4 flex flex-wrap gap-3">
                {rankDurationData.map(d => (
                  <div key={d.label} className="bg-slate-50 rounded-xl p-3 text-center border border-slate-100 min-w-[90px] flex-1">
                    <p className="text-xs font-semibold text-slate-600 mb-1">{d.label}</p>
                    <p className="text-xl font-bold text-indigo-600">{d.avg}<span className="text-xs font-normal text-slate-400 ml-0.5">日</span></p>
                    <p className="text-xs text-slate-400 mt-0.5">{d.min}〜{d.max}日</p>
                    <p className="text-xs text-slate-300">{d.count}人</p>
                  </div>
                ))}
              </div>
            </>
          ) : <p className="text-slate-400 text-sm text-center py-8">データなし</p>}
        </div>
      </section>}
    </div>
  );
}
