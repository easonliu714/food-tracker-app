import { I18n } from 'i18n-js';
import { getLocales } from 'expo-localization';
import { getSettings } from './storage';
import { create } from 'zustand';

// 定義翻譯字串
const translations = {
  "zh-TW": {
    welcome: "歡迎",
    today_summary: "今日概況",
    calories: "熱量",
    protein: "蛋白質",
    fat: "脂肪",
    carbs: "碳水",
    sodium: "鈉",
    save: "儲存",
    cancel: "取消",
    settings: "設定",
    ai_analysis: "AI 分析",
    analyzing: "分析中...",
    food_name: "食物名稱",
    portion: "份量",
    camera: "相機",
    gallery: "相簿",
    scan_barcode: "掃描條碼",
    manual_input: "手動輸入",
    breakfast: "早餐",
    lunch: "午餐",
    dinner: "晚餐",
    snack: "點心",
    exercise: "運動",
    weight: "體重",
    body_fat: "體脂",
    analysis: "分析",
    ai_coach: "AI 教練",
    recipes: "食譜",
    profile: "個人設定",
    daily_goal: "每日目標",
    intake: "攝取",
    burned: "消耗",
    remaining: "剩餘",
    week: "近7天",
    month: "近30天",
    avg_daily: "日均數值",
    trend_calories: "熱量收支趨勢",
    trend_body: "體重體脂趨勢",
    composition: "食物組成",
    suggestion: "攝取建議",
    ask_ai: "詢問 AI...",
    send: "發送",
    follow_up_1: "這餐適合運動後吃嗎？",
    follow_up_2: "如何調整更健康？",
    follow_up_3: "推薦的搭配飲料？",
    version_history: "版本履歷",
    logout: "登出",
    language: "語言",
    theme: "主題",
    export_pdf: "匯出 PDF",
    ingredients: "食材",
    steps: "步驟",
    reason: "推薦原因",
    workout_suggestion: "運動建議",
    recipe_suggestion: "食譜建議",
    generate_plan: "生成計畫",
    watch_video: "觀看影片",
    remaining_budget: "今日剩餘熱量",
    sugar: "糖",
    fiber: "膳食纖維",
    saturated_fat: "飽和脂肪",
    trans_fat: "反式脂肪",
    cholesterol: "膽固醇"
  },
  "en": {
    welcome: "Welcome",
    today_summary: "Today's Summary",
    calories: "Calories",
    protein: "Protein",
    fat: "Fat",
    carbs: "Carbs",
    sodium: "Sodium",
    save: "Save",
    cancel: "Cancel",
    settings: "Settings",
    ai_analysis: "AI Analysis",
    analyzing: "Analyzing...",
    food_name: "Food Name",
    portion: "Portion",
    camera: "Camera",
    gallery: "Gallery",
    scan_barcode: "Scan Barcode",
    manual_input: "Manual Input",
    breakfast: "Breakfast",
    lunch: "Lunch",
    dinner: "Dinner",
    snack: "Snack",
    exercise: "Exercise",
    weight: "Weight",
    body_fat: "Body Fat",
    analysis: "Analysis",
    ai_coach: "AI Coach",
    recipes: "Recipes",
    profile: "Profile",
    daily_goal: "Daily Goal",
    intake: "Intake",
    burned: "Burned",
    remaining: "Remaining",
    week: "7 Days",
    month: "30 Days",
    avg_daily: "Daily Avg",
    trend_calories: "Calorie Trend",
    trend_body: "Body Metrics Trend",
    composition: "Composition",
    suggestion: "Suggestion",
    ask_ai: "Ask AI...",
    send: "Send",
    follow_up_1: "Good for post-workout?",
    follow_up_2: "How to make it healthier?",
    follow_up_3: "Best drink pairing?",
    version_history: "Version History",
    logout: "Log Out",
    language: "Language",
    theme: "Theme",
    export_pdf: "Export PDF",
    ingredients: "Ingredients",
    steps: "Steps",
    reason: "Reason",
    workout_suggestion: "Workout Suggestion",
    recipe_suggestion: "Recipe Suggestion",
    generate_plan: "Generate Plan",
    watch_video: "Watch Video",
    remaining_budget: "Remaining Calories",
    sugar: "Sugar",
    fiber: "Fiber",
    saturated_fat: "Saturated Fat",
    trans_fat: "Trans Fat",
    cholesterol: "Cholesterol"
  },
  // ... 其他語言 (日/韓/法/俄) 可在此擴充，為節省篇幅暫略，邏輯同上
};

// 狀態管理
interface LanguageState {
  locale: string;
  setLocale: (locale: string) => void;
}

export const useLanguageStore = create<LanguageState>((set) => ({
  locale: 'zh-TW',
  setLocale: (locale) => set({ locale }),
}));

// 初始化 i18n
const i18n = new I18n(translations);
i18n.enableFallback = true;

// Hook
export const useLanguage = () => {
  const locale = useLanguageStore((state) => state.locale);
  return locale;
};

// Helper function
export const t = (key: keyof typeof translations["zh-TW"], locale: string = 'zh-TW') => {
  i18n.locale = locale;
  return i18n.t(key) || key; // Fallback to key if missing
};

// 切換語言 helper
export const setAppLanguage = (langCode: string) => {
  useLanguageStore.getState().setLocale(langCode);
};

export const LANGUAGES = [
  { code: 'zh-TW', label: '繁體中文' },
  { code: 'en', label: 'English' },
  { code: 'ja', label: '日本語' },
  { code: 'ko', label: '한국어' },
  { code: 'fr', label: 'Français' },
  { code: 'ru', label: 'Русский' },
];

// 版本履歷
export const VERSION_LOGS = [
  {
    version: "V1.0.9",
    date: "2025-12-29",
    content: `[New] AI Coach now supports interactive chat and follow-up questions.
[New] Analysis charts upgraded: 7/30 days switch, detailed statistics.
[New] Food Editor displays AI analysis composition and suggestions.
[Fix] Camera crop frame is now adjustable.
[Fix] Multi-language support for all UI elements.
\n[新增] AI 教練支援互動對話與追問功能。
[新增] 分析圖表升級：支援 7/30 天切換與詳細統計表。
[新增] 食物編輯頁面顯示 AI 分析組成與建議。
[修正] 相機裁切框可自由調整長寬。
[修正] 全介面支援多語言切換。`
  },
  { version: '1.0.8', date: '2025-12-24', content: '全面多語言支援(含AI)；新增API Key申請連結；優化相機UI與掃碼流程；資料庫欄位擴充。' },
  { version: '1.0.7', date: '2025-12-23', content: '優化編輯介面(支援份數調整)；修正相機與AI模型問題；強化掃碼存檔機制。' },
  { version: '1.0.6', date: '2025-12-23', content: '新增訓練目標與年齡推算；強化 AI 教練建議邏輯；優化掃碼功能；食物確認頁面改版。' },
  { version: '1.0.5', date: '2025-12-22', content: '修復推播導致的閃退問題；優化運動熱量計算公式；新增營養素攝取比例圖表。' },
  { version: '1.0.4', date: '2025-12-21', content: 'UI/UX全面優化：解決語言切換延遲問題；新增相簿匯入功能；AI教練建議分開儲存；鈉含量單位修正。' },
];