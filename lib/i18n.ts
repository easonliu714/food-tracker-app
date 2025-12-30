import { useState, useEffect } from 'react';
import { getSettings, saveSettings } from './storage';
import { create } from 'zustand';

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
    tab_home: "首頁", tab_analysis: "分析", tab_ai_coach: "AI 教練", tab_settings: "設定",
    
    // General
    welcome: "歡迎", save: "儲存", cancel: "取消", delete: "刪除", error: "錯誤", success: "成功", loading: "載入中...",
    tip: "提示", save_success: "儲存成功", invalid_input: "輸入數值無效", settings: "設定",
    
    // Home
    body_metrics: "身體數值", record_metrics: "+ 紀錄", target_weight: "目標體重", target_body_fat: "目標體脂",
    intake: "攝取", burned: "消耗", net_intake_pct: "靜攝取 %", intake_target: "攝取/目標", 
    quick_record: "常用食物", no_recent_foods: "暫無常用紀錄", exercise: "運動",
    
    // Actions
    camera: "拍照", gallery: "圖庫", scan_barcode: "掃碼", manual_input: "手輸", 
    scan_hint: "請將條碼對準框內",
    
    // Meals
    breakfast: "早餐", lunch: "午餐", dinner: "晚餐", afternoon_tea: "下午茶", late_night: "宵夜", snack: "點心", no_records: "尚無紀錄",
    
    // Nutrients
    calories: "熱量", protein: "蛋白質", fat: "脂肪", carbs: "碳水", sodium: "鈉",
    sugar: "糖", fiber: "膳食纖維", saturated_fat: "飽和脂肪", trans_fat: "反式脂肪", cholesterol: "膽固醇",
    zinc: "鋅", magnesium: "鎂", iron: "鐵",

    // Analysis
    trend_analysis: "數據分析",
    chart_title_cal: "熱量收支趨勢",
    chart_title_body: "體重與體脂趨勢",
    week: "近7天", month: "近30天", avg_daily: "日均數值",
    axis_l: "(左)", axis_r: "(右)",

    // Profile & AI
    profile: "個人資料", ai_settings: "AI 設定", basic_info: "基本資料", gender: "性別", male: "男", female: "女", 
    birth_date: "出生日期", height: "身高", weight: "體重(kg)", body_fat: "體脂率(%)",
    target_goals: "目標設定", training_goal: "訓練目標", activity_level: "日常活動量", save_settings: "儲存設定",
    api_key_placeholder: "貼上您的 API Key", get_api_key: "取得 API Key", test_key: "測試 Key", test_key_first: "請先測試 API Key", current_model: "當前模型", language: "語言",
    
    lose_weight: "減重", lose_weight_desc: "熱量赤字，專注減脂",
    maintain: "維持", maintain_desc: "維持目前體重與體態",
    gain_weight: "增重", gain_weight_desc: "熱量盈餘，專注增肌",
    recomp: "體態重組", recomp_desc: "增肌同時減脂",
    blood_sugar: "控制血糖", blood_sugar_desc: "穩定血糖波動",

    sedentary: "久坐少動", sedentary_desc: "幾乎不運動",
    lightly_active: "輕度活動", lightly_active_desc: "每週 1-3 天",
    moderately_active: "中度活動", moderately_active_desc: "每週 3-5 天",
    very_active: "高度活動", very_active_desc: "每週 6-7 天",
    extra_active: "極度活動", extra_active_desc: "體力工作",

    ai_coach: "AI 教練", ai_hello: "嗨! 我是你的營養師暨訓練員.", remaining_budget: "今日剩餘熱量", generate_plan: "生成計畫",
    recipe_suggestion: "食譜建議", workout_suggestion: "運動建議", ask_ai: "詢問 AI...",
    ask_recipe: "今天有什麼建議菜單？", ask_workout: "今天有什麼建議的訓練？",
    follow_up_1: "這餐適合運動後吃嗎？", follow_up_2: "如何調整更健康？", follow_up_3: "推薦的搭配飲料？",
    
    // Food Editor
    ai_analysis: "AI 分析", analyzing: "AI 分析中...", composition: "食物組成", suggestion: "攝取建議",
    food_name_placeholder: "輸入名稱或掃描條碼", barcode_scanned: "已讀取條碼：",
    local_db: "本地資料庫", loaded: "已載入", downloaded: "已下載資訊",
    scan_failed: "查無資料", scan_failed_msg: "無此商品，請選擇：",
    scan_ai_option: "拍照分析營養標示", manual_option: "手動輸入", 
    food_name: "食物名稱", 
    portion: "份量設定", portion_count: "份數", unit_weight: "單份重",
    total_weight_input: "總重量", total_label: "總計",
    switch_to_weight: "切換為總重輸入", switch_to_serving: "切換為份數輸入",
    val_per_100g: "每100克含量", 
    
    // Activity Editor
    record_activity: "紀錄運動", select_activity: "選擇運動", custom_activity: "自訂運動", input_activity_name: "輸入運動名稱", edit_activity: "編輯運動",
    activity_intensity: "運動強度", activity_details: "詳細數據", time_min: "時間 (分鐘)", distance_km: "距離 (km)", steps: "步數",
    floors: "樓層", est_calories: "預估消耗熱量", feeling_notes: "運動感受 & 筆記", enter_notes: "輸入筆記...",
    data_incomplete: "資料不完整", data_incomplete_msg: "請選擇運動項目，並至少輸入一項數據",
    
    cat_cardio: "有氧與耐力", cat_gym: "健身房", cat_sport: "球類與競技", cat_life: "日常生活", cat_custom: "自訂",
    act_walk: "散步", act_run_slow: "慢跑", act_run_fast: "快跑", act_cycling: "騎腳踏車", act_swim: "游泳", act_hike: "登山", act_jump_rope: "跳繩",
    act_weight_training: "重量訓練", act_powerlifting: "健力", act_yoga: "瑜珈", act_pilates: "皮拉提斯", act_hiit: "HIIT", act_elliptical: "橢圓機",
    act_basketball: "籃球", act_badminton: "羽球", act_tennis: "網球", act_soccer: "足球", act_baseball: "棒球",
    act_housework: "做家事", act_gardening: "園藝", act_moving: "搬運",
    
    intensity_low: "低強度", intensity_medium: "中強度", intensity_high: "高強度",
    
    increase: "增加", decrease: "減少", no_change: "無變化"
  },
  'en': {
    tab_home: "Home", tab_analysis: "Analysis", tab_ai_coach: "AI Coach", tab_settings: "Settings",
    welcome: "Welcome", save: "Save", cancel: "Cancel", delete: "Delete", error: "Error", success: "Success", loading: "Loading...",
    tip: "Tip", save_success: "Saved successfully", invalid_input: "Invalid input", settings: "Settings",

    body_metrics: "Body Metrics", record_metrics: "+ Record", target_weight: "Target Weight", target_body_fat: "Target Body Fat",
    intake: "Intake", burned: "Burned", net_intake_pct: "Net Intake %", intake_target: "Intake/Target", 
    quick_record: "Quick Add", no_recent_foods: "No recent records", exercise: "Exercise",
    
    camera: "Camera", gallery: "Gallery", scan_barcode: "Scan Code", manual_input: "Manual", 
    scan_hint: "Align barcode within frame",
    
    breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner", afternoon_tea: "Afternoon Tea", late_night: "Late Night", snack: "Snack", no_records: "No records",
    
    calories: "Calories", protein: "Protein", fat: "Fat", carbs: "Carbs", sodium: "Sodium",
    sugar: "Sugar", fiber: "Fiber", saturated_fat: "Saturated Fat", trans_fat: "Trans Fat", cholesterol: "Cholesterol",
    zinc: "Zinc", magnesium: "Magnesium", iron: "Iron",

    trend_analysis: "Analysis",
    chart_title_cal: "Calories Trend",
    chart_title_body: "Body Metrics Trend",
    week: "7 Days", month: "30 Days", avg_daily: "Daily Avg",
    axis_l: "(L)", axis_r: "(R)",
    
    profile: "Profile", ai_settings: "AI Settings", basic_info: "Basic Info", gender: "Gender", male: "Male", female: "Female", 
    birth_date: "Birth Date", height: "Height", weight: "Weight(kg)", body_fat: "Body Fat(%)",
    target_goals: "Targets", training_goal: "Goal", activity_level: "Activity Level", save_settings: "Save Settings",
    api_key_placeholder: "Paste API Key", get_api_key: "Get API Key", test_key: "Test Key", test_key_first: "Test Key First", current_model: "Model", language: "Language",
    
    lose_weight: "Weight Loss", lose_weight_desc: "Calorie deficit",
    maintain: "Maintain", maintain_desc: "Maintain weight",
    gain_weight: "Gain Weight", gain_weight_desc: "Muscle gain",
    recomp: "Recomp", recomp_desc: "Lose fat gain muscle",
    blood_sugar: "Blood Sugar", blood_sugar_desc: "Stable blood sugar",

    sedentary: "Sedentary", sedentary_desc: "Little exercise",
    lightly_active: "Lightly Active", lightly_active_desc: "1-3 days/week",
    moderately_active: "Moderately Active", moderately_active_desc: "3-5 days/week",
    very_active: "Very Active", very_active_desc: "6-7 days/week",
    extra_active: "Extra Active", extra_active_desc: "Physical job",

    ai_coach: "AI Coach", ai_hello: "Hi! I am your AI Coach.", remaining_budget: "Remaining", generate_plan: "Generate Plan",
    recipe_suggestion: "Recipe Suggestion", workout_suggestion: "Workout Suggestion", ask_ai: "Ask AI...",
    ask_recipe: "Suggest a meal plan?", ask_workout: "Suggest a workout?",
    follow_up_1: "Good for post-workout?", follow_up_2: "How to make it healthier?", follow_up_3: "Best drink pairing?",
    
    ai_analysis: "AI Analysis", analyzing: "Analyzing...", composition: "Composition", suggestion: "Suggestion",
    food_name_placeholder: "Enter name", barcode_scanned: "Barcode: ",
    local_db: "Local DB", loaded: "Loaded", downloaded: "Downloaded",
    scan_failed: "Not Found", scan_failed_msg: "Choose option:",
    scan_ai_option: "Scan Label (AI)", manual_option: "Manual",
    food_name: "Food Name", 
    portion: "Portion", portion_count: "Count", unit_weight: "Unit Weight",
    total_weight_input: "Total Weight", total_label: "Total",
    switch_to_weight: "Switch to Total", switch_to_serving: "Switch to Servings",
    val_per_100g: "Per 100g",

    record_activity: "Record Activity", select_activity: "Select Activity", custom_activity: "Custom", input_activity_name: "Enter Activity Name", edit_activity: "Edit Activity",
    activity_intensity: "Intensity", activity_details: "Details", time_min: "Time (min)", distance_km: "Distance (km)", steps: "Steps",
    floors: "Floors", est_calories: "Est. Calories", feeling_notes: "Notes & Feeling", enter_notes: "Enter notes...",
    data_incomplete: "Incomplete Data", data_incomplete_msg: "Please select activity and enter at least one value.",

    cat_cardio: "Cardio", cat_gym: "Gym", cat_sport: "Sport", cat_life: "Life", cat_custom: "Custom",
    act_walk: "Walking", act_run_slow: "Jogging", act_run_fast: "Running", act_cycling: "Cycling", act_swim: "Swimming", act_hike: "Hiking", act_jump_rope: "Jump Rope",
    act_weight_training: "Weight Training", act_powerlifting: "Powerlifting", act_yoga: "Yoga", act_pilates: "Pilates", act_hiit: "HIIT", act_elliptical: "Elliptical",
    act_basketball: "Basketball", act_badminton: "Badminton", act_tennis: "Tennis", act_soccer: "Soccer", act_baseball: "Baseball",
    act_housework: "Housework", act_gardening: "Gardening", act_moving: "Moving",
    
    intensity_low: "Low", intensity_medium: "Medium", intensity_high: "High",
    
    increase: "Inc", decrease: "Dec", no_change: "-"
  },
};

interface LanguageState {
  locale: string;
  setLocale: (locale: string) => void;
}

export const useLanguageStore = create<LanguageState>((set) => ({
  locale: 'zh-TW',
  setLocale: (locale) => set({ locale }),
}));

export const t = (key: string, lang: string = 'zh-TW') => {
  const dict = TRANSLATIONS[lang as keyof typeof TRANSLATIONS] || TRANSLATIONS['en'];
  // @ts-ignore
  return dict[key] || key;
};

export const useLanguage = () => {
  const locale = useLanguageStore((state) => state.locale);
  useEffect(() => {
    getSettings().then(s => { 
      if(s.language && s.language !== locale) {
        useLanguageStore.getState().setLocale(s.language);
      }
    });
  }, []);
  return locale;
};

export const setAppLanguage = (lang: string) => {
  useLanguageStore.getState().setLocale(lang);
  saveSettings({ language: lang });
};

// 版本履歷
export const VERSION_LOGS = [
  {
    version: "V1.0.9.9",
    date: "2025-12-30",
    content: "[Fix] Critical syntax error in analysis screen.\n[New] Completed i18n dictionary for all new features.\n[Fix] Graph axis labels localized."
  },
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
  { version: '1.0.6', date: '2025-12-23', content: '新增訓練目標與年齡推算；強化 AI 教練建議邏輯；優化掃碼功能(支援外部資料庫查詢)；食物確認頁面改版(分離基準值)。' },
  { version: '1.0.5', date: '2025-12-22', content: '修復推播導致的閃退問題；優化運動熱量計算公式；新增營養素攝取比例圖表。' },
  { version: '1.0.4', date: '2025-12-21', content: 'UI/UX全面優化：解決語言切換延遲問題；新增相簿匯入功能；AI教練建議分開儲存；鈉含量單位修正。' },
  { version: '1.0.3', date: '2025-12-20', content: '新增多語言支援；新增體脂率紀錄；趨勢分析增加年/月/週切換；AI 邏輯優化。' },
  { version: '1.0.2', date: '2025-12-18', content: '修正 AI 金鑰失效問題，開放自訂 Key；修正條碼掃描；優化趨勢圖表。' },
  { version: '1.0.1', date: '2025-12-15', content: '基本功能發布：飲食紀錄、卡路里計算、個人檔案、AI 辨識、條碼掃描。' },
];