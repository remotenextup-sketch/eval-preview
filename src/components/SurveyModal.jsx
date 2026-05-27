import React from 'react';
import SurveyView from './SurveyView';

export default function SurveyModal({ selectedUser, users, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col overflow-hidden"
        style={{ maxHeight: '90vh' }}
      >
        <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between shrink-0 bg-white">
          <h2 className="text-sm font-semibold text-slate-700">サーベイ</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 w-7 h-7 flex items-center justify-center text-lg leading-none"
          >
            ✕
          </button>
        </div>
        <div className="flex-1 overflow-hidden flex flex-col min-h-0">
          <SurveyView selectedUser={selectedUser} users={users} />
        </div>
      </div>
    </div>
  );
}
