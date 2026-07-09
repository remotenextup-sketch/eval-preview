import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

const RANK_ORDER = {
  'CEO': 0, 'ディレクター': 1, 'スペシャリスト': 2,
  'リーダー': 3, 'パートナー': 4, 'トレーニー': 5, 'オンボーディング': 6,
};

const RANK_BADGE = {
  'ディレクター':     'bg-purple-100 text-purple-700',
  'スペシャリスト':   'bg-indigo-100 text-indigo-700',
  'リーダー':         'bg-blue-100 text-blue-700',
  'パートナー':       'bg-green-100 text-green-700',
  'トレーニー':       'bg-yellow-100 text-yellow-700',
  'オンボーディング': 'bg-gray-100 text-gray-500',
};

const RANK_BORDER = {
  'ディレクター':     'border-l-purple-400',
  'スペシャリスト':   'border-l-indigo-400',
  'リーダー':         'border-l-blue-400',
  'パートナー':       'border-l-green-400',
  'トレーニー':       'border-l-yellow-400',
  'オンボーディング': 'border-l-gray-300',
};

const DEPT_ORDER = [
  'デザイン', '商品開発', '広告運用', '物流',
  'カスタマー', '人事採用', '採用', 'CS', 'フィットイージー',
];

function normalizeDepts(depts) {
  return (depts || []).flatMap(d => d.split(',').map(s => s.trim())).filter(Boolean);
}

function Avatar({ name, avatarUrl }) {
  if (avatarUrl) {
    const base = avatarUrl.split('?')[0];
    const t = avatarUrl.match(/[?&]t=(\d+)/)?.[1];
    return (
      <img
        src={t ? `${base}?t=${t}` : base}
        alt={name}
        className="w-7 h-7 rounded-full object-cover shrink-0 border border-slate-200"
      />
    );
  }
  return (
    <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-xs shrink-0">
      {(name ?? '?')[0]}
    </div>
  );
}

export default function OrgChartView() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchUsers = async () => {
    const { data } = await supabase
      .from('users')
      .select('id, name, rank, department, avatar_url')
      .neq('name', 'テンプレート')
      .is('resigned_at', null)
      .order('name');
    setUsers(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchUsers();
    const ch = supabase
      .channel('org-chart-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, fetchUsers)
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, []);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">
        読み込み中...
      </div>
    );
  }

  const ceo = users.find(u => u.rank === 'CEO');

  // Build dept → members map（1人が複数部門に出現）
  const deptMap = {};
  users.filter(u => u.id !== ceo?.id).forEach(u => {
    const depts = normalizeDepts(u.department);
    const effective = depts.length > 0 ? depts.filter(d => d !== 'CEO') : ['未所属'];
    effective.forEach(d => {
      if (!deptMap[d]) deptMap[d] = [];
      deptMap[d].push(u);
    });
  });

  const sortedDepts = Object.keys(deptMap).sort((a, b) => {
    const ai = DEPT_ORDER.indexOf(a), bi = DEPT_ORDER.indexOf(b);
    if (ai !== -1 && bi !== -1) return ai - bi;
    if (ai !== -1) return -1;
    if (bi !== -1) return 1;
    return a.localeCompare(b, 'ja');
  });

  const totalActive = users.filter(u => u.rank !== 'CEO').length;

  return (
    <div className="flex-1 overflow-auto p-5 min-h-0 bg-slate-50">

      {/* CEO */}
      {ceo && (
        <div className="flex flex-col items-center mb-1">
          <div className="bg-slate-800 text-white rounded-2xl px-6 py-3 flex items-center gap-3 shadow-lg">
            <Avatar name={ceo.name} avatarUrl={ceo.avatar_url} />
            <div>
              <p className="text-sm font-bold leading-tight">{ceo.name}</p>
              <p className="text-xs text-slate-300 mt-0.5">CEO</p>
            </div>
          </div>
          <div className="w-px h-5 bg-slate-300 mt-1" />
          <div className="text-xs text-slate-400 mb-1">在籍 {totalActive}名</div>
        </div>
      )}

      {/* Department columns */}
      <div className="flex gap-3 overflow-x-auto pb-4 items-start">
        {sortedDepts.map(dept => {
          const members = [...deptMap[dept]].sort(
            (a, b) => (RANK_ORDER[a.rank] ?? 9) - (RANK_ORDER[b.rank] ?? 9)
          );
          return (
            <div
              key={dept}
              className="shrink-0 w-48 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col"
            >
              {/* Dept header */}
              <div className="px-3 py-2.5 bg-slate-50 rounded-t-2xl border-b border-slate-100 text-center">
                <p className="text-xs font-bold text-slate-700">{dept}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">{members.length}名</p>
              </div>

              {/* Members */}
              <div className="flex flex-col">
                {members.map(u => {
                  const primaryDept = normalizeDepts(u.department).filter(d => d !== 'CEO')[0];
                  const isSecondary = !!primaryDept && primaryDept !== dept;
                  const badge  = RANK_BADGE[u.rank]  ?? 'bg-slate-100 text-slate-600';
                  const border = RANK_BORDER[u.rank] ?? 'border-l-slate-200';
                  return (
                    <div
                      key={`${dept}-${u.id}`}
                      className={`flex items-center gap-2 px-3 py-2 border-l-4 ${border} border-b border-slate-50 last:border-b-0 last:rounded-b-2xl ${isSecondary ? 'opacity-50' : ''}`}
                    >
                      <Avatar name={u.name} avatarUrl={u.avatar_url} />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-slate-800 truncate leading-tight">
                          {u.name}
                          {isSecondary && (
                            <span className="text-[10px] text-slate-400 ml-1">兼</span>
                          )}
                        </p>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium inline-block mt-0.5 ${badge}`}>
                          {u.rank ?? '未設定'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-3 pt-3 border-t border-slate-200 flex flex-wrap items-center gap-2">
        {Object.entries(RANK_BADGE).map(([rank, color]) => (
          <span key={rank} className={`text-xs px-2 py-0.5 rounded-full ${color}`}>{rank}</span>
        ))}
        <span className="text-xs text-slate-400 ml-2">左の色線 = ランク　「兼」= 他部門兼務（薄表示）</span>
      </div>
    </div>
  );
}
