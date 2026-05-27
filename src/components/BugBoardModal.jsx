import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

const PRIORITY_LABELS = { low: '低', medium: '中', high: '高' };
const PRIORITY_COLORS = { low: 'bg-slate-100 text-slate-600', medium: 'bg-yellow-100 text-yellow-700', high: 'bg-red-100 text-red-700' };
const STATUS_LABELS = { open: '未対応', in_progress: '対応中', resolved: '解決済み' };
const STATUS_COLORS = { open: 'bg-red-50 border-red-200', in_progress: 'bg-yellow-50 border-yellow-200', resolved: 'bg-slate-50 border-slate-200' };
const STATUS_BADGE = { open: 'bg-red-500 text-white', in_progress: 'bg-yellow-500 text-white', resolved: 'bg-slate-400 text-white' };

export default function BugBoardModal({ onClose }) {
  const isAdmin = sessionStorage.getItem('is_admin_mode') === 'true';

  const [bugs, setBugs]           = useState([]);
  const [loading, setLoading]     = useState(true);
  const [filter, setFilter]       = useState('unresolved');
  const [selectedBug, setSelectedBug] = useState(null);
  const [comments, setComments]   = useState([]);
  const [commentsLoading, setCommentsLoading] = useState(false);

  const [showForm, setShowForm]   = useState(false);
  const [form, setForm]           = useState({ user_name: '', title: '', description: '', priority: 'medium' });
  const [submitting, setSubmitting] = useState(false);

  const [commentUser, setCommentUser] = useState('');
  const [commentText, setCommentText] = useState('');
  const [addingComment, setAddingComment] = useState(false);

  useEffect(() => { fetchBugs(); }, []);

  const fetchBugs = async () => {
    setLoading(true);
    const { data } = await supabase.from('bug_reports').select('*').order('created_at', { ascending: false });
    setBugs(data || []);
    setLoading(false);
  };

  const fetchComments = async (bugId) => {
    setCommentsLoading(true);
    setComments([]);
    const { data } = await supabase.from('bug_comments').select('*').eq('bug_id', bugId).order('created_at', { ascending: true });
    setComments(data || []);
    setCommentsLoading(false);
  };

  const selectBug = (bug) => {
    setSelectedBug(bug);
    fetchComments(bug.id);
    setCommentText('');
  };

  const submitBug = async () => {
    if (!form.user_name.trim() || !form.title.trim() || !form.description.trim()) return;
    setSubmitting(true);
    const { data, error } = await supabase.from('bug_reports').insert({ ...form }).select().single();
    if (!error && data) {
      setBugs(prev => [data, ...prev]);
      setForm({ user_name: '', title: '', description: '', priority: 'medium' });
      setShowForm(false);
      selectBug(data);
    }
    setSubmitting(false);
  };

  const addComment = async () => {
    if (!commentText.trim() || !commentUser.trim() || !selectedBug) return;
    setAddingComment(true);
    const { data, error } = await supabase.from('bug_comments')
      .insert({ bug_id: selectedBug.id, user_name: commentUser.trim(), content: commentText.trim() })
      .select().single();
    if (!error && data) {
      setComments(prev => [...prev, data]);
      setCommentText('');
    }
    setAddingComment(false);
  };

  const updateStatus = async (bugId, status) => {
    const { error } = await supabase.from('bug_reports')
      .update({ status, updated_at: new Date().toISOString() }).eq('id', bugId);
    if (!error) {
      setBugs(prev => prev.map(b => b.id === bugId ? { ...b, status } : b));
      setSelectedBug(prev => prev?.id === bugId ? { ...prev, status } : prev);
    }
  };

  const updatePriority = async (bugId, priority) => {
    const { error } = await supabase.from('bug_reports')
      .update({ priority, updated_at: new Date().toISOString() }).eq('id', bugId);
    if (!error) {
      setBugs(prev => prev.map(b => b.id === bugId ? { ...b, priority } : b));
      setSelectedBug(prev => prev?.id === bugId ? { ...prev, priority } : prev);
    }
  };

  const filteredBugs = bugs.filter(b => {
    if (filter === 'unresolved') return b.status !== 'resolved';
    if (filter === 'resolved') return b.status === 'resolved';
    return true;
  });

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl flex flex-col overflow-hidden" style={{ maxHeight: '90vh' }}>

        {/* ヘッダー */}
        <div className="px-5 py-3 border-b border-slate-200 flex items-center gap-3 shrink-0 flex-wrap">
          <span className="text-base">🐛</span>
          <h2 className="text-sm font-semibold text-slate-700">バグ報告掲示板</h2>
          <div className="flex rounded border border-slate-200 overflow-hidden">
            {[['all','全て'],['unresolved','未解決'],['resolved','解決済み']].map(([v, l]) => (
              <button key={v} onClick={() => setFilter(v)}
                className={`px-2.5 py-1 text-xs transition-colors ${filter === v ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>
                {l}
              </button>
            ))}
          </div>
          {isAdmin && <span className="text-xs bg-amber-100 text-amber-700 font-semibold px-2 py-0.5 rounded-full">管理者モード</span>}
          <button
            onClick={() => setShowForm(v => !v)}
            className={`text-xs px-3 py-1 rounded-lg font-medium transition-colors ml-auto ${showForm ? 'bg-slate-200 text-slate-700 hover:bg-slate-300' : 'bg-red-500 text-white hover:bg-red-600'}`}>
            {showForm ? 'キャンセル' : '＋ バグ報告'}
          </button>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 w-7 h-7 flex items-center justify-center text-lg leading-none shrink-0">✕</button>
        </div>

        <div className="flex-1 flex overflow-hidden min-h-0">
          {/* 左ペイン：一覧 */}
          <div className="w-72 shrink-0 border-r border-slate-200 flex flex-col overflow-hidden">
            {showForm && (
              <div className="p-4 border-b border-slate-200 bg-slate-50 space-y-2.5 shrink-0">
                <p className="text-xs font-semibold text-slate-600">新しいバグを報告</p>
                <div>
                  <label className="text-[10px] font-medium text-slate-500 block mb-0.5">投稿者名</label>
                  <input value={form.user_name} onChange={e => setForm(p => ({ ...p, user_name: e.target.value }))}
                    placeholder="あなたの名前"
                    className="w-full text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-red-300" />
                </div>
                <div>
                  <label className="text-[10px] font-medium text-slate-500 block mb-0.5">タイトル</label>
                  <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                    placeholder="バグのタイトル"
                    className="w-full text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-red-300" />
                </div>
                <div>
                  <label className="text-[10px] font-medium text-slate-500 block mb-0.5">詳細説明</label>
                  <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                    placeholder="バグの詳細・再現手順など" rows={3}
                    className="w-full text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 resize-none focus:outline-none focus:ring-2 focus:ring-red-300" />
                </div>
                <div>
                  <label className="text-[10px] font-medium text-slate-500 block mb-0.5">優先度</label>
                  <div className="flex gap-1.5">
                    {[['low','低'],['medium','中'],['high','高']].map(([v, l]) => (
                      <button key={v} onClick={() => setForm(p => ({ ...p, priority: v }))}
                        className={`flex-1 text-xs py-1 rounded-lg border transition-colors ${form.priority === v ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300 text-slate-600 hover:bg-slate-50'}`}>
                        {l}
                      </button>
                    ))}
                  </div>
                </div>
                <button onClick={submitBug}
                  disabled={submitting || !form.user_name.trim() || !form.title.trim() || !form.description.trim()}
                  className="w-full text-xs py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-40 font-medium transition-colors">
                  {submitting ? '送信中...' : '送信する'}
                </button>
              </div>
            )}

            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <p className="text-xs text-slate-400 text-center py-8">読み込み中...</p>
              ) : filteredBugs.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-8">報告はありません</p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {filteredBugs.map(bug => (
                    <button key={bug.id} onClick={() => selectBug(bug)}
                      className={`w-full text-left px-4 py-3 transition-colors ${selectedBug?.id === bug.id ? 'bg-indigo-50' : 'hover:bg-slate-50'}`}>
                      <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${STATUS_BADGE[bug.status]}`}>{STATUS_LABELS[bug.status]}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${PRIORITY_COLORS[bug.priority]}`}>{PRIORITY_LABELS[bug.priority]}優先</span>
                      </div>
                      <p className="text-xs font-medium text-slate-700 leading-snug">{bug.title}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">{bug.user_name} · {bug.created_at?.slice(0, 10)}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 右ペイン：詳細＋コメント */}
          <div className="flex-1 flex flex-col overflow-hidden min-w-0">
            {selectedBug ? (
              <>
                <div className="flex-1 overflow-y-auto p-5 space-y-4">
                  {/* バグ詳細 */}
                  <div className={`rounded-xl border p-4 ${STATUS_COLORS[selectedBug.status]}`}>
                    <div className="flex items-start gap-2 mb-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-800 leading-snug">{selectedBug.title}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{selectedBug.user_name} · {selectedBug.created_at?.slice(0, 10)}</p>
                      </div>
                      <div className="flex gap-1.5 shrink-0 flex-wrap justify-end">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[selectedBug.status]}`}>{STATUS_LABELS[selectedBug.status]}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PRIORITY_COLORS[selectedBug.priority]}`}>{PRIORITY_LABELS[selectedBug.priority]}優先</span>
                      </div>
                    </div>
                    <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">{selectedBug.description}</p>

                    {/* 管理者コントロール */}
                    {isAdmin && (
                      <div className="mt-3 pt-3 border-t border-slate-200 space-y-2">
                        <div>
                          <p className="text-[10px] font-semibold text-slate-500 mb-1.5">ステータス変更</p>
                          <div className="flex gap-1.5">
                            {[['open','未対応'],['in_progress','対応中'],['resolved','解決済み']].map(([v, l]) => (
                              <button key={v} onClick={() => updateStatus(selectedBug.id, v)}
                                className={`text-xs px-2 py-1 rounded-lg border transition-colors ${selectedBug.status === v ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300 text-slate-600 hover:bg-slate-50'}`}>
                                {l}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <p className="text-[10px] font-semibold text-slate-500 mb-1.5">優先度変更</p>
                          <div className="flex gap-1.5">
                            {[['low','低優先'],['medium','中優先'],['high','高優先']].map(([v, l]) => (
                              <button key={v} onClick={() => updatePriority(selectedBug.id, v)}
                                className={`text-xs px-2 py-1 rounded-lg border transition-colors ${selectedBug.priority === v ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300 text-slate-600 hover:bg-slate-50'}`}>
                                {l}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* コメント一覧 */}
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                      コメント{comments.length > 0 && <span className="ml-1 normal-case font-normal text-slate-400">({comments.length}件)</span>}
                    </p>
                    {commentsLoading ? (
                      <p className="text-xs text-slate-400 text-center py-4">読み込み中...</p>
                    ) : comments.length === 0 ? (
                      <p className="text-xs text-slate-400 text-center py-4">コメントはありません</p>
                    ) : (
                      <div className="space-y-2">
                        {comments.map(c => (
                          <div key={c.id} className="bg-white rounded-xl border border-slate-200 px-3 py-2.5">
                            <p className="text-[10px] text-slate-500 mb-1 font-medium">{c.user_name} · {c.created_at?.slice(0, 10)}</p>
                            <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">{c.content}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* コメント投稿フォーム */}
                <div className="shrink-0 border-t border-slate-200 p-4 bg-white space-y-2">
                  <input
                    value={commentUser}
                    onChange={e => setCommentUser(e.target.value)}
                    placeholder="あなたの名前"
                    className="w-full text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  />
                  <textarea
                    value={commentText}
                    onChange={e => setCommentText(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        if (commentText.trim() && commentUser.trim()) addComment();
                      }
                    }}
                    placeholder="コメントを入力（Enterで送信、Shift+Enterで改行）"
                    rows={2}
                    className="w-full text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  />
                  <button onClick={addComment}
                    disabled={addingComment || !commentText.trim() || !commentUser.trim()}
                    className="w-full text-xs py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-40 font-medium transition-colors">
                    {addingComment ? '送信中...' : 'コメントを送信'}
                  </button>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-slate-300 text-sm">
                バグを選択してください
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
