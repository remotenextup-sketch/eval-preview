import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { DEPT_COLORS } from '../constants';

export default function DepartmentView({ overallLoading, completedProgress, allUsersData }) {
  if (overallLoading) return <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">読み込み中...</div>;

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

  const { departments, data } = departmentMonthlyData;

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <h2 className="text-base font-semibold text-slate-700 mb-4">部署別 月次クリア数</h2>
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
        {data.length > 0 ? (
          <ResponsiveContainer width="100%" height={360}>
            <LineChart data={data} margin={{ top: 8, right: 16, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="month" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {departments.map((dept, i) => (
                <Line key={dept} type="monotone" dataKey={dept} stroke={DEPT_COLORS[i % DEPT_COLORS.length]} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        ) : <p className="text-slate-400 text-sm text-center py-8">データなし</p>}
      </div>
    </div>
  );
}
