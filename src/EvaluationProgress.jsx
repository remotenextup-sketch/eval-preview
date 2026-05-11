import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import confetti from 'canvas-confetti';
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Cell,
} from 'recharts';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const STATUSES = [
  { value: 'pending',         label: '未着手',     bg: 'bg-gray-50',   border: 'border-l-gray-300',  badge: 'bg-gray-200 text-gray-700',   bar: '#9ca3af' },
  { value: 'in_progress',     label: '取り組み中', bg: 'bg-yellow-50', border: 'border-l-yellow-400',badge: 'bg-yellow-100 text-yellow-800',bar: '#fbbf24' },
  { value: 'clear_scheduled', label: 'クリア予定', bg: 'bg-purple-50', border: 'border-l-purple-400',badge: 'bg-purple-100 text-purple-800',bar: '#a78bfa' },
  { value: 'clear_reported',  label: 'クリア報告', bg: 'bg-blue-50',   border: 'border-l-blue-400',  badge: 'bg-blue-100 text-blue-800',   bar: '#60a5fa' },
  { value: 'completed',       label: '完了',       bg: 'bg-green-50',  border: 'border-l-green-400', badge: 'bg-green-100 text-green-800', bar: '#34d399' },
];
const STATUS_MAP = Object.fromEntries(STATUSES.map(s => [s.value, s]));
const FILTER_TABS = [{ value: 'all', label: '全て' }, ...STATUSES.map(s => ({ value: s.value, label: s.label }))];

const now = new Date();
const CURRENT_MONTH = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}`;

const RANK_TRANSITIONS = [
  { key: 'onboarding', label: 'オンボ',         from: 'onboarding_at',  to: 'trainee_at'    },
  { key: 'trainee',    label: 'トレーニー',     from: 'trainee_at',     to: 'partner_at'    },
  { key: 'partner',    label: 'パートナー',     from: 'partner_at',     to: 'leader_at'     },
  { key: 'leader',     label: 'リーダー',       from: 'leader_at',      to: 'specialist_at' },
  { key: 'specialist', label: 'スペシャリスト', from: 'specialist_at',  to: 'director_at'   },
];

const RANK_OPTIONS = ['オンボーディング','トレーニー','パートナー','リーダー','スペシャリスト','ディレクター'];
const DEPT_COLORS  = ['#6366f1','#f59e0b','#10b981','#ef4444','#8b5cf6','#ec4899','#06b6d4','#84cc16'];
const RANK_SALARY = {
  'オンボーディング':     { base: 1163, bonus: 0 },
  'トレーニー':           { base: 1300, bonus: 0 },
  'パートナー':           { base: 1300, bonus: 0 },
  'リーダー':             { base: 1300, bonus: 0 },
  'スペシャリスト':       { base: 1300, bonus: 3 },
  'ディレクター':         { base: 1400, bonus: 5 },
  'ブランドマネージャー': { base: 1600, bonus: 5 },
  'ゼネラルマネージャー': { base: 1800, bonus: 5 },
};
const ADMIN_PASSWORD = 'boss2024';
const RANK_CHART_COLORS = ['#6366f1','#f59e0b','#10b981','#ef4444','#8b5cf6','#ec4899','#06b6d4','#84cc16','#f97316','#64748b'];
const EMPTY_ITEM_FORM   = { item_name: '', rank: '', description: '', is_salary_item: false };
const EMPTY_MEMBER_FORM = { name: '', email: '', rank: '', department: [], mall: '', onboarding_at: '' };

const DEFAULT_DEPARTMENTS = ['CEO','秘書','カスタマー','物流','採用','商品開発','商品改善','経理','広告運用','デザイン','Amazon','楽天','Yahoo','フィットイージー'];

// ============================================================
export default function EvaluationProgress() {
  const [view, setView] = useState('personal');

  // ── 個人ビュー ──
  const [users, setUsers]               = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [items, setItems]               = useState([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [monthFilter, setMonthFilter]   = useState('all');
  const [loading, setLoading]           = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [mobileShowDetail, setMobileShowDetail] = useState(false);
  const [showPersonalChart, setShowPersonalChart] = useState(false);
  const [evidenceText, setEvidenceText] = useState({});
  const [uploading, setUploading]       = useState({});

  // ── 全体/部門別 ──
  const [overallLoading, setOverallLoading] = useState(false);
  const [overallLoaded, setOverallLoaded]   = useState(false);
  const [completedProgress, setCompletedProgress] = useState([]);
  const [stuckProgress, setStuckProgress]   = useState([]);
  const [allItemDefs, setAllItemDefs]       = useState([]);
  const [allUsersData, setAllUsersData]     = useState([]);
  const [expandedStuck, setExpandedStuck]   = useState(null);
  const [rankActiveOnly, setRankActiveOnly] = useState(true);

  // ── 管理タブ ──
  const [adminItems, setAdminItems]               = useState([]);
  const [adminLoaded, setAdminLoaded]             = useState(false);
  const [selectedAdminItem, setSelectedAdminItem] = useState(null);
  const [adminForm, setAdminForm]                 = useState(EMPTY_ITEM_FORM);
  const [savingAdminForm, setSavingAdminForm]     = useState(false);
  const [mobileShowAdminEdit, setMobileShowAdminEdit] = useState(false);
  const [proposals, setProposals]                 = useState([]);
  const [proposalContent, setProposalContent]     = useState('');
  const [savingProposal, setSavingProposal]       = useState(false);
  const [mtgMode, setMtgMode]                     = useState(false);
  // item_comments（件数バッジ用のみ親で管理、詳細は ItemCommentsSection で管理）
  const [itemCommentCounts, setItemCommentCounts] = useState({});  // { [item_id]: number }

  // ── 全体タブ グラフモード ──
  const [overallChartMode, setOverallChartMode] = useState('all'); // 'all'|'rank'|'personal'
  const [overallIndivUser, setOverallIndivUser] = useState(null);

  // ── 時給タブ ──
  const [salaryTab, setSalaryTab] = useState('personal'); // 'personal'|'admin'

  // ── NG理由モーダル ──
  const [ngModal, setNgModal]           = useState(null); // { progressId, evidenceId }
  const [ngReasonText, setNgReasonText] = useState('');

  // ── クリア計画 ──
  const [plans, setPlans]               = useState([]);
  const [plansLoading, setPlansLoading] = useState(false);
  const [showPlanView, setShowPlanView] = useState(false);
  const [planForm, setPlanForm]         = useState({ item_id: '', planned_month: '', start_date: '', due_date: '', created_by: '' });
  const [savingPlan, setSavingPlan]     = useState(false);

  // ── メンバー管理タブ ──
  const [membersKey, setMembersKey]     = useState(0);
  const [availableRanks, setAvailableRanks] = useState([...RANK_OPTIONS]);

  // ① users
  useEffect(() => {
    supabase.from('users').select('id, name, rank, progress_name').is('resigned_at', null).order('name')
      .then(({ data }) => {
        if (!data) return;
        const valid = data.filter(u => u.name && u.name !== 'テンプレート');
        setUsers(valid);
        if (valid.length) setSelectedUser(valid[0]);
      });
  }, []);

  // ランク一覧（evaluation_items + localStorage カスタム）
  useEffect(() => {
    supabase.from('evaluation_items').select('rank').not('rank', 'is', null)
      .then(({ data }) => {
        const dbRanks = [...new Set((data || []).map(r => r.rank))];
        const saved   = JSON.parse(localStorage.getItem('customRanks') || '[]');
        setAvailableRanks([...new Set([...RANK_OPTIONS, ...dbRanks, ...saved])]);
      });
  }, []);

  const addCustomRank = (rankName) => {
    if (!rankName || availableRanks.includes(rankName)) return;
    const next = [...availableRanks, rankName];
    setAvailableRanks(next);
    const saved = JSON.parse(localStorage.getItem('customRanks') || '[]');
    localStorage.setItem('customRanks', JSON.stringify([...new Set([...saved, rankName])]));
  };

  const refreshUsers = useCallback(() => {
    supabase.from('users').select('id, name, rank, progress_name').is('resigned_at', null).order('name')
      .then(({ data }) => {
        if (!data) return;
        const valid = data.filter(u => u.name && u.name !== 'テンプレート');
        setUsers(valid);
      });
  }, []);

  // ② 全体/部門別データ
  useEffect(() => {
    if ((view !== 'overall' && view !== 'department') || overallLoaded) return;
    setOverallLoading(true);
    Promise.all([
      supabase.from('evaluation_progress').select('achieved_month, user_name, item_no').eq('status', 'completed').limit(5000),
      supabase.from('evaluation_progress').select('item_no, created_at, user_name').in('status', ['pending', 'in_progress']).limit(5000),
      supabase.from('evaluation_items').select('no, item_name, rank').limit(1000),
      supabase.from('users').select('id, name, progress_name, rank, department, resigned_at, onboarding_at, trainee_at, partner_at, leader_at, specialist_at, director_at').neq('name', 'テンプレート').limit(200),
    ]).then(([c, s, i, u]) => {
      setCompletedProgress(c.data || []);
      setStuckProgress(s.data || []);
      setAllItemDefs(i.data || []);
      setAllUsersData(u.data || []);
      setOverallLoaded(true);
      setOverallLoading(false);
    });
  }, [view, overallLoaded]);

  // ③ 管理タブデータ + リアルタイム
  useEffect(() => {
    if (view !== 'admin' || adminLoaded) return;
    Promise.all([
      supabase.from('evaluation_items').select('*').order('no'),
      supabase.from('improvement_proposals').select('*').order('created_at', { ascending: false }),
      supabase.from('item_comments').select('item_id').limit(5000),
    ]).then(([its, props, cmts]) => {
      setAdminItems(its.data || []);
      setProposals(props.data || []);
      const counts = {};
      (cmts.data || []).forEach(c => { counts[c.item_id] = (counts[c.item_id] || 0) + 1; });
      setItemCommentCounts(counts);
      setAdminLoaded(true);
    });
  }, [view, adminLoaded]);

  useEffect(() => {
    if (view !== 'admin') return;
    const ch = supabase.channel('admin-rt')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'improvement_proposals' }, ({ new: p }) => {
        setProposals(prev => prev.some(x => x.id === p.id) ? prev : [p, ...prev]);
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'evaluation_items' }, ({ new: item }) => {
        setAdminItems(prev => prev.some(x => x.id === item.id) ? prev : [...prev, item]);
      })
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [view]);

  // ④ 個人進捗取得
  const loadItems = useCallback(async () => {
    if (!selectedUser) return;
    setLoading(true);
    setSelectedItem(null);
    setMobileShowDetail(false);
    const [{ data: progress }, { data: itemDefs }] = await Promise.all([
      supabase.from('evaluation_progress').select('*, evaluation_evidences(*)').eq('user_name', selectedUser.progress_name ?? selectedUser.name).order('item_no', { ascending: true }),
      supabase.from('evaluation_items').select('id, no, item_name, description, rank, is_salary_item').eq('rank', selectedUser.rank),
    ]);
    const itemMap = {};
    (itemDefs || []).forEach(d => { if (d.no != null) itemMap[d.no] = d; });
    const merged = (progress || [])
      .filter(p => itemMap[p.item_no] != null)
      .map(p => ({ ...p, item_name: itemMap[p.item_no].item_name, description: itemMap[p.item_no].description ?? '', item_def_id: itemMap[p.item_no].id, is_salary_item: itemMap[p.item_no].is_salary_item ?? false }));
    setItems(merged);
    setLoading(false);
  }, [selectedUser]);

  useEffect(() => { loadItems(); }, [loadItems]);

  // ユーザー切り替え時にフィルターをリセット（前ユーザーの絞り込みが残るバグ対策）
  useEffect(() => {
    setStatusFilter('all');
    setMonthFilter('all');
  }, [selectedUser?.id]);

  // ⑤ クリア計画
  useEffect(() => {
    if (!selectedUser || view !== 'personal') return;
    setPlansLoading(true);
    supabase.from('evaluation_plans')
      .select('*, evaluation_items(item_name)')
      .eq('user_id', selectedUser.id)
      .neq('status', 'achieved')
      .order('due_date', { ascending: true, nullsFirst: false })
      .then(({ data }) => { setPlans(data || []); setPlansLoading(false); });
  }, [selectedUser, view]);

  // ── 個人ビュー集計 ──
  const currentMonthCount = items.filter(i => i.status === 'completed' && i.achieved_month === CURRENT_MONTH).length;
  const monthlyCounts = items
    .filter(i => i.status === 'completed' && /^\d{4}\/\d{2}$/.test(i.achieved_month ?? ''))
    .reduce((acc, i) => { acc[i.achieved_month] = (acc[i.achieved_month] || 0) + 1; return acc; }, {});
  const timelineData = Object.entries(monthlyCounts).sort(([a], [b]) => a.localeCompare(b)).map(([month, count]) => ({ month, count }));
  const availableMonths = [...new Set(items.filter(i => /^\d{4}\/\d{2}$/.test(i.achieved_month ?? '')).map(i => i.achieved_month))].sort();
  const filteredItems = items.filter(i => {
    if (statusFilter !== 'all' && i.status !== statusFilter) return false;
    if (monthFilter !== 'all' && i.achieved_month !== monthFilter) return false;
    return true;
  });
  const statusCounts = STATUSES.reduce((acc, s) => { acc[s.value] = items.filter(i => i.status === s.value).length; return acc; }, {});

  // ── 全体ビュー集計 ──
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

  // ── 個人ビュー: 昇給項目サマリー ──
  const salarySummary = (() => {
    const sal = items.filter(i => i.is_salary_item);
    const done = sal.filter(i => i.status === 'completed').length;
    return { total: sal.length, done, remaining: sal.length - done };
  })();

  // ── 全体ビュー: ランク別クリア件数 ──
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

  // ── 管理タブ: ランク別コメントあり項目数 ──
  const rankCommentSummary = RANK_OPTIONS
    .map(rank => ({ rank, count: adminItems.filter(i => i.rank === rank && (itemCommentCounts[i.id] || 0) > 0).length }))
    .filter(r => r.count > 0);

  // ── 管理タブ関数 ──
  const selectAdminItem = (item) => {
    setSelectedAdminItem(item);
    setAdminForm(item === 'new'
      ? EMPTY_ITEM_FORM
      : { item_name: item.item_name, rank: item.rank ?? '', description: item.description ?? '', is_salary_item: item.is_salary_item ?? false });
    setMobileShowAdminEdit(true);
  };

  const saveAdminForm = async () => {
    if (!adminForm.item_name.trim() || !adminForm.rank) return;
    setSavingAdminForm(true);
    if (selectedAdminItem === 'new') {
      const { data, error } = await supabase.from('evaluation_items').insert({ ...adminForm, status: 'active' }).select().single();
      if (!error && data) {
        setAdminItems(prev => prev.some(x => x.id === data.id) ? prev : [...prev, data]);
        setSelectedAdminItem(data);
      }
    } else {
      const { error } = await supabase.from('evaluation_items').update(adminForm).eq('id', selectedAdminItem.id);
      if (!error) {
        const updated = { ...selectedAdminItem, ...adminForm };
        setAdminItems(prev => prev.map(i => i.id === selectedAdminItem.id ? updated : i));
        setSelectedAdminItem(updated);
      }
    }
    setSavingAdminForm(false);
  };

  const archiveAdminItem = async () => {
    if (!selectedAdminItem || selectedAdminItem === 'new') return;
    const { error } = await supabase.from('evaluation_items').update({ status: 'archived' }).eq('id', selectedAdminItem.id);
    if (!error) {
      setAdminItems(prev => prev.map(i => i.id === selectedAdminItem.id ? { ...i, status: 'archived' } : i));
      setSelectedAdminItem(prev => ({ ...prev, status: 'archived' }));
    }
  };

  const saveProposal = async () => {
    if (!proposalContent.trim() || !selectedUser) return;
    setSavingProposal(true);
    const { data, error } = await supabase.from('improvement_proposals')
      .insert({ user_id: selectedUser.id, user_name: selectedUser.name, content: proposalContent })
      .select().single();
    if (!error && data) { setProposals(prev => prev.some(x => x.id === data.id) ? prev : [data, ...prev]); setProposalContent(''); }
    setSavingProposal(false);
  };

  const adoptProposal = (proposal) => {
    selectAdminItem('new');
    setAdminForm({ item_name: proposal.content.split('\n')[0].substring(0, 100), rank: '', description: proposal.content, is_salary_item: false });
    updateProposalStatus(proposal.id, 'adopted');
    if (mtgMode) setMtgMode(false);
  };

  const updateProposalStatus = async (id, status) => {
    const { error } = await supabase.from('improvement_proposals').update({ status }).eq('id', id);
    if (!error) setProposals(prev => prev.map(p => p.id === id ? { ...p, status } : p));
  };

  // ── 個人ビューのデータ操作 ──
  const updateStatus = async (id, newStatus) => {
    const { error } = await supabase.from('evaluation_progress').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', id);
    if (!error) {
      setItems(prev => prev.map(i => i.id === id ? { ...i, status: newStatus } : i));
      setSelectedItem(prev => prev?.id === id ? { ...prev, status: newStatus } : prev);
      if (newStatus === 'completed') {
        confetti({ particleCount: 120, spread: 70, origin: { y: 0.6 } });
        setTimeout(() => {
          confetti({ particleCount: 55, angle: 60,  spread: 55, origin: { x: 0,   y: 0.65 } });
          confetti({ particleCount: 55, angle: 120, spread: 55, origin: { x: 1,   y: 0.65 } });
        }, 350);
        // 計画を自動達成
        const item = items.find(i => i.id === id);
        if (item?.item_def_id && selectedUser?.id) {
          supabase.from('evaluation_plans').update({ status: 'achieved' })
            .eq('user_id', selectedUser.id).eq('item_id', item.item_def_id).eq('status', 'planned')
            .then(() => setPlans(prev => prev.filter(p => p.item_id !== item.item_def_id)));
        }
      }
    }
  };
  const updateMemo = async (id, memo) => {
    await supabase.from('evaluation_progress').update({ memo, updated_at: new Date().toISOString() }).eq('id', id);
    setItems(prev => prev.map(i => i.id === id ? { ...i, memo } : i));
    setSelectedItem(prev => prev?.id === id ? { ...prev, memo } : prev);
  };
  const addTextEvidence = async (progressId) => {
    const text = (evidenceText[progressId] ?? '').trim();
    if (!text) return;
    const { data, error } = await supabase.from('evaluation_evidences').insert({ progress_id: progressId, evidence_type: 'text', content: text }).select().single();
    if (!error && data) {
      const addEv = item => ({ ...item, evaluation_evidences: [...(item.evaluation_evidences ?? []), data] });
      setItems(prev => prev.map(i => i.id === progressId ? addEv(i) : i));
      setSelectedItem(prev => prev?.id === progressId ? addEv(prev) : prev);
      setEvidenceText(prev => ({ ...prev, [progressId]: '' }));
    }
  };
  const uploadImage = async (progressId, file) => {
    setUploading(prev => ({ ...prev, [progressId]: true }));
    const ext = file.name.split('.').pop();
    const filePath = `${progressId}/${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from('evidences').upload(filePath, file);
    if (!upErr) {
      const { data: { publicUrl } } = supabase.storage.from('evidences').getPublicUrl(filePath);
      const { data, error } = await supabase.from('evaluation_evidences').insert({ progress_id: progressId, evidence_type: 'image', content: publicUrl }).select().single();
      if (!error && data) {
        const addEv = item => ({ ...item, evaluation_evidences: [...(item.evaluation_evidences ?? []), data] });
        setItems(prev => prev.map(i => i.id === progressId ? addEv(i) : i));
        setSelectedItem(prev => prev?.id === progressId ? addEv(prev) : prev);
      }
    }
    setUploading(prev => ({ ...prev, [progressId]: false }));
  };
  const deleteEvidence = async (progressId, evidenceId) => {
    const { error } = await supabase.from('evaluation_evidences').delete().eq('id', evidenceId);
    if (!error) {
      const rmEv = item => ({ ...item, evaluation_evidences: (item.evaluation_evidences ?? []).filter(e => e.id !== evidenceId) });
      setItems(prev => prev.map(i => i.id === progressId ? rmEv(i) : i));
      setSelectedItem(prev => prev?.id === progressId ? rmEv(prev) : prev);
    }
  };
  const updateEvidenceQuality = (progressId, evidenceId, quality) => {
    if (quality === 'bad') {
      setNgModal({ progressId, evidenceId });
      setNgReasonText('');
      return;
    }
    supabase.from('evaluation_evidences').update({ quality, ng_reason: null }).eq('id', evidenceId).then(({ error }) => {
      if (!error) {
        const upEv = item => ({ ...item, evaluation_evidences: (item.evaluation_evidences ?? []).map(e => e.id === evidenceId ? { ...e, quality, ng_reason: null } : e) });
        setItems(prev => prev.map(i => i.id === progressId ? upEv(i) : i));
        setSelectedItem(prev => prev?.id === progressId ? upEv(prev) : prev);
      }
    });
  };

  const confirmNgReason = async () => {
    if (!ngModal) return;
    const { progressId, evidenceId } = ngModal;
    const reason = ngReasonText.trim() || null;
    const { error } = await supabase.from('evaluation_evidences').update({ quality: 'bad', ng_reason: reason }).eq('id', evidenceId);
    if (!error) {
      const upEv = item => ({ ...item, evaluation_evidences: (item.evaluation_evidences ?? []).map(e => e.id === evidenceId ? { ...e, quality: 'bad', ng_reason: reason } : e) });
      setItems(prev => prev.map(i => i.id === progressId ? upEv(i) : i));
      setSelectedItem(prev => prev?.id === progressId ? upEv(prev) : prev);
    }
    setNgModal(null);
    setNgReasonText('');
  };
  const addPlan = async () => {
    if (!selectedUser || !planForm.item_id || !planForm.due_date) return;
    setSavingPlan(true);
    const { data, error } = await supabase.from('evaluation_plans').insert({
      user_id: selectedUser.id,
      item_id: planForm.item_id,
      planned_month: planForm.planned_month || null,
      start_date: planForm.start_date || null,
      due_date: planForm.due_date,
      created_by: planForm.created_by.trim() || 'self',
      status: 'planned',
    }).select('*, evaluation_items(item_name)').single();
    if (!error && data) {
      setPlans(prev => [...prev, data].sort((a, b) => (a.due_date ?? '').localeCompare(b.due_date ?? '')));
      setPlanForm({ item_id: '', planned_month: '', start_date: '', due_date: '', created_by: '' });
    }
    setSavingPlan(false);
  };

  const achievePlan = async (planId) => {
    const { error } = await supabase.from('evaluation_plans').update({ status: 'achieved' }).eq('id', planId);
    if (!error) setPlans(prev => prev.filter(p => p.id !== planId));
  };

  const deletePlan = async (planId) => {
    const { error } = await supabase.from('evaluation_plans').delete().eq('id', planId);
    if (!error) setPlans(prev => prev.filter(p => p.id !== planId));
  };

  const detailProps = selectedItem ? {
    item: selectedItem, onStatusChange: updateStatus, onMemoChange: updateMemo,
    evidenceText: evidenceText[selectedItem.id] ?? '',
    onEvidenceTextChange: val => setEvidenceText(prev => ({ ...prev, [selectedItem.id]: val })),
    onAddText: () => addTextEvidence(selectedItem.id),
    onImageUpload: file => uploadImage(selectedItem.id, file),
    isUploading: uploading[selectedItem.id] ?? false,
    onDeleteEvidence: evidenceId => deleteEvidence(selectedItem.id, evidenceId),
    onUpdateEvidenceQuality: (evidenceId, quality) => updateEvidenceQuality(selectedItem.id, evidenceId, quality),
  } : null;

  // ============================================================
  // ヘッダー
  // ============================================================
  const Header = () => (
    <header className="bg-white shadow-sm sticky top-0 z-20">
      <div className="max-w-full px-4 py-3 flex flex-wrap items-center gap-3">
        <h1 className="text-base font-bold text-slate-800 shrink-0">人事評価</h1>
        <div className="flex rounded-lg border border-slate-200 overflow-hidden text-xs shrink-0">
          {[['personal','個人'],['overall','全体'],['department','部門別'],['admin','管理'],['members','メンバー'],['salary','時給']].map(([v,l]) => (
            <button key={v} onClick={() => setView(v)}
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
  );

  // ============================================================
  // 左ペイン（個人ビュー）
  // ============================================================
  const ListPane = ({ onItemClick, activeId }) => (
    <div className="flex flex-col h-full">
      <div className="bg-white border-b border-slate-200 px-4 py-3 space-y-2 shrink-0">
        {!loading && salarySummary.total > 0 && (
          <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3">
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-xs font-semibold text-indigo-700">昇給項目の進捗</p>
              <p className="text-xs font-bold text-indigo-600">{salarySummary.done}/{salarySummary.total}件</p>
            </div>
            <div className="w-full bg-indigo-100 rounded-full h-2 mb-1.5">
              <div className="bg-indigo-500 h-2 rounded-full transition-all"
                style={{ width: `${salarySummary.total > 0 ? Math.round((salarySummary.done / salarySummary.total) * 100) : 0}%` }} />
            </div>
            <p className="text-xs text-indigo-400 text-right">
              {salarySummary.remaining > 0 ? `残り${salarySummary.remaining}件でランク卒業` : 'ランク卒業達成！'}
            </p>
          </div>
        )}
        <div className="flex flex-wrap gap-1.5">
          {FILTER_TABS.map(tab => (
            <button key={tab.value} onClick={() => setStatusFilter(tab.value)}
              className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${statusFilter === tab.value ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
              {tab.label}{tab.value !== 'all' && <span className="ml-1 opacity-70">({statusCounts[tab.value] ?? 0})</span>}
            </button>
          ))}
        </div>
        {availableMonths.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1.5 border-t border-slate-100">
            <button onClick={() => setMonthFilter('all')} className={`text-xs px-2.5 py-1 rounded-full transition-colors ${monthFilter === 'all' ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>全月</button>
            {availableMonths.map(m => (
              <button key={m} onClick={() => setMonthFilter(m)} className={`text-xs px-2.5 py-1 rounded-full transition-colors ${monthFilter === m ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>{m}</button>
            ))}
          </div>
        )}
        <p className="text-xs text-slate-400">{selectedUser?.rank && `ランク「${selectedUser.rank}」 `}{filteredItems.length}件表示 / 全{items.length}件</p>
      </div>
      <div className="flex-1 overflow-y-auto">
        {loading ? <div className="text-center py-16 text-slate-400 text-sm">読み込み中...</div>
          : filteredItems.length === 0 ? <div className="text-center py-16 text-slate-400 text-sm">該当する項目がありません</div>
          : (
            <div className="divide-y divide-slate-100">
              {filteredItems.map(item => {
                const st = STATUS_MAP[item.status] ?? STATUS_MAP.pending;
                const evidences = item.evaluation_evidences ?? [];
                const isActive = item.id === activeId;
                return (
                  <div key={item.id} onClick={() => onItemClick(item)}
                    className={`px-4 py-3 cursor-pointer flex items-start gap-2 border-l-4 transition-colors ${st.border} ${isActive ? 'bg-indigo-50' : `${st.bg} hover:brightness-95`}`}>
                    <span className="text-xs text-slate-400 w-8 shrink-0 pt-0.5">#{item.item_no}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-800 leading-snug">{item.item_name}</p>
                      <div className="flex flex-wrap items-center gap-1.5 mt-1">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${st.badge}`}>{st.label}</span>
                        {item.achieved_month && <span className="text-xs text-slate-400">{item.achieved_month}</span>}
                        {item.memo && <span className="text-xs text-slate-400">📝</span>}
                        {evidences.length > 0 && <span className="text-xs text-slate-400">📎{evidences.length}</span>}
                      </div>
                    </div>
                    <span className="text-slate-300 text-xs pt-0.5">›</span>
                  </div>
                );
              })}
            </div>
          )}
      </div>
    </div>
  );

  // ============================================================
  // 右ペイン大グラフ
  // ============================================================
  const TimelineGraph = () => (
    <div className="flex-1 flex flex-col p-6 overflow-y-auto">
      <h2 className="text-lg font-semibold text-slate-700 mb-1">{selectedUser?.name} の月別クリア数</h2>
      <p className="text-xs text-slate-400 mb-5">項目を選択すると詳細が表示されます</p>
      {timelineData.length > 0 ? (
        <>
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm mb-5">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={timelineData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip formatter={v => [`${v}件`, 'クリア数']} />
                <Bar dataKey="count" radius={[6,6,0,0]}>
                  {timelineData.map((e,i) => <Cell key={i} fill={e.month === CURRENT_MONTH ? '#6366f1' : '#a5b4fc'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: '総クリア数', value: `${items.filter(i => i.status === 'completed').length}件` },
              { label: '今月クリア', value: `${currentMonthCount}件`, hi: currentMonthCount > 0 },
              { label: '取り組み中', value: `${statusCounts.in_progress ?? 0}件` },
            ].map(s => (
              <div key={s.label} className={`bg-white rounded-xl p-4 border text-center ${s.hi ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200'}`}>
                <p className="text-2xl font-bold text-slate-800">{s.value}</p>
                <p className="text-xs text-slate-500 mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-slate-400 text-sm">まだクリアした項目がありません</p>
        </div>
      )}
    </div>
  );

  // ============================================================
  // グラフモーダル（個人ビュー）
  // ============================================================
  const ChartModal = ({ onClose }) => (
    <div className="absolute inset-0 z-20 flex flex-col justify-end" style={{ background: 'rgba(0,0,0,0.45)' }}>
      <div className="bg-white rounded-t-2xl shadow-2xl flex flex-col" style={{ maxHeight: '72%' }}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 shrink-0">
          <span className="text-sm font-semibold text-slate-700">{selectedUser?.name} の月別クリア数</span>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-xl w-7 h-7 flex items-center justify-center">✕</button>
        </div>
        <div className="overflow-y-auto p-5">
          {timelineData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={timelineData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                  <Tooltip formatter={v => [`${v}件`, 'クリア数']} />
                  <Bar dataKey="count" radius={[4,4,0,0]}>
                    {timelineData.map((e,i) => <Cell key={i} fill={e.month === CURRENT_MONTH ? '#6366f1' : '#a5b4fc'} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div className="grid grid-cols-3 gap-3 mt-4">
                {[
                  { label: '総クリア数', value: `${items.filter(i => i.status === 'completed').length}件` },
                  { label: '今月クリア', value: `${currentMonthCount}件`, hi: currentMonthCount > 0 },
                  { label: '取り組み中', value: `${statusCounts.in_progress ?? 0}件` },
                ].map(s => (
                  <div key={s.label} className={`rounded-xl p-3 border text-center ${s.hi ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 bg-slate-50'}`}>
                    <p className="text-xl font-bold text-slate-800">{s.value}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="text-center text-slate-400 text-sm py-8">まだクリアした項目がありません</p>
          )}
        </div>
      </div>
    </div>
  );

  // ============================================================
  // 全体ビュー
  // ============================================================
  const OverallView = () => {
    if (overallLoading) return <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">読み込み中...</div>;

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
          {/* モード切り替えヘッダー */}
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <h2 className="text-base font-semibold text-slate-700">月次クリア数</h2>
            <div className="flex rounded-lg border border-slate-200 overflow-hidden text-xs">
              {[['all','全体'],['rank','ランク別'],['personal','個人別']].map(([v,l]) => (
                <button key={v} onClick={() => setOverallChartMode(v)}
                  className={`px-3 py-1.5 transition-colors ${overallChartMode === v ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>
                  {l}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
            {/* 全体モード */}
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

            {/* ランク別モード */}
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

            {/* 個人別モード */}
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
  };

  // ============================================================
  // 部門別ビュー
  // ============================================================
  const DepartmentView = () => {
    if (overallLoading) return <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">読み込み中...</div>;
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
  };

  // ============================================================
  // 管理ビュー 左ペイン
  // ============================================================
  const AdminLeftPane = () => {
    const rankGroups = availableRanks
      .map(rank => ({ rank, items: adminItems.filter(i => i.rank === rank).sort((a, b) => (a.no ?? 999) - (b.no ?? 999)) }))
      .filter(g => g.items.length > 0);
    const openProposals = proposals.filter(p => p.status === 'open');
    const rankInputRef  = useRef(null);

    return (
      <div className="flex flex-col h-full overflow-hidden">
        {/* 新規追加ボタン */}
        <div className="px-4 pt-3 pb-2 bg-white border-b border-slate-200 shrink-0 space-y-2">
          <button
            onClick={() => selectAdminItem('new')}
            className={`w-full text-sm py-2 rounded-xl font-medium transition-colors ${selectedAdminItem === 'new' ? 'bg-indigo-600 text-white' : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200'}`}
          >＋ 新規項目を追加</button>

          {/* 修正4: ランク別コメントあり項目サマリー */}
          {rankCommentSummary.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {rankCommentSummary.map(r => (
                <span key={r.rank} className="text-xs bg-red-50 text-red-600 border border-red-100 px-2 py-0.5 rounded-full">
                  {r.rank} 💬 {r.count}件
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* 項目一覧 */}
          <div className="p-4 space-y-3">
            {rankGroups.map(({ rank, items: rankItems }) => (
              <div key={rank} className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-600">{rank}</span>
                  <span className="text-xs text-slate-400">{rankItems.length}件</span>
                </div>
                <div className="divide-y divide-slate-100">
                  {rankItems.map(item => {
                    const commentCount = itemCommentCounts[item.id] || 0;
                    const hasComments = commentCount > 0;
                    const isSelected = selectedAdminItem !== 'new' && selectedAdminItem?.id === item.id;
                    return (
                      <button key={item.id} onClick={() => selectAdminItem(item)}
                        className={`w-full text-left px-3 py-2.5 flex items-start gap-2 transition-colors ${
                          isSelected ? 'bg-indigo-50' : hasComments ? 'hover:bg-red-50' : 'hover:bg-slate-50'
                        }`}
                        style={!isSelected && hasComments ? { backgroundColor: '#FFF0F0' } : undefined}
                      >
                        <span className="text-xs text-slate-400 w-6 shrink-0 mt-0.5">#{item.no}</span>
                        {/* 修正1: 折り返し表示 */}
                        <p className="flex-1 text-sm text-slate-800 leading-snug">{item.item_name}</p>
                        <div className="flex items-center gap-1 shrink-0 mt-0.5">
                          {hasComments && (
                            <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full font-medium">
                              💬 {commentCount}
                            </span>
                          )}
                          {item.is_salary_item && <span className="text-xs bg-amber-100 text-amber-700 px-1 py-0.5 rounded">昇給</span>}
                          {item.status !== 'active' && <span className="text-xs bg-slate-100 text-slate-400 px-1 py-0.5 rounded">{item.status}</span>}
                        </div>
                        <span className="text-slate-300 text-xs mt-0.5">›</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* 改善提案ボード */}
          <div className="px-4 pb-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-700">
                改善提案ボード
                {openProposals.length > 0 && <span className="ml-2 text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full">{openProposals.length}件</span>}
              </h3>
              {openProposals.length > 0 && (
                <button onClick={() => setMtgMode(true)} className="text-xs px-2.5 py-1 bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition-colors">MTGモード</button>
              )}
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-3 mb-3 space-y-2 shadow-sm">
              <p className="text-xs text-slate-400">投稿者: <span className="font-medium text-slate-600">{selectedUser?.name ?? '（未選択）'}</span></p>
              <textarea value={proposalContent} onChange={e => setProposalContent(e.target.value)} placeholder="改善提案・アイデアを書いてください" rows={3}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300" />
              <button onClick={saveProposal} disabled={savingProposal || !proposalContent.trim() || !selectedUser}
                className="w-full text-sm py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-40">
                {savingProposal ? '送信中...' : '提案する'}
              </button>
            </div>
            <div className="space-y-2">
              {proposals.length === 0 && <p className="text-xs text-slate-400 text-center py-4">まだ提案がありません</p>}
              {proposals.map(p => (
                <div key={p.id} className={`bg-white rounded-xl border shadow-sm p-3 ${p.status === 'open' ? 'border-slate-200' : p.status === 'adopted' ? 'border-green-200 bg-green-50' : 'border-slate-100 bg-slate-50 opacity-60'}`}>
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-medium text-slate-700">{p.user_name || '匿名'}</span>
                      <span className="text-xs text-slate-400">{new Date(p.created_at).toLocaleDateString('ja-JP')}</span>
                    </div>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium shrink-0 ${p.status === 'open' ? 'bg-orange-100 text-orange-600' : p.status === 'adopted' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-400'}`}>
                      {p.status === 'open' ? '未対応' : p.status === 'adopted' ? '採用' : '解決済み'}
                    </span>
                  </div>
                  <p className="text-sm text-slate-800 whitespace-pre-wrap mb-2">{p.content}</p>
                  {p.status === 'open' && (
                    <div className="flex gap-1.5">
                      <button onClick={() => adoptProposal(p)} className="text-xs px-2.5 py-1 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">採用</button>
                      <button onClick={() => updateProposalStatus(p.id, 'resolved')} className="text-xs px-2.5 py-1 bg-white border border-slate-300 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors">解決済み</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* ランク管理 */}
          <div className="px-4 pb-6 mt-2">
            <div className="border-t border-slate-200 pt-4">
              <h3 className="text-sm font-semibold text-slate-700 mb-2">ランク管理</h3>
              <div className="flex flex-wrap gap-1.5 mb-3">
                {availableRanks.map(r => (
                  <span key={r} className="text-xs bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full">{r}</span>
                ))}
              </div>
              <div className="flex gap-2">
                <input ref={rankInputRef} type="text" placeholder="新しいランク名..."
                  className="flex-1 text-sm border border-slate-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                <button onClick={() => {
                  const val = rankInputRef.current?.value?.trim();
                  if (val) { addCustomRank(val); rankInputRef.current.value = ''; }
                }} className="text-xs px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">追加</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };


  // MTGモード
  const MtgOverlay = () => {
    const openProposals = proposals.filter(p => p.status === 'open');
    return (
      <div className="fixed inset-0 bg-slate-900 z-50 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-8 py-4 border-b border-slate-700 shrink-0">
          <h2 className="text-lg font-bold text-white">改善提案 MTGモード</h2>
          <button onClick={() => setMtgMode(false)} className="text-slate-400 hover:text-white text-sm px-3 py-1.5 border border-slate-600 rounded-lg transition-colors">閉じる</button>
        </div>
        <div className="flex-1 overflow-y-auto px-8 py-6 space-y-5">
          {openProposals.length === 0
            ? <p className="text-slate-500 text-center py-16 text-lg">未対応の提案はありません</p>
            : openProposals.map((p, idx) => (
              <div key={p.id} className="bg-slate-800 rounded-2xl p-6 border border-slate-700">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-2xl font-bold text-slate-500">{idx + 1}</span>
                      <span className="text-slate-400 text-sm">{p.user_name || '匿名'}</span>
                      <span className="text-slate-600 text-sm">{new Date(p.created_at).toLocaleDateString('ja-JP')}</span>
                    </div>
                    <p className="text-white text-xl leading-relaxed whitespace-pre-wrap">{p.content}</p>
                  </div>
                  <div className="flex flex-col gap-2 shrink-0">
                    <button onClick={() => adoptProposal(p)} className="text-sm px-4 py-2 bg-indigo-500 text-white rounded-xl hover:bg-indigo-400 transition-colors font-medium">採用して追加</button>
                    <button onClick={() => updateProposalStatus(p.id, 'resolved')} className="text-sm px-4 py-2 bg-slate-700 text-slate-300 rounded-xl hover:bg-slate-600 transition-colors">解決済み</button>
                  </div>
                </div>
              </div>
            ))}
        </div>
      </div>
    );
  };

  // ============================================================
  // レンダリング
  // ============================================================
  return (
    <div className="h-screen flex flex-col bg-slate-100 font-sans overflow-hidden">
      <Header />

      {view === 'personal' && (
        <>
          <div className="hidden md:grid flex-1 overflow-hidden" style={{ gridTemplateColumns: '380px 1fr' }}>
            <div className="bg-white border-r border-slate-200 overflow-hidden flex flex-col">
              <ListPane onItemClick={setSelectedItem} activeId={selectedItem?.id} />
            </div>
            <div className="overflow-hidden flex flex-col bg-slate-50 relative">
              {selectedItem && detailProps && !showPlanView ? (
                <>
                  <ItemDetail {...detailProps} onBack={null} />
                  {showPersonalChart && <ChartModal onClose={() => setShowPersonalChart(false)} />}
                </>
              ) : showPlanView ? (
                <PlanPanel
                  plans={plans} plansLoading={plansLoading}
                  planForm={planForm} setPlanForm={setPlanForm}
                  savingPlan={savingPlan} onAddPlan={addPlan}
                  onAchievePlan={achievePlan} onDeletePlan={deletePlan}
                  unachievedItems={items.filter(i => i.status !== 'completed' && i.item_def_id)}
                  selectedUser={selectedUser}
                />
              ) : showPersonalChart ? (
                <TimelineGraph />
              ) : (
                <div className="flex-1 flex items-center justify-center text-slate-300 text-sm">
                  項目を選択するか 📊 バッジでクリア推移を表示
                </div>
              )}
            </div>
          </div>
          <div className="md:hidden flex-1 overflow-hidden relative">
            <div className={`absolute inset-0 bg-white transition-transform duration-200 ${mobileShowDetail ? '-translate-x-full' : 'translate-x-0'}`}>
              <ListPane onItemClick={item => { setSelectedItem(item); setMobileShowDetail(true); }} activeId={selectedItem?.id} />
            </div>
            <div className={`absolute inset-0 bg-slate-50 transition-transform duration-200 ${mobileShowDetail ? 'translate-x-0' : 'translate-x-full'} relative`}>
              {showPlanView ? (
                <PlanPanel
                  plans={plans} plansLoading={plansLoading}
                  planForm={planForm} setPlanForm={setPlanForm}
                  savingPlan={savingPlan} onAddPlan={addPlan}
                  onAchievePlan={achievePlan} onDeletePlan={deletePlan}
                  unachievedItems={items.filter(i => i.status !== 'completed' && i.item_def_id)}
                  selectedUser={selectedUser}
                />
              ) : selectedItem && detailProps ? (
                <>
                  <ItemDetail {...detailProps} onBack={() => setMobileShowDetail(false)} />
                  {showPersonalChart && <ChartModal onClose={() => setShowPersonalChart(false)} />}
                </>
              ) : <div className="flex items-center justify-center h-full text-slate-400 text-sm">← 項目を選択してください</div>}
            </div>
            {showPersonalChart && !mobileShowDetail && (
              <ChartModal onClose={() => setShowPersonalChart(false)} />
            )}
          </div>
        </>
      )}

      {view === 'overall' && <div className="flex-1 overflow-hidden flex flex-col"><OverallView /></div>}
      {view === 'department' && <div className="flex-1 overflow-hidden flex flex-col"><DepartmentView /></div>}

      {view === 'admin' && (
        <>
          {/* PC: 2ペイン（左を440pxに拡大） */}
          <div className="hidden md:grid flex-1 overflow-hidden" style={{ gridTemplateColumns: '440px 1fr' }}>
            <div className="bg-white border-r border-slate-200 overflow-hidden flex flex-col">
              <AdminLeftPane />
            </div>
            <div className="overflow-hidden flex flex-col bg-slate-50">
              <AdminEditPane
                selectedAdminItem={selectedAdminItem}
                adminForm={adminForm}
                setAdminForm={setAdminForm}
                savingAdminForm={savingAdminForm}
                onSave={saveAdminForm}
                onArchive={archiveAdminItem}
                onDeselect={() => { setSelectedAdminItem(null); setMobileShowAdminEdit(false); }}
                onSelectNew={() => selectAdminItem('new')}
                setItemCommentCounts={setItemCommentCounts}
                availableRanks={availableRanks}
                onBack={null}
              />
            </div>
          </div>
          {/* モバイル */}
          <div className="md:hidden flex-1 overflow-hidden relative">
            <div className={`absolute inset-0 bg-white transition-transform duration-200 ${mobileShowAdminEdit ? '-translate-x-full' : 'translate-x-0'}`}>
              <AdminLeftPane />
            </div>
            <div className={`absolute inset-0 bg-slate-50 transition-transform duration-200 ${mobileShowAdminEdit ? 'translate-x-0' : 'translate-x-full'}`}>
              <AdminEditPane
                selectedAdminItem={selectedAdminItem}
                adminForm={adminForm}
                setAdminForm={setAdminForm}
                savingAdminForm={savingAdminForm}
                onSave={saveAdminForm}
                onArchive={archiveAdminItem}
                onDeselect={() => { setSelectedAdminItem(null); setMobileShowAdminEdit(false); }}
                onSelectNew={() => selectAdminItem('new')}
                setItemCommentCounts={setItemCommentCounts}
                availableRanks={availableRanks}
                onBack={() => { setMobileShowAdminEdit(false); setSelectedAdminItem(null); }}
              />
            </div>
          </div>
          {mtgMode && <MtgOverlay />}
        </>
      )}

      {view === 'members' && (
        <div className="flex-1 overflow-hidden flex flex-col">
          <MembersView key={membersKey} onUsersRefresh={refreshUsers} availableRanks={availableRanks} />
        </div>
      )}

      {view === 'salary' && (
        <div className="flex-1 overflow-hidden flex flex-col">
          <SalaryView users={users} />
        </div>
      )}

      {ngModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="px-5 py-4 border-b border-slate-200">
              <h3 className="text-sm font-semibold text-slate-700">やり直し理由を入力</h3>
            </div>
            <div className="p-5">
              <textarea value={ngReasonText} onChange={e => setNgReasonText(e.target.value)}
                placeholder="やり直しの理由を入力（任意）..."
                rows={3} autoFocus
                className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-red-300" />
              <p className="text-xs text-slate-400 mt-1.5">空白のまま確定することもできます</p>
            </div>
            <div className="px-5 py-4 border-t border-slate-200 flex gap-2">
              <button onClick={confirmNgReason}
                className="flex-1 text-sm py-2 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors font-medium">
                やり直し確定
              </button>
              <button onClick={() => { setNgModal(null); setNgReasonText(''); }}
                className="text-sm px-4 py-2 bg-white border border-slate-300 text-slate-600 rounded-xl hover:bg-slate-50">
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// ItemDetail
// ============================================================
function ItemDetail({
  item, onBack, onStatusChange, onMemoChange,
  evidenceText, onEvidenceTextChange, onAddText, onImageUpload, isUploading,
  onDeleteEvidence, onUpdateEvidenceQuality,
}) {
  const [localMemo, setLocalMemo] = useState(item.memo ?? '');
  const debounceRef = useRef(null);
  const fileRef = useRef(null);
  const evidences = item.evaluation_evidences ?? [];
  const st = STATUS_MAP[item.status] ?? STATUS_MAP.pending;

  useEffect(() => { setLocalMemo(item.memo ?? ''); }, [item.id, item.memo]);

  const handleMemoChange = val => {
    setLocalMemo(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => onMemoChange(item.id, val), 800);
  };

  const idx = STATUSES.findIndex(s => s.value === item.status);
  const prevSt = idx > 0 ? STATUSES[idx - 1] : null;
  const nextSt = idx < STATUSES.length - 1 ? STATUSES[idx + 1] : null;

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className={`px-4 py-3 border-b border-slate-200 shrink-0 ${st.bg}`}>
        <div className="flex items-start gap-2">
          {onBack && <button onClick={onBack} className="text-indigo-600 text-sm font-medium shrink-0 pt-0.5 hover:text-indigo-800">‹ 戻る</button>}
          <div className="flex-1 min-w-0">
            <p className="text-xs text-slate-400">#{item.item_no}</p>
            <p className="text-base font-semibold text-slate-800 leading-snug mt-0.5">{item.item_name}</p>
            <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-full font-medium ${st.badge}`}>{st.label}</span>
            {item.achieved_month && <span className="ml-2 text-xs text-slate-400">{item.achieved_month}</span>}
          </div>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
        {item.description && (
          <p className="text-xs text-slate-500 bg-white rounded-xl p-3 border border-slate-200 whitespace-pre-wrap leading-relaxed">{item.description}</p>
        )}
        <section>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">ステータス</p>
          <div className="flex gap-2 mb-3">
            {prevSt && <button onClick={() => onStatusChange(item.id, prevSt.value)} className="text-xs px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-600 hover:bg-slate-50 transition-colors">← {prevSt.label}</button>}
            {nextSt ? <button onClick={() => onStatusChange(item.id, nextSt.value)} className="text-xs px-3 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 transition-colors">{nextSt.label} →</button>
              : <span className="text-xs text-emerald-600 font-semibold self-center">✓ 完了済み</span>}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {STATUSES.map(s => (
              <button key={s.value} onClick={() => onStatusChange(item.id, s.value)}
                className={`text-xs px-2.5 py-1.5 rounded-lg transition-colors ${item.status === s.value ? `${s.badge} font-bold ring-1 ring-offset-1 ring-current` : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
                {s.label}
              </button>
            ))}
          </div>
        </section>
        <section>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">メモ</p>
          <textarea value={localMemo} onChange={e => handleMemoChange(e.target.value)} placeholder="進捗メモ・コメントを入力..." rows={4}
            className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none" />
        </section>
        <ItemQuestionSection itemId={item.item_def_id} />
        <PeerEvidenceSection itemNo={item.item_no} selfUserName={item.user_name} />
        <section>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
            エビデンス{evidences.length > 0 && <span className="ml-1 normal-case font-normal text-slate-400">({evidences.length}件)</span>}
          </p>
          {evidences.length > 0 && (
            <div className="space-y-2 mb-3">
              {evidences.map(ev => {
                const isBad = ev.quality === 'bad';
                return (
                  <div key={ev.id} className={`rounded-xl p-3 border transition-opacity ${isBad ? 'bg-slate-50 border-slate-200 opacity-50' : 'bg-white border-slate-200'}`}>
                    <div className="flex items-start gap-2">
                      {ev.evidence_type === 'image'
                        ? <a href={ev.content} target="_blank" rel="noreferrer" className="flex-1"><img src={ev.content} alt="evidence" className="w-28 object-cover rounded-lg" /></a>
                        : <p className="text-xs text-slate-700 flex-1 whitespace-pre-wrap">📝 {ev.content}</p>}
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className="text-xs text-slate-300">{new Date(ev.created_at).toLocaleDateString('ja-JP')}</span>
                        <div className="flex gap-1">
                          <button
                            onClick={() => onUpdateEvidenceQuality?.(ev.id, isBad ? 'good' : 'bad')}
                            className={`text-xs px-2 py-0.5 rounded-lg border transition-colors ${isBad ? 'bg-slate-200 text-slate-500 border-slate-300 hover:bg-slate-300' : 'bg-white text-slate-500 border-slate-200 hover:bg-red-50 hover:border-red-200 hover:text-red-500'}`}
                            title={isBad ? '良いエビデンスに戻す' : 'やり直しにする'}>
                            {isBad ? '✅ 戻す' : '❌ やり直し'}
                          </button>
                          <button
                            onClick={() => onDeleteEvidence?.(ev.id)}
                            className="text-xs px-2 py-0.5 rounded-lg border border-slate-200 bg-white text-slate-400 hover:bg-red-50 hover:border-red-200 hover:text-red-500 transition-colors"
                            title="削除">
                            🗑
                          </button>
                        </div>
                      </div>
                    </div>
                    {isBad && <span className="inline-block mt-1.5 text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">
                      やり直し{ev.ng_reason ? `：${ev.ng_reason}` : ''}
                    </span>}
                  </div>
                );
              })}
            </div>
          )}
          <div className="flex gap-2">
            <input type="text" value={evidenceText} onChange={e => onEvidenceTextChange(e.target.value)} onKeyDown={e => e.key === 'Enter' && onAddText()}
              placeholder="テキストエビデンスを入力..."
              className="flex-1 text-xs border border-slate-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300" />
            <button onClick={onAddText} disabled={!evidenceText.trim()} className="text-xs px-3 py-2 bg-slate-700 text-white rounded-xl hover:bg-slate-800 transition-colors disabled:opacity-40">追加</button>
          </div>
          <button onClick={() => fileRef.current?.click()} disabled={isUploading}
            className={`mt-2 w-full flex items-center justify-center gap-2 text-xs py-3 border-2 border-dashed rounded-xl transition-colors ${isUploading ? 'opacity-50 cursor-not-allowed border-slate-300 text-slate-400' : 'border-slate-300 text-slate-400 hover:border-indigo-400 hover:text-indigo-500 cursor-pointer'}`}>
            {isUploading ? '⏳ アップロード中...' : '📷 画像をアップロード'}
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => { if (e.target.files?.[0]) onImageUpload(e.target.files[0]); e.target.value = ''; }} />
        </section>
      </div>
    </div>
  );
}

// ============================================================
// PeerEvidenceSection — 他メンバーのエビデンス参照（折りたたみ）
// ============================================================
function PeerEvidenceSection({ itemNo, selfUserName }) {
  const [evidences, setEvidences] = useState([]);
  const [loading, setLoading]     = useState(false);
  const [open, setOpen]           = useState(false);

  useEffect(() => {
    if (!itemNo) return;
    setLoading(true);
    setEvidences([]);
    setOpen(false);
    supabase
      .from('evaluation_progress')
      .select('user_name, achieved_month, evaluation_evidences(*)')
      .eq('item_no', itemNo)
      .eq('status', 'completed')
      .neq('user_name', selfUserName)
      .then(({ data, error }) => {
        if (error) console.error('参考エビデンス取得エラー:', error);
        const flat = (data || [])
          .filter(row => row.evaluation_evidences?.length > 0)
          .flatMap(row =>
            row.evaluation_evidences
              .filter(ev => ev.quality !== 'bad')
              .map(ev => ({
                ...ev,
                user_name: row.user_name,
                achieved_month: row.achieved_month,
              }))
          );
        setEvidences(flat);
        setLoading(false);
      });
  }, [itemNo, selfUserName]);

  if (loading) {
    return (
      <section>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">みんなのエビデンス</p>
        <p className="text-xs text-slate-400 text-center py-2">読み込み中...</p>
      </section>
    );
  }

  return (
    <section>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-wide py-1 hover:text-slate-700 transition-colors"
      >
        <span>みんなのエビデンス</span>
        <span className="normal-case font-normal text-indigo-500">
          {open
            ? '閉じる ▲'
            : evidences.length > 0
              ? `参考エビデンスを見る（${evidences.length}件） ▼`
              : '参考エビデンスを見る ▼'}
        </span>
      </button>

      {open && (
        <div className="mt-2 space-y-2">
          {evidences.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-3 bg-slate-50 rounded-xl border border-slate-100">
              まだエビデンスがありません
            </p>
          ) : (
            evidences.map((ev, i) => (
              <div key={ev.id ?? i} className="bg-indigo-50 rounded-xl border border-indigo-100 p-3">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-xs font-medium text-slate-700">{ev.user_name}</span>
                  {ev.achieved_month && (
                    <span className="text-xs text-slate-400">{ev.achieved_month}</span>
                  )}
                </div>
                {ev.evidence_type === 'image' ? (
                  <a href={ev.content} target="_blank" rel="noreferrer">
                    <img src={ev.content} alt="evidence" className="rounded-lg max-w-full object-cover" style={{ maxHeight: 200 }} />
                  </a>
                ) : (
                  <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">📝 {ev.content}</p>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </section>
  );
}

// ============================================================
// ItemCommentsSection — トップレベル（再マウントしない安定コンポーネント）
// ============================================================
function ItemCommentsSection({ itemId, onCountChange }) {
  const [comments, setComments]     = useState([]);
  const [loading, setLoading]       = useState(false);
  const [authorName, setAuthorName] = useState('');
  const [content, setContent]       = useState('');
  const [saving, setSaving]         = useState(false);

  useEffect(() => {
    if (!itemId) return;
    setLoading(true);
    supabase
      .from('item_comments')
      .select('*')
      .eq('item_id', itemId)
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) console.error('コメント取得エラー:', error);
        setComments(data || []);
        setLoading(false);
      });
  }, [itemId]);

  const submit = async () => {
    if (!content.trim() || !authorName.trim()) return;
    setSaving(true);
    const { data, error } = await supabase
      .from('item_comments')
      .insert({ item_id: itemId, user_name: authorName.trim(), content: content.trim() })
      .select()
      .single();
    if (error) {
      console.error('コメント投稿エラー:', error);
    } else if (data) {
      setComments(prev => [data, ...prev]);
      onCountChange(itemId, c => c + 1);
      setContent('');
    }
    setSaving(false);
  };

  const remove = async (commentId) => {
    const { error } = await supabase.from('item_comments').delete().eq('id', commentId);
    if (error) {
      console.error('コメント削除エラー:', error);
    } else {
      setComments(prev => prev.filter(c => c.id !== commentId));
      onCountChange(itemId, c => Math.max(0, c - 1));
    }
  };

  return (
    <div className="border-t border-slate-200 pt-4">
      <h4 className="text-sm font-semibold text-slate-700 mb-3">
        みんなのメモ・意見
        {comments.length > 0 && <span className="ml-2 text-xs font-normal text-slate-400">({comments.length}件)</span>}
      </h4>

      <div className="bg-slate-50 rounded-xl border border-slate-200 p-3 mb-3 space-y-2">
        <input
          type="text"
          value={authorName}
          onChange={e => setAuthorName(e.target.value)}
          placeholder="名前を入力"
          className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
        />
        <textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && e.metaKey) submit(); }}
          placeholder="この項目についてコメントや意見を書いてください..."
          rows={3}
          className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white resize-y focus:outline-none focus:ring-2 focus:ring-indigo-300"
        />
        <button
          onClick={submit}
          disabled={saving || !content.trim() || !authorName.trim()}
          className="w-full text-sm py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-40"
        >
          {saving ? '投稿中...' : '投稿する'}
        </button>
      </div>

      {loading ? (
        <p className="text-xs text-slate-400 text-center py-4">読み込み中...</p>
      ) : comments.length === 0 ? (
        <p className="text-xs text-slate-400 text-center py-4">まだコメントがありません</p>
      ) : (
        <div className="space-y-2">
          {comments.map(c => (
            <div key={c.id} className="bg-white rounded-xl border border-slate-200 p-3">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-slate-700">{c.user_name || '匿名'}</span>
                  <span className="text-xs text-slate-400">
                    {new Date(c.created_at).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <button
                  onClick={() => remove(c.id)}
                  className="text-slate-300 hover:text-red-500 transition-colors leading-none text-base"
                  title="削除"
                >🗑️</button>
              </div>
              <p className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">{c.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================
// ============================================================
// AdminEditPane — 管理タブ右ペイン (top-level: focus loss 防止)
// ============================================================
function AdminEditPane({
  selectedAdminItem, adminForm, setAdminForm, savingAdminForm,
  onSave, onArchive, onDeselect, onSelectNew, setItemCommentCounts, availableRanks, onBack,
}) {
  const isNew = selectedAdminItem === 'new';
  const isArchived = !isNew && selectedAdminItem?.status === 'archived';

  if (!selectedAdminItem) {
    return (
      <div className="flex-1 flex items-center justify-center flex-col gap-3 text-slate-400">
        <p className="text-sm">項目を選択するか、新規追加してください</p>
        <button onClick={onSelectNew} className="text-sm px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors">＋ 新規追加</button>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="px-5 py-3.5 bg-white border-b border-slate-200 shrink-0 flex items-center gap-3">
        {onBack && <button onClick={onBack} className="text-indigo-600 text-sm font-medium hover:text-indigo-800">‹ 戻る</button>}
        <h3 className="text-sm font-semibold text-slate-700">{isNew ? '新規項目追加' : '項目を編集'}</h3>
        {!isNew && selectedAdminItem?.status && (
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${isArchived ? 'bg-slate-100 text-slate-400' : 'bg-green-100 text-green-700'}`}>
            {selectedAdminItem.status}
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        <div>
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1.5">項目名 *</label>
          <textarea value={adminForm.item_name} onChange={e => setAdminForm(f => ({ ...f, item_name: e.target.value }))}
            placeholder="項目名を入力..." rows={3}
            className="w-full text-base border border-slate-300 rounded-xl px-4 py-3 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300 font-medium" />
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1.5">ランク *</label>
          <select value={adminForm.rank} onChange={e => setAdminForm(f => ({ ...f, rank: e.target.value }))}
            className="w-full text-sm border border-slate-300 rounded-xl px-4 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300">
            <option value="">ランクを選択</option>
            {(availableRanks || RANK_OPTIONS).map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1.5">詳細説明</label>
          <textarea value={adminForm.description} onChange={e => setAdminForm(f => ({ ...f, description: e.target.value }))}
            placeholder="詳細・達成基準・参考情報など..." rows={8}
            className="w-full text-sm border border-slate-300 rounded-xl px-4 py-3 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300 leading-relaxed" />
        </div>

        <label className="flex items-center gap-3 cursor-pointer select-none">
          <input type="checkbox" checked={adminForm.is_salary_item} onChange={e => setAdminForm(f => ({ ...f, is_salary_item: e.target.checked }))} className="w-4 h-4 accent-indigo-600" />
          <span className="text-sm text-slate-700 font-medium">昇給項目</span>
          <span className="text-xs text-slate-400">（評価に直結する項目）</span>
        </label>

        {!isNew && (
          <ItemCommentsSection
            itemId={selectedAdminItem?.id}
            onCountChange={(itemId, updater) =>
              setItemCommentCounts(prev => ({
                ...prev,
                [itemId]: typeof updater === 'function' ? updater(prev[itemId] || 0) : updater,
              }))
            }
          />
        )}
      </div>

      <div className="px-5 py-4 bg-white border-t border-slate-200 shrink-0 flex flex-wrap gap-2">
        <button onClick={onSave} disabled={savingAdminForm || !adminForm.item_name.trim() || !adminForm.rank}
          className="flex-1 text-sm py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-40 font-medium">
          {savingAdminForm ? '保存中...' : isNew ? '保存して全員に追加' : '変更を保存'}
        </button>
        {!isNew && !isArchived && (
          <button onClick={onArchive} className="text-sm px-4 py-2.5 bg-white border border-red-200 text-red-500 rounded-xl hover:bg-red-50 transition-colors">Archive</button>
        )}
        <button onClick={onDeselect}
          className="text-sm px-4 py-2.5 bg-white border border-slate-300 text-slate-600 rounded-xl hover:bg-slate-50 transition-colors">キャンセル</button>
      </div>
      {!isNew && <p className="text-xs text-slate-400 text-center pb-3">変更は即時反映されます</p>}
      {isNew && <p className="text-xs text-slate-400 text-center pb-3">保存後、全メンバーのevaluation_progressに自動追加されます</p>}
    </div>
  );
}

// MembersView — メンバー管理タブ
// ============================================================
function MembersView({ onUsersRefresh, availableRanks = RANK_OPTIONS }) {
  const [data, setData]               = useState([]);
  const [loading, setLoading]         = useState(false);
  const [showResigned, setShowResigned] = useState(false);
  const [rankFilter, setRankFilter]   = useState('all');
  const [deptFilter, setDeptFilter]   = useState('all');
  // 追加モーダル
  const [showAdd, setShowAdd]         = useState(false);
  const [addForm, setAddForm]         = useState(EMPTY_MEMBER_FORM);
  const [savingAdd, setSavingAdd]     = useState(false);
  // 退職モーダル
  const [retireTarget, setRetireTarget] = useState(null);
  const [retireDate, setRetireDate]   = useState('');
  const [retiring, setRetiring]       = useState(false);
  // 編集モーダル
  const [editTarget, setEditTarget]   = useState(null);
  const [editForm, setEditForm]       = useState({});
  const [savingEdit, setSavingEdit]   = useState(false);
  // 削除モーダル
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting]       = useState(false);
  // トースト & 部署カスタム入力
  const [toast, setToast]             = useState(null);
  const [customDept, setCustomDept]   = useState('');

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2000);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    const { data: rows, error } = await supabase
      .from('users')
      .select('id, name, email, rank, department, mall, onboarding_at, resigned_at, progress_name')
      .neq('name', 'テンプレート')
      .order('name');
    if (error) console.error('メンバー取得エラー:', error);
    setData(rows || []);
    setLoading(false);
  };

  const handleAdd = async () => {
    if (!addForm.name.trim() || !addForm.rank) return;
    setSavingAdd(true);
    const { error } = await supabase.from('users').insert({
      name:          addForm.name.trim(),
      email:         addForm.email.trim() || null,
      rank:          addForm.rank,
      department:    addForm.department,
      mall:          addForm.mall.trim() || null,
      onboarding_at: addForm.onboarding_at || null,
      is_anonymized: false,
    });
    if (error) {
      console.error('メンバー追加エラー:', error);
      setToast({ type: 'error', message: `登録に失敗しました：${error.message}` });
    } else {
      await fetchData();
      onUsersRefresh();
      setShowAdd(false);
      setAddForm(EMPTY_MEMBER_FORM);
      setCustomDept('');
      setToast({ type: 'success', message: '登録完了 ✓' });
    }
    setSavingAdd(false);
  };

  const handleRetire = async () => {
    if (!retireTarget || !retireDate) return;
    setRetiring(true);
    const { error } = await supabase.from('users').update({ resigned_at: retireDate }).eq('id', retireTarget.id);
    if (error) {
      console.error('退職処理エラー:', error);
    } else {
      await fetchData();
      onUsersRefresh();
      setRetireTarget(null);
      setRetireDate('');
    }
    setRetiring(false);
  };

  const handleEdit = async () => {
    if (!editTarget) return;
    setSavingEdit(true);
    const changes = {};
    if (editForm.rank) changes.rank = editForm.rank;
    if (editForm.department !== undefined) changes.department = editForm.department.trim() ? [editForm.department.trim()] : (editTarget.department || []);
    if (editForm.mall !== undefined) changes.mall = editForm.mall.trim() || null;

    const { error } = await supabase.from('users').update(changes).eq('id', editTarget.id);
    if (error) {
      console.error('メンバー編集エラー:', error);
      setSavingEdit(false);
      return;
    }
    // ランク変更時: 新ランクの評価項目をprogressに追加
    if (changes.rank && changes.rank !== editTarget.rank) {
      const progressName = editTarget.progress_name ?? editTarget.name;
      const [{ data: existing }, { data: newItems }] = await Promise.all([
        supabase.from('evaluation_progress').select('item_no').eq('user_name', progressName),
        supabase.from('evaluation_items').select('no').eq('rank', changes.rank).eq('status', 'active'),
      ]);
      const existingNos = new Set((existing || []).map(p => p.item_no));
      const toInsert = (newItems || [])
        .filter(item => item.no != null && !existingNos.has(item.no))
        .map(item => ({ user_name: progressName, item_no: item.no, status: 'pending', user_id: editTarget.id }));
      if (toInsert.length > 0) {
        const { error: insErr } = await supabase.from('evaluation_progress').insert(toInsert);
        if (insErr) console.error('進捗追加エラー:', insErr);
      }
    }
    await fetchData();
    onUsersRefresh();
    setEditTarget(null);
    setSavingEdit(false);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const progressName = deleteTarget.progress_name ?? deleteTarget.name;
    // 関連エビデンス → 進捗 → ユーザーの順に削除
    const { data: progressRows } = await supabase.from('evaluation_progress').select('id').eq('user_name', progressName);
    const progressIds = (progressRows || []).map(r => r.id);
    if (progressIds.length > 0) {
      await supabase.from('evaluation_evidences').delete().in('progress_id', progressIds);
      await supabase.from('evaluation_progress').delete().in('id', progressIds);
    }
    const { error } = await supabase.from('users').delete().eq('id', deleteTarget.id);
    if (error) {
      setToast({ type: 'error', message: `削除に失敗しました：${error.message}` });
    } else {
      await fetchData();
      onUsersRefresh();
      setToast({ type: 'success', message: '削除しました ✓' });
    }
    setDeleteTarget(null);
    setDeleting(false);
  };

  const depts = [...new Set(data.flatMap(u => u.department || []))].filter(Boolean).sort();
  const filtered = data
    .filter(u => showResigned ? !!u.resigned_at : !u.resigned_at)
    .filter(u => rankFilter === 'all' || u.rank === rankFilter)
    .filter(u => deptFilter === 'all' || (u.department || []).includes(deptFilter));

  return (
    <div className="flex-1 overflow-y-auto flex flex-col">
      {toast && (
        <div className={`fixed top-5 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl shadow-lg text-sm font-medium pointer-events-none ${toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
          {toast.message}
        </div>
      )}
      {/* ツールバー */}
      <div className="sticky top-0 bg-white border-b border-slate-200 px-5 py-3 z-10 flex flex-wrap items-center gap-2 shrink-0">
        <div className="flex rounded-lg border border-slate-200 overflow-hidden text-xs shrink-0">
          {[['active', '在籍中'], ['resigned', '退職済み']].map(([v, l]) => (
            <button key={v} onClick={() => setShowResigned(v === 'resigned')}
              className={`px-3 py-1.5 transition-colors ${(v === 'resigned') === showResigned ? 'bg-slate-700 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>
              {l}
            </button>
          ))}
        </div>
        <select value={rankFilter} onChange={e => setRankFilter(e.target.value)}
          className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none">
          <option value="all">ランク: 全て</option>
          {availableRanks.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        {depts.length > 0 && (
          <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)}
            className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none">
            <option value="all">部署: 全て</option>
            {depts.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        )}
        <span className="text-xs text-slate-400">{filtered.length}名</span>
        {!showResigned && (
          <button onClick={() => { setAddForm(EMPTY_MEMBER_FORM); setShowAdd(true); }}
            className="ml-auto text-xs px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium">
            ＋ メンバー追加
          </button>
        )}
      </div>

      {/* カードグリッド */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">読み込み中...</div>
      ) : filtered.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">該当するメンバーがいません</div>
      ) : (
        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map(u => {
            const isResigned = !!u.resigned_at;
            return (
              <div key={u.id} className={`bg-white rounded-2xl border p-4 shadow-sm flex flex-col gap-2 transition-shadow ${isResigned ? 'opacity-60 border-slate-200' : 'border-slate-200 hover:shadow-md'}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{u.name}</p>
                    {u.email && <p className="text-xs text-slate-400 mt-0.5 truncate">{u.email}</p>}
                  </div>
                  {isResigned && <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full shrink-0 whitespace-nowrap">退職済み</span>}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {u.rank && <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">{u.rank}</span>}
                  {(u.department || []).map(d => (
                    <span key={d} className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{d}</span>
                  ))}
                  {u.mall && <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">{u.mall}</span>}
                </div>
                {u.onboarding_at && <p className="text-xs text-slate-400">入社: {u.onboarding_at}</p>}
                {isResigned && u.resigned_at && <p className="text-xs text-slate-400">退職: {u.resigned_at}</p>}
                <div className="flex gap-1.5 mt-1 pt-2 border-t border-slate-100">
                  {!isResigned && (
                    <>
                      <button
                        onClick={() => { setEditTarget(u); setEditForm({ rank: u.rank || '', department: (u.department || []).join(', '), mall: u.mall || '' }); }}
                        className="flex-1 text-xs py-1.5 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors">
                        編集
                      </button>
                      <button
                        onClick={() => { setRetireTarget(u); setRetireDate(''); }}
                        className="text-xs px-3 py-1.5 bg-white border border-orange-200 text-orange-500 rounded-lg hover:bg-orange-50 transition-colors">
                        退職
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => setDeleteTarget(u)}
                    className="text-xs px-2 py-1.5 bg-white border border-red-200 text-red-400 rounded-lg hover:bg-red-50 hover:text-red-600 transition-colors"
                    title="完全削除">
                    🗑
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── メンバー追加モーダル ── */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between shrink-0">
              <h3 className="text-sm font-semibold text-slate-700">メンバー追加</h3>
              <button onClick={() => setShowAdd(false)} className="text-slate-400 hover:text-slate-700 text-xl leading-none">✕</button>
            </div>
            <div className="overflow-y-auto p-5 space-y-3 flex-1">
              {[
                { key: 'name',          label: '名前 *',    placeholder: '山田太郎',          type: 'text'  },
                { key: 'email',         label: 'メール',    placeholder: 'taro@example.com', type: 'email' },
                { key: 'mall',          label: '担当モール', placeholder: '楽天',             type: 'text'  },
                { key: 'onboarding_at', label: '入社日',    placeholder: '',                  type: 'date'  },
              ].map(f => (
                <div key={f.key}>
                  <label className="text-xs font-medium text-slate-500 block mb-1">{f.label}</label>
                  <input type={f.type} value={addForm[f.key]}
                    onChange={e => setAddForm(p => ({ ...p, [f.key]: e.target.value }))}
                    placeholder={f.placeholder}
                    className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                </div>
              ))}
              <div>
                <label className="text-xs font-medium text-slate-500 block mb-1.5">部署</label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {[...new Set([...DEFAULT_DEPARTMENTS, ...depts])].map(d => (
                    <button key={d} type="button"
                      onClick={() => setAddForm(p => ({ ...p, department: p.department.includes(d) ? p.department.filter(x => x !== d) : [...p.department, d] }))}
                      className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${addForm.department.includes(d) ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-300 hover:border-indigo-400'}`}>
                      {d}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input value={customDept} onChange={e => setCustomDept(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); const v = customDept.trim(); if (v && !addForm.department.includes(v)) setAddForm(p => ({ ...p, department: [...p.department, v] })); setCustomDept(''); } }}
                    placeholder="その他（自由入力）"
                    className="flex-1 text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                  <button type="button" onClick={() => { const v = customDept.trim(); if (v && !addForm.department.includes(v)) setAddForm(p => ({ ...p, department: [...p.department, v] })); setCustomDept(''); }}
                    className="text-xs px-3 py-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors">追加</button>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 block mb-1">ランク *</label>
                <select value={addForm.rank} onChange={e => setAddForm(p => ({ ...p, rank: e.target.value }))}
                  className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300">
                  <option value="">選択してください</option>
                  {availableRanks.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            </div>
            <div className="px-5 py-4 border-t border-slate-200 flex gap-2 shrink-0">
              <button onClick={handleAdd} disabled={savingAdd || !addForm.name.trim() || !addForm.rank}
                className="flex-1 text-sm py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-40 font-medium">
                {savingAdd ? '追加中...' : '追加する'}
              </button>
              <button onClick={() => setShowAdd(false)} className="text-sm px-4 py-2 bg-white border border-slate-300 text-slate-600 rounded-xl hover:bg-slate-50">キャンセル</button>
            </div>
          </div>
        </div>
      )}

      {/* ── 退職モーダル ── */}
      {retireTarget && (
        <div className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="px-5 py-4 border-b border-slate-200">
              <h3 className="text-sm font-semibold text-slate-700">退職処理: {retireTarget.name}</h3>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-500 block mb-1">退職日 *</label>
                <input type="date" value={retireDate} onChange={e => setRetireDate(e.target.value)}
                  className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
              </div>
              <p className="text-xs text-slate-400">退職後はヘッダーのユーザー選択から除外されます。</p>
            </div>
            <div className="px-5 py-4 border-t border-slate-200 flex gap-2">
              <button onClick={handleRetire} disabled={retiring || !retireDate}
                className="flex-1 text-sm py-2 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors disabled:opacity-40 font-medium">
                {retiring ? '処理中...' : '退職確定'}
              </button>
              <button onClick={() => setRetireTarget(null)} className="text-sm px-4 py-2 bg-white border border-slate-300 text-slate-600 rounded-xl hover:bg-slate-50">キャンセル</button>
            </div>
          </div>
        </div>
      )}

      {/* ── 編集モーダル ── */}
      {editTarget && (
        <div className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-700">編集: {editTarget.name}</h3>
              <button onClick={() => setEditTarget(null)} className="text-slate-400 hover:text-slate-700 text-xl leading-none">✕</button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-500 block mb-1">ランク</label>
                <select value={editForm.rank} onChange={e => setEditForm(p => ({ ...p, rank: e.target.value }))}
                  className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300">
                  <option value="">変更しない</option>
                  {availableRanks.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
                {editForm.rank && editForm.rank !== editTarget.rank && (
                  <p className="text-xs text-amber-600 mt-1">※ ランク変更後、新しいランクの評価項目が自動追加されます</p>
                )}
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 block mb-1">部署</label>
                <input type="text" value={editForm.department}
                  onChange={e => setEditForm(p => ({ ...p, department: e.target.value }))}
                  placeholder="ECチーム"
                  className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 block mb-1">担当モール</label>
                <input type="text" value={editForm.mall}
                  onChange={e => setEditForm(p => ({ ...p, mall: e.target.value }))}
                  placeholder="楽天"
                  className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
              </div>
            </div>
            <div className="px-5 py-4 border-t border-slate-200 flex gap-2">
              <button onClick={handleEdit} disabled={savingEdit}
                className="flex-1 text-sm py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-40 font-medium">
                {savingEdit ? '保存中...' : '保存する'}
              </button>
              <button onClick={() => setEditTarget(null)} className="text-sm px-4 py-2 bg-white border border-slate-300 text-slate-600 rounded-xl hover:bg-slate-50">キャンセル</button>
            </div>
          </div>
        </div>
      )}

      {/* ── 削除確認モーダル ── */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/50 z-40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="px-5 py-4 border-b border-slate-200">
              <h3 className="text-sm font-semibold text-red-600">メンバー完全削除</h3>
            </div>
            <div className="p-5 space-y-3">
              <p className="text-sm text-slate-700">
                <span className="font-semibold">{deleteTarget.name}</span>さんのデータを完全に削除します。この操作は取り消せません。
              </p>
              <p className="text-xs text-slate-400">評価進捗・エビデンスも含めてすべて削除されます。</p>
            </div>
            <div className="px-5 py-4 border-t border-slate-200 flex gap-2">
              <button onClick={handleDelete} disabled={deleting}
                className="flex-1 text-sm py-2 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors disabled:opacity-40 font-medium">
                {deleting ? '削除中...' : '完全に削除する'}
              </button>
              <button onClick={() => setDeleteTarget(null)} className="text-sm px-4 py-2 bg-white border border-slate-300 text-slate-600 rounded-xl hover:bg-slate-50">キャンセル</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// ItemQuestionSection — 項目への質問フォーム
// ============================================================
function ItemQuestionSection({ itemId }) {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading]     = useState(false);
  const [userName, setUserName]   = useState('');
  const [questionText, setQuestionText] = useState('');
  const [saving, setSaving]       = useState(false);
  const [expanded, setExpanded]   = useState({});

  useEffect(() => {
    if (!itemId) return;
    setLoading(true);
    supabase.from('item_questions').select('*').eq('item_id', itemId)
      .order('created_at', { ascending: false })
      .then(({ data }) => { setQuestions(data || []); setLoading(false); });
  }, [itemId]);

  const submitQuestion = async () => {
    if (!questionText.trim() || !userName.trim()) return;
    setSaving(true);
    const { data, error } = await supabase.from('item_questions')
      .insert({ item_id: itemId, user_name: userName.trim(), question: questionText.trim(), status: 'open' })
      .select().single();
    if (!error && data) { setQuestions(prev => [data, ...prev]); setQuestionText(''); }
    setSaving(false);
  };

  const submitAnswer = async (qId, answer, answeredBy) => {
    const { error } = await supabase.from('item_questions')
      .update({ answer, answered_by: answeredBy, status: 'answered' }).eq('id', qId);
    if (!error) setQuestions(prev => prev.map(q => q.id === qId ? { ...q, answer, answered_by: answeredBy, status: 'answered' } : q));
  };

  const QuestionItem = ({ q }) => {
    const [answerText, setAnswerText]   = useState('');
    const [answererName, setAnswererName] = useState('');
    const [showForm, setShowForm]       = useState(false);
    const [submitting, setSubmitting]   = useState(false);
    const isAnswered = q.status === 'answered';
    const isOpen = expanded[q.id] ?? false;

    return (
      <div className={`rounded-xl border p-3 ${isAnswered ? 'bg-green-50 border-green-100' : 'bg-orange-50 border-orange-100'}`}>
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-medium text-slate-700">{q.user_name}</span>
            <span className="text-xs text-slate-400">{new Date(q.created_at).toLocaleDateString('ja-JP')}</span>
          </div>
          <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium shrink-0 ${isAnswered ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-600'}`}>
            {isAnswered ? '回答済み' : '未回答'}
          </span>
        </div>
        {isAnswered ? (
          <button onClick={() => setExpanded(p => ({ ...p, [q.id]: !p[q.id] }))} className="w-full text-left">
            {isOpen ? (
              <>
                <p className="text-sm text-slate-800 mb-2">Q: {q.question}</p>
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
                    await submitAnswer(q.id, answerText.trim(), answererName.trim());
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
  };

  if (!itemId) return null;

  return (
    <section>
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
        みんなへの質問{questions.length > 0 && <span className="ml-1 normal-case font-normal text-slate-400">({questions.length}件)</span>}
      </p>
      <div className="bg-slate-50 rounded-xl border border-slate-200 p-3 mb-3 space-y-2">
        <input type="text" value={userName} onChange={e => setUserName(e.target.value)} placeholder="投稿者名..."
          className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300" />
        <textarea value={questionText} onChange={e => setQuestionText(e.target.value)}
          placeholder="この項目について質問してください..." rows={2}
          className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300" />
        <button onClick={submitQuestion} disabled={saving || !questionText.trim() || !userName.trim()}
          className="w-full text-sm py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-40">
          {saving ? '投稿中...' : '質問する'}
        </button>
      </div>
      {loading ? <p className="text-xs text-slate-400 text-center py-3">読み込み中...</p>
        : questions.length === 0 ? <p className="text-xs text-slate-400 text-center py-3">まだ質問がありません</p>
        : <div className="space-y-2">{questions.map(q => <QuestionItem key={q.id} q={q} />)}</div>}
    </section>
  );
}

// ============================================================
// PlanPanel — クリア計画
// ============================================================
function PlanPanel({ plans, plansLoading, planForm, setPlanForm, savingPlan, onAddPlan, onAchievePlan, onDeletePlan, unachievedItems, selectedUser }) {
  const now = new Date();
  const getDaysLeft = (due) => due ? Math.ceil((new Date(due) - now) / 86400000) : null;
  const daysStyle = (d) => d === null ? '' : d < 0 ? 'text-red-500 font-semibold' : d <= 7 ? 'text-orange-500 font-semibold' : 'text-green-600';
  const daysLabel = (d) => d === null ? '' : d < 0 ? `${Math.abs(d)}日超過` : d === 0 ? '今日が期限' : `あと${d}日`;

  return (
    <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4">
      <div>
        <h2 className="text-base font-semibold text-slate-700">{selectedUser?.name} のクリア計画</h2>
        <p className="text-xs text-slate-400 mb-4">期限を設定して項目クリアを管理します</p>
      </div>
      <div className="space-y-2">
        {plansLoading ? <p className="text-sm text-slate-400 text-center py-6">読み込み中...</p>
          : plans.length === 0 ? <p className="text-sm text-slate-400 text-center py-6">計画がありません</p>
          : plans.map(plan => {
            const days = getDaysLeft(plan.due_date);
            return (
              <div key={plan.id} className={`bg-white rounded-xl border p-3 shadow-sm ${days !== null && days < 0 ? 'border-red-200 bg-red-50' : 'border-slate-200'}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-800 leading-snug">{plan.evaluation_items?.item_name ?? '(不明)'}</p>
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      {plan.due_date && <span className="text-xs text-slate-500">期限: {plan.due_date}</span>}
                      {days !== null && <span className={`text-xs ${daysStyle(days)}`}>{daysLabel(days)}</span>}
                      {plan.planned_month && <span className="text-xs text-indigo-500">予定月: {plan.planned_month}</span>}
                      {plan.created_by && plan.created_by !== 'self' && <span className="text-xs text-slate-400">担当: {plan.created_by}</span>}
                    </div>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <button onClick={() => onAchievePlan(plan.id)} className="text-xs px-2 py-1 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">達成</button>
                    <button onClick={() => onDeletePlan(plan.id)} className="text-xs px-2 py-1 bg-white border border-slate-300 text-slate-500 rounded-lg hover:bg-red-50 hover:border-red-200 hover:text-red-500 transition-colors">削除</button>
                  </div>
                </div>
              </div>
            );
          })}
      </div>
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3">
        <h3 className="text-sm font-semibold text-slate-700">計画を追加</h3>
        <div>
          <label className="text-xs font-medium text-slate-500 block mb-1">項目を選択 *</label>
          <select value={planForm.item_id} onChange={e => setPlanForm(p => ({ ...p, item_id: e.target.value }))}
            className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300">
            <option value="">選択してください</option>
            {unachievedItems.map(i => (
              <option key={i.item_def_id} value={i.item_def_id}>#{i.item_no} {i.item_name}</option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">期限 *</label>
            <input type="date" value={planForm.due_date} onChange={e => setPlanForm(p => ({ ...p, due_date: e.target.value }))}
              className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">予定月</label>
            <input type="text" value={planForm.planned_month} onChange={e => setPlanForm(p => ({ ...p, planned_month: e.target.value }))}
              placeholder="2026/06"
              className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">開始日</label>
            <input type="date" value={planForm.start_date} onChange={e => setPlanForm(p => ({ ...p, start_date: e.target.value }))}
              className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">作成者</label>
            <input type="text" value={planForm.created_by} onChange={e => setPlanForm(p => ({ ...p, created_by: e.target.value }))}
              placeholder="self または担当者名"
              className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
          </div>
        </div>
        <button onClick={onAddPlan} disabled={savingPlan || !planForm.item_id || !planForm.due_date}
          className="w-full text-sm py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-40 font-medium">
          {savingPlan ? '保存中...' : '計画を追加'}
        </button>
      </div>
    </div>
  );
}


// ============================================================
// SalaryView — 時給管理タブ（2ペインレイアウト）
// ============================================================
function SalaryView({ users }) {
  const [salaryUser, setSalaryUser]         = useState(null);
  const [salaryHistory, setSalaryHistory]   = useState([]);
  const [completedByMonth, setCompletedByMonth] = useState({});
  const [salaryLoading, setSalaryLoading]   = useState(false);
  const [toggling, setToggling]             = useState(null); // month being toggled

  // 管理者ビュー
  const [adminUnlocked, setAdminUnlocked]   = useState(false);
  const [adminInput, setAdminInput]         = useState('');
  const [adminPwError, setAdminPwError]     = useState(false);
  const [adminTab, setAdminTab]             = useState('list');
  const [allSalaryData, setAllSalaryData]   = useState([]);
  const [adminLoading, setAdminLoading]     = useState(false);
  const [adminMonth, setAdminMonth]         = useState(CURRENT_MONTH);
  const [bulkUsers, setBulkUsers]           = useState([]);
  const [bulkRate, setBulkRate]             = useState('');
  const [bulkNote, setBulkNote]             = useState('');
  const [bulkSaving, setBulkSaving]         = useState(false);

  // ビュー切り替え: 'personal' | 'admin'
  const [salaryView, setSalaryView]         = useState('personal');

  useEffect(() => { if (users.length && !salaryUser) setSalaryUser(users[0]); }, [users]);

  useEffect(() => {
    if (!salaryUser) return;
    setSalaryLoading(true);
    const pName = salaryUser.progress_name ?? salaryUser.name;
    Promise.all([
      supabase.from('hourly_rate_history').select('*').eq('user_id', salaryUser.id).order('month'),
      supabase.from('evaluation_progress').select('achieved_month').eq('user_name', pName).eq('status', 'completed').not('achieved_month', 'is', null),
    ]).then(([hRes, pRes]) => {
      setSalaryHistory(hRes.data || []);
      const counts = {};
      (pRes.data || []).forEach(p => { if (/^\d{4}\/\d{2}$/.test(p.achieved_month)) counts[p.achieved_month] = (counts[p.achieved_month] || 0) + 1; });
      setCompletedByMonth(counts);
      setSalaryLoading(false);
    });
  }, [salaryUser]);

  useEffect(() => { if (salaryView === 'admin' && adminUnlocked) loadAdminData(); }, [salaryView, adminUnlocked]);

  const loadAdminData = async () => {
    setAdminLoading(true);
    const { data } = await supabase.from('hourly_rate_history')
      .select('id, user_id, month, base_rate, item_bonus, total_rate, confirmed, note, users(name, rank)')
      .order('month').limit(5000);
    setAllSalaryData(data || []);
    setAdminLoading(false);
  };

  const getRankInfo = (rank) => RANK_SALARY[rank] ?? { base: 1163, bonus: 0 };

  const calcMonth = (month, user) => {
    const { base, bonus } = getRankInfo(user?.rank ?? '');
    const count = completedByMonth[month] || 0;
    return { base_rate: base, item_bonus: bonus * count, total: base + bonus * count };
  };

  // 確定/未確定トグル
  const toggleConfirm = async (month) => {
    if (!salaryUser || toggling) return;
    setToggling(month);
    const existing = salaryHistory.find(h => h.month === month);
    if (existing) {
      const newConfirmed = !existing.confirmed;
      await supabase.from('hourly_rate_history').update({ confirmed: newConfirmed }).eq('id', existing.id);
      setSalaryHistory(prev => prev.map(h => h.month === month ? { ...h, confirmed: newConfirmed } : h));
    } else {
      const { base_rate, item_bonus } = calcMonth(month, salaryUser);
      const { data } = await supabase.from('hourly_rate_history')
        .insert({ user_id: salaryUser.id, month, base_rate, item_bonus, confirmed: true })
        .select().single();
      if (data) setSalaryHistory(prev => [...prev, data].sort((a, b) => a.month.localeCompare(b.month)));
    }
    setToggling(null);
  };

  // 今月の時給を計算してDBに保存（未確定で保存）
  const calcAndSave = async () => {
    if (!salaryUser || toggling) return;
    setToggling(CURRENT_MONTH);
    const { base_rate, item_bonus } = calcMonth(CURRENT_MONTH, salaryUser);
    await supabase.from('hourly_rate_history').upsert(
      { user_id: salaryUser.id, month: CURRENT_MONTH, base_rate, item_bonus, confirmed: false },
      { onConflict: 'user_id,month' }
    );
    const { data } = await supabase.from('hourly_rate_history').select('*').eq('user_id', salaryUser.id).order('month');
    setSalaryHistory(data || []);
    setToggling(null);
  };

  const unlockAdmin = () => {
    if (adminInput === ADMIN_PASSWORD) { setAdminUnlocked(true); setAdminInput(''); setAdminPwError(false); }
    else setAdminPwError(true);
  };

  const handleBulkUpdate = async () => {
    if (!bulkUsers.length || !bulkRate) return;
    setBulkSaving(true);
    for (const uid of bulkUsers) {
      await supabase.from('hourly_rate_history').upsert(
        { user_id: uid, month: adminMonth, base_rate: parseInt(bulkRate), item_bonus: 0, confirmed: false, note: bulkNote || null },
        { onConflict: 'user_id,month' }
      );
    }
    await loadAdminData();
    setBulkUsers([]); setBulkRate(''); setBulkNote('');
    setBulkSaving(false);
  };

  const exportCsv = () => {
    const rows = [
      ['名前','月','基本時給','ボーナス','合計'],
      ...allSalaryData.filter(d => d.month === adminMonth).map(d => [
        d.users?.name ?? d.user_id, d.month,
        d.base_rate, d.item_bonus ?? 0,
        d.total_rate ?? (d.base_rate + (d.item_bonus ?? 0)),
      ])
    ];
    const blob = new Blob(['﻿' + rows.map(r => r.join(',')).join('\n')], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `salary_${adminMonth.replace('/', '-')}.csv`; a.click();
    URL.revokeObjectURL(a.href);
  };

  const allMonths = [...new Set([...Object.keys(completedByMonth), ...salaryHistory.map(h => h.month), CURRENT_MONTH])].sort();
  const chartData = allMonths.map(month => {
    const hist = salaryHistory.find(h => h.month === month);
    return {
      month,
      total: hist ? (hist.total_rate ?? hist.base_rate + (hist.item_bonus ?? 0)) : calcMonth(month, salaryUser).total,
      confirmed: hist?.confirmed ?? false,
    };
  });
  const adminMonths = [...new Set([CURRENT_MONTH, ...allSalaryData.map(d => d.month)])].sort().reverse();
  const adminMonthData = allSalaryData.filter(d => d.month === adminMonth);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* ビュー切り替えヘッダー */}
      <div className="bg-white border-b border-slate-200 px-4 py-2 flex items-center gap-2 shrink-0">
        <div className="flex rounded-lg border border-slate-200 overflow-hidden text-xs">
          {[['personal','個人時給'],['admin','管理者ビュー']].map(([v,l]) => (
            <button key={v} onClick={() => setSalaryView(v)}
              className={`px-3 py-1.5 transition-colors ${salaryView === v ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* 個人ビュー */}
      {salaryView === 'personal' && (
        <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
          {/* 左ペイン: ユーザー選択 + 履歴一覧 */}
          <div className="md:w-80 lg:w-96 shrink-0 bg-white border-r border-slate-200 flex flex-col overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 space-y-2 shrink-0">
              <label className="text-xs font-medium text-slate-500 block">メンバーを選択</label>
              <select value={salaryUser?.id ?? ''} onChange={e => setSalaryUser(users.find(u => u.id === e.target.value) ?? null)}
                className="w-full text-sm border border-slate-300 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400">
                {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
              {salaryUser?.rank && (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-medium">{salaryUser.rank}</span>
                  {(() => {
                    const { base, bonus } = getRankInfo(salaryUser.rank);
                    return <span className="text-xs text-slate-500">基本 {base.toLocaleString()}円{bonus > 0 ? ` + ${bonus}円/件` : ''}</span>;
                  })()}
                </div>
              )}
            </div>

            {/* 月次履歴リスト */}
            <div className="flex-1 overflow-y-auto">
              {salaryLoading ? (
                <div className="text-center py-12 text-slate-400 text-sm">読み込み中...</div>
              ) : allMonths.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-sm">データなし</div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {[...allMonths].reverse().map(month => {
                    const hist = salaryHistory.find(h => h.month === month);
                    const calc = calcMonth(month, salaryUser);
                    const base = hist?.base_rate ?? calc.base_rate;
                    const bonusVal = hist?.item_bonus ?? calc.item_bonus;
                    const total = hist?.total_rate ?? (base + bonusVal);
                    const isConfirmed = hist?.confirmed ?? false;
                    const isCurrent = month === CURRENT_MONTH;
                    return (
                      <div key={month} className={`px-4 py-3 ${!isConfirmed ? 'bg-yellow-50' : ''}`}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-slate-700">
                            {month}{isCurrent && <span className="ml-1 text-xs text-indigo-500 font-normal">今月</span>}
                          </span>
                          <button
                            onClick={() => toggleConfirm(month)}
                            disabled={toggling === month}
                            className={`text-xs px-2.5 py-1 rounded-lg border transition-colors font-medium ${
                              toggling === month ? 'opacity-40 cursor-not-allowed bg-slate-100 text-slate-400 border-slate-200' :
                              isConfirmed
                                ? 'bg-green-50 text-green-700 border-green-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200'
                                : 'bg-white text-slate-600 border-slate-300 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-300'
                            }`}
                          >
                            {toggling === month ? '...' : isConfirmed ? '✓ 確定済み' : '− 未確定'}
                          </button>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-slate-500">
                          <span>{base.toLocaleString()}円</span>
                          {bonusVal > 0 && <span className="text-green-600">+{bonusVal}円</span>}
                          <span className="font-semibold text-slate-700 text-sm">{total.toLocaleString()}円</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* 右ペイン: グラフ + 計算ボタン */}
          <div className="flex-1 overflow-y-auto bg-slate-50 p-5 space-y-5">
            {salaryUser && (() => {
              const { base, bonus } = getRankInfo(salaryUser.rank ?? '');
              const curCalc = calcMonth(CURRENT_MONTH, salaryUser);
              const curCount = completedByMonth[CURRENT_MONTH] ?? 0;
              return (
                <>
                  {/* 今月サマリー */}
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">今月 ({CURRENT_MONTH}) の時給</p>
                    <div className="flex flex-wrap gap-3 mb-4">
                      {[
                        { label: '基本時給', value: `${base.toLocaleString()}円` },
                        { label: '今月クリア', value: `${curCount}件`, hi: curCount > 0 },
                        { label: 'ボーナス', value: `${(bonus * curCount).toLocaleString()}円`, hi: bonus * curCount > 0 },
                        { label: '推定時給', value: `${curCalc.total.toLocaleString()}円`, bold: true },
                      ].map(s => (
                        <div key={s.label} className={`rounded-xl px-4 py-3 text-center border flex-1 min-w-[80px] ${s.bold ? 'bg-indigo-50 border-indigo-200' : s.hi ? 'bg-green-50 border-green-100' : 'bg-slate-50 border-slate-100'}`}>
                          <p className={`text-lg font-bold ${s.bold ? 'text-indigo-700' : 'text-slate-800'}`}>{s.value}</p>
                          <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
                        </div>
                      ))}
                    </div>
                    <button onClick={calcAndSave} disabled={!!toggling}
                      className="w-full text-sm py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-40 font-medium">
                      {toggling === CURRENT_MONTH ? '保存中...' : '今月の時給を計算して保存'}
                    </button>
                  </div>

                  {/* 時給推移グラフ */}
                  {chartData.length > 0 && (
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">時給推移</p>
                      <ResponsiveContainer width="100%" height={200}>
                        <LineChart data={chartData} margin={{ top: 4, right: 16, left: -16, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                          <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                          <YAxis tick={{ fontSize: 10 }} domain={['auto', 'auto']} />
                          <Tooltip formatter={v => [`${Number(v).toLocaleString()}円`, '時給']} />
                          <Line type="monotone" dataKey="total" stroke="#6366f1" strokeWidth={2.5}
                            dot={({ cx, cy, payload, index }) => (
                              <circle key={index} cx={cx} cy={cy} r={5}
                                fill={payload.confirmed ? '#6366f1' : '#fff'}
                                stroke="#6366f1" strokeWidth={2} />
                            )} />
                        </LineChart>
                      </ResponsiveContainer>
                      <p className="text-xs text-slate-400 mt-1.5">
                        塗りつぶし ◆ 確定済み　白抜き ◇ 未確定
                      </p>
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* 管理者ビュー */}
      {salaryView === 'admin' && (
        <div className="flex-1 overflow-y-auto p-5">
          {!adminUnlocked ? (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 max-w-sm mx-auto mt-8">
              <h3 className="text-sm font-semibold text-slate-700 mb-1">管理者認証</h3>
              <p className="text-xs text-slate-400 mb-4">パスワードを入力してください</p>
              <div className="flex gap-2">
                <input type="password" value={adminInput} onChange={e => setAdminInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && unlockAdmin()} placeholder="パスワード"
                  className={`flex-1 text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300 ${adminPwError ? 'border-red-400' : 'border-slate-300'}`} />
                <button onClick={unlockAdmin} className="text-sm px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">確認</button>
              </div>
              {adminPwError && <p className="text-xs text-red-500 mt-2">パスワードが違います</p>}
            </div>
          ) : (
            <div className="space-y-4 max-w-5xl mx-auto">
              {/* 月選択 + タブ + CSV */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="flex items-center border-b border-slate-200 px-4">
                  {[['list','一覧'],['bulk','一括更新']].map(([v,l]) => (
                    <button key={v} onClick={() => setAdminTab(v)}
                      className={`text-sm px-4 py-3 font-medium transition-colors border-b-2 ${adminTab === v ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
                      {l}
                    </button>
                  ))}
                  <div className="flex-1" />
                  <div className="flex items-center gap-2 py-2">
                    <label className="text-xs text-slate-500">月</label>
                    <select value={adminMonth} onChange={e => setAdminMonth(e.target.value)}
                      className="text-xs border border-slate-300 rounded px-2 py-1 bg-white focus:outline-none">
                      {adminMonths.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                    <button onClick={exportCsv}
                      className="text-xs px-3 py-1.5 bg-slate-700 text-white rounded-lg hover:bg-slate-800 transition-colors">
                      CSVエクスポート
                    </button>
                  </div>
                </div>

                {/* 一覧タブ */}
                {adminTab === 'list' && (
                  <div className="overflow-x-auto">
                    {adminLoading ? <p className="text-sm text-slate-400 text-center py-8">読み込み中...</p> : (
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-slate-200 bg-slate-50">
                            {['名前','ランク','基本時給','ボーナス','合計','確定','メモ'].map(h => (
                              <th key={h} className={`py-2.5 px-4 text-slate-500 font-medium ${['基本時給','ボーナス','合計'].includes(h) ? 'text-right' : h === '確定' ? 'text-center' : 'text-left'}`}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {adminMonthData.length === 0 ? (
                            <tr><td colSpan={7} className="text-center py-8 text-slate-400">この月のデータがありません</td></tr>
                          ) : adminMonthData.map(d => (
                            <tr key={d.id} className={`border-b border-slate-100 ${!d.confirmed ? 'bg-yellow-50' : ''}`}>
                              <td className="py-2.5 px-4 font-medium text-slate-700">{d.users?.name ?? '−'}</td>
                              <td className="py-2.5 px-4 text-slate-500">{d.users?.rank ?? '−'}</td>
                              <td className="py-2.5 px-4 text-right">{(d.base_rate ?? 0).toLocaleString()}円</td>
                              <td className="py-2.5 px-4 text-right text-green-600">+{d.item_bonus ?? 0}円</td>
                              <td className="py-2.5 px-4 text-right font-semibold">{(d.total_rate ?? (d.base_rate ?? 0) + (d.item_bonus ?? 0)).toLocaleString()}円</td>
                              <td className="py-2.5 px-4 text-center">
                                {d.confirmed
                                  ? <span className="text-green-600 font-medium">確定</span>
                                  : <span className="text-amber-500 font-medium">未確定</span>}
                              </td>
                              <td className="py-2.5 px-4 text-slate-400">{d.note ?? ''}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}

                {/* 一括更新タブ */}
                {adminTab === 'bulk' && (
                  <div className="p-5 space-y-4">
                    <p className="text-sm text-slate-600">対象月 <span className="font-semibold text-indigo-600">{adminMonth}</span> の基本時給を一括更新します</p>
                    <div>
                      <label className="text-xs font-medium text-slate-500 block mb-2">対象メンバーを選択</label>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 max-h-40 overflow-y-auto border border-slate-200 rounded-xl p-3 bg-slate-50">
                        {users.map(u => (
                          <label key={u.id} className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={bulkUsers.includes(u.id)}
                              onChange={e => setBulkUsers(prev => e.target.checked ? [...prev, u.id] : prev.filter(id => id !== u.id))}
                              className="w-3.5 h-3.5 accent-indigo-600" />
                            <span className="text-xs text-slate-700 truncate">{u.name}</span>
                          </label>
                        ))}
                      </div>
                      <button onClick={() => setBulkUsers(bulkUsers.length === users.length ? [] : users.map(u => u.id))}
                        className="text-xs text-indigo-600 hover:underline mt-1">
                        {bulkUsers.length === users.length ? '全解除' : '全選択'}
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-medium text-slate-500 block mb-1">基本時給 (円) *</label>
                        <input type="number" value={bulkRate} onChange={e => setBulkRate(e.target.value)} placeholder="例: 1300"
                          className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-slate-500 block mb-1">メモ（任意）</label>
                        <input type="text" value={bulkNote} onChange={e => setBulkNote(e.target.value)} placeholder="例: 最低賃金改定"
                          className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                      </div>
                    </div>
                    <button onClick={handleBulkUpdate} disabled={bulkSaving || !bulkUsers.length || !bulkRate}
                      className="w-full text-sm py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-40 font-medium">
                      {bulkSaving ? '更新中...' : `${bulkUsers.length}名 の基本時給を更新`}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
