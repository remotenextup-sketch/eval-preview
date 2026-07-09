import React, { useState, useEffect, useCallback } from 'react';
import confetti from 'canvas-confetti';

import { supabase } from './components/supabaseClient';
import {
  STATUSES, STATUS_MAP, CURRENT_MONTH, RANK_OPTIONS, EMPTY_ITEM_FORM,
} from './constants';

import Header        from './components/Header';
import PersonalView  from './components/PersonalView';
import OverallView   from './components/OverallView';
import AdminView     from './components/AdminView';
import SurveyView    from './components/SurveyView';
import MembersView   from './components/MemberView';
import SalaryView    from './components/SalaryView';
import OrgChartView  from './components/OrgChartView';
import SettingsModal  from './components/SettingsModal';
import SurveyModal    from './components/SurveyModal';
import BugBoardModal  from './components/BugBoardModal';

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
  const [uploading, setUploading]       = useState({});

  // ── 全体/部門別 ──
  const [overallLoading, setOverallLoading] = useState(false);
  const [overallLoaded, setOverallLoaded]   = useState(false);
  const [completedProgress, setCompletedProgress] = useState([]);
  const [stuckProgress, setStuckProgress]   = useState([]);
  const [allItemDefs, setAllItemDefs]       = useState([]);
  const [allUsersData, setAllUsersData]     = useState([]);

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
  const [itemCommentCounts, setItemCommentCounts] = useState({});


  // ── クリア計画 ──
  const [plans, setPlans]               = useState([]);
  const [plansLoading, setPlansLoading] = useState(false);
  const [showPlanView, setShowPlanView] = useState(false);
  const [planForm, setPlanForm]         = useState({ item_id: '', planned_month: '', start_date: '', due_date: '', created_by: '' });
  const [savingPlan, setSavingPlan]     = useState(false);

  // ── メンバー管理タブ ──
  const [membersKey, setMembersKey]     = useState(0);
  const [availableRanks, setAvailableRanks] = useState([...RANK_OPTIONS]);

  // ── サーベイ未回答バッジ ──
  const [surveyUnread, setSurveyUnread] = useState(false);

  // ── 設定・サーベイ・バグ報告モーダル ──
  const [showSettings, setShowSettings]     = useState(false);
  const [showSurveyModal, setShowSurveyModal] = useState(false);
  const [showBugBoard, setShowBugBoard]     = useState(false);
  const [bugCount, setBugCount]             = useState(0);

  // ── KPI目標（今月・選択中ユーザー）──
  const [kpiTarget, setKpiTarget] = useState(null);

  // ── 質問パネル ──
  const [showQuestionsPanel, setShowQuestionsPanel] = useState(false);


  // ── 付箋ページからの項目選択連携 ──
  const [pendingItemNo, setPendingItemNo] = useState(null);

  // サーベイ未回答チェック
  const checkSurveyUnread = useCallback(async () => {
    if (!selectedUser) { setSurveyUnread(false); return; }
    const { data: active } = await supabase.from('surveys').select('id').eq('is_active', true).limit(1);
    if (!active?.length) { setSurveyUnread(false); return; }
    const { data: resp } = await supabase.from('survey_responses')
      .select('id').eq('survey_id', active[0].id).eq('user_id', selectedUser.id).eq('month', CURRENT_MONTH).limit(1);
    setSurveyUnread(!(resp?.length));
  }, [selectedUser?.id]);

  useEffect(() => {
    let cancelled = false;
    checkSurveyUnread().catch(() => {});
    return () => { cancelled = true; };
  }, [checkSurveyUnread]);

  // 未解決バグ件数（open + in_progress）
  const refreshBugCount = useCallback(async () => {
    const { count } = await supabase.from('bug_reports')
      .select('id', { count: 'exact', head: true })
      .in('status', ['open', 'in_progress']);
    setBugCount(count ?? 0);
  }, []);

  useEffect(() => { refreshBugCount(); }, [refreshBugCount]);

  // KPI目標フェッチ（選択ユーザー・今月）
  useEffect(() => {
    if (!selectedUser) return;
    supabase.from('kpi_targets').select('*')
      .eq('user_id', selectedUser.id).eq('target_month', CURRENT_MONTH)
      .maybeSingle()
      .then(({ data }) => setKpiTarget(data || null));
  }, [selectedUser?.id]);

  // ① users
  useEffect(() => {
    supabase.from('users').select('id, name, rank, progress_name, onboarding_at').is('resigned_at', null).order('onboarding_at', { ascending: true, nullsFirst: false })
      .then(({ data }) => {
        if (!data) return;
        const valid = data.filter(u => u.name && u.name !== 'テンプレート');
        setUsers(valid);
        const savedId = localStorage.getItem('lastSelectedUserId');
        const restored = savedId ? valid.find(u => u.id === savedId) : null;
        setSelectedUser(restored ?? valid[0] ?? null);
      });
  }, []);

  // 選択ユーザーをlocalStorageに保存
  useEffect(() => {
    if (selectedUser?.id) localStorage.setItem('lastSelectedUserId', selectedUser.id);
  }, [selectedUser?.id]);

  // ランク一覧
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
    supabase.from('users').select('id, name, rank, progress_name, onboarding_at').is('resigned_at', null).order('onboarding_at', { ascending: true, nullsFirst: false })
      .then(({ data }) => {
        if (!data) return;
        const valid = data.filter(u => u.name && u.name !== 'テンプレート');
        setUsers(valid);
      });
  }, []);

  // ② 全体/部門別データ
  useEffect(() => {
    if (view !== 'overall' || overallLoaded) return;
    setOverallLoading(true);
    Promise.all([
      supabase.from('evaluation_progress').select('achieved_month, user_name, item_no').eq('status', 'completed').limit(5000),
      supabase.from('evaluation_progress').select('item_no, created_at, user_name').in('status', ['pending', 'in_progress']).limit(5000),
      supabase.from('evaluation_items').select('no, item_name, rank').limit(1000),
      supabase.from('users').select('id, name, progress_name, rank, department, resigned_at, onboarding_at, trainee_at, partner_at, leader_at, specialist_at, director_at, birth_year').neq('name', 'テンプレート').limit(200),
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
      supabase.from('evaluation_items').select('*').order('sort_order', { nullsLast: true }).order('no'),
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
    const [{ data: progress }, { data: itemDefs }, { data: currentMonthPlans }] = await Promise.all([
      supabase.from('evaluation_progress').select('*, evaluation_evidences(*)').eq('user_name', selectedUser.progress_name ?? selectedUser.name),
      supabase.from('evaluation_items').select('id, no, sort_order, item_name, description, rank, is_salary_item').eq('rank', selectedUser.rank),
      supabase.from('evaluation_plans').select('item_id').eq('user_id', selectedUser.id).eq('planned_month', CURRENT_MONTH),
    ]);
    // Build rank-aware progress map:
    // priority 2 = exact rank match, 1 = null rank, 0 = any other rank (last resort)
    const progressMap = {};
    (progress || []).forEach(p => {
      if (p.item_no == null) return;
      const priority = p.rank === selectedUser.rank ? 2 : p.rank == null ? 1 : 0;
      const existing = progressMap[p.item_no];
      const existingPriority = existing ? (existing.rank === selectedUser.rank ? 2 : existing.rank == null ? 1 : 0) : -1;
      if (priority > existingPriority) progressMap[p.item_no] = p;
    });
    const merged = (itemDefs || [])
      .filter(d => d.no != null)
      .map(d => {
        const p = progressMap[d.no];
        if (!p) return null;
        return {
          ...p,
          item_name: d.item_name,
          description: d.description ?? '',
          item_def_id: d.id,
          is_salary_item: d.is_salary_item ?? false,
          sort_order: d.sort_order ?? d.no ?? 9999,
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.sort_order - b.sort_order);

    // 当月計画がある & pending/NULL の項目を 'in_progress' に一括更新
    if (currentMonthPlans?.length > 0) {
      const currentMonthItemIds = new Set(currentMonthPlans.map(p => p.item_id));
      const toActivate = merged.filter(m =>
        currentMonthItemIds.has(m.item_def_id) &&
        (m.status == null || m.status === 'pending')
      );
      if (toActivate.length > 0) {
        await Promise.all(toActivate.map(m =>
          supabase.from('evaluation_progress').update({ status: 'in_progress', updated_at: new Date().toISOString() }).eq('id', m.id)
        ));
        toActivate.forEach(m => { m.status = 'in_progress'; });
      }
    }

    // 【廃止】【削除】を含む項目は達成済み(completed)の場合のみ表示
    const isDeprecated = name => /【廃止】|【削除】/.test(name ?? '');
    const visibleItems = merged.filter(item =>
      !isDeprecated(item.item_name) || item.status === 'completed'
    );

    setItems(visibleItems);
    setLoading(false);
  }, [selectedUser]);

  useEffect(() => { loadItems(); }, [loadItems]);

  // ユーザー切り替え時にフィルターをリセット
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
      .order('planned_month', { ascending: true, nullsFirst: false })
      .then(async ({ data }) => {
        let loadedPlans = data || [];
        const overdueIds = loadedPlans
          .filter(p => p.status === 'planned' && p.planned_month && p.planned_month <= CURRENT_MONTH)
          .map(p => p.id);
        if (overdueIds.length > 0) {
          await supabase.from('evaluation_plans').update({ status: 'overdue' }).in('id', overdueIds);
          loadedPlans = loadedPlans.map(p => overdueIds.includes(p.id) ? { ...p, status: 'overdue' } : p);
        }
        setPlans(loadedPlans);
        setPlansLoading(false);
      });
  }, [selectedUser, view]);

  // 付箋ページからの storage イベントで項目選択
  useEffect(() => {
    const handler = (e) => {
      if (e.key !== 'stickySelectItem') return;
      try {
        const sel = JSON.parse(e.newValue);
        if (!sel) return;
        setView('personal');
        setStatusFilter('all');
        setPendingItemNo(sel.itemNo);
        if (sel.userId && sel.userId !== selectedUser?.id) {
          const u = users.find(u => u.id === sel.userId);
          if (u) setSelectedUser(u);
        }
      } catch {}
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, [users, selectedUser?.id]);

  // pendingItemNo が立ったとき items がロード済みなら即選択
  useEffect(() => {
    if (pendingItemNo == null || !items.length) return;
    const item = items.find(i => i.item_no === pendingItemNo);
    if (item) {
      setSelectedItem(item);
      setMobileShowDetail(true);
      setPendingItemNo(null);
      localStorage.removeItem('stickySelectItem');
    }
  }, [items, pendingItemNo]);

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
  const salarySummary = (() => {
    const sal = items.filter(i => i.is_salary_item);
    const done = sal.filter(i => i.status === 'completed').length;
    return { total: sal.length, done, remaining: sal.length - done };
  })();

  // ── 管理タブ: ランク別コメントあり項目数 ──
  const rankCommentSummary = RANK_OPTIONS
    .map(rank => ({ rank, count: adminItems.filter(i => i.rank === rank && (itemCommentCounts[i.id] || 0) > 0).length }))
    .filter(r => r.count > 0);

  // ── 管理タブ関数 ──
  const loadAdminItems = useCallback(async () => {
    const { data, error } = await supabase.from('evaluation_items').select('*').not('item_name', 'is', null).order('sort_order', { nullsLast: true }).order('no');
    if (error) { console.error('[loadAdminItems] error:', error); return false; }
    setAdminItems(data || []);
    return true;
  }, []);

  const deleteAdminItem = async (item) => {
    // 関連データを順番に削除
    const { data: progressRows } = await supabase.from('evaluation_progress').select('id').eq('item_no', item.no);
    const progressIds = (progressRows || []).map(p => p.id);
    if (progressIds.length > 0) {
      await supabase.from('evaluation_evidences').delete().in('progress_id', progressIds);
    }
    await supabase.from('evaluation_progress').delete().eq('item_no', item.no);
    await supabase.from('item_questions').delete().eq('item_id', item.id);
    await supabase.from('item_comments').delete().eq('item_id', item.id);
    await supabase.from('evaluation_plans').delete().eq('item_id', item.id);
    const { error } = await supabase.from('evaluation_items').delete().eq('id', item.id);
    if (error) { console.error('[deleteAdminItem] error:', error); return false; }
    await loadAdminItems();
    return true;
  };

  const selectAdminItem = (item) => {
    setSelectedAdminItem(item);
    setAdminForm(item === 'new'
      ? EMPTY_ITEM_FORM
      : { item_name: item.item_name ?? '', rank: item.rank ?? '', description: item.description ?? '', is_salary_item: item.is_salary_item ?? false });
    setMobileShowAdminEdit(true);
  };

  const saveAdminForm = async () => {
    console.log('[saveAdminForm] called, form:', adminForm, 'selectedAdminItem:', selectedAdminItem);
    if (!(adminForm.item_name ?? '').trim() || !adminForm.rank) {
      console.warn('[saveAdminForm] validation failed: item_name=', adminForm.item_name, 'rank=', adminForm.rank);
      return false;
    }
    setSavingAdminForm(true);
    let success = false;
    if (selectedAdminItem === 'new') {
      // no・sort_order を自動採番（ascending: false で降順取得）
      const { data: maxRow, error: maxErr } = await supabase.from('evaluation_items').select('no').not('no', 'is', null).order('no', { ascending: false }).limit(1);
      console.log('[saveAdminForm] maxRow:', maxRow, 'maxErr:', maxErr);
      const maxNo = (maxRow?.[0]?.no ?? 0) + 1;
      const { data: maxSortRow } = await supabase.from('evaluation_items').select('sort_order').not('sort_order', 'is', null).order('sort_order', { ascending: false }).limit(1);
      const maxSort = (maxSortRow?.[0]?.sort_order ?? 0) + 1;
      console.log('[saveAdminForm] inserting with no:', maxNo, 'sort_order:', maxSort);

      const { data, error } = await supabase.from('evaluation_items')
        .insert({ ...adminForm, status: 'active', no: maxNo, sort_order: maxSort })
        .select().single();
      console.log('[saveAdminForm] INSERT result data:', data, 'error:', error);
      if (error) {
        console.error('[saveAdminForm] INSERT error:', error);
      } else {
        if (data) setSelectedAdminItem(data);

        // 対象ランクの全ユーザーに evaluation_progress を追加
        const { data: targetUsers } = await supabase.from('users').select('id, name, progress_name, rank').eq('rank', adminForm.rank);
        console.log('[saveAdminForm] targetUsers:', targetUsers?.length);
        if (targetUsers?.length) {
          const progressRows = targetUsers.map(u => ({
            user_name: u.progress_name ?? u.name,
            user_id: u.id,
            item_no: maxNo,
            rank: adminForm.rank,
            status: 'pending',
          }));
          const { error: progError } = await supabase.from('evaluation_progress')
            .upsert(progressRows, { onConflict: 'user_name,item_no', ignoreDuplicates: true });
          if (progError) console.error('[saveAdminForm] evaluation_progress upsert error:', progError);
          else console.log('[saveAdminForm] evaluation_progress added for', targetUsers.length, 'users');
        }

        await loadAdminItems();
        success = true;
      }
    } else {
      const { error } = await supabase.from('evaluation_items').update(adminForm).eq('id', selectedAdminItem.id);
      if (error) {
        console.error('[saveAdminForm] UPDATE error:', error);
      } else {
        console.log('[saveAdminForm] UPDATE success');
        setSelectedAdminItem(prev => ({ ...prev, ...adminForm }));
        await loadAdminItems();
        success = true;
      }
    }
    setSavingAdminForm(false);
    return success;
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
        const item = items.find(i => i.id === id);
        if (item?.item_def_id && selectedUser?.id) {
          supabase.from('evaluation_plans').update({ status: 'achieved' })
            .eq('user_id', selectedUser.id).eq('item_id', item.item_def_id)
            .in('status', ['planned', 'overdue'])
            .then(() => setPlans(prev => prev.map(p =>
              p.item_id === item.item_def_id && ['planned', 'overdue'].includes(p.status)
                ? { ...p, status: 'achieved' }
                : p
            )));
        }
      }
    }
  };

  const updateMemo = async (id, memo) => {
    await supabase.from('evaluation_progress').update({ memo, updated_at: new Date().toISOString() }).eq('id', id);
    setItems(prev => prev.map(i => i.id === id ? { ...i, memo } : i));
    setSelectedItem(prev => prev?.id === id ? { ...prev, memo } : prev);
  };

  const loadEvidences = useCallback(async (progressId) => {
    const { data, error } = await supabase.from('evaluation_evidences').select('*').eq('progress_id', progressId).order('created_at', { ascending: true });
    if (error) { console.error('[loadEvidences] error:', error); return; }
    const evs = data ?? [];
    const updateEv = item => ({ ...item, evaluation_evidences: evs });
    setItems(prev => prev.map(i => i.id === progressId ? updateEv(i) : i));
    setSelectedItem(prev => prev?.id === progressId ? updateEv(prev) : prev);
  }, []);

  const addTextEvidence = async (progressId, text, postId = null) => {
    if (!text) return;
    const row = { progress_id: progressId, evidence_type: 'text', content: text };
    if (postId) row.post_id = postId;
    const { error } = await supabase.from('evaluation_evidences').insert(row);
    if (error) { console.error('[addTextEvidence] INSERT error:', error); return; }
    await loadEvidences(progressId);
  };

  const uploadImages = async (progressId, files, comment = null, postId = null) => {
    const fileList = Array.isArray(files) ? files : [files];
    setUploading(prev => ({ ...prev, [progressId]: true }));
    for (const file of fileList) {
      const ext = file.name.split('.').pop();
      const filePath = `${progressId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: upErr } = await supabase.storage.from('evidences').upload(filePath, file);
      if (upErr) { console.error('[uploadImages] storage error:', upErr); continue; }
      const { data: { publicUrl } } = supabase.storage.from('evidences').getPublicUrl(filePath);
      const row = { progress_id: progressId, evidence_type: 'image', content: publicUrl };
      if (comment) row.comment = comment;
      if (postId) row.post_id = postId;
      const { error } = await supabase.from('evaluation_evidences').insert(row);
      if (error) console.error('[uploadImages] INSERT error:', error);
    }
    await loadEvidences(progressId);
    setUploading(prev => ({ ...prev, [progressId]: false }));
  };

  const post = async (progressId, text, files) => {
    const trimmed = text.trim();
    const postId = crypto.randomUUID();
    if (files.length > 0) {
      await uploadImages(progressId, files, trimmed || null, postId);
    } else if (trimmed) {
      await addTextEvidence(progressId, trimmed, postId);
    }
  };

  const deleteEvidences = async (progressId, evidenceIds) => {
    await Promise.all(evidenceIds.map(id => supabase.from('evaluation_evidences').delete().eq('id', id)));
    await loadEvidences(progressId);
  };

  const deleteEvidence = async (progressId, evidenceId) => {
    const { error } = await supabase.from('evaluation_evidences').delete().eq('id', evidenceId);
    if (!error) {
      const rmEv = item => ({ ...item, evaluation_evidences: (item.evaluation_evidences ?? []).filter(e => e.id !== evidenceId) });
      setItems(prev => prev.map(i => i.id === progressId ? rmEv(i) : i));
      setSelectedItem(prev => prev?.id === progressId ? rmEv(prev) : prev);
    }
  };

  const updateEvidenceComment = async (progressId, evidenceId, comment) => {
    const { error } = await supabase.from('evaluation_evidences').update({ comment: comment || null }).eq('id', evidenceId);
    if (!error) {
      const upEv = item => ({ ...item, evaluation_evidences: (item.evaluation_evidences ?? []).map(e => e.id === evidenceId ? { ...e, comment: comment || null } : e) });
      setItems(prev => prev.map(i => i.id === progressId ? upEv(i) : i));
      setSelectedItem(prev => prev?.id === progressId ? upEv(prev) : prev);
    }
  };

  const updateEvidenceQuality = async (progressId, evidenceId, quality, itemNo, userName) => {
    console.log('[updateEvidenceQuality] quality:', quality, '/ progressId:', progressId, '/ itemNo:', itemNo, '/ userName:', userName);

    const { error } = await supabase.from('evaluation_evidences').update({ quality, ng_reason: null }).eq('id', evidenceId);
    if (error) { console.error('[updateEvidenceQuality] evidences update error:', error); return; }

    const upEv = item => ({ ...item, evaluation_evidences: (item.evaluation_evidences ?? []).map(e => e.id === evidenceId ? { ...e, quality, ng_reason: null } : e) });
    setItems(prev => prev.map(i => i.id === progressId ? upEv(i) : i));
    setSelectedItem(prev => prev?.id === progressId ? upEv(prev) : prev);

    if (quality === 'good') {
      const target = items.find(i => i.id === progressId);
      console.log('[updateEvidenceQuality] target status:', target?.status, '/ item_no:', target?.item_no, '/ user_name:', target?.user_name);

      if (target?.status === 'completed') {
        console.log('[updateEvidenceQuality] already completed, skip');
        return;
      }

      const queryUserName = userName ?? target?.user_name;
      const queryItemNo   = itemNo   ?? target?.item_no;
      console.log('[updateEvidenceQuality] progress update query — user_name:', queryUserName, '/ item_no:', queryItemNo);

      const { data: updated, error: progressErr } = await supabase
        .from('evaluation_progress')
        .update({ status: 'completed', achieved_month: CURRENT_MONTH, updated_at: new Date().toISOString() })
        .eq('user_name', queryUserName)
        .eq('item_no', queryItemNo)
        .neq('status', 'completed')
        .select('id, status, achieved_month');

      console.log('[updateEvidenceQuality] progress update result:', updated, '/ error:', progressErr);

      if (!progressErr) {
        setItems(prev => prev.map(i => i.id === progressId ? { ...i, status: 'completed', achieved_month: CURRENT_MONTH } : i));
        setSelectedItem(prev => prev?.id === progressId ? { ...prev, status: 'completed', achieved_month: CURRENT_MONTH } : prev);
      }
    }
  };

  const saveBadQuality = async (progressId, evidenceId, ngReason) => {
    const reason = ngReason || null;
    const { error } = await supabase.from('evaluation_evidences').update({ quality: 'bad', ng_reason: reason }).eq('id', evidenceId);
    if (!error) {
      const upEv = item => ({ ...item, evaluation_evidences: (item.evaluation_evidences ?? []).map(e => e.id === evidenceId ? { ...e, quality: 'bad', ng_reason: reason } : e) });
      setItems(prev => prev.map(i => i.id === progressId ? upEv(i) : i));
      setSelectedItem(prev => prev?.id === progressId ? upEv(prev) : prev);
    }
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
      const progressItem = items.find(i => i.item_def_id === planForm.item_id);
      if (progressItem && planForm.planned_month === CURRENT_MONTH && (progressItem.status == null || progressItem.status === 'pending')) {
        await supabase.from('evaluation_progress').update({ status: 'in_progress', updated_at: new Date().toISOString() }).eq('id', progressItem.id);
        setItems(prev => prev.map(i => i.id === progressItem.id ? { ...i, status: 'in_progress' } : i));
        setSelectedItem(prev => prev?.id === progressItem.id ? { ...prev, status: 'in_progress' } : prev);
      }
    }
    setSavingPlan(false);
  };

  const achievePlan = async (planId) => {
    const { error } = await supabase.from('evaluation_plans').update({ status: 'achieved' }).eq('id', planId);
    if (!error) setPlans(prev => prev.map(p => p.id === planId ? { ...p, status: 'achieved' } : p));
  };

  const deletePlan = async (planId) => {
    const plan = plans.find(p => p.id === planId);
    const { error } = await supabase.from('evaluation_plans').delete().eq('id', planId);
    if (!error) {
      const remainingPlans = plans.filter(p => p.id !== planId);
      setPlans(remainingPlans);
      if (plan && plan.planned_month === CURRENT_MONTH) {
        const hasOtherCurrentMonthPlans = remainingPlans.some(p => p.item_id === plan.item_id && p.planned_month === CURRENT_MONTH);
        if (!hasOtherCurrentMonthPlans) {
          const progressItem = items.find(i => i.item_def_id === plan.item_id);
          if (progressItem?.status === 'in_progress') {
            await supabase.from('evaluation_progress').update({ status: 'pending', updated_at: new Date().toISOString() }).eq('id', progressItem.id);
            setItems(prev => prev.map(i => i.id === progressItem.id ? { ...i, status: 'pending' } : i));
            setSelectedItem(prev => prev?.id === progressItem.id ? { ...prev, status: 'pending' } : prev);
          }
        }
      }
    }
  };

  const togglePlanCell = async (item, month, existingPlan) => {
    if (!selectedUser) return;
    if (existingPlan) {
      const { error } = await supabase.from('evaluation_plans').delete().eq('id', existingPlan.id);
      if (!error) {
        const remainingPlans = plans.filter(p => p.id !== existingPlan.id);
        setPlans(remainingPlans);
        if (month === CURRENT_MONTH) {
          const hasOtherCurrentMonthPlans = remainingPlans.some(p => p.item_id === existingPlan.item_id && p.planned_month === CURRENT_MONTH);
          if (!hasOtherCurrentMonthPlans && item.status === 'in_progress') {
            await supabase.from('evaluation_progress').update({ status: 'pending', updated_at: new Date().toISOString() }).eq('id', item.id);
            setItems(prev => prev.map(i => i.id === item.id ? { ...i, status: 'pending' } : i));
            setSelectedItem(prev => prev?.id === item.id ? { ...prev, status: 'pending' } : prev);
          }
        }
      }
    } else {
      const planStatus = month <= CURRENT_MONTH ? 'overdue' : 'planned';
      const { data, error } = await supabase.from('evaluation_plans').insert({
        user_id: selectedUser.id,
        item_id: item.item_def_id,
        planned_month: month,
        status: planStatus,
      }).select('*, evaluation_items(item_name)').single();
      if (!error && data) {
        setPlans(prev => [...prev, data]);
        if (month === CURRENT_MONTH && (item.status == null || item.status === 'pending')) {
          await supabase.from('evaluation_progress').update({ status: 'in_progress', updated_at: new Date().toISOString() }).eq('id', item.id);
          setItems(prev => prev.map(i => i.id === item.id ? { ...i, status: 'in_progress' } : i));
          setSelectedItem(prev => prev?.id === item.id ? { ...prev, status: 'in_progress' } : prev);
        }
      }
    }
  };


  const detailProps = selectedItem ? {
    item: selectedItem, onStatusChange: updateStatus, onMemoChange: updateMemo,
    onPost: (text, files) => post(selectedItem.id, text, files),
    onAddImagesToGroup: (postId, files) => uploadImages(selectedItem.id, files, null, postId),
    isUploading: uploading[selectedItem.id] ?? false,
    onDeleteEvidence: evidenceId => deleteEvidence(selectedItem.id, evidenceId),
    onDeleteGroup: ids => deleteEvidences(selectedItem.id, ids),
    onUpdateEvidenceQuality: (evidenceId, quality) => updateEvidenceQuality(selectedItem.id, evidenceId, quality, selectedItem.item_no, selectedUser?.progress_name ?? selectedUser?.name),
    onUpdateEvidenceComment: (evidenceId, comment) => updateEvidenceComment(selectedItem.id, evidenceId, comment),
    onSaveBadQuality: (evidenceId, ngReason) => saveBadQuality(selectedItem.id, evidenceId, ngReason),
    selectedUser,
  } : null;

  // ============================================================
  // レンダリング
  // ============================================================
  return (
    <div className="h-screen flex flex-col bg-slate-100 font-sans overflow-hidden">
      <Header
        view={view} setView={setView}
        users={users} selectedUser={selectedUser} setSelectedUser={setSelectedUser}
        currentMonthCount={currentMonthCount}
        showPersonalChart={showPersonalChart} setShowPersonalChart={setShowPersonalChart}
        plans={plans.filter(p => p.status !== 'achieved')} showPlanView={showPlanView} setShowPlanView={setShowPlanView}
        surveyUnread={surveyUnread}
        showQuestionsPanel={showQuestionsPanel} setShowQuestionsPanel={setShowQuestionsPanel}
        onSettingsClick={() => setShowSettings(true)}
        onSurveyBadgeClick={() => setShowSurveyModal(true)}
        onBugBoardClick={() => setShowBugBoard(true)}
        bugCount={bugCount}
      />

      {view === 'personal' && (
        <PersonalView
          selectedUser={selectedUser}
          items={items} loading={loading}
          filteredItems={filteredItems} statusCounts={statusCounts}
          availableMonths={availableMonths} salarySummary={salarySummary}
          statusFilter={statusFilter} setStatusFilter={setStatusFilter}
          monthFilter={monthFilter} setMonthFilter={setMonthFilter}
          selectedItem={selectedItem} setSelectedItem={setSelectedItem}
          mobileShowDetail={mobileShowDetail} setMobileShowDetail={setMobileShowDetail}
          showPersonalChart={showPersonalChart} setShowPersonalChart={setShowPersonalChart}
          showPlanView={showPlanView} setShowPlanView={setShowPlanView}
          timelineData={timelineData} currentMonthCount={currentMonthCount}
          plans={plans} plansLoading={plansLoading}
          onCellClick={togglePlanCell}
          detailProps={detailProps}
          showQuestionsPanel={showQuestionsPanel} setShowQuestionsPanel={setShowQuestionsPanel}
          kpiTarget={kpiTarget}
        />
      )}

      {view === 'overall' && (
        <div className="flex-1 overflow-hidden flex flex-col">
          <OverallView
            overallLoading={overallLoading}
            completedProgress={completedProgress}
            stuckProgress={stuckProgress}
            allItemDefs={allItemDefs}
            allUsersData={allUsersData}
          />
        </div>
      )}

      {view === 'survey' && (
        <div className="flex-1 overflow-hidden flex flex-col">
          <SurveyView selectedUser={selectedUser} users={users} />
        </div>
      )}

      {view === 'admin' && (
        <AdminView
          adminItems={adminItems}
          selectedAdminItem={selectedAdminItem}
          onSelectAdminItem={selectAdminItem}
          adminForm={adminForm} setAdminForm={setAdminForm}
          savingAdminForm={savingAdminForm}
          onSave={saveAdminForm} onArchive={archiveAdminItem} onDelete={deleteAdminItem}
          mobileShowAdminEdit={mobileShowAdminEdit}
          setMobileShowAdminEdit={setMobileShowAdminEdit}
          proposals={proposals}
          proposalContent={proposalContent} setProposalContent={setProposalContent}
          savingProposal={savingProposal}
          onSaveProposal={saveProposal}
          onAdoptProposal={adoptProposal}
          onUpdateProposalStatus={updateProposalStatus}
          mtgMode={mtgMode} setMtgMode={setMtgMode}
          itemCommentCounts={itemCommentCounts}
          setItemCommentCounts={setItemCommentCounts}
          availableRanks={availableRanks}
          addCustomRank={addCustomRank}
          selectedUser={selectedUser}
          rankCommentSummary={rankCommentSummary}
          onDeselect={() => { setSelectedAdminItem(null); setMobileShowAdminEdit(false); }}
          onSelectNew={() => selectAdminItem('new')}
        />
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

      {view === 'orgchart' && (
        <div className="flex-1 overflow-hidden flex flex-col">
          <OrgChartView />
        </div>
      )}

      {/* ── 設定モーダル ── */}
      {showSettings && (
        <SettingsModal
          selectedUser={selectedUser}
          onClose={() => setShowSettings(false)}
        />
      )}

      {/* ── サーベイモーダル ── */}
      {showSurveyModal && (
        <SurveyModal
          selectedUser={selectedUser}
          users={users}
          onClose={() => { setShowSurveyModal(false); checkSurveyUnread(); }}
        />
      )}

      {/* ── バグ報告掲示板 ── */}
      {showBugBoard && (
        <BugBoardModal onClose={() => { setShowBugBoard(false); refreshBugCount(); }} onCountChange={refreshBugCount} />
      )}

    </div>
  );
}
