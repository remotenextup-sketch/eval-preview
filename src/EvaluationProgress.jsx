import React, { useState, useEffect, useCallback } from 'react';
import confetti from 'canvas-confetti';

import { supabase } from './components/supabaseClient';
import {
  STATUSES, STATUS_MAP, CURRENT_MONTH, RANK_OPTIONS, EMPTY_ITEM_FORM,
} from './constants';

import Header       from './components/Header';
import PersonalView from './components/PersonalView';
import OverallView  from './components/OverallView';
import DepartmentView from './components/DepartmentView';
import AdminView    from './components/AdminView';
import MembersView  from './components/MemberView';
import SalaryView   from './components/SalaryView';

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

  // ── NG理由モーダル ──
  const [ngModal, setNgModal]           = useState(null);
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
    const [{ data: progress }, { data: itemDefs }] = await Promise.all([
      supabase.from('evaluation_progress').select('*, evaluation_evidences(*)').eq('user_name', selectedUser.progress_name ?? selectedUser.name),
      supabase.from('evaluation_items').select('id, no, sort_order, item_name, description, rank, is_salary_item').eq('rank', selectedUser.rank),
    ]);
    const itemMap = {};
    (itemDefs || []).forEach(d => { if (d.no != null) itemMap[d.no] = d; });
    const merged = (progress || [])
      .filter(p => itemMap[p.item_no] != null)
      .map(p => ({
        ...p,
        item_name: itemMap[p.item_no].item_name,
        description: itemMap[p.item_no].description ?? '',
        item_def_id: itemMap[p.item_no].id,
        is_salary_item: itemMap[p.item_no].is_salary_item ?? false,
        sort_order: itemMap[p.item_no].sort_order ?? itemMap[p.item_no].no ?? 9999,
      }))
      .sort((a, b) => a.sort_order - b.sort_order);
    setItems(merged);
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
    const { data, error } = await supabase.from('evaluation_items').select('*').order('sort_order', { nullsLast: true }).order('no');
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
      : { item_name: item.item_name, rank: item.rank ?? '', description: item.description ?? '', is_salary_item: item.is_salary_item ?? false });
    setMobileShowAdminEdit(true);
  };

  const saveAdminForm = async () => {
    if (!adminForm.item_name.trim() || !adminForm.rank) return false;
    setSavingAdminForm(true);
    let success = false;
    if (selectedAdminItem === 'new') {
      const { data, error } = await supabase.from('evaluation_items').insert({ ...adminForm, status: 'active' }).select().single();
      if (error) {
        console.error('[saveAdminForm] INSERT error:', error);
      } else {
        console.log('[saveAdminForm] INSERT success');
        if (data) setSelectedAdminItem(data);
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

  const loadEvidences = useCallback(async (progressId) => {
    const { data, error } = await supabase.from('evaluation_evidences').select('*').eq('progress_id', progressId).order('created_at', { ascending: true });
    if (error) { console.error('[loadEvidences] error:', error); return; }
    const evs = data ?? [];
    const updateEv = item => ({ ...item, evaluation_evidences: evs });
    setItems(prev => prev.map(i => i.id === progressId ? updateEv(i) : i));
    setSelectedItem(prev => prev?.id === progressId ? updateEv(prev) : prev);
  }, []);

  const addTextEvidence = async (progressId) => {
    const text = (evidenceText[progressId] ?? '').trim();
    if (!text) return;
    const { error } = await supabase.from('evaluation_evidences').insert({ progress_id: progressId, evidence_type: 'text', content: text });
    if (error) { console.error('[addTextEvidence] INSERT error:', error); return; }
    console.log('[addTextEvidence] INSERT success, progressId:', progressId);
    setEvidenceText(prev => ({ ...prev, [progressId]: '' }));
    await loadEvidences(progressId);
  };

  const uploadImage = async (progressId, file) => {
    setUploading(prev => ({ ...prev, [progressId]: true }));
    const ext = file.name.split('.').pop();
    const filePath = `${progressId}/${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from('evidences').upload(filePath, file);
    if (!upErr) {
      const { data: { publicUrl } } = supabase.storage.from('evidences').getPublicUrl(filePath);
      const { error } = await supabase.from('evaluation_evidences').insert({ progress_id: progressId, evidence_type: 'image', content: publicUrl });
      if (error) { console.error('[uploadImage] INSERT evidence error:', error); }
      else {
        console.log('[uploadImage] INSERT success, progressId:', progressId);
        await loadEvidences(progressId);
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
  // レンダリング
  // ============================================================
  return (
    <div className="h-screen flex flex-col bg-slate-100 font-sans overflow-hidden">
      <Header
        view={view} setView={setView}
        users={users} selectedUser={selectedUser} setSelectedUser={setSelectedUser}
        currentMonthCount={currentMonthCount}
        showPersonalChart={showPersonalChart} setShowPersonalChart={setShowPersonalChart}
        plans={plans} showPlanView={showPlanView} setShowPlanView={setShowPlanView}
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
          planForm={planForm} setPlanForm={setPlanForm}
          savingPlan={savingPlan}
          onAddPlan={addPlan} onAchievePlan={achievePlan} onDeletePlan={deletePlan}
          detailProps={detailProps}
          ngModal={ngModal} setNgModal={setNgModal}
          ngReasonText={ngReasonText} setNgReasonText={setNgReasonText}
          onConfirmNgReason={confirmNgReason}
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

      {view === 'department' && (
        <div className="flex-1 overflow-hidden flex flex-col">
          <DepartmentView
            overallLoading={overallLoading}
            completedProgress={completedProgress}
            allUsersData={allUsersData}
          />
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
    </div>
  );
}
