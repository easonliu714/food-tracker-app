export const HEALTH_DAILY_STEPS_KEY = 'health_daily_steps';

export const HEALTH_DAILY_STEPS_ALIASES = [
  HEALTH_DAILY_STEPS_KEY,
  'Daily Steps',
  'daily_steps',
  'walking',
  '日常步數',
  '每日步數',
  '日常步数',
  '每日步数',
  'Daily Step Count',
  'Health Connect Daily Steps',
  '健康步數',
  '健康步数',
];

const ACTIVITY_TEXTS: Record<string, Record<string, string>> = {
  zhTW: {
    health_daily_steps: '日常步數',
    health_daily_steps_category: '日常步數',
    health_connect_source: 'Health Connect',
    pedometer_source: '計步器',
    sync_success: '同步成功',
    no_new_health_data: '沒有新的健康資料',
    step_history_requires_health_connect: 'Android 步數歷史同步需要 Health Connect。',
    sync_error: '同步錯誤',
    duration_min: '分鐘',
  },
  zhCN: {
    health_daily_steps: '日常步数',
    health_daily_steps_category: '日常步数',
    health_connect_source: 'Health Connect',
    pedometer_source: '计步器',
    sync_success: '同步成功',
    no_new_health_data: '没有新的健康数据',
    step_history_requires_health_connect: 'Android 步数历史同步需要 Health Connect。',
    sync_error: '同步错误',
    duration_min: '分钟',
  },
  en: {
    health_daily_steps: 'Daily Steps',
    health_daily_steps_category: 'Daily Steps',
    health_connect_source: 'Health Connect',
    pedometer_source: 'Pedometer',
    sync_success: 'Sync successful',
    no_new_health_data: 'No new health data found',
    step_history_requires_health_connect: 'Step history syncing requires Health Connect on Android.',
    sync_error: 'Sync Error',
    duration_min: 'min',
  },
  ja: {
    health_daily_steps: '日常歩数',
    health_daily_steps_category: '日常歩数',
    health_connect_source: 'Health Connect',
    pedometer_source: '歩数計',
    sync_success: '同期に成功しました',
    no_new_health_data: '新しい健康データはありません',
    step_history_requires_health_connect: 'Androidで歩数履歴を同期するには Health Connect が必要です。',
    sync_error: '同期エラー',
    duration_min: '分',
  },
  ko: {
    health_daily_steps: '일상 걸음 수',
    health_daily_steps_category: '일상 걸음 수',
    health_connect_source: 'Health Connect',
    pedometer_source: '걸음 수 센서',
    sync_success: '동기화 성공',
    no_new_health_data: '새 건강 데이터가 없습니다',
    step_history_requires_health_connect: 'Android에서 걸음 수 기록을 동기화하려면 Health Connect가 필요합니다.',
    sync_error: '동기화 오류',
    duration_min: '분',
  },
};

const langBucket = (lang?: string) => {
  if (lang === 'zh-CN') return 'zhCN';
  if (lang === 'ja') return 'ja';
  if (lang === 'ko') return 'ko';
  if (lang === 'en') return 'en';
  return 'zhTW';
};

export const healthActivityText = (key: string, lang?: string) => {
  const bucket = langBucket(lang);
  return ACTIVITY_TEXTS[bucket]?.[key] || ACTIVITY_TEXTS.en[key] || key;
};

export const isHealthDailyStepsName = (name?: string | null) => {
  if (!name) return false;
  const normalized = String(name).trim().toLowerCase();
  return HEALTH_DAILY_STEPS_ALIASES.some((alias) => alias.trim().toLowerCase() === normalized);
};

export const localizeActivityName = (name?: string | null, lang?: string) => {
  if (isHealthDailyStepsName(name)) return healthActivityText('health_daily_steps', lang);
  return name || '';
};

export const localizeActivityCategory = (category?: string | null, lang?: string) => {
  if (isHealthDailyStepsName(category)) return healthActivityText('health_daily_steps_category', lang);
  return category || '';
};

export const dailyStepsNameVariants = (lang?: string) => [
  ...HEALTH_DAILY_STEPS_ALIASES,
  healthActivityText('health_daily_steps', lang),
  healthActivityText('health_daily_steps_category', lang),
];
