import React, { useState, useEffect, useRef } from 'react';
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { supabase } from './supabaseClient';
import { CURRENT_MONTH, MASTER_PIN } from '../constants';

/* ─────────── PIN helpers ─────────── */
const SURVEY_ADMIN_KEY = 'survey_admin_auth';
const readAdminAuth = () => sessionStorage.getItem(SURVEY_ADMIN_KEY) === 'true';

/* ─────────── RatingInput ─────────── */
function RatingInput({ value, onChange }) {
  return (
    <div className="flex gap-2">
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          className={`w-10 h-10 rounded-xl text-sm font-bold transition-colors border-2 ${
            value >= n
              ? 'bg-indigo-600 border-indigo-600 text-white'
              : 'bg-white border-slate-200 text-slate-400 hover:border-indigo-300 hover:text-indigo-500'
          }`}
        >
          {n}
        </button>
      ))}
    </div>
  );
}

/* ─────────── main component ─────────── */
export default function SurveyView({ selectedUser, users }) {
  /* admin auth */
  const [adminAuth, setAdminAuth]     = useState(readAdminAuth);
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinInput, setPinInput]       = useState('');
  const [pinError, setPinError]       = useState('');
  const pinRef = useRef(null);

  /* tab */
  const [tab, setTab] = useState('personal');

  /* personal view */
  const [activeSurveys, setActiveSurveys] = useState([]);
  const [myResponses, setMyResponses]     = useState({}); // surveyId → response
  const [currentSurvey, setCurrentSurvey] = useState(null);
  const [answers, setAnswers]             = useState({});
  const [submitting, setSubmitting]       = useState(false);
  const [personalLoading, setPersonalLoading] = useState(false);

  /* admin – surveys */
  const [allSurveys, setAllSurveys]   = useState([]);
  const [adminSubTab, setAdminSubTab] = useState('surveys'); // 'surveys' | 'results'
  const [editingSurvey, setEditingSurvey] = useState(null); // null | 'new' | survey
  const [surveyForm, setSurveyForm]   = useState({ title: '', frequency: 'monthly', questions: [] });
  const [savingSurvey, setSavingSurvey] = useState(false);

  /* admin – results */
  const [selectedSurveyId, setSelectedSurveyId] = useState('');
  const [allResponses, setAllResponses]           = useState([]);
  const [loadingResponses, setLoadingResponses]   = useState(false);

  /* ── effects ── */
  useEffect(() => {
    if (tab === 'personal' && selectedUser) loadPersonalData();
  }, [tab, selectedUser?.id]);

  useEffect(() => {
    if (tab === 'admin') loadAllSurveys();
  }, [tab]);

  useEffect(() => {
    if (showPinModal) setTimeout(() => pinRef.current?.focus(), 80);
  }, [showPinModal]);

  /* ── personal data ── */
  const loadPersonalData = async () => {
    if (!selectedUser) return;
    setPersonalLoading(true);
    const [{ data: surveys }, { data: responses }] = await Promise.all([
      supabase.from('surveys').select('*').eq('is_active', true).order('created_at'),
      supabase.from('survey_responses').select('*').eq('user_id', selectedUser.id).eq('month', CURRENT_MONTH),
    ]);
    const list = surveys || [];
    setActiveSurveys(list);
    const respMap = {};
    (responses || []).forEach(r => { respMap[r.survey_id] = r; });
    setMyResponses(respMap);
    const first = list.find(s => !respMap[s.id]);
    setCurrentSurvey(first ?? null);
    if (first) initAnswers(first);
    setPersonalLoading(false);
  };

  const initAnswers = (survey) => {
    const init = {};
    (survey.questions || []).forEach(q => { init[q.id] = q.type === 'rating' ? 0 : ''; });
    setAnswers(init);
  };

  const submitAnswer = async () => {
    if (!currentSurvey || !selectedUser) return;
    setSubmitting(true);
    const answersList = (currentSurvey.questions || []).map(q => ({
      questionId: q.id,
      type: q.type,
      text: q.text,
      value: answers[q.id] ?? (q.type === 'rating' ? 0 : ''),
    }));
    const { error } = await supabase.from('survey_responses').insert({
      survey_id: currentSurvey.id,
      user_id: selectedUser.id,
      user_name: selectedUser.name,
      answers: answersList,
      month: CURRENT_MONTH,
    });
    if (!error) {
      const nextMap = { ...myResponses, [currentSurvey.id]: { answers: answersList } };
      setMyResponses(nextMap);
      const next = activeSurveys.find(s => !nextMap[s.id]);
      setCurrentSurvey(next ?? null);
      if (next) initAnswers(next);
    }
    setSubmitting(false);
  };

  /* ── admin – survey management ── */
  const loadAllSurveys = async () => {
    const { data } = await supabase.from('surveys').select('*').order('created_at', { ascending: false });
    setAllSurveys(data || []);
  };

  const startCreate = () => {
    setEditingSurvey('new');
    setSurveyForm({ title: '', frequency: 'monthly', questions: [{ id: 'q' + Date.now(), type: 'rating', text: '' }] });
  };

  const startEdit = (survey) => {
    setEditingSurvey(survey);
    setSurveyForm({ title: survey.title, frequency: survey.frequency || 'monthly', questions: JSON.parse(JSON.stringify(survey.questions || [])) });
  };

  const addQuestion = () => {
    setSurveyForm(f => ({ ...f, questions: [...f.questions, { id: 'q' + Date.now(), type: 'rating', text: '' }] }));
  };

  const removeQuestion = (idx) => {
    setSurveyForm(f => ({ ...f, questions: f.questions.filter((_, i) => i !== idx) }));
  };

  const moveQuestion = (idx, dir) => {
    setSurveyForm(f => {
      const qs = [...f.questions];
      const t = idx + dir;
      if (t < 0 || t >= qs.length) return f;
      [qs[idx], qs[t]] = [qs[t], qs[idx]];
      return { ...f, questions: qs };
    });
  };

  const updateQuestion = (idx, field, value) => {
    setSurveyForm(f => {
      const qs = [...f.questions];
      qs[idx] = { ...qs[idx], [field]: value };
      return { ...f, questions: qs };
    });
  };

  const saveSurvey = async () => {
    if (!surveyForm.title.trim() || !surveyForm.questions.length) return;
    setSavingSurvey(true);
    const payload = {
      title: surveyForm.title.trim(),
      frequency: surveyForm.frequency,
      questions: surveyForm.questions,
    };
    let error;
    if (editingSurvey === 'new') {
      ({ error } = await supabase.from('surveys').insert({ ...payload, is_active: true }));
    } else {
      ({ error } = await supabase.from('surveys').update(payload).eq('id', editingSurvey.id));
    }
    if (!error) { await loadAllSurveys(); setEditingSurvey(null); }
    setSavingSurvey(false);
  };

  const toggleActive = async (survey) => {
    await supabase.from('surveys').update({ is_active: !survey.is_active }).eq('id', survey.id);
    setAllSurveys(prev => prev.map(s => s.id === survey.id ? { ...s, is_active: !s.is_active } : s));
  };

  /* ── admin – results ── */
  const loadResponses = async (surveyId) => {
    setLoadingResponses(true);
    const { data } = await supabase.from('survey_responses')
      .select('*')
      .eq('survey_id', surveyId)
      .order('month').order('created_at');
    setAllResponses(data || []);
    setLoadingResponses(false);
  };

  const handleSurveySelect = (id) => {
    setSelectedSurveyId(id);
    if (id) loadResponses(id);
  };

  /* ── admin PIN ── */
  const handleAdminAuth = () => {
    if (pinInput.trim() === MASTER_PIN) {
      sessionStorage.setItem(SURVEY_ADMIN_KEY, 'true');
      setAdminAuth(true);
      setShowPinModal(false);
      setTab('admin');
      setPinInput(''); setPinError('');
    } else {
      setPinError('PINが正しくありません');
    }
  };

  const handleAdminLogout = () => {
    sessionStorage.removeItem(SURVEY_ADMIN_KEY);
    setAdminAuth(false);
    setTab('personal');
  };

  /* ── computed results ── */
  const selectedSurvey = allSurveys.find(s => s.id === selectedSurveyId);

  const monthlyScoreData = (() => {
    if (!selectedSurvey || !allResponses.length) return [];
    const ratingQs = (selectedSurvey.questions || []).filter(q => q.type === 'rating');
    if (!ratingQs.length) return [];
    const byMonth = {};
    allResponses.forEach(r => {
      if (!r.month) return;
      const avg = ratingQs.reduce((s, q) => {
        const a = (r.answers || []).find(a => a.questionId === q.id);
        return s + (a ? Number(a.value) : 0);
      }, 0) / ratingQs.length;
      if (!byMonth[r.month]) byMonth[r.month] = [];
      byMonth[r.month].push(avg);
    });
    return Object.entries(byMonth).sort(([a], [b]) => a.localeCompare(b)).map(([month, scores]) => ({
      month,
      avg: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length * 10) / 10,
    }));
  })();

  const questionScoreData = (() => {
    if (!selectedSurvey || !allResponses.length) return [];
    return (selectedSurvey.questions || []).filter(q => q.type === 'rating').map(q => {
      const vals = allResponses.map(r => {
        const a = (r.answers || []).find(a => a.questionId === q.id);
        return a && Number(a.value) > 0 ? Number(a.value) : null;
      }).filter(v => v !== null);
      return {
        text: q.text.length > 18 ? q.text.slice(0, 18) + '…' : q.text,
        fullText: q.text,
        avg: vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length * 10) / 10 : 0,
        count: vals.length,
      };
    });
  })();

  const textAnswers = (() => {
    if (!selectedSurvey || !allResponses.length) return [];
    return (selectedSurvey.questions || []).filter(q => q.type === 'text').map(q => ({
      question: q.text,
      answers: allResponses.map(r => {
        const a = (r.answers || []).find(a => a.questionId === q.id);
        return a?.value ? { user: r.user_name, value: a.value, month: r.month } : null;
      }).filter(Boolean),
    })).filter(q => q.answers.length > 0);
  })();

  const responseStatus = (() => {
    if (!selectedSurveyId || !users.length) return null;
    const latestMonth = allResponses.length
      ? [...new Set(allResponses.map(r => r.month))].sort().reverse()[0]
      : CURRENT_MONTH;
    const respondedIds = new Set(allResponses.filter(r => r.month === latestMonth).map(r => r.user_id));
    return { month: latestMonth, respondedIds };
  })();

  /* ═══════════════ RENDER ═══════════════ */
  return (
    <div className="flex-1 flex flex-col overflow-hidden">

      {/* PIN modal for admin */}
      {showPinModal && (
        <div className="fixed inset-0 bg-slate-900/70 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xs p-6 space-y-4">
            <div>
              <h2 className="text-base font-bold text-slate-800">管理者認証</h2>
              <p className="text-xs text-slate-500 mt-0.5">管理者用PINを入力してください</p>
            </div>
            <input
              ref={pinRef}
              type="password"
              autoComplete="off"
              value={pinInput}
              onChange={e => setPinInput(e.target.value.replace(/\D/g, '').slice(0, 4))}
              onKeyDown={e => e.key === 'Enter' && handleAdminAuth()}
              inputMode="numeric"
              placeholder="••••"
              className="w-full text-center text-2xl tracking-[0.6em] border-2 border-slate-200 rounded-xl px-3 py-3 focus:outline-none focus:border-indigo-400 bg-slate-50 font-mono"
            />
            {pinError && <p className="text-xs text-red-500 text-center">{pinError}</p>}
            <div className="flex gap-2">
              <button onClick={handleAdminAuth}
                className={`flex-1 text-sm py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 font-medium ${pinInput.length < 4 ? 'opacity-40 cursor-not-allowed' : ''}`}>
                認証
              </button>
              <button onClick={() => { setShowPinModal(false); setPinInput(''); setPinError(''); }}
                className="flex-1 text-sm py-2 bg-white border border-slate-300 text-slate-600 rounded-xl hover:bg-slate-50">
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tab bar */}
      <div className="bg-white border-b border-slate-200 px-4 py-2 flex items-center gap-2 shrink-0">
        <div className="flex rounded-lg border border-slate-200 overflow-hidden text-xs">
          <button onClick={() => setTab('personal')}
            className={`px-3 py-1.5 transition-colors ${tab === 'personal' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>
            回答する
          </button>
          {adminAuth && (
            <button onClick={() => setTab('admin')}
              className={`px-3 py-1.5 transition-colors ${tab === 'admin' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>
              管理者ビュー
            </button>
          )}
        </div>
        <div className="flex-1" />
        {adminAuth ? (
          <button onClick={handleAdminLogout} className="text-xs text-slate-400 hover:text-slate-600 px-2 py-1 rounded hover:bg-slate-100">
            管理者ログアウト
          </button>
        ) : (
          <button onClick={() => setShowPinModal(true)} className="text-xs text-slate-400 hover:text-slate-600 px-2 py-1 rounded hover:bg-slate-100">
            管理者モード
          </button>
        )}
      </div>

      {/* ─── PERSONAL VIEW ─── */}
      {tab === 'personal' && (
        <div className="flex-1 overflow-y-auto bg-slate-50 p-5">
          <div className="max-w-xl mx-auto space-y-4">
            {selectedUser && (
              <p className="text-xs text-slate-500">
                回答者: <span className="font-semibold text-slate-700">{selectedUser.name}</span>
                　対象月: <span className="font-semibold text-slate-700">{CURRENT_MONTH}</span>
              </p>
            )}

            {personalLoading ? (
              <div className="text-center py-12 text-slate-400 text-sm">読み込み中...</div>
            ) : activeSurveys.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-400 text-sm">
                現在アクティブなサーベイはありません
              </div>
            ) : (
              <>
                {/* 回答済みサーベイ */}
                {activeSurveys.filter(s => myResponses[s.id]).map(s => (
                  <div key={s.id} className="bg-green-50 border border-green-200 rounded-2xl px-5 py-4 flex items-center gap-3">
                    <span className="text-green-500 text-lg">✓</span>
                    <div>
                      <p className="text-sm font-semibold text-slate-700">{s.title}</p>
                      <p className="text-xs text-green-600 mt-0.5">今月は回答済みです</p>
                    </div>
                  </div>
                ))}

                {/* 未回答サーベイ – 回答フォーム */}
                {currentSurvey && (
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="px-5 py-4 border-b border-slate-100 bg-indigo-50">
                      <h2 className="text-sm font-bold text-indigo-700">{currentSurvey.title}</h2>
                      <p className="text-xs text-indigo-500 mt-0.5">
                        {(currentSurvey.questions || []).length}問 / {currentSurvey.frequency === 'monthly' ? '月次' : '週次'}
                      </p>
                    </div>
                    <div className="p-5 space-y-6">
                      {(currentSurvey.questions || []).map((q, idx) => (
                        <div key={q.id}>
                          <p className="text-sm font-medium text-slate-700 mb-2">
                            <span className="text-indigo-400 font-bold mr-1">Q{idx + 1}.</span>
                            {q.text}
                          </p>
                          {q.type === 'rating' ? (
                            <div className="space-y-1">
                              <RatingInput
                                value={answers[q.id] ?? 0}
                                onChange={v => setAnswers(a => ({ ...a, [q.id]: v }))}
                              />
                              <p className="text-xs text-slate-400">1 = 低い　5 = 高い</p>
                            </div>
                          ) : (
                            <textarea
                              value={answers[q.id] ?? ''}
                              onChange={e => setAnswers(a => ({ ...a, [q.id]: e.target.value }))}
                              rows={3}
                              placeholder="自由に記入してください"
                              className="w-full text-sm border border-slate-300 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
                            />
                          )}
                        </div>
                      ))}
                    </div>
                    <div className="px-5 pb-5">
                      <button
                        onClick={submitAnswer}
                        disabled={submitting || (currentSurvey.questions || []).some(q => q.type === 'rating' && (answers[q.id] ?? 0) === 0)}
                        className="w-full text-sm py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-40 font-medium"
                      >
                        {submitting ? '送信中...' : '回答を送信する'}
                      </button>
                      {(currentSurvey.questions || []).some(q => q.type === 'rating' && (answers[q.id] ?? 0) === 0) && (
                        <p className="text-xs text-slate-400 text-center mt-1.5">評価項目（1〜5）を全て選択してください</p>
                      )}
                    </div>
                  </div>
                )}

                {/* 全回答済み */}
                {!currentSurvey && activeSurveys.every(s => myResponses[s.id]) && (
                  <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
                    <p className="text-2xl mb-2">🎉</p>
                    <p className="text-sm font-semibold text-slate-700">今月のサーベイは全て回答済みです</p>
                    <p className="text-xs text-slate-400 mt-1">来月もよろしくお願いします</p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* ─── ADMIN VIEW ─── */}
      {tab === 'admin' && adminAuth && (
        <div className="flex-1 overflow-hidden flex flex-col">
          {/* admin sub-tab */}
          <div className="bg-white border-b border-slate-200 px-4 pt-0 flex">
            {[['surveys', 'サーベイ管理'], ['results', '回答結果']].map(([v, l]) => (
              <button key={v} onClick={() => setAdminSubTab(v)}
                className={`text-sm px-4 py-3 font-medium border-b-2 transition-colors ${adminSubTab === v ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
                {l}
              </button>
            ))}
          </div>

          {/* ── サーベイ管理 ── */}
          {adminSubTab === 'surveys' && (
            <div className="flex-1 overflow-y-auto bg-slate-50 p-5">
              <div className="max-w-2xl mx-auto space-y-4">
                {editingSurvey ? (
                  /* 編集 / 作成フォーム */
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-slate-700">
                        {editingSurvey === 'new' ? 'サーベイを作成' : 'サーベイを編集'}
                      </h3>
                      <button onClick={() => setEditingSurvey(null)} className="text-slate-400 hover:text-slate-600 text-lg leading-none">✕</button>
                    </div>
                    <div className="p-5 space-y-5">
                      {/* タイトル */}
                      <div>
                        <label className="text-xs font-medium text-slate-500 block mb-1">タイトル *</label>
                        <input
                          value={surveyForm.title}
                          onChange={e => setSurveyForm(f => ({ ...f, title: e.target.value }))}
                          placeholder="例: 月次エンゲージメントサーベイ"
                          className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                        />
                      </div>
                      {/* 頻度 */}
                      <div>
                        <label className="text-xs font-medium text-slate-500 block mb-1.5">頻度</label>
                        <div className="flex gap-2">
                          {[['monthly', '月次'], ['weekly', '週次']].map(([v, l]) => (
                            <button key={v} type="button" onClick={() => setSurveyForm(f => ({ ...f, frequency: v }))}
                              className={`text-xs px-4 py-1.5 rounded-lg border font-medium transition-colors ${surveyForm.frequency === v ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-300 hover:border-indigo-400'}`}>
                              {l}
                            </button>
                          ))}
                        </div>
                      </div>
                      {/* 質問 */}
                      <div>
                        <label className="text-xs font-medium text-slate-500 block mb-2">質問 ({surveyForm.questions.length}件)</label>
                        <div className="space-y-2">
                          {surveyForm.questions.map((q, idx) => (
                            <div key={q.id} className="flex items-start gap-2 bg-slate-50 rounded-xl p-3">
                              {/* 順番変更 */}
                              <div className="flex flex-col gap-0.5 shrink-0 mt-0.5">
                                <button type="button" onClick={() => moveQuestion(idx, -1)} disabled={idx === 0}
                                  className="text-slate-300 hover:text-slate-500 disabled:opacity-20 text-xs leading-none">▲</button>
                                <button type="button" onClick={() => moveQuestion(idx, 1)} disabled={idx === surveyForm.questions.length - 1}
                                  className="text-slate-300 hover:text-slate-500 disabled:opacity-20 text-xs leading-none">▼</button>
                              </div>
                              {/* タイプ */}
                              <select
                                value={q.type}
                                onChange={e => updateQuestion(idx, 'type', e.target.value)}
                                className="text-xs border border-slate-300 rounded-lg px-2 py-1.5 bg-white focus:outline-none shrink-0"
                              >
                                <option value="rating">5段階評価</option>
                                <option value="text">テキスト</option>
                              </select>
                              {/* テキスト */}
                              <input
                                value={q.text}
                                onChange={e => updateQuestion(idx, 'text', e.target.value)}
                                placeholder={`質問 ${idx + 1}`}
                                className="flex-1 text-sm border border-slate-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                              />
                              {/* 削除 */}
                              <button type="button" onClick={() => removeQuestion(idx)}
                                className="text-red-300 hover:text-red-500 text-sm shrink-0 mt-0.5">✕</button>
                            </div>
                          ))}
                        </div>
                        <button type="button" onClick={addQuestion}
                          className="mt-2 text-xs text-indigo-600 hover:underline font-medium">
                          ＋ 質問を追加
                        </button>
                      </div>
                    </div>
                    <div className="px-5 pb-5 flex gap-2">
                      <button onClick={saveSurvey} disabled={savingSurvey || !surveyForm.title.trim() || !surveyForm.questions.length}
                        className="flex-1 text-sm py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-40 font-medium">
                        {savingSurvey ? '保存中...' : editingSurvey === 'new' ? '作成する' : '更新する'}
                      </button>
                      <button onClick={() => setEditingSurvey(null)} className="text-sm px-4 py-2 bg-white border border-slate-300 text-slate-600 rounded-xl hover:bg-slate-50">
                        キャンセル
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <button onClick={startCreate}
                      className="w-full text-sm py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 font-medium">
                      ＋ 新規サーベイを作成
                    </button>
                    {allSurveys.length === 0 ? (
                      <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-400 text-sm">
                        サーベイがありません
                      </div>
                    ) : allSurveys.map(s => (
                      <div key={s.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-semibold text-slate-700">{s.title}</p>
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                                {s.is_active ? 'アクティブ' : '非アクティブ'}
                              </span>
                            </div>
                            <p className="text-xs text-slate-400 mt-0.5">
                              {s.frequency === 'monthly' ? '月次' : '週次'} ／ {(s.questions || []).length}問
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-2 flex-wrap">
                          <button onClick={() => startEdit(s)}
                            className="text-xs px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 font-medium">
                            編集
                          </button>
                          <button onClick={() => toggleActive(s)}
                            className={`text-xs px-3 py-1.5 rounded-lg font-medium ${s.is_active ? 'bg-amber-50 text-amber-600 hover:bg-amber-100' : 'bg-green-50 text-green-600 hover:bg-green-100'}`}>
                            {s.is_active ? '非アクティブにする' : 'アクティブにする'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </div>
          )}

          {/* ── 回答結果 ── */}
          {adminSubTab === 'results' && (
            <div className="flex-1 overflow-y-auto bg-slate-50 p-5">
              <div className="max-w-3xl mx-auto space-y-5">
                {/* サーベイ選択 */}
                <div>
                  <label className="text-xs font-medium text-slate-500 block mb-1">サーベイを選択</label>
                  <select
                    value={selectedSurveyId}
                    onChange={e => handleSurveySelect(e.target.value)}
                    className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  >
                    <option value="">選択してください</option>
                    {allSurveys.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
                  </select>
                </div>

                {loadingResponses && <p className="text-slate-400 text-sm text-center py-8">読み込み中...</p>}

                {selectedSurvey && !loadingResponses && allResponses.length === 0 && (
                  <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-400 text-sm">
                    まだ回答データがありません
                  </div>
                )}

                {selectedSurvey && !loadingResponses && allResponses.length > 0 && (
                  <>
                    {/* 全体スコア推移 */}
                    {monthlyScoreData.length > 0 && (
                      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                        <h3 className="text-sm font-semibold text-slate-700 mb-3">平均スコア推移（月次）</h3>
                        <ResponsiveContainer width="100%" height={200}>
                          <LineChart data={monthlyScoreData} margin={{ top: 4, right: 16, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                            <YAxis tick={{ fontSize: 11 }} domain={[0, 5]} />
                            <Tooltip formatter={v => [`${v}`, '平均スコア']} />
                            <Line type="monotone" dataKey="avg" stroke="#6366f1" strokeWidth={2.5} dot={{ r: 4, fill: '#6366f1' }} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    )}

                    {/* 質問別スコア */}
                    {questionScoreData.length > 0 && (
                      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                        <h3 className="text-sm font-semibold text-slate-700 mb-3">質問別平均スコア（全期間）</h3>
                        <ResponsiveContainer width="100%" height={180}>
                          <BarChart data={questionScoreData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                            <XAxis dataKey="text" tick={{ fontSize: 10 }} />
                            <YAxis tick={{ fontSize: 11 }} domain={[0, 5]} />
                            <Tooltip
                              formatter={(v, _, props) => [`${v}`, '平均スコア']}
                              labelFormatter={(_, payload) => payload?.[0]?.payload?.fullText ?? ''}
                            />
                            <Bar dataKey="avg" fill="#6366f1" radius={[4, 4, 0, 0]}
                              label={{ position: 'top', fontSize: 10, formatter: v => v }} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    )}

                    {/* 自由回答 */}
                    {textAnswers.map(q => (
                      <div key={q.question} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="px-5 py-3 border-b border-slate-100 bg-slate-50">
                          <h3 className="text-sm font-semibold text-slate-700">{q.question}</h3>
                        </div>
                        <div className="divide-y divide-slate-100">
                          {q.answers.map((a, i) => (
                            <div key={i} className="px-5 py-3">
                              <div className="flex items-center gap-2 mb-0.5">
                                <span className="text-xs font-medium text-slate-600">{a.user}</span>
                                <span className="text-xs text-slate-400">{a.month}</span>
                              </div>
                              <p className="text-sm text-slate-700 whitespace-pre-wrap">{a.value}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}

                    {/* メンバー別回答状況 */}
                    {responseStatus && (
                      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
                          <h3 className="text-sm font-semibold text-slate-700">メンバー別回答状況</h3>
                          <span className="text-xs text-slate-400">{responseStatus.month}</span>
                        </div>
                        <div className="p-4 flex flex-wrap gap-2">
                          {users.map(u => {
                            const responded = responseStatus.respondedIds.has(u.id);
                            return (
                              <span key={u.id}
                                className={`text-xs px-3 py-1.5 rounded-full font-medium ${responded ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                                {u.name} {responded ? '✓' : '未回答'}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
