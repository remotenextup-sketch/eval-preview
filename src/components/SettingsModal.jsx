import React, { useState } from 'react';
import { supabase } from './supabaseClient';
import { MASTER_PIN } from '../constants';

export const ADMIN_SESSION_KEY = 'is_admin_mode';

export default function SettingsModal({ selectedUser, onClose }) {
  const [tab, setTab] = useState('pin');

  // PIN変更
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin]         = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinError, setPinError]     = useState('');
  const [pinSuccess, setPinSuccess] = useState('');
  const [saving, setSaving]         = useState(false);

  // 管理者モード
  const [isAdminMode, setIsAdminMode]       = useState(() => sessionStorage.getItem(ADMIN_SESSION_KEY) === 'true');
  const [masterPinInput, setMasterPinInput] = useState('');
  const [masterPinError, setMasterPinError] = useState('');

  const handlePinChange = async () => {
    setPinError(''); setPinSuccess('');
    if (!currentPin || !newPin || !confirmPin) { setPinError('全ての項目を入力してください'); return; }
    if (newPin.length !== 4) { setPinError('新しいPINは4桁で入力してください'); return; }
    if (newPin !== confirmPin) { setPinError('新しいPINと確認用PINが一致しません'); return; }
    setSaving(true);
    const { data: user } = await supabase.from('users').select('pin_code').eq('id', selectedUser.id).maybeSingle();
    if (user?.pin_code && user.pin_code !== currentPin) {
      setPinError('現在のPINが正しくありません');
      setSaving(false);
      return;
    }
    const { error } = await supabase.from('users').update({ pin_code: newPin }).eq('id', selectedUser.id);
    if (error) {
      setPinError('保存に失敗しました');
    } else {
      setPinSuccess('PINを変更しました');
      setCurrentPin(''); setNewPin(''); setConfirmPin('');
    }
    setSaving(false);
  };

  const handleAdminToggle = () => {
    if (isAdminMode) {
      sessionStorage.removeItem(ADMIN_SESSION_KEY);
      setIsAdminMode(false);
      setMasterPinError('');
    } else {
      if (masterPinInput === MASTER_PIN) {
        sessionStorage.setItem(ADMIN_SESSION_KEY, 'true');
        setIsAdminMode(true);
        setMasterPinInput('');
        setMasterPinError('');
      } else {
        setMasterPinError('マスターPINが正しくありません');
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-700">設定</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 w-7 h-7 flex items-center justify-center text-lg leading-none">✕</button>
        </div>

        <div className="flex border-b border-slate-200">
          {[['pin','PINコード変更'],['admin','管理者モード']].map(([v, l]) => (
            <button key={v} onClick={() => setTab(v)}
              className={`flex-1 text-xs py-2.5 font-medium border-b-2 transition-colors ${tab === v ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
              {l}
            </button>
          ))}
        </div>

        <div className="p-5">
          {tab === 'pin' ? (
            <div className="space-y-3">
              {[
                { label: '現在のPIN', val: currentPin, set: setCurrentPin },
                { label: '新しいPIN（4桁）', val: newPin, set: setNewPin },
                { label: '新しいPIN（確認）', val: confirmPin, set: setConfirmPin },
              ].map(({ label, val, set }) => (
                <div key={label}>
                  <label className="text-xs font-medium text-slate-500 block mb-1">{label}</label>
                  <input
                    type="password"
                    value={val}
                    onChange={e => { set(e.target.value.replace(/\D/g, '').slice(0, 4)); setPinError(''); setPinSuccess(''); }}
                    onKeyDown={e => e.key === 'Enter' && handlePinChange()}
                    inputMode="numeric"
                    placeholder="••••"
                    className="w-full text-center text-xl tracking-[0.5em] border border-slate-300 rounded-lg px-3 py-2 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  />
                </div>
              ))}
              {pinError   && <p className="text-xs text-red-500">{pinError}</p>}
              {pinSuccess && <p className="text-xs text-green-600 font-medium">{pinSuccess}</p>}
              <button
                onClick={handlePinChange}
                disabled={saving || !currentPin || !newPin || !confirmPin}
                className="w-full text-sm py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-40 font-medium transition-colors"
              >
                {saving ? '保存中...' : 'PINを変更する'}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className={`rounded-xl p-3 border ${isAdminMode ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-200'}`}>
                <div className="flex items-center gap-2">
                  <span className="text-xl">{isAdminMode ? '🔓' : '🔒'}</span>
                  <div>
                    <p className="text-sm font-semibold text-slate-700">管理者モード</p>
                    <p className={`text-xs ${isAdminMode ? 'text-amber-600 font-medium' : 'text-slate-400'}`}>
                      {isAdminMode ? 'ON（有効）' : 'OFF（無効）'}
                    </p>
                  </div>
                </div>
              </div>
              {!isAdminMode && (
                <div>
                  <label className="text-xs font-medium text-slate-500 block mb-1">マスターPINを入力</label>
                  <input
                    type="password"
                    value={masterPinInput}
                    onChange={e => { setMasterPinInput(e.target.value.replace(/\D/g, '').slice(0, 4)); setMasterPinError(''); }}
                    onKeyDown={e => e.key === 'Enter' && handleAdminToggle()}
                    inputMode="numeric"
                    placeholder="••••"
                    className="w-full text-center text-xl tracking-[0.5em] border border-slate-300 rounded-lg px-3 py-2 font-mono focus:outline-none focus:ring-2 focus:ring-amber-300"
                  />
                  {masterPinError && <p className="text-xs text-red-500 mt-1">{masterPinError}</p>}
                </div>
              )}
              <button
                onClick={handleAdminToggle}
                disabled={!isAdminMode && masterPinInput.length < 4}
                className={`w-full text-sm py-2 rounded-xl font-medium transition-colors disabled:opacity-40 ${
                  isAdminMode ? 'bg-slate-200 text-slate-700 hover:bg-slate-300' : 'bg-amber-500 text-white hover:bg-amber-600'
                }`}
              >
                {isAdminMode ? '管理者モードをOFFにする' : '管理者モードをONにする'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
