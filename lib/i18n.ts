import { useState, useEffect } from 'react';
import { getSettings, saveSettings } from './storage';
import { create } from 'zustand';

// 定義支援的語言
export const LANGUAGES = [
  { code: 'zh-TW', label: '繁體中文' },
  { code: 'en', label: 'English' },
  { code: 'ja', label: '日本語' },
  { code: 'ko', label: '한국어' },
  { code: 'fr', label: 'Français' },
  { code: 'ru', label: 'Русский' },
];

// 翻譯字典
export const TRANSLATIONS = {
  'zh-TW': {
    // Tab Titles
    tab_home: "首頁",
    tab_analysis: "分析",
    tab_ai_coach: "AI 教練",
    tab_settings: "設定",

    // General
    welcome: "歡迎",
    save: "儲存",
    cancel: "取消",
    error: "錯誤",
    success: "成功",
    loading: "載入中...",
    
    // Home Screen
    body_metrics: "身體數值",
    record_metrics: "+ 紀錄",
    target_weight: "目標體重",
    target_body_fat: "目標體脂",
    intake: "攝取",
    burned: "消耗",
    net_intake_pct: "靜攝取 %",
    intake_target: "攝取/目標",
    burned_cal: "消耗熱量",
    quick_record: "快速紀錄",
    recent_foods: "常用食物",
    no_recent_foods: "暫無常用紀錄",
    
    // Actions
    camera: "拍照",
    scan_barcode: "掃碼", // Modified as requested
    manual_input: "手輸",
    exercise: "運動",
    
    // Meals
    breakfast: "早餐",
    lunch: "午餐",
    dinner: "晚餐",
    afternoon_tea: "下午茶",
    late_night: "宵夜",
    snack: "點心",
    no_records: "尚無紀錄",
    
    // Nutrients
    calories: "熱量",
    protein: "蛋白質",
    fat: "脂肪",
    carbs: "碳水",
    sodium: "鈉",
    sugar: "糖",
    fiber: "膳食纖維",
    saturated_fat: "飽和脂肪",
    trans_fat: "反式脂肪",
    cholesterol: "膽固醇",

    // Analysis
    trend_analysis: "數據分析",
    chart_title_cal_weight: "熱量與體重趨勢",
    chart_title_nutrients: "營養素攝取比例",
    week: "近7天",
    month: "近30天",
    avg_daily: "日均數值",
    weight_trend: "體重趨勢",
    
    // Profile / Settings
    ai_settings: "AI 設定",
    basic_info: "基本資料",
    gender: "性別",
    male: "男",
    female: "女",
    height: "身高",
    birth_year: "出生年份",
    weight: "體重",
    body_fat: "體脂率",
    training_goal: "訓練目標",
    activity_level: "日常活動量",
    save_settings: "儲存設定",
    api_key_placeholder: "貼上您的 API Key",
    test_key: "測試 Key",
    current_model: "當前模型",
    language: "語言",
    
    // Goals Descriptions
    lose_weight: "減重",
    lose_weight_desc: "熱量赤字，專注減脂",
    maintain: "維持",
    maintain_desc: "維持目前體重與體態",
    gain_weight: "增重",
    gain_weight_desc: "熱量盈餘，專注增肌",
    recomp: "體態重組",
    recomp_desc: "增肌同時減脂(適合新手)",
    blood_sugar: "控制血糖",
    blood_sugar_desc: "穩定血糖波動，低 GI 飲食",

    // Activity Descriptions
    sedentary: "久坐少動",
    sedentary_desc: "辦公室工作，幾乎不運動",
    lightly_active: "輕度活動",
    lightly_active_desc: "每週運動 1-3 天",
    moderately_active: "中度活動",
    moderately_active_desc: "每週運動 3-5 天",
    very_active: "高度活動",
    very_active_desc: "每週運動 6-7 天",
    extra_active: "極度活動",
    extra_active_desc: "體力工作或每日兩練",

    // AI Coach
    ai_coach_title: "AI 教練",
    remaining_budget: "今日剩餘熱量",
    generate_plan: "生成計畫",
    recipe_suggestion: "食譜建議",
    workout_suggestion: "運動建議",
    ask_ai: "詢問 AI...",
    ask_recipe: "今天有什麼建議菜單？",
    ask_workout: "今天有什麼建議的訓練？",
    follow_up_1: "這餐適合運動後吃嗎？",
    follow_up_2: "如何調整更健康？",
    follow_up_3: "推薦的搭配飲料？",
    
    // Food Editor
    ai_analysis_title: "AI 分析",
    composition: "食物組成",
    suggestion: "攝取建議",
    food_name_placeholder: "輸入名稱或掃描條碼",
    barcode_scanned: "已讀取條碼：",
    local_db: "本地資料庫",
    loaded: "已載入",
    downloaded: "已下載資訊",
    scan_failed: "查無資料",
    scan_failed_msg: "資料庫與網路皆無此商品，請選擇：",
    scan_ai_option: "拍照分析營養標示",
    manual_option: "手動輸入",
    
    // Compare
    increase: "增加",
    decrease: "減少",
    no_change: "無變化"
  },
  'en': {
    // Tab Titles
    tab_home: "Home",
    tab_analysis: "Analysis",
    tab_ai_coach: "AI Coach",
    tab_settings: "Settings",

    // General
    welcome: "Welcome",
    save: "Save",
    cancel: "Cancel",
    error: "Error",
    success: "Success",
    loading: "Loading...",
    
    // Home Screen
    body_metrics: "Body Metrics",
    record_metrics: "+ Record",
    target_weight: "Target Weight",
    target_body_fat: "Target Body Fat",
    intake: "Intake",
    burned: "Burned",
    net_intake_pct: "Net Intake %",
    intake_target: "Intake/Target",
    burned_cal: "Calories Burned",
    quick_record: "Quick Add",
    recent_foods: "Recent Foods",
    no_recent_foods: "No recent records",
    
    // Actions
    camera: "Camera",
    scan_barcode: "Scan Code",
    manual_input: "Manual",
    exercise: "Exercise",
    
    // Meals
    breakfast: "Breakfast",
    lunch: "Lunch",
    dinner: "Dinner",
    afternoon_tea: "Afternoon Tea",
    late_night: "Late Night",
    snack: "Snack",
    no_records: "No records",
    
    // Nutrients
    calories: "Calories",
    protein: "Protein",
    fat: "Fat",
    carbs: "Carbs",
    sodium: "Sodium",
    sugar: "Sugar",
    fiber: "Fiber",
    saturated_fat: "Saturated Fat",
    trans_fat: "Trans Fat",
    cholesterol: "Cholesterol",

    // Analysis
    trend_analysis: "Analysis",
    chart_title_cal_weight: "Calories & Weight Trend",
    chart_title_nutrients: "Nutrient Ratios",
    week: "7 Days",
    month: "30 Days",
    avg_daily: "Daily Avg",
    weight_trend: "Weight Trend",
    
    // Profile / Settings
    ai_settings: "AI Settings",
    basic_info: "Basic Info",
    gender: "Gender",
    male: "Male",
    female: "Female",
    height: "Height",
    birth_year: "Birth Year",
    weight: "Weight",
    body_fat: "Body Fat",
    training_goal: "Goal",
    activity_level: "Activity Level",
    save_settings: "Save Settings",
    api_key_placeholder: "Paste API Key",
    test_key: "Test Key",
    current_model: "Current Model",
    language: "Language",
    
    // Goals Descriptions
    lose_weight: "Weight Loss",
    lose_weight_desc: "Calorie deficit, fat loss focus",
    maintain: "Maintain",
    maintain_desc: "Maintain current weight",
    gain_weight: "Gain Weight",
    gain_weight_desc: "Calorie surplus, muscle gain",
    recomp: "Recomp",
    recomp_desc: "Gain muscle, lose fat",
    blood_sugar: "Blood Sugar Control",
    blood_sugar_desc: "Stable blood sugar, low GI",

    // Activity Descriptions
    sedentary: "Sedentary",
    sedentary_desc: "Office job, little exercise",
    lightly_active: "Lightly Active",
    lightly_active_desc: "Exercise 1-3 days/week",
    moderately_active: "Moderately Active",
    moderately_active_desc: "Exercise 3-5 days/week",
    very_active: "Very Active",
    very_active_desc: "Exercise 6-7 days/week",
    extra_active: "Extra Active",
    extra_active_desc: "Physical job or 2x daily training",

    // AI Coach
    ai_coach_title: "AI Coach",
    remaining_budget: "Remaining Calories",
    generate_plan: "Generate Plan",
    recipe_suggestion: "Recipe Suggestion",
    workout_suggestion: "Workout Suggestion",
    ask_ai: "Ask AI...",
    ask_recipe: "Suggest a meal plan for today?",
    ask_workout: "Suggest a workout for today?",
    follow_up_1: "Good for post-workout?",
    follow_up_2: "How to make it healthier?",
    follow_up_3: "Best drink pairing?",
    
    // Food Editor
    ai_analysis_title: "AI Analysis",
    composition: "Composition",
    suggestion: "Suggestion",
    food_name_placeholder: "Enter name or scan barcode",
    barcode_scanned: "Barcode: ",
    local_db: "Local DB",
    loaded: "Loaded",
    downloaded: "Downloaded",
    scan_failed: "Not Found",
    scan_failed_msg: "Item not found. Please choose:",
    scan_ai_option: "Scan Nutrition Label (AI)",
    manual_option: "Manual Input",
    
    // Compare
    increase: "Increase",
    decrease: "Decrease",
    no_change: "No Change"
  }
};

interface LanguageState {
  locale: string;
  setLocale: (locale: string) => void;
}

export const useLanguageStore = create<LanguageState>((set) => ({
  locale: 'zh-TW',
  setLocale: (locale) => set({ locale }),
}));

// Listener for non-reactive usage if needed
const listeners: ((lang: string) => void)[] = [];
let currentLang = 'zh-TW';

export const t = (key: string, lang: string = 'zh-TW') => {
  const dict = TRANSLATIONS[lang as keyof typeof TRANSLATIONS] || TRANSLATIONS['en'];
  // @ts-ignore
  return dict[key] || key; // Return key if translation missing
};

export const useLanguage = () => {
  const locale = useLanguageStore((state) => state.locale);
  
  useEffect(() => {
    getSettings().then(s => { 
      if(s.language && s.language !== currentLang) {
        currentLang = s.language;
        useLanguageStore.getState().setLocale(s.language);
      }
    });
  }, []);
  
  return locale;
};

export const setAppLanguage = (lang: string) => {
  currentLang = lang;
  useLanguageStore.getState().setLocale(lang);
  saveSettings({ language: lang });
};

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