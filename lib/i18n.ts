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
    tip: "提示", save_success: "儲存成功", invalid_input: "輸入數值無效", settings: "設定", edit: "編輯",
    close: "關閉", version_history: "改版履歷", how_to_get_key: "如何取得 Key?", input_date: "輸入日期",
    
    // Backup & Restore
    data_backup: "資料備份與還原",
    backup_db: "匯出資料庫 (備份)",
    restore_db: "匯入資料庫 (還原)",
    backup_desc: "將資料庫檔案匯出至 Google Drive 或本機",
    restore_desc: "從檔案還原資料庫 (將覆蓋目前資料)",
    restore_confirm_title: "確認還原？",
    restore_confirm_msg: "這將會完全覆蓋目前的紀錄，且無法復原。請確認您選擇的是正確的備份檔案。",
    restore_success_msg: "還原成功！請完全關閉並重啟 App 以套用變更。",
    
    // API Guide
    api_guide_title: "申請 Gemini API Key 步驟",
    api_step_1: "1. 點擊下方按鈕前往 Google AI Studio。",
    api_step_2: "2. 登入您的 Google 帳號。",
    api_step_3: "3. 點擊 'Get API Key' 或 'Create API Key'。",
    api_step_4: "4. 選擇 'Create API key in new project'。",
    api_step_5: "5. 複製生成的 Key 並貼回本 App。",
    go_to_site: "前往申請網站",

    // Home
    body_metrics: "身體數值", record_metrics: "+ 紀錄", target_weight: "目標體重", target_body_fat: "目標體脂",
    intake: "攝取", burned: "消耗", net_intake_pct: "靜攝取 %", intake_target: "攝取/目標", 
    quick_record: "常用食物", no_recent_foods: "暫無常用紀錄", exercise: "運動", quick_add_activity: "常用運動", today: "今天", confirm: "確認",
    
    // Actions
    camera: "拍照", scan_barcode: "掃碼", manual_input: "手輸", gallery: "相簿",
    scan_hint: "請將條碼對準框內",allow: "允許",
    
    // Meals
    breakfast: "早餐", lunch: "午餐", dinner: "晚餐", afternoon_tea: "下午茶", late_night: "宵夜", snack: "點心", no_records: "尚無紀錄",
    
    // Nutrients
    calories: "熱量", protein: "蛋白質", fat: "脂肪", carbs: "碳水", sodium: "鈉",
    sugar: "糖", fiber: "膳食纖維", saturated_fat: "飽和脂肪", trans_fat: "反式脂肪", cholesterol: "膽固醇",
    zinc: "鋅", magnesium: "鎂", iron: "鐵",

    // Analysis
    trend_analysis: "數據分析",
    chart_title_cal: "熱量收支趨勢",
    chart_title_body: "體重與體脂趨勢", calories_and_weight: "熱量收支與體重體脂趨勢",
    week: "近7天", month: "近30天", avg_daily: "日均數值",
    axis_l: "(左)", axis_r: "(右)", analysis: "分析", total: "總計",
    pinch_to_zoom: "雙指縮放圖表", drag_to_move: "拖曳移動圖表", tap_msg: "點擊方塊以選取/交換位置，按 X 刪除。", done: "完成",
    last_7_days: "最近 7 天", last_30_days: "最近 30 天", custom: "自訂區間",
    avg_daily_intake: "日均攝取", avg_burned: "日均消耗", avg_bmr: "日均淨攝取", net_intake: "淨攝取",
    total_time: "總運動時間", total_steps: "總步數", total_calories: "總消耗熱量",
    avg_weight: "平均體重", weight_change: "體重變化", avg_body_fat: "平均體脂", body_fat_change: "體脂變化",

    // Profile & AI
    profile: "個人資料", ai_settings: "AI 設定", basic_info: "基本資料", gender: "性別", male: "男", female: "女",
    birth_date: "出生日期", height: "身高", weight: "體重", body_fat: "體脂率",
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
    target_date: "預計完成日",
    days_remaining: "剩餘天數",

    // AI Coach UI
    ai_coach: "AI 教練", ai_welcome_msg: "你好！我是你的專屬營養與健身助手。\n請點擊下方按鈕，或直接輸入問題。",
    ask_ai_placeholder: "輸入訊息...",
    meal_suggestions: "飲食建議", workout_suggestions: "運動建議",
    cook_meal: "自備食材", store_meal: "便利商店",
    home_workout: "居家無器材", gym_workout: "健身房/器材",
    remaining: "剩餘額度", daily_calorie_target: "目標",
    
    // AI Coach Prompts (Dynamic)
    coach_prompt_cook: "身為營養師，請提供一份適合我目前剩餘熱量的「自備食材烹飪」菜單。請包含：1.食材清單 2.詳細烹飪步驟 3. 推薦的 YouTube 料理教學關鍵字或連結。請考量我的個人目標。",
    coach_prompt_store: "身為營養師，請提供一份適合我目前剩餘熱量的「便利商店」外食組合（如 7-11 或全家）。請列出具體商品名稱與預估熱量。請考量我的個人目標。",
    coach_prompt_home_workout: "身為健身教練，請提供一份適合我今日狀態的「居家無器材」運動課表。請包含：1.動作名稱 2.次數/組數 3.動作要點 4. 推薦的 YouTube 動作教學連結。",
    coach_prompt_gym_workout: "身為健身教練，請提供一份適合我今日狀態的「健身房/器材輔助」運動課表。請包含：1.器材名稱 2.重量/組數建議 3.注意事項 4. 推薦的 YouTube 教學連結。",
    
    // Food Editor
    ai_analysis: "AI 分析", analyzing: "AI 分析中...", composition: "食物組成", suggestion: "攝取建議",
    food_name_placeholder: "輸入名稱或掃描條碼", barcode_scanned: "已讀取條碼：",
    local_db: "本地資料庫", loaded: "已載入", downloaded: "已下載資訊", read_failed: "讀取失敗",
    scan_failed: "查無資料", scan_failed_msg: "無此商品，請選擇：",
    scan_ai_option: "拍照分析營養標示", manual_option: "手動輸入", 
    food_name: "食物名稱", brand_placeholder: "品牌（選填）", brand: "品牌",
    portion: "份量設定", portion_count: "份數", unit_weight: "單份重",
    total_weight_input: "總重量", total_label: "總計",
    switch_to_weight: "切換為總重輸入", switch_to_serving: "切換為份數輸入",
    val_per_100g: "每100克含量", data_incomplete: "資料不完整", food_modified_msg: "數值已變更，要更新原始項目還是另存新檔？",
    save_as_new: "另存新檔", update_original: "更新原始項目",

    //app/barcode-product.tsx
    product_not_found: "查無此商品", product_not_found_msg: "您可以選擇以下方式：", unknown_product: "未知商品",
    product_info: "商品資訊", product_name: "商品名稱", input_serving: "輸入份量", input_gram: "輸入克數",
    serving_unit: "份量" , barcode: "條碼",

    // Activity Editor
    record_activity: "紀錄運動", select_activity: "選擇運動", custom_activity: "自訂運動", input_activity_name: "輸入運動名稱",
    activity_intensity: "運動強度", activity_details: "詳細數據", time_min: "時間 (分鐘)", distance_km: "距離 (km)", steps: "步數",
    floors: "樓層", est_calories: "預估消耗熱量", feeling_notes: "運動感受 & 筆記", enter_notes: "輸入筆記...",
    data_incomplete_msg: "請選擇運動項目，並至少輸入一項數據", activity_name: "運動名稱", category: "分類",
    select_category_msg: "請選擇運動類別...",
    
    cat_cardio: "有氧與耐力", cat_gym: "健身房", cat_sport: "球類與競技", cat_life: "日常生活", cat_custom: "自訂",
    act_walk: "散步", act_run_slow: "慢跑", act_run_fast: "快跑", act_cycling: "騎腳踏車", act_swim: "游泳", act_hike: "登山", act_jump_rope: "跳繩",
    act_weight_training: "重量訓練", act_powerlifting: "健力", act_yoga: "瑜珈", act_pilates: "皮拉提斯", act_hiit: "HIIT", act_elliptical: "橢圓機",
    act_basketball: "籃球", act_badminton: "羽球", act_tennis: "網球", act_soccer: "足球", act_baseball: "棒球",
    act_housework: "做家事", act_gardening: "園藝", act_moving: "搬運",
    
    intensity_low: "低強度", intensity_medium: "中強度", intensity_high: "高強度",
    
    increase: "增加", decrease: "減少", no_change: "無變化"
  },
  'en': {
    // Tab Titles
    tab_home: "Home", tab_analysis: "Analysis", tab_ai_coach: "AI Coach", tab_settings: "Settings",
    // General
    welcome: "Welcome", save: "Save", cancel: "Cancel", delete: "Delete", error: "Error", success: "Success", loading: "Loading...",
    tip: "Tip", save_success: "Saved successfully", invalid_input: "Invalid input", settings: "Settings", edit: "Edit",
    close: "Close", version_history: "Version History", how_to_get_key: "How to get the Key?", input_date: "Input Date",
    // Backup & Restore
    data_backup: "Data Backup & Restore",
    backup_db: "Export Database (Backup)",
    restore_db: "Import Database (Restore)",
    backup_desc: "Export the database file to Google Drive or local",
    restore_desc: "Restore database from file (will overwrite current data)",
    restore_confirm_title: "Confirm Restore?",
    restore_confirm_msg: "This will completely overwrite your current records and cannot be undone. Please ensure you have selected the correct backup file.",
    restore_success_msg: "Restore successful! Please fully close and restart the app to apply changes.",
    // API Guide
    api_guide_title: "Steps to Apply for Gemini API Key",
    api_step_1: "1. Click the button below to go to Google AI Studio.",
    api_step_2: "2. Log in with your Google account.",
    api_step_3: "3. Click 'Get API Key' or 'Create API Key'.",
    api_step_4: "4. Select 'Create API key in new project'.",
    api_step_5: "5. Copy the generated Key and paste it back into this app.",
    go_to_site: "Go to Application Site",
    // Home
    body_metrics: "Body Metrics", record_metrics: "+ Record", target_weight: "Target Weight", target_body_fat: "Target Body Fat",
    intake: "Intake", burned: "Burned", net_intake_pct: "Net Intake %", intake_target: "Intake/Target",
    quick_record: "Frequent Foods", no_recent_foods: "No Frequent Records", exercise: "Exercise", quick_add_activity: "Frequent Exercises", today: "Today", confirm: "Confirm",
    // Actions
    camera: "Camera", scan_barcode: "Scan", manual_input: "Manual Input", gallery: "Gallery",
    scan_hint: "Please align the barcode within the frame",allow: "Allow",
    // Meals
    breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner", afternoon_tea: "Afternoon Tea", late_night: "Late Night", snack: "Snack", no_records: "No Records",
    // Nutrients
    calories: "Calories", protein: "Protein", fat: "Fat", carbs: "Carbs", sodium: "Sodium",
    sugar: "Sugar", fiber: "Fiber", saturated_fat: "Saturated Fat", trans_fat: "Trans Fat", cholesterol: "Cholesterol",
    zinc: "Zinc", magnesium: "Magnesium", iron: "Iron",
    // Analysis
    trend_analysis: "Data Analysis",
    chart_title_cal: "Calorie Trend",
    chart_title_body: "Weight & Body Fat Trend", calories_and_weight: "Calorie Balance & Weight/Body Fat Trend",
    week: "Last 7 Days", month: "Last 30 Days", avg_daily: "Avg. Daily",
    axis_l: "(Left)", axis_r: "(Right)", analysis: "Analysis", total: "Total",
    pinch_to_zoom: "Pinch to zoom chart", drag_to_move: "Drag to move chart", tap_msg: "Tap blocks to select/swap. Delete with X.", done: "Done",
    last_7_days: "Last 7 Days", last_30_days: "Last 30 Days", custom: "Custom Range",
    avg_daily_intake: "Avg. Daily Intake", avg_burned: "Avg. Burned", avg_bmr: "Avg. Net Intake", net_intake: "Net Intake",
    total_time: "Total Exercise Time", total_steps: "Total Steps", total_calories: "Total Burned Calories",
    avg_weight: "Avg. Weight", weight_change: "Weight Change", avg_body_fat: "Avg. Body Fat", body_fat_change: "Body Fat Change",
    // Profile & AI
    profile: "Profile", ai_settings: "AI Settings", basic_info: "Basic Info", gender: "Gender", male: "Male", female: "Female",
    birth_date: "Birth Date", height: "Height", weight: "Weight", body_fat: "Body Fat %",
    target_goals: "Target Goals", training_goal: "Training Goal", activity_level: "Daily Activity Level", save_settings: "Save Settings",
    api_key_placeholder: "Paste your API Key", get_api_key: "Get API Key", test_key: "Test Key", test_key_first: "Please test API Key first", current_model: "Current Model", language: "Language", 
    
    lose_weight: "Lose Weight", lose_weight_desc: "Calorie Deficit, Focus on Fat Loss",
    maintain: "Maintain", maintain_desc: "Maintain Current Weight and Physique",
    gain_weight: "Gain Weight", gain_weight_desc: "Calorie Surplus, Focus on Muscle Gain",
    recomp: "Body Recomposition", recomp_desc: "Build Muscle while Losing Fat",
    blood_sugar: "Control Blood Sugar", blood_sugar_desc: "Stabilize Blood Sugar Levels",

    sedentary: "Sedentary", sedentary_desc: "Little to No Exercise",
    lightly_active: "Lightly Active", lightly_active_desc: "1-3 Days/Week",
    moderately_active: "Moderately Active", moderately_active_desc: "3-5 Days/Week",
    very_active: "Very Active", very_active_desc: "6-7 Days/Week",
    extra_active: "Extra Active", extra_active_desc: "Physical Job",
    target_date: "Target Completion Date",
    days_remaining: "Days Remaining",
    // AI Coach UI
    ai_coach: "AI Coach", ai_welcome_msg: "Hello! I'm your personal nutrition and fitness assistant.\nPlease click the buttons below or type in your questions directly.",  
    ask_ai_placeholder: "Type your message...", 
    meal_suggestions: "Meal Suggestions", workout_suggestions: "Workout Suggestions",
    cook_meal: "Cook at Home", store_meal: "Convenience Store",
    home_workout: "Home Workout", gym_workout: "Gym/Equipment",
    remaining: "Remaining", daily_calorie_target: "Daily Target",
    // AI Coach Prompts (Dynamic)
    coach_prompt_cook: "As a nutritionist, please provide a 'Cook at Home' meal plan suitable for my current remaining calories. Please include: 1. Ingredient list 2. Detailed cooking steps 3. Recommended YouTube cooking tutorial keywords or links. Please consider my personal goals.", 
    coach_prompt_store: "As a nutritionist, please provide a 'Convenience Store' meal combination suitable for my current remaining calories (e.g., 7-11 or FamilyMart). Please list specific product names and estimated calories. Please consider my personal goals.",  
    coach_prompt_home_workout: "As a fitness coach, please provide a 'Home Workout without Equipment' exercise routine suitable for my current condition. Please include: 1. Exercise name 2. Reps/Sets 3. Key points 4. Recommended YouTube exercise tutorial links.", 
    coach_prompt_gym_workout: "As a fitness coach, please provide a 'Gym/Equipment Assisted' exercise routine suitable for my current condition. Please include: 1. Equipment name 2. Weight/Sets recommendations 3. Precautions 4. Recommended YouTube tutorial links.", 
    // Food Editor
    ai_analysis: "AI Analysis", analyzing: "AI Analyzing...", composition: "Food Composition", suggestion: "Intake Suggestions",
    food_name_placeholder: "Enter name or scan barcode", barcode_scanned: "Barcode scanned: ",
    local_db: "Local Database", loaded: "Loaded", downloaded: "Info Downloaded", read_failed: "Read Failed",
    scan_failed: "No Data Found", scan_failed_msg: "No such product, please choose:",
    scan_ai_option: "Scan Label (AI)", manual_option: "Manual Input",
    food_name: "Food Name", brand_placeholder: "Brand (optional)", brand: "Brand",
    portion: "Portion Settings", portion_count: "Portion Count", unit_weight: "Unit Weight",
    total_weight_input: "Total Weight", total_label: "Total",
    switch_to_weight: "Switch to Total Weight Input", switch_to_serving: "Switch to Portion Count Input",
    val_per_100g: "Per 100g", data_incomplete: "Data Incomplete", food_modified_msg: "Values have changed. Update original item or save as new?",
    save_as_new: "Save as New", update_original: "Update Original",
    //app/barcode-product.tsx
    product_not_found: "Product Not Found", product_not_found_msg: "You can choose the following options:", unknown_product: "Unknown Product",
    product_info: "Product Info", product_name: "Product Name", input_serving: "Input Serving", input_gram: "Input Grams",
    serving_unit: "Serving Unit" , barcode: "Barcode",
    // Activity Editor
    record_activity: "Record Activity", select_activity: "Select Activity", custom_activity: "Custom Activity", input_activity_name: "Input Activity Name",
    activity_intensity: "Intensity", activity_details: "Details", time_min: "Time (min)", distance_km: "Distance (km)", steps: "Steps",
    floors: "Floors", est_calories: "Estimated Burned Calories", feeling_notes: "Notes & Feelings", enter_notes: "Enter notes...",
    data_incomplete_msg: "Please select an activity and enter at least one value", activity_name: "Activity Name", category: "Category",
    select_category_msg: "Please select an activity category...",

    cat_cardio: "Cardio & Endurance", cat_gym: "Gym", cat_sport: "Sports & Competition", cat_life: "Daily Life", cat_custom: "Custom",
    act_walk: "Walking", act_run_slow: "Jogging", act_run_fast: "Running", act_cycling: "Cycling", act_swim: "Swimming", act_hike: "Hiking", act_jump_rope: "Jump Rope",
    act_weight_training: "Weight Training", act_powerlifting: "Powerlifting", act_yoga: "Yoga", act_pilates: "Pilates", act_hiit: "HIIT", act_elliptical: "Elliptical",
    act_basketball: "Basketball", act_badminton: "Badminton", act_tennis: "Tennis", act_soccer: "Soccer", act_baseball: "Baseball",
    act_housework: "Housework", act_gardening: "Gardening", act_moving: "Moving",

    intensity_low: "Low Intensity", intensity_medium: "Medium Intensity", intensity_high: "High Intensity",

    increase: "Increase", decrease: "Decrease", no_change: "No Change"

  },
  'ja': {
    tab_home: "ホーム", tab_analysis: "分析", tab_ai_coach: "AIコーチ", tab_settings: "設定",
    
    // General
    welcome: "ようこそ", save: "保存", cancel: "キャンセル", delete: "削除", error: "エラー", success: "成功", loading: "読み込み中...",
    tip: "ヒント", save_success: "保存しました", invalid_input: "無効な入力", settings: "設定", edit: "編集",
    close: "閉じる", version_history: "バージョン履歴", how_to_get_key: "キーの取得方法", input_date: "日付を入力",
    
    // Backup & Restore
    data_backup: "データバックアップ",
    backup_db: "DBをエクスポート",
    restore_db: "DBをインポート",
    backup_desc: "データベースをGoogleドライブまたはローカルに保存",
    restore_desc: "ファイルから復元 (現在のデータは上書きされます)",
    restore_confirm_title: "復元しますか？",
    restore_confirm_msg: "現在のデータは完全に上書きされ、元に戻すことはできません。",
    restore_success_msg: "復元しました！アプリを再起動してください。",
    
    // API Guide
    api_guide_title: "Gemini APIキーの取得手順",
    api_step_1: "1. 下のボタンをクリックしてGoogle AI Studioへ移動します。",
    api_step_2: "2. Googleアカウントでログインします。",
    api_step_3: "3. 'Get API Key' または 'Create API Key' をクリックします。",
    api_step_4: "4. 'Create API key in new project' を選択します。",
    api_step_5: "5. 生成されたキーをコピーしてアプリに貼り付けます。",
    go_to_site: "サイトへ移動",

    // Home
    body_metrics: "身体測定", record_metrics: "+ 記録", target_weight: "目標体重", target_body_fat: "目標体脂肪率",
    intake: "摂取", burned: "消費", net_intake_pct: "純摂取 %", intake_target: "摂取/目標", 
    quick_record: "よく食べる物", no_recent_foods: "履歴なし", exercise: "運動", quick_add_activity: "よくする運動", today: "今日", confirm: "確認",
    
    // Actions
    camera: "カメラ", scan_barcode: "スキャン", manual_input: "手入力", gallery: "ギャラリー",
    scan_hint: "バーコードを枠に合わせてください",allow: "許可する",
    
    // Meals
    breakfast: "朝食", lunch: "昼食", dinner: "夕食", afternoon_tea: "間食", late_night: "夜食", snack: "スナック", no_records: "記録なし",
    
    // Nutrients
    calories: "カロリー", protein: "タンパク質", fat: "脂質", carbs: "炭水化物", sodium: "ナトリウム",
    sugar: "糖質", fiber: "食物繊維", saturated_fat: "飽和脂肪酸", trans_fat: "トランス脂肪酸", cholesterol: "コレステロール",
    zinc: "亜鉛", magnesium: "マグネシウム", iron: "鉄",

    // Analysis
    trend_analysis: "データ分析",
    chart_title_cal: "カロリートレンド",
    chart_title_body: "体重と体脂肪のトレンド", calories_and_weight: "カロリー収支と体重/体脂肪のトレンド",
    week: "過去7日", month: "過去30日", avg_daily: "1日平均",
    axis_l: "(左)", axis_r: "(右)", analysis: "分析", total: "合計",
    pinch_to_zoom: "ピンチでズーム", drag_to_move: "ドラッグで移動", tap_msg: "ブロックをタップして選択/交換。Xで削除。", done: "完了",
    last_7_days: "過去7日", last_30_days: "過去30日", custom: "カスタム範囲",
    avg_daily_intake: "1日平均摂取", avg_burned: "1日平均消費", avg_bmr: "1日平均純摂取", net_intake: "純摂取",
    total_time: "総運動時間", total_steps: "総歩数", total_calories: "総消費カロリー",
    avg_weight: "平均体重", weight_change: "体重変化", avg_body_fat: "平均体脂肪率", body_fat_change: "体脂肪率変化",

    // Profile & AI
    profile: "プロフィール", ai_settings: "AI設定", basic_info: "基本情報", gender: "性別", male: "男性", female: "女性", 
    birth_date: "生年月日", height: "身長", weight: "体重", body_fat: "体脂肪率",
    target_goals: "目標設定", training_goal: "トレーニング目標", activity_level: "日常活動レベル", save_settings: "設定を保存",
    api_key_placeholder: "APIキーを貼り付けてください", get_api_key: "APIキーを取得", test_key: "キーをテスト", test_key_first: "まずAPIキーをテストしてください", current_model: "現在のモデル", language: "言語", 

    lose_weight: "減量", lose_weight_desc: "カロリー不足、脂肪燃焼に集中",
    maintain: "維持", maintain_desc: "現在の体重と体型を維持",
    gain_weight: "増量", gain_weight_desc: "カロリー過剰、筋肉増強に集中",
    recomp: "ボディリコンポジション", recomp_desc: "脂肪を減らしながら筋肉を増やす",
    blood_sugar: "血糖値コントロール", blood_sugar_desc: "血糖値の安定化",

    sedentary: "座りがち", sedentary_desc: "ほとんど運動しない",
    lightly_active: "軽度の活動", lightly_active_desc: "週1-3日",
    moderately_active: "中程度の活動", moderately_active_desc: "週3-5日",
    very_active: "高強度の活動", very_active_desc: "週6-7日",
    extra_active: "非常に活発", extra_active_desc: "肉体労働",
    target_date: "目標完了日",
    days_remaining: "残り日数",
    
    // AI Coach UI
    ai_coach: "AI コーチ", ai_welcome_msg: "こんにちは！私はあなたの専属の栄養とフィットネスアシスタントです。\n下のボタンをクリックするか、直接質問を入力してください。",
    ask_ai_placeholder: "メッセージを入力...",
    meal_suggestions: "食事の提案", workout_suggestions: "運動の提案",
    cook_meal: "自炊", store_meal: "コンビニ食",
    home_workout: "自宅トレーニング", gym_workout: "ジムトレーニング",
    remaining: "残り", daily_calorie_target: "1日の目標カロリー",
    
    // AI Coach Prompts (Dynamic)
    coach_prompt_cook: "栄養士として、私の現在の残りカロリーに適した「自炊」メニューを提供してください。以下を含めてください：1. 材料リスト 2. 詳細な調理手順 3. 推奨されるYouTube料理チュートリアルのキーワードまたはリンク。私の個人目標を考慮してください。",
    coach_prompt_store: "栄養士として、私の現在の残りカロリーに適した「コンビニ食」メニューを提供してください（例：セブンイレブンやファミリーマート）。具体的な商品名と推定カロリーをリストアップしてください。私の個人目標を考慮してください。",
    coach_prompt_home_workout: "フィットネスコーチとして、私の現在の状態に適した「自宅での器具なし」トレーニングスケジュールを提供してください。以下を含めてください：1. 運動名 2. 回数/セット数 3. 運動のポイント 4. 推奨されるYouTube運動チュートリアルのリンク。",
    coach_prompt_gym_workout: "フィットネスコーチとして、私の現在の状態に適した「ジム/器具使用」トレーニングスケジュールを提供してください。以下を含めてください：1. 器具名 2. 重量/セット数の推奨 3. 注意事項 4. 推奨されるYouTubeチュートリアルのリンク。",

    // Food Editor
    ai_analysis: "AI分析", analyzing: "分析中...", composition: "成分", suggestion: "アドバイス",
    food_name_placeholder: "食品名またはスキャン", barcode_scanned: "バーコード: ",
    local_db: "ローカルDB", loaded: "ロード済み", downloaded: "情報取得済み", read_failed: "読み込み失敗",
    scan_failed: "見つかりません", scan_failed_msg: "選択してください:",
    scan_ai_option: "ラベルをスキャン(AI)", manual_option: "手動入力",
    food_name: "食品名",  brand_placeholder: "ブランド（任意）", brand: "ブランド",
    portion: "分量設定", portion_count: "個数", unit_weight: "単位重量",
    total_weight_input: "総重量", total_label: "合計",
    switch_to_weight: "重量入力へ切替", switch_to_serving: "個数入力へ切替",
    val_per_100g: "100gあたり", data_incomplete: "データ不完全", food_modified_msg: "値が変更されました。更新しますか？",
    save_as_new: "新規保存", update_original: "上書き更新",

    //app/barcode-product.tsx
    product_not_found: "商品が見つかりません", product_not_found_msg: "以下の方法を選択できます:", unknown_product: "不明な商品",
    product_info: "商品情報", product_name: "商品名", input_serving: "分量を入力", input_gram: "グラムを入力",
    serving_unit: "分量単位" , barcode: "バーコード",

    // Activity Editor
    record_activity: "運動を記録", select_activity: "運動を選択", custom_activity: "カスタム", input_activity_name: "運動名を入力",
    activity_intensity: "強度", activity_details: "詳細", time_min: "時間 (分)", distance_km: "距離 (km)", steps: "歩数",
    floors: "階数", est_calories: "推定消費カロリー", feeling_notes: "メモ & 感想", enter_notes: "メモを入力...",
    data_incomplete_msg: "運動を選択し、少なくとも1つの値を入力してください", activity_name: "運動名", category: "カテゴリ",
    select_category_msg: "スポーツのカテゴリーを選択してください",

    cat_cardio: "有酸素", cat_gym: "ジム", cat_sport: "スポーツ", cat_life: "生活活動", cat_custom: "カスタム",
    act_walk: "ウォーキング", act_run_slow: "ジョギング", act_run_fast: "ランニング", act_cycling: "サイクリング", act_swim: "水泳", act_hike: "ハイキング", act_jump_rope: "縄跳び",
    act_weight_training: "筋トレ", act_powerlifting: "パワーリフティング", act_yoga: "ヨガ", act_pilates: "ピラティス", act_hiit: "HIIT", act_elliptical: "エリプティカル",
    act_basketball: "バスケットボール", act_badminton: "バドミントン", act_tennis: "テニス", act_soccer: "サッカー", act_baseball: "野球",
    act_housework: "家事", act_gardening: "ガーデニング", act_moving: "引越し作業",
    
    intensity_low: "低", intensity_medium: "中", intensity_high: "高",

    increase: "増加", decrease: "減少", no_change: "変化なし"
  },
  'ko': {
    // Tab Titles
    tab_home: "홈", tab_analysis: "분석", tab_ai_coach: "AI 코치", tab_settings: "설정",
    // General
    welcome: "환영합니다", save: "저장", cancel: "취소", delete: "삭제", error: "오류", success: "성공", loading: "로딩 중...",
    tip: "팁", save_success: "저장되었습니다", invalid_input: "잘못된 입력", settings: "설정", edit: "편집",
    close: "닫기", version_history: "버전 기록", how_to_get_key: "키를 얻는 방법?", input_date: "날짜 입력",
    // Backup & Restore 
    data_backup: "데이터 백업 및 복원",
    backup_db: "데이터베이스 내보내기 (백업)",
    restore_db: "데이터베이스 가져오기 (복원)",
    backup_desc: "데이터베이스 파일을 Google 드라이브 또는 로컬에 내보내기",
    restore_desc: "파일에서 데이터베이스 복원 (현재 데이터 덮어쓰기)",
    restore_confirm_title: "복원하시겠습니까?",
    restore_confirm_msg: "이 작업은 현재 기록을 완전히 덮어쓰며 복구할 수 없습니다. 올바른 백업 파일을 선택했는지 확인하세요.",
    restore_success_msg: "복원 성공! 변경 사항을 적용하려면 앱을 완전히 종료한 후 다시 시작하세요.",
    // API Guide
    api_guide_title: "Gemini API 키 발급 순서",
    api_step_1: "1. 아래 버튼을 눌러 Google AI Studio로 이동하세요.",
    api_step_2: "2. Google 계정으로 로그인하세요.",
    api_step_3: "3. 'Get API Key' 또는 'Create API Key'를 클릭하세요.",
    api_step_4: "4. 'Create API key in new project'를 선택하세요.",
    api_step_5: "5. 생성된 키를 복사하여 앱에 붙여넣으세요.",
    go_to_site: "사이트로 이동",
    // Home
    body_metrics: "신체 수치", record_metrics: "+ 기록", target_weight: "목표 체중", target_body_fat: "목표 체지방",
    intake: "섭취", burned: "소모", net_intake_pct: "순 섭취 %", intake_target: "섭취/목표", 
    quick_record: "즐겨찾기", no_recent_foods: "최근 기록 없음", exercise: "운동", quick_add_activity: "즐겨찾기 운동", today: "오늘", confirm: "확인",
    // Actions
    camera: "카메라", scan_barcode: "스캔", manual_input: "직접 입력",  gallery: "갤러리",
    scan_hint: "바코드를 사각형 안에 맞추세요",allow: "권한 허용",
    // Meals
    breakfast: "아침", lunch: "점심", dinner: "저녁", afternoon_tea: "간식", late_night: "야식", snack: "스낵", no_records: "기록 없음",
    // Nutrients
    calories: "칼로리", protein: "단백질", fat: "지방", carbs: "탄수화물", sodium: "나트륨",
    sugar: "당류", fiber: "식이섬유", saturated_fat: "포화지방", trans_fat: "트랜스지방", cholesterol: "콜레스테롤",
    zinc: "아연", magnesium: "마그네슘", iron: "철분",
    // Analysis
    trend_analysis: "데이터 분석",
    chart_title_cal: "칼로리 추세",
    chart_title_body: "체중 및 체지방 추세",
    week: "7일", month: "30일", avg_daily: "일평균",
    axis_l: "(좌)", axis_r: "(우)", analysis: "분석", total: "합계",
    pinch_to_zoom: "핀치로 확대/축소", drag_to_move: "드래그로 이동",tap_msg: "탭하여 선택/교체. X로 삭제.", done: "완료",
    last_7_days: "최근 7일", last_30_days: "최근 30일", custom: "사용자 지정 범위",
    avg_daily_intake: "일평균 섭취", avg_burned: "일평균 소모", avg_bmr: "일평균 순섭취", net_intake: "순 섭취",
    total_time: "총 운동 시간", total_steps: "총 걸음 수", total_calories: "총 칼로리 소모",
    avg_weight: "평균 체중", weight_change: "체중 변화", avg_body_fat: "평균 체지방", body_fat_change: "체지방 변화",
    // Profile & AI
    profile: "프로필", ai_settings: "AI 설정", basic_info: "기본 정보", gender: "성별", male: "남성", female: "여성",
    birth_date: "생년월일", height: "신장", weight: "체중", body_fat: "체지방 %",
    target_goals: "목표 설정", training_goal: "운동 목표", activity_level: "일상 활동 수준", save_settings: "설정 저장",
    api_key_placeholder: "API 키를 붙여넣으세요", get_api_key: "API 키 받기", test_key: "키 테스트", test_key_first: "먼저 API 키를 테스트하세요", current_model: "현재 모델", language: "언어",  
    
    lose_weight: "체중 감량", lose_weight_desc: "칼로리 적자, 지방 감소에 집중",
    maintain: "유지", maintain_desc: "현재 체중과 체형 유지",
    gain_weight: "체중 증가", gain_weight_desc: "칼로리 과잉, 근육 증가에 집중",
    recomp: "바디 리컴포지션", recomp_desc: "지방을 줄이면서 근육을 늘리기",
    blood_sugar: "혈당 조절", blood_sugar_desc: "혈당 수치 안정화",

    sedentary: "좌식 생활", sedentary_desc: "거의 운동하지 않음",
    lightly_active: "가벼운 활동", lightly_active_desc: "주 1-3일",
    moderately_active: "적당한 활동", moderately_active_desc: "주 3-5일",
    very_active: "활발한 활동", very_active_desc: "주 6-7일",
    extra_active: "매우 활발함", extra_active_desc: "육체 노동",
    target_date: "목표 완료 날짜",
    days_remaining: "남은 일수",
    

    // AI Coach UI
    ai_coach: "AI 코치", ai_welcome_msg: "안녕하세요! 저는 당신의 개인 영양 및 피트니스 어시스턴트입니다.\n아래 버튼을 클릭하거나 직접 질문을 입력하세요.",
    ask_ai_placeholder: "메시지 입력...",
    meal_suggestions: "식사 제안", workout_suggestions: "운동 제안",
    cook_meal: "요리하기", store_meal: "편의점 식사",
    home_workout: "홈 트레이닝", gym_workout: "헬스장 트레이닝",
    remaining: "남은 칼로리", daily_calorie_target: "일일 칼로리 목표",
    
    // AI Coach Prompts (Dynamic)
    coach_prompt_cook: "영양사로서, 제 현재 남은 칼로리에 맞는 '집에서 요리하는' 메뉴를 제공해 주세요. 다음을 포함해 주세요: 1. 재료 목록 2. 상세한 조리 단계 3. 추천 유튜브 요리 튜토리얼 키워드 또는 링크. 제 개인 목표를 고려해 주세요.",
    coach_prompt_store: "영양사로서, 제 현재 남은 칼로리에 맞는 '편의점 식사' 메뉴를 제공해 주세요 (예: 세븐일레븐, 패밀리마트). 구체적인 상품명과 예상 칼로리를 나열해 주세요. 제 개인 목표를 고려해 주세요.",
    coach_prompt_home_workout: "피트니스 코치로서, 제 현재 상태에 맞는 '집에서 하는 기구 없는' 운동 일정을 제공해 주세요. 다음을 포함해 주세요: 1. 운동명 2. 반복 횟수/세트 수 3. 운동의 핵심 포인트 4. 추천 유튜브 운동 튜토리얼 링크.",
    coach_prompt_gym_workout: "피트니스 코치로서, 제 현재 상태에 맞는 '헬스장/기구 사용' 운동 일정을 제공해 주세요. 다음을 포함해 주세요: 1. 기구명 2. 무게/세트 수 추천 3. 주의사항 4. 추천 유튜브 튜토리얼 링크.",
    
    // Food Editor
    ai_analysis: "AI 분석", analyzing: "분석 중...", composition: "성분", suggestion: "조언",
    food_name_placeholder: "음식명 또는 바코드", barcode_scanned: "바코드: ",
    local_db: "로컬 DB", loaded: "로드됨", downloaded: "다운로드됨", read_failed: "읽기 실패",
    scan_failed: "없음", scan_failed_msg: "선택하세요:",
    scan_ai_option: "라벨 스캔 (AI)", manual_option: "직접 입력",
    food_name: "음식명", brand_placeholder: "브랜드 (선택)", brand: "브랜드",
    portion: "분량 설정", portion_count: "수량", unit_weight: "단위 중량",
    total_weight_input: "총 중량", total_label: "합계",
    switch_to_weight: "총 중량 입력", switch_to_serving: "수량 입력",
    val_per_100g: "100g 당", data_incomplete: "데이터 불충분", food_modified_msg: "값이 변경되었습니다. 원본을 업데이트할까요?",
    save_as_new: "새로 저장", update_original: "원본 업데이트",

    //app/barcode-product.tsx
    product_not_found: "상품을 찾을 수 없습니다", product_not_found_msg: "다음 옵션 중 선택할 수 있습니다:", unknown_product: "알 수 없는 상품",
    product_info: "상품 정보", product_name: "상품명", input_serving: "분량 입력", input_gram: "그램 입력",
    serving_unit: "분량 단위" , barcode: "바코드",

    // Activity Editor
    record_activity: "운동 기록", select_activity: "운동 선택", custom_activity: "직접 입력", input_activity_name: "운동명 입력",
    activity_intensity: "강도", activity_details: "상세 정보", time_min: "시간 (분)", distance_km: "거리 (km)", steps: "걸음 수",
    floors: "층", est_calories: "예상 칼로리", feeling_notes: "메모 & 느낌", enter_notes: "메모 입력...",
    data_incomplete_msg: "운동을 선택하고 값을 입력하세요", activity_name: "운동명", category: "카테고리",
    select_category_msg: "스포츠 카테고리를 선택해 주세요.",

    cat_cardio: "유산소", cat_gym: "헬스장", cat_sport: "스포츠", cat_life: "생활", cat_custom: "직접 입력",
    act_walk: "걷기", act_run_slow: "조깅", act_run_fast: "달리기", act_cycling: "자전거", act_swim: "수영", act_hike: "등산", act_jump_rope: "줄넘기",
    act_weight_training: "웨이트 트레이닝", act_powerlifting: "파워리프팅", act_yoga: "요가", act_pilates: "필라테스", act_hiit: "HIIT", act_elliptical: "일립티컬",
    act_basketball: "농구", act_badminton: "배드민턴", act_tennis: "테니스", act_soccer: "축구", act_baseball: "야구",
    act_housework: "집안일", act_gardening: "정원 가꾸기", act_moving: "이사/운반",
    
    intensity_low: "저", intensity_medium: "중", intensity_high: "고",
    
    increase: "증가", decrease: "감소", no_change: "변화 없음"
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

const LOGS_ZH = [
  {
    version: "V1.0.12",
    date: "2026-01-06",
    content: "[新增] 分析頁面統計方塊支援自由排序、新增與刪除 (長按進入編輯模式)。\n[升級] 分析圖表整合雙軸顯示 (熱量/體重/體脂)，支援「自訂區間」與自動縮放適配螢幕。\n[新增] 首頁「常用運動」快捷鍵；客製化月曆支援鍵盤輸入日期與淨熱量預覽。\n[修正] 修復備份還原邏輯 (含運動紀錄) 及部分 UI 顯示問題。"
  },
  {
    version: "V1.0.11",
    date: "2026-01-05",
    content: "[新增] 數據備份與還原功能 (JSON 格式，支援跨裝置)。\n[優化] 分析圖表升級：雙軸顯示體重與熱量，自動聚焦最新日期。\n[優化] AI 教練：新增剩餘熱量儀表板，提供分類明確的菜單與運動建議 (附影片連結)。\n[修正] 統一食品編輯介面，修復掃碼流程中斷問題。"
  },
  {
    version: "V1.0.10",
    date: "2025-12-30",
    content: "[新增] 資料庫備份與還原功能 (支援 Google Drive)。\n[修正] 分析圖表完全對齊，修復切換週期不聚焦問題。\n[修正] 首頁圓餅圖可顯示超過 100% 之數值。"
  },
  {
    version: "V1.0.9.10",
    date: "2025-12-30",
    content: "[修正] 運動紀錄支援編輯與更新。\n[修正] 分析圖表完全對齊，支援滑動查看30天數據，並自動聚焦最新日期。\n[修正] 體重折線圖資料靠左與消失問題修復。\n[新增] 支援日語與韓語介面。"
  },
  {
    version: "V1.0.9",
    date: "2025-12-29",
    content: "[新增] AI 教練支援互動對話與追問功能。\n[新增] 分析圖表升級：支援 7/30 天切換與詳細統計表。\n[新增] 食物編輯頁面顯示 AI 分析組成與建議。\n[修正] 相機裁切框可自由調整長寬。\n[修正] 全介面支援多語言切換。"
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

const LOGS_EN = [
  {
    version: "V1.0.12",
    date: "2026-01-06",
    content: "[New] Analysis Stats: Customizable grid (Sort/Add/Delete). [New] Analysis Chart: Auto-fit dual-axis view with Custom Date Range support.\n[New] Home: Quick Activity Shortcuts & Custom Calendar (with Keyboard input).\n[Fix] Fixed Backup/Restore logic and minor UI glitches."
  },
  {
    version: "V1.0.11",
    date: "2026-01-05",
    content: "[New] Backup & Restore via JSON (Cross-device support).\n[Imp] Analysis Chart: Dual-axis for weight/calories, auto-scroll to latest date.\n[Imp] AI Coach: Added calorie dashboard and categorized suggestions with video links.\n[Fix] Unified food editor interface and fixed barcode flow issues."
  },
  {
    version: "V1.0.10",
    date: "2025-12-30",
    content: "[New] Return to the original location (support Google Drive).\n[Fix] Analysis charts perfectly aligned, fixed focus issue when switching periods.\n[Fix] Home pie chart can display values over 100%."
  },
  {
    version: "V1.0.9.10",
    date: "2025-12-30",
    content: "[Fix] Activity logs now support edit/update.\n[Fix] Analysis charts perfectly aligned, support scrolling for 30-day view, and auto-focus on latest date.\n[Fix] Weight line chart alignment issues resolved.\n[New] Added Japanese and Korean language support."
  },
  {
    version: "V1.0.9",
    date: "2025-12-29",
    content: "[New] AI Coach now supports interactive chat and follow-up questions.\n[New] Analysis charts upgraded: 7/30 days switch, detailed statistics.\n[New] Food Editor displays AI analysis composition and suggestions.\n[Fix] Camera crop frame is now adjustable.\n[Fix] Multi-language support for all UI elements."
  }
  , { version: '1.0.8', date: '2025-12-24', content: 'Full multi-language support (including AI); Added API Key application link; Optimized camera UI and scanning process; Expanded database fields.' },
  { version: '1.0.7', date: '2025-12-23', content: 'Optimized editing interface (support portion adjustment); Fixed camera and AI model issues; Strengthened scanning and saving mechanism.' },
  { version: '1.0.6', date: '2025-12-23', content: 'Added training goals and age calculation; Enhanced AI Coach suggestion logic; Optimized scanning function (support external database query); Food confirmation page revamped (separated baseline values).' },
  { version: '1.0.5', date: '2025-12-22', content: 'Fixed crash issues caused by notifications; Optimized exercise calorie calculation formula; Added nutrient intake ratio chart.' },
  { version: '1.0.4', date: '2025-12-21', content: 'UI/UX comprehensive optimization: Resolved language switching delay issues; Added album import function; AI coach suggestions stored separately; Sodium content unit corrected.' },
  { version: '1.0.3', date: '2025-12-20', content: 'Added multi-language support; Added body fat percentage record; Trend analysis added year/month/week switch; AI logic optimization.' },
  { version: '1.0.2', date: '2025-12-18', content: 'Fixed AI key invalidation issue, opened custom Key; Fixed barcode scanning; Optimized trend charts.' },
  { version: '1.0.1', date: '2025-12-15', content: 'Basic features released: Diet recording, calorie calculation, personal profile, AI recognition, barcode scanning.' },
];

const LOGS_JP = [
  {
    version: "V1.0.12",
    date: "2026-01-06",
    content: "[新機能] 分析ページの統計ボックスで、自由に並べ替え、追加、削除できるようになりました（長押しで編集モードに移行します）。[アップグレード] 分析チャートに2軸表示（カロリー/体重/体脂肪）が統合され、「カスタム間隔」とさまざまな画面サイズに適応する自動スケーリングがサポートされるようになりました。[新機能] ホームページの「よく使うエクササイズ」ショートカット。カスタマイズされたカレンダーで、日付と正味カロリーのプレビューにキーボード入力がサポートされます。[修正] バックアップと復元ロジック（エクササイズ記録を含む）と一部のUI表示の問題を修正しました。",
  },
  {
    version: "V1.0.11",
    date: "2026-01-05",
    content: "[新機能] データのバックアップと復元機能（JSON形式、デバイス間のサポート）。[最適化] 分析チャートのアップグレード：体重とカロリーの2軸表示、最新の日付に自動的にフォーカスします。[最適化] AIコーチ：カロリーダッシュボードを追加し、明確に分類されたメニューと運動の提案を提供します（ビデオリンク付き）。[修正] 食品編集インターフェースを統一し、スキャンフローの中断問題を修正しました。",
  },
  {
    version: "V1.0.10",
    date: "2025-12-30",
    content: "[新機能] データベースのバックアップと復元機能（Googleドライブをサポート）。[修正] 分析チャートが完全に整列され、期間切り替え時のフォーカス問題を修正しました。[修正] ホームの円グラフが100％を超える値を表示できるようになりました。",
  },
  {
    version: "V1.0.9.10",
    date: "2025-12-30",
    content: "[修正] 運動記録が編集と更新をサポートするようになりました。[修正] 分析チャートが完全に整列され、30日間のビューのスクロールをサポートし、最新の日付に自動的にフォーカスします。[修正] 体重折れ線グラフの配置問題が解決されました。[新機能] 日本語と韓国語のインターフェースサポートが追加されました。",
  },
  {
    version: "V1.0.9",
    date: "2025-12-29",
    content: "[新機能] AIコーチがインタラクティブなチャットとフォローアップの質問をサポートするようになりました。[新機能] 分析チャートのアップグレード：7/30日切り替え、詳細な統計。[新機能] 食品編集ページにAI分析の構成と提案が表示されます。[修正] カメラのクロップフレームが調整可能になりました。[修正] すべてのUI要素で多言語サポートが提供されるようになりました。",
  },
  { version: '1.0.8', date: '2025-12-24', content: '完全な多言語サポート（AI を含む）、API キー アプリケーション リンクの追加、カメラ UI と QR コード スキャン プロセスの最適化、データベース フィールドの拡張。' },
  { version: '1.0.7', date: '2025-12-23', content: '編集インターフェースの最適化（ポーション調整をサポート）、カメラと AI モデルの問題の修正、スキャンと保存メカニズムの強化。' },
  { version: '1.0.6', date: '2025-12-23', content: 'トレーニング目標と年齢計算の追加、AI コーチの提案ロジックの強化、スキャン機能の最適化（外部データベース クエリをサポート）、食品確認ページの刷新（基準値の分離）。' },
  { version: '1.0.5', date: '2025-12-22', content: '通知によるクラッシュ問題の修正、運動カロリー計算式の最適化、栄養素摂取比率チャートの追加。' },
  { version: '1.0.4', date: '2025-12-21', content: 'UI/UX の包括的な最適化: 言語切り替えの遅延問題の解決、アルバムインポート機能の追加、AI コーチの提案を別々に保存、ナトリウム含有量の単位を修正。' },
  { version: '1.0.3', date: '2025-12-20', content: '多言語サポートの追加、体脂肪率記録の追加、傾向分析に年/月/週の切り替えを追加、AI ロジックの最適化。' },
  { version: '1.0.2', date: '2025-12-18', content: 'AI キーの無効化問題を修正し、カスタム キーを開放。バーコード スキャンを修正。傾向チャートを最適化。' },
  { version: '1.0.1', date: '2025-12-15', content: '基本機能のリリース: 食事記録、カロリー計算、個人プロフィール、AI 認識、バーコード スキャン。' },
];

const LOGS_KO = [
  {
    version: "V1.0.12",
    date: "2026-01-06",
    content: "[신규] 분석 페이지 통계 상자에서 자유롭게 정렬, 추가, 삭제 가능 (길게 눌러 편집 모드로 전환). [업그레이드] 분석 차트에 2축 표시(칼로리/체중/체지방) 통합, 다양한 화면 크기에 적응하는 자동 스케일링 지원. [신규] 홈 페이지의 '자주 사용하는 운동' 바로가기. 맞춤형 달력에서 날짜 및 순 칼로리 미리보기에 키보드 입력 지원. [수정] 백업 및 복원 로직(운동 기록 포함) 및 일부 UI 표시 문제 수정."
  },
  {
    version: "V1.0.11",
    date: "2026-01-05",
    content: "[신규] JSON 형식의 데이터 백업 및 복원 기능(장치 간 지원). [최적화] 분석 차트 업그레이드: 체중 및 칼로리 2축 표시, 최신 날짜에 자동 포커스. [최적화] AI 코치: 칼로리 대시보드 추가 및 명확하게 분류된 메뉴와 운동 제안 제공(비디오 링크 포함). [수정] 식품 편집 인터페이스 통합 및 스캔 흐름 중단 문제 수정."
  },
  {
    version: "V1.0.10",
    date: "2025-12-30",
    content: "[신규] 데이터베이스 백업 및 복원 기능 (Google Drive 지원). [수정] 분석 차트가 완전히 정렬되고, 주기 전환 시 포커스 문제 수정. [수정] 홈 페이지 원형 차트가 100%를 초과하는 값을 표시할 수 있도록 수정."
  },
  {
    version: "V1.0.9.10",
    date: "2025-12-30",
    content: "[수정] 운동 기록이 편집 및 업데이트를 지원하도록 수정.\n[수정] 분석 차트가 완전히 정렬되고, 30일 보기의 스크롤을 지원하며, 최신 날짜에 자동 포커스.\n[수정] 체중 선 그래프의 배치 문제 해결.\n[신규] 일본어와 한국어 인터페이스 지원."
  },
  {
    version: "V1.0.9",
    date: "2025-12-29",
    content: "[신규] AI 코치가 대화형 채팅과 후속 질문을 지원하도록 수정.\n[신규] 분석 차트 업그레이드: 7/30일 전환, 상세 통계.\n[신규] 식품 편집 페이지에 AI 분석 구성 및 제안 표시.\n[수정] 카메라 자르기 프레임이 조정 가능하도록 수정.\n[수정] 모든 UI 요소에 다국어 지원 제공."
  },
  { version: '1.0.8', date: '2025-12-24', content: '전면 다국어 지원(IA 포함)；API Key 신청 링크 추가；카메라 UI 및 QR 코드 스캔 프로세스 최적화；데이터베이스 필드 확장。' },
  { version: '1.0.7', date: '2025-12-23', content: '편집 인터페이스 최적화(분량 조정 지원)；카메라 및 AI 모델 문제 수정；스캔 및 저장 메커니즘 강화。' },
  { version: '1.0.6', date: '2025-12-23', content: '트레이닝 목표 및 나이 계산 추가；AI 코치 제안 로직 강화；스캔 기능 최적화(외부 데이터베이스 쿼리 지원)；음식 확인 페이지 리뉴얼(기준치 분리)。' },
  { version: '1.0.5', date: '2025-12-22', content: '알림으로 인한 충돌 문제 수정；운동 칼로리 계산식 최적화；영양소 섭취 비율 차트 추가。' },
  { version: '1.0.4', date: '2025-12-21', content: 'UI/UX 전면 최적화: 언어 전환 지연 문제 해결, 앨범 가져오기 기능 추가, AI 코치 제안 별도 저장, 나트륨 함량 단위 수정。' },
  { version: '1.0.3', date: '2025-12-20', content: '전면 다국어 지원(IA 포함)；API Key 신청 링크 추가；카메라 UI 및 QR 코드 스캔 프로세스 최적화；데이터베이스 필드 확장。' },
  { version: '1.0.2', date: '2025-12-18', content: 'AI 키의 유효성 문제 수정 및 사용자 정의 키 해제；바코드 스캔 기능 수정；트렌드 차트 최적화。' },
  { version: '1.0.1', date: '2025-12-15', content: '기본 기능 출시：식사 기록、칼로리 계산、개인 프로필、AI 인식、바코드 스캔。' },
];

export const getVersionLogs = (lang: string) => {
    return lang === 'zh-TW' ? LOGS_ZH : lang === 'ja' ? LOGS_JP : lang === 'ko' ? LOGS_KO : LOGS_EN;
};
