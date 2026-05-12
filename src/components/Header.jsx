import React, { useState } from 'react';
import { ADMIN_PASSWORD } from '../constants';

export default function Header({
  view, setView, users, selectedUser, setSelectedUser,
  currentMonthCount, showPersonalChart, setShowPersonalChart,
  plans, showPlanView, setShowPlanView,
  adminAuthed, setAdminAuthed,
}) {
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [adminInput, setAdminInput] = useState('');
  const [adminError, setAdminError] = useState(false);

  const handleTabClick = (v) => {
    if (v === 'admin' && !adminAuthed) {
      setShowAdminModal(true);
      setAdminInput('');
      setAdminError(false);
    } else {
      setView(v);
    }
  };

  const confirmAdmin = () => {
    if (adminInput === ADMIN_PASSWORD) {
      setAdminAuthed(true);
      setView('admin');
      setShowAdminModal(false);
      setAdminInput('');
      setAdminError(false);
    } else {
      setAdminError(true);
    }
  };

  return (
    <>
      <header className="bg-white shadow-sm sticky top-0 z-20">
        <div className="max-w-full px-4 py-3 flex flex-wrap items-center gap-3">
          <h1 className="text-base font-bold text-slate-800 shrink-0">人事評価</h1>
          <div className="flex rounded-lg border border-slate-200 overflow-hidden text-xs shrink-0">
            {[['personal','個人'],['overall','全体'],['department','部門別'],['admin','管理'],['members','メンバー'],['salary','時給']].map(([v,l]) => (
              <button key={v} onClick={() => handleTabClick(v)}
                className={`px-3 py-1.5 transition-colors ${view === v ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
              >{l}</button>
            ))}
          </div>
          <select value={selectedUser?.id ?? ''} onChange={e => { const u = users.find(u => u.id === e.target.value); if (u) setSelectedUser(u); }}
            className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400 max-w-[200px]">
            {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
          {selectedUser?.rank && <span className="bg-indigo-100 text-indigo-700 text-xs font-semibold px-2.5 py-1 rounded-full">{selectedUser.rank}</span>}
          {view === 'personal' && (
            <>
              <button
                onClick={() => setShowPersonalChart(prev => !prev)}
                className={`text-xs font-bold px-2.5 py-1 rounded-full transition-colors ${
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
                onClick={() => { setShowPlanView(prev => !prev); setShowPersonalChart(false); }}
                className={`text-xs font-bold px-2.5 py-1 rounded-full transition-colors ${
                  showPlanView
                    ? 'bg-blue-700 text-white ring-2 ring-blue-300'
                    : plans.length > 0
                      ? 'bg-blue-500 text-white hover:bg-blue-600'
                      : 'bg-slate-200 text-slate-500 hover:bg-slate-300'
                }`}
              >
                計画 {plans.length}件
              </button>
            </>
          )}
          {view === 'admin' && selectedUser && (
            <span className="text-xs text-slate-400 bg-slate-100 px-2.5 py-1 rounded-full">投稿者: {selectedUser.name}</span>
          )}
        </div>
      </header>
      {showAdminModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-xs p-6 space-y-4">
            <h2 className="text-sm font-bold text-slate-800">管理者パスワードを入力</h2>
            <input
              type="password"
              value={adminInput}
              onChange={e => { setAdminInput(e.target.value); setAdminError(false); }}
              onKeyDown={e => e.key === 'Enter' && confirmAdmin()}
              placeholder="パスワード..."
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300"
              autoFocus
            />
            {adminError && <p className="text-xs text-red-500">パスワードが違います</p>}
            <div className="flex gap-2">
              <button onClick={confirmAdmin}
                className="flex-1 text-sm py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">
                確認
              </button>
              <button onClick={() => { setShowAdminModal(false); setAdminInput(''); setAdminError(false); }}
                className="flex-1 text-sm py-2 bg-white border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors">
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
