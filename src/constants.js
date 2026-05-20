export const STATUSES = [
  { value: 'pending',         label: '未着手',     bg: 'bg-gray-50',   border: 'border-l-gray-300',  badge: 'bg-gray-200 text-gray-700',   bar: '#9ca3af' },
  { value: 'planned',         label: '計画中',     bg: 'bg-cyan-50',   border: 'border-l-cyan-400',  badge: 'bg-cyan-100 text-cyan-800',   bar: '#22d3ee' },
  { value: 'in_progress',     label: '取り組み中', bg: 'bg-yellow-50', border: 'border-l-yellow-400',badge: 'bg-yellow-100 text-yellow-800',bar: '#fbbf24' },
  { value: 'clear_scheduled', label: 'クリア予定', bg: 'bg-purple-50', border: 'border-l-purple-400',badge: 'bg-purple-100 text-purple-800',bar: '#a78bfa' },
  { value: 'clear_reported',  label: 'クリア報告', bg: 'bg-blue-50',   border: 'border-l-blue-400',  badge: 'bg-blue-100 text-blue-800',   bar: '#60a5fa' },
  { value: 'completed',       label: '完了',       bg: 'bg-green-50',  border: 'border-l-green-400', badge: 'bg-green-100 text-green-800', bar: '#34d399' },
];
export const STATUS_MAP = Object.fromEntries(STATUSES.map(s => [s.value, s]));
export const FILTER_TABS = [{ value: 'all', label: '全て' }, ...STATUSES.map(s => ({ value: s.value, label: s.label }))];

const now = new Date();
export const CURRENT_MONTH = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}`;

export const RANK_TRANSITIONS = [
  { key: 'onboarding', label: 'オンボ',         from: 'onboarding_at',  to: 'trainee_at'    },
  { key: 'trainee',    label: 'トレーニー',     from: 'trainee_at',     to: 'partner_at'    },
  { key: 'partner',    label: 'パートナー',     from: 'partner_at',     to: 'leader_at'     },
  { key: 'leader',     label: 'リーダー',       from: 'leader_at',      to: 'specialist_at' },
  { key: 'specialist', label: 'スペシャリスト', from: 'specialist_at',  to: 'director_at'   },
];

export const RANK_OPTIONS = ['オンボーディング','トレーニー','パートナー','リーダー','スペシャリスト','ディレクター'];
export const DEPT_COLORS  = ['#6366f1','#f59e0b','#10b981','#ef4444','#8b5cf6','#ec4899','#06b6d4','#84cc16'];
export const RANK_SALARY = {
  'オンボーディング':     { base: 1163, bonus: 0 },
  'トレーニー':           { base: 1300, bonus: 0 },
  'パートナー':           { base: 1300, bonus: 0 },
  'リーダー':             { base: 1300, bonus: 0 },
  'スペシャリスト':       { base: 1300, bonus: 3 },
  'ディレクター':         { base: 1400, bonus: 5 },
  'ブランドマネージャー': { base: 1600, bonus: 5 },
  'ゼネラルマネージャー': { base: 1800, bonus: 5 },
};
export const RANK_CHART_COLORS = ['#6366f1','#f59e0b','#10b981','#ef4444','#8b5cf6','#ec4899','#06b6d4','#84cc16','#f97316','#64748b'];
export const MASTER_PIN        = '9999';
export const EMPTY_ITEM_FORM   = { item_name: '', rank: '', description: '', is_salary_item: false };
export const EMPTY_MEMBER_FORM = { name: '', email: '', rank: '', department: [], mall: '', onboarding_at: '', birth_year: '' };
export const DEFAULT_DEPARTMENTS = ['CEO','秘書','カスタマー','物流','採用','商品開発','商品改善','経理','広告運用','デザイン','Amazon','楽天','Yahoo','フィットイージー'];
