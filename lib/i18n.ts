import { getLocales } from 'expo-localization';
import { useState, useEffect } from 'react';
import { getSettings, saveSettings } from './storage';

export const LANGUAGES = [
  { code: 'zh-TW', label: '繁體中文' },
  { code: 'en', label: 'English' },
  { code: 'ja', label: '日本語' },
  { code: 'ko', label: '한국어' },
  { code: 'fr', label: 'Français' },
  { code: 'ru', label: 'Русский' },
];

export const TRANSLATIONS = {
  'zh-TW': {
    // Tab Titles
    tab_home: '首頁',
    tab_analysis: '分析',
    tab_ai_coach: 'AI教練',
    tab_settings: '設定',
    
    // Common
    activity_level: '活動量',
    sedentary: '久坐 (BMR x 1.2)',
    lightly_active: '輕度 (BMR x 1.375)',
    moderately_active: '中度 (BMR x 1.55)',
    very_active: '高度 (BMR x 1.725)',
    gender: '性別',
    male: '男',
    female: '女',
    birth_year: '出生西元年',
    height: '身高(cm)',
    weight: '體重(kg)',
    body_fat: '體脂率(%)',
    target_weight: '目標(kg)',
    training_goal: '訓練目標',
    goal_maintain: '維持身形',
    goal_fat_loss: '降低體脂',
    goal_tone_up: '強化塑身',
    goal_upper_strength: '增加上半身肌力',
    goal_lower_strength: '增加下半身肌力',

    save_settings: '儲存設定',
    logout: '登出',
    version_history: '版次歷程',
    ai_settings: 'AI 設定',
    current_model: '目前使用模型',
    test_key: '測試並取得模型',
    api_key_placeholder: '請貼上您的 API Key',
    trend_analysis: '趨勢分析',
    intake: '攝取',
    burned: '消耗',
    protein: '蛋',
    carbs: '碳',
    fat: '油',
    sodium: '鈉',
    week: '周',
    month_day: '月(日)',
    month_week: '月(週)',
    year: '年',
    manual_input: '手輸',
    photo: '拍照',
    scan: '掃碼',
    workout: '運動',
    today_overview: '今日概覽',
    quick_record: '快速紀錄',
    no_record: '尚無紀錄',
    ai_coach: 'AI 智能教練',
    recipe_suggestion: '食譜建議',
    workout_suggestion: '運動建議',
    generate_plan: '生成計畫',
    remaining_budget: '目前剩餘額度',
    watch_video: '觀看教學影片',
    ingredients: '食材',
    steps: '步驟',
    reason: '建議原因',
    estimated_weight: '估計重量 (g)',
    confirm_save: '確認並儲存',
    food_name: '食物名稱',
    calories: '熱量',
    suggestion_limit: '每日建議攝取量',
    alert_over: '超過建議值',
    export_pdf: '匯出 PDF',
    edit: '編輯',
    delete: '刪除',
    
    // New
    serving_weight: '單份重量 (g)',
    intake_quantity: '攝取份數',
    per_100g_base: '每 100g 基準數值',
    ai_analysis_result: 'AI 分析結果',
    composition: '組成',
    intake_advice: '攝取建議',
    scan_failed: '查無資料',
    scan_failed_msg: '本地與雲端資料庫皆無此商品，請選擇輸入方式：',
    scan_ai_label: 'AI 辨識標示',
    input_manual: '手動輸入',
    
    // Edit Modal
    adjust_portion: '調整份量倍率',
    original_val: '原數值',
    new_val: '新數值',
  },
  'en': {
    tab_home: 'Home',
    tab_analysis: 'Analysis',
    tab_ai_coach: 'AI Coach',
    tab_settings: 'Settings',

    activity_level: 'Activity Level',
    sedentary: 'Sedentary',
    lightly_active: 'Lightly Active',
    moderately_active: 'Moderately Active',
    very_active: 'Very Active',
    gender: 'Gender',
    male: 'Male',
    female: 'Female',
    birth_year: 'Birth Year',
    height: 'Height (cm)',
    weight: 'Weight (kg)',
    body_fat: 'Body Fat (%)',
    target_weight: 'Target (kg)',
    training_goal: 'Training Goal',
    goal_maintain: 'Maintain',
    goal_fat_loss: 'Fat Loss',
    goal_tone_up: 'Tone Up',
    goal_upper_strength: 'Upper Strength',
    goal_lower_strength: 'Lower Strength',

    save_settings: 'Save Settings',
    logout: 'Logout',
    version_history: 'Version History',
    ai_settings: 'AI Settings',
    current_model: 'Current Model',
    test_key: 'Test & Get Models',
    api_key_placeholder: 'Paste your API Key here',
    trend_analysis: 'Trend Analysis',
    intake: 'Intake',
    burned: 'Burned',
    protein: 'Prot',
    carbs: 'Carb',
    fat: 'Fat',
    sodium: 'Sod',
    week: 'Week',
    month_day: 'Month(Day)',
    month_week: 'Month(Week)',
    year: 'Year',
    manual_input: 'Manual',
    photo: 'Photo',
    scan: 'Scan',
    workout: 'Workout',
    today_overview: 'Today Overview',
    quick_record: 'Quick Add',
    no_record: 'No records',
    ai_coach: 'AI Coach',
    recipe_suggestion: 'Recipe',
    workout_suggestion: 'Workout',
    generate_plan: 'Generate Plan',
    remaining_budget: 'Remaining Budget',
    watch_video: 'Watch Video',
    ingredients: 'Ingredients',
    steps: 'Steps',
    reason: 'Reason',
    estimated_weight: 'Est. Weight (g)',
    confirm_save: 'Confirm & Save',
    food_name: 'Food Name',
    calories: 'Calories',
    suggestion_limit: 'Daily Suggestion',
    alert_over: 'Exceeded',
    export_pdf: 'Export PDF',
    edit: 'Edit',
    delete: 'Delete',
    
    serving_weight: 'Unit Weight (g)',
    intake_quantity: 'Quantity',
    per_100g_base: 'Per 100g Base',
    ai_analysis_result: 'AI Analysis',
    composition: 'Composition',
    intake_advice: 'Advice',
    scan_failed: 'Not Found',
    scan_failed_msg: 'Product not found. Choose input method:',
    scan_ai_label: 'AI Label Scan',
    input_manual: 'Manual Input',

    adjust_portion: 'Adjust Portion',
    original_val: 'Original',
    new_val: 'New',
  }
};

export const VERSION_LOGS = [
  { version: '1.0.7', date: '2025-12-23', content: '優化編輯介面(支援份數調整)；修正相機與AI模型問題；強化掃碼存檔機制。' },
  { version: '1.0.6', date: '2025-12-23', content: '新增訓練目標與年齡推算；強化 AI 教練建議邏輯；優化掃碼功能(支援外部資料庫查詢)；食物確認頁面改版(分離基準值)。' },
  { version: '1.0.5', date: '2025-12-22', content: '修復推播導致的閃退問題；優化運動熱量計算公式；新增營養素攝取比例圖表。' },
  { version: '1.0.4', date: '2025-12-21', content: 'UI/UX全面優化：解決語言切換延遲問題；新增相簿匯入功能；AI教練建議分開儲存；鈉含量單位修正。' },
];

export const t = (key: string, lang: string = 'zh-TW') => {
  const dict = TRANSLATIONS[lang as keyof typeof TRANSLATIONS] || TRANSLATIONS['en'];
  return dict[key as keyof typeof dict] || TRANSLATIONS['zh-TW'][key as any] || key;
};

const listeners: ((lang: string) => void)[] = [];

export const subscribeLanguageChange = (callback: (lang: string) => void) => {
  listeners.push(callback);
  return () => {
    const index = listeners.indexOf(callback);
    if (index > -1) listeners.splice(index, 1);
  };
};

let currentLang = 'zh-TW';

export const getCurrentLang = () => currentLang;

export const setAppLanguage = (lang: string) => {
  currentLang = lang;
  listeners.forEach(cb => cb(lang));
  saveSettings({ language: lang });
};

export const useLanguage = () => {
  const [lang, setLang] = useState(currentLang);
  useEffect(() => {
    getSettings().then(s => { 
      if(s.language && s.language !== currentLang) {
        currentLang = s.language;
        setLang(s.language);
      }
    });
    return subscribeLanguageChange(setLang);
  }, []);
  return lang;
};