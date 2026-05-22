import React from 'react';

export default function Header({
  view, setView, users, selectedUser, setSelectedUser,
  currentMonthCount, showPersonalChart, setShowPersonalChart,
  plans, showPlanView, setShowPlanView,
  surveyUnread,
  showQuestionsPanel, setShowQuestionsPanel,
}) {
  return (
    <>
      <header className="bg-white shadow-sm sticky top-0 z-20">
        <div className="max-w-full px-3 py-1.5 flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-slate-700 shrink-0">人事評価</span>
          <div className="flex rounded border border-slate-200 overflow-hidden shrink-0">
            {[['personal','個人'],['overall','全体'],['survey','サーベイ'],['admin','管理'],['members','メンバー'],['salary','時給']].map(([v,l]) => (
              <button key={v} onClick={() => setView(v)}
                className={`relative px-2.5 py-1 text-xs transition-colors ${view === v ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
              >
                {l}
                {v === 'survey' && surveyUnread && (
                  <span className="absolute top-0.5 right-0.5 w-2 h-2 bg-red-500 rounded-full" />
                )}
              </button>
            ))}
          </div>
          <select value={selectedUser?.id ?? ''} onChange={e => { const u = users.find(u => u.id === e.target.value); if (u) setSelectedUser(u); }}
            className="border border-slate-300 rounded px-2 py-1 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400 max-w-[160px]">
            {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
          {selectedUser?.rank && <span className="bg-indigo-100 text-indigo-700 text-xs font-semibold px-2 py-0.5 rounded-full">{selectedUser.rank}</span>}
          {view === 'personal' && (
            <>
              <button
                onClick={() => setShowPersonalChart(prev => !prev)}
                className={`text-xs font-bold px-2 py-0.5 rounded-full transition-colors ${
                  showPersonalChart
                    ? 'bg-emerald-700 text-white ring-2 ring-emerald-300'
                    : currentMonthCount > 0
                      ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                      : 'bg-slate-200 text-slate-500 hover:bg-slate-300'
                }`}
              >
                今月 {currentMonthCount}件クリア 📊
              </button>
              <button
                onClick={() => { setShowPlanView(prev => !prev); setShowPersonalChart(false); setShowQuestionsPanel(false); }}
                className={`text-xs font-bold px-2 py-0.5 rounded-full transition-colors ${
                  showPlanView
                    ? 'bg-blue-700 text-white ring-2 ring-blue-300'
                    : plans.length > 0
                      ? 'bg-blue-500 text-white hover:bg-blue-600'
                      : 'bg-slate-200 text-slate-500 hover:bg-slate-300'
                }`}
              >
                計画 {plans.length}件
              </button>
              <button
                onClick={() => { setShowQuestionsPanel(prev => !prev); setShowPersonalChart(false); setShowPlanView(false); }}
                className={`text-xs font-bold px-2 py-0.5 rounded-full transition-colors ${
                  showQuestionsPanel
                    ? 'bg-violet-700 text-white ring-2 ring-violet-300'
                    : 'bg-violet-100 text-violet-700 hover:bg-violet-200'
                }`}
              >
                質問に答える
              </button>
            </>
          )}
          {view === 'admin' && selectedUser && (
            <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">投稿者: {selectedUser.name}</span>
          )}
        </div>
      </header>
    </>
  );
}
