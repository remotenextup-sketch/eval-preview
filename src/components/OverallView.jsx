import React, { useState } from 'react';
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Cell,
} from 'recharts';
import { CURRENT_MONTH, RANK_TRANSITIONS, RANK_CHART_COLORS } from '../constants';

export default function OverallView({ overallLoading, completedProgress, stuckProgress, allItemDefs, allUsersData }) {
  const [expandedStuck, setExpandedStuck]   = useState(null);
  const [rankActiveOnly, setRankActiveOnly] = useState(true);
  const [overallChartMode, setOverallChartMode] = useState('all');
  const [overallIndivUser, setOverallIndivUser] = useState(null);

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
          <div className="flex rounded-lg border border-slate-200 overflow-hidden text-xs">
            {[['all','全体'],['rank','ランク別'],['personal','個人別'],['fiscal','年度別']].map(([v,l]) => (
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

      <section>
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
      </section>

      <section>
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
      </section>
    </div>
  );
}
