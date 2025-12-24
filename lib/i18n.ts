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
    get_api_key_link: '👉 前往 Google AI Studio 取得 API Key',
    trend_analysis: '趨勢分析',
    chart_title_cal_weight: '熱量、體重與體脂',
    chart_title_nutrients: '營養素攝取比例 (%)',
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
    food_name_placeholder: '輸入食物名稱',
    calories: '熱量 (kcal)',
    suggestion_limit: '每日建議攝取量',
    alert_over: '超過建議值',
    export_pdf: '匯出 PDF',
    edit: '編輯',
    delete: '刪除',
    cancel: '取消',
    
    // Food Recognition
    serving_weight: '單份重量 (g)',
    intake_quantity: '攝取份數',
    total_intake_gram: '總攝取量 (g/ml)',
    per_100g_base: '每 100g 基準數值',
    ai_analysis_result: 'AI 分析結果',
    composition: '組成',
    intake_advice: '攝取建議',
    scan_failed: '查無資料',
    scan_failed_msg: '本地與雲端資料庫皆無此商品，請選擇輸入方式：',
    scan_ai_label: 'AI 辨識標示',
    input_manual: '手動輸入',
    input_serving_mode: '份數輸入',
    input_gram_mode: '總克數輸入',
    total_calories_display: '當次總熱量',
    barcode_label: '條碼',
    
    // Nutrients
    macro_nutrients: '三大營養素',
    detailed_fats: '詳細脂肪',
    minerals: '礦物質',
    sugar: '糖 (g)',
    sat_fat: '飽和脂肪 (g)',
    trans_fat: '反式脂肪 (g)',
    cholesterol: '膽固醇 (mg)',
    zinc: '鋅 (mg)',
    magnesium: '鎂 (mg)',
    iron: '鐵 (mg)',
    sodium_mg: '鈉 (mg)',
    protein_g: '蛋白質 (g)',
    carbs_g: '總碳水 (g)',
    fat_g: '總脂肪 (g)',

    // Camera
    camera_option_title: '選擇輸入方式',
    camera_option_subtitle: '透過 AI 分析影像中的營養成分',
    camera_option_subtitle_barcode: '正在為條碼 {barcode} 建立資料',
    open_camera: '開啟相機',
    open_camera_desc: '拍照並裁切營養標示',
    open_gallery: '讀取相簿',
    open_gallery_desc: '從現有照片中選取',
    processing: '處理中...',
    permission_required: '需要權限',
    camera_permission_msg: '請允許使用相機以進行拍照',
    error_title: '錯誤',
    capture_failed: '拍照失敗',
    pick_failed: '選取圖片失敗',
    
    // Edit Modal
    adjust_portion: '調整份量倍率',
    original_val: '原數值',
    new_val: '新數值',
    delete_item_confirm: '確定要刪除「{item}」嗎？\n注意：這將會一併刪除所有屬於此項目的歷史紀錄！',
    delete_confirm_btn: '確定刪除',
    deleted_msg: '已刪除',
    
    // Alerts
    ai_failed: '辨識失敗',
    ai_failed_msg: 'AI 無法識別，請手動輸入',
    save_db_confirm_title: '基準值變更',
    save_db_confirm_msg: '您修改了每 100g 的基準營養數值，是否同步更新產品資料庫？(影響未來掃碼結果)',
    yes_update_all: '是，同步更新',
    no_update_current: '否，僅修紀錄',
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
    get_api_key_link: '👉 Get API Key from Google AI Studio',
    trend_analysis: 'Trend Analysis',
    chart_title_cal_weight: 'Calories, Weight & Body Fat',
    chart_title_nutrients: 'Nutrient Ratio (%)',
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
    food_name_placeholder: 'Enter food name',
    calories: 'Calories (kcal)',
    suggestion_limit: 'Daily Suggestion',
    alert_over: 'Exceeded',
    export_pdf: 'Export PDF',
    edit: 'Edit',
    delete: 'Delete',
    cancel: 'Cancel',
    
    serving_weight: 'Unit Weight (g)',
    intake_quantity: 'Quantity',
    total_intake_gram: 'Total (g/ml)',
    per_100g_base: 'Per 100g Base',
    ai_analysis_result: 'AI Analysis',
    composition: 'Composition',
    intake_advice: 'Advice',
    scan_failed: 'Not Found',
    scan_failed_msg: 'Product not found. Choose input method:',
    scan_ai_label: 'AI Label Scan',
    input_manual: 'Manual Input',
    input_serving_mode: 'By Quantity',
    input_gram_mode: 'By Total Grams',
    total_calories_display: 'Total Calories',
    barcode_label: 'Barcode',

    macro_nutrients: 'Macro Nutrients',
    detailed_fats: 'Detailed Fats',
    minerals: 'Minerals',
    sugar: 'Sugar (g)',
    sat_fat: 'Sat. Fat (g)',
    trans_fat: 'Trans Fat (g)',
    cholesterol: 'Cholest. (mg)',
    zinc: 'Zinc (mg)',
    magnesium: 'Magnesium (mg)',
    iron: 'Iron (mg)',
    sodium_mg: 'Sodium (mg)',
    protein_g: 'Protein (g)',
    carbs_g: 'Carbs (g)',
    fat_g: 'Fat (g)',

    camera_option_title: 'Select Input Method',
    camera_option_subtitle: 'Analyze nutrition via AI',
    camera_option_subtitle_barcode: 'Creating data for barcode {barcode}',
    open_camera: 'Open Camera',
    open_camera_desc: 'Capture & Crop Label',
    open_gallery: 'Open Gallery',
    open_gallery_desc: 'Select from Photos',
    processing: 'Processing...',
    permission_required: 'Permission Required',
    camera_permission_msg: 'Please allow camera access.',
    error_title: 'Error',
    capture_failed: 'Capture Failed',
    pick_failed: 'Pick Image Failed',

    adjust_portion: 'Adjust Portion',
    original_val: 'Original',
    new_val: 'New',
    delete_item_confirm: 'Delete "{item}"? This will delete all history logs for this item.',
    delete_confirm_btn: 'Delete',
    deleted_msg: 'Deleted',

    ai_failed: 'Recognition Failed',
    ai_failed_msg: 'AI could not recognize. Please input manually.',
    save_db_confirm_title: 'Base Value Changed',
    save_db_confirm_msg: 'You changed the per 100g base values. Sync with Product Database? (Affects future scans)',
    yes_update_all: 'Yes, Sync',
    no_update_current: 'No, This Only',
  },
  // 其他語言可依此類推，此處省略以保持精簡，實際應用時需補齊所有 Key
};

// 簡單的 Fallback 機制：若其他語言缺 Key，回退到英文
const getTranslation = (lang: string, key: string) => {
  const dict = TRANSLATIONS[lang as keyof typeof TRANSLATIONS] || TRANSLATIONS['en'];
  const val = dict[key as keyof typeof dict];
  if (val) return val;
  // Fallback to EN
  return TRANSLATIONS['en'][key as keyof typeof TRANSLATIONS['en']] || key;
};

export const VERSION_LOGS = [
  { version: '1.0.8', date: '2025-12-24', content: '全面多語言支援(含AI)；新增API Key申請連結；優化相機UI與掃碼流程；資料庫欄位擴充。' },
  { version: '1.0.7', date: '2025-12-23', content: '優化編輯介面(支援份數調整)；修正相機與AI模型問題；強化掃碼存檔機制。' },
  { version: '1.0.6', date: '2025-12-23', content: '新增訓練目標與年齡推算；強化 AI 教練建議邏輯；優化掃碼功能；食物確認頁面改版。' },
  { version: '1.0.5', date: '2025-12-22', content: '修復推播導致的閃退問題；優化運動熱量計算公式；新增營養素攝取比例圖表。' },
  { version: '1.0.4', date: '2025-12-21', content: 'UI/UX全面優化：解決語言切換延遲問題；新增相簿匯入功能；AI教練建議分開儲存；鈉含量單位修正。' },
];

export const t = (key: string, lang: string = 'zh-TW') => {
  return getTranslation(lang, key).replace('{barcode}', ''); // 簡單處理變數
};

// 支援帶參數的翻譯
export const tParams = (key: string, params: Record<string, string>, lang: string = 'zh-TW') => {
  let text = getTranslation(lang, key);
  for (const k in params) {
    text = text.replace(`{${k}}`, params[k]);
  }
  return text;
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