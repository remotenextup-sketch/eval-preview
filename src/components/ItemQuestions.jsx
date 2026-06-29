import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

function QuestionItem({ q, onAnswer, onDelete, expanded, setExpanded }) {
  const [answerText, setAnswerText]   = useState('');
  const [answererName, setAnswererName] = useState('');
  const [showForm, setShowForm]       = useState(false);
  const [submitting, setSubmitting]   = useState(false);
  const isAnswered = q.status === 'answered';
  const isOpen = expanded[q.id] ?? false;

  return (
    <div className={`rounded-xl border p-3 ${isAnswered ? 'bg-slate-50 border-slate-200' : 'bg-yellow-50 border-yellow-100'}`}>
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-medium text-slate-700">{q.user_name}</span>
          <span className="text-xs text-slate-400">{new Date(q.created_at).toLocaleDateString('ja-JP')}</span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${isAnswered ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
            {isAnswered ? '回答済' : '未回答'}
          </span>
          <button onClick={() => onDelete(q.id)}
            className="text-xs px-1.5 py-0.5 rounded bg-white border border-slate-200 text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors">
            🗑
          </button>
        </div>
      </div>
      {isAnswered ? (
        <button onClick={() => setExpanded(p => ({ ...p, [q.id]: !p[q.id] }))} className="w-full text-left">
          {isOpen ? (
            <>
              <p className="text-sm text-slate-800 mb-2 whitespace-pre-wrap">Q: {q.question}</p>
              <div className="bg-white rounded-lg p-2.5 border border-green-200">
                <p className="text-xs text-green-700 font-medium">A（{q.answered_by}）</p>
                <p className="text-sm text-slate-700 mt-1 whitespace-pre-wrap">{q.answer}</p>
              </div>
              <span className="text-xs text-indigo-500 mt-1 inline-block">閉じる ▲</span>
            </>
          ) : (
            <span className="text-xs text-slate-500 line-clamp-1">Q: {q.question} ▼</span>
          )}
        </button>
      ) : (
        <>
          <p className="text-sm text-slate-800 mb-2">Q: {q.question}</p>
          {!showForm ? (
            <button onClick={() => setShowForm(true)} className="text-xs text-indigo-600 hover:underline">回答する</button>
          ) : (
            <div className="space-y-1.5 mt-1">
              <input type="text" value={answererName} onChange={e => setAnswererName(e.target.value)}
                placeholder="回答者名..."
                className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-300" />
              <textarea value={answerText} onChange={e => setAnswerText(e.target.value)}
                placeholder="回答内容..." rows={2}
                className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white resize-none focus:outline-none focus:ring-1 focus:ring-indigo-300" />
              <div className="flex gap-1.5">
                <button onClick={async () => {
                  if (!answerText.trim() || !answererName.trim()) return;
                  setSubmitting(true);
                  await onAnswer(q.id, answerText.trim(), answererName.trim());
                  setSubmitting(false); setShowForm(false);
                }} disabled={submitting || !answerText.trim() || !answererName.trim()}
                  className="text-xs px-2.5 py-1 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-40">
                  {submitting ? '...' : '回答する'}
                </button>
                <button onClick={() => setShowForm(false)} className="text-xs px-2 py-1 bg-white border border-slate-200 text-slate-500 rounded-lg">キャンセル</button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function ItemQuestionSection({ itemId, itemName, selectedUser, onQuestionCountChange }) {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading]     = useState(false);
  const [questionText, setQuestionText] = useState('');
  const [saving, setSaving]       = useState(false);
  const [expanded, setExpanded]   = useState({});

  const loadQuestions = async (id) => {
    if (!id) return;
    setLoading(true);
    const { data } = await supabase.from('item_questions').select('*').eq('item_id', id)
      .order('created_at', { ascending: false });
    const list = data || [];
    setQuestions(list);
    if (onQuestionCountChange) onQuestionCountChange(id, list.length);
    setLoading(false);
  };

  useEffect(() => {
    setQuestions([]);
    setExpanded({});
    setQuestionText('');
    loadQuestions(itemId);
  }, [itemId]);

  const submitQuestion = async () => {
    const userName = selectedUser?.name ?? '';
    if (!questionText.trim() || !userName) return;
    setSaving(true);
    const { error } = await supabase.from('item_questions')
      .insert({ item_id: itemId, user_name: userName, question: questionText.trim(), status: 'open' });
    if (!error) { setQuestionText(''); await loadQuestions(itemId); }
    setSaving(false);
  };

  const submitAnswer = async (qId, answer, answeredBy) => {
    const { error } = await supabase.from('item_questions')
      .update({ answer, answered_by: answeredBy, status: 'answered' }).eq('id', qId);
    if (!error) setQuestions(prev => prev.map(q => q.id === qId ? { ...q, answer, answered_by: answeredBy, status: 'answered' } : q));
  };

  const deleteQuestion = async (qId) => {
    await supabase.from('item_questions').delete().eq('id', qId);
    const next = questions.filter(q => q.id !== qId);
    setQuestions(next);
    if (onQuestionCountChange) onQuestionCountChange(itemId, next.length);
  };

  if (!itemId) return null;

  return (
    <section>
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
        項目に関する質問{questions.length > 0 && <span className="ml-1 normal-case font-normal text-slate-400">({questions.length}件)</span>}
      </p>
      <div className="bg-slate-50 rounded-xl border border-slate-200 p-3 mb-3 space-y-2">
        {selectedUser?.name && (
          <p className="text-xs text-slate-500">投稿者: <span className="font-medium text-slate-700">{selectedUser.name}</span></p>
        )}
        <textarea value={questionText} onChange={e => setQuestionText(e.target.value)}
          placeholder="この項目について質問してください..." rows={2}
          className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300" />
        <button onClick={submitQuestion} disabled={saving || !questionText.trim() || !selectedUser?.name}
          className="w-full text-sm py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-40">
          {saving ? '投稿中...' : '質問を投稿'}
        </button>
      </div>
      {loading ? <p className="text-xs text-slate-400 text-center py-3">読み込み中...</p>
        : questions.length === 0 ? <p className="text-xs text-slate-400 text-center py-3">まだ質問がありません</p>
        : <div className="space-y-2">{questions.map(q => <QuestionItem key={q.id} q={q} onAnswer={submitAnswer} onDelete={deleteQuestion} expanded={expanded} setExpanded={setExpanded} />)}</div>}
    </section>
  );
}
