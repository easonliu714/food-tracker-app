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
    close: "關閉", version_history: "改版履歷", how_to_get_key: "如何取得 Key?",
    
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
    quick_record: "常用食物", no_recent_foods: "暫無常用紀錄", exercise: "運動",
    
    // Actions
    camera: "拍照", scan_barcode: "掃碼", manual_input: "手輸", 
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
    ai_settings: "AI 設定", basic_info: "基本資料", gender: "性別", male: "男", female: "女", prifile: "個人資料",
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
    target_date: "預計完成日",
    days_remaining: "剩餘天數",

    ai_coach: "AI 教練", ai_hello: "嗨! 我是你的營養師暨訓練員.", remaining_budget: "今日剩餘熱量", generate_plan: "生成計畫",
    recipe_suggestion: "食譜建議", workout_suggestion: "運動建議", ask_ai: "詢問 AI...",
    ask_recipe: "今天有什麼建議菜單？", ask_workout: "今天有什麼建議的訓練？",
    follow_up_1: "這餐適合運動後吃嗎？", follow_up_2: "如何調整更健康？", follow_up_3: "推薦的搭配飲料？",
    
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

    // Activity Editor
    record_activity: "紀錄運動", select_activity: "選擇運動", custom_activity: "自訂運動", input_activity_name: "輸入運動名稱",
    activity_intensity: "運動強度", activity_details: "詳細數據", time_min: "時間 (分鐘)", distance_km: "距離 (km)", steps: "步數",
    floors: "樓層", est_calories: "預估消耗熱量", feeling_notes: "運動感受 & 筆記", enter_notes: "輸入筆記...",
    data_incomplete_msg: "請選擇運動項目，並至少輸入一項數據", activity_name: "運動名稱", category: "分類",
    
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
    tip: "Tip", save_success: "Saved successfully", invalid_input: "Invalid input", settings: "Settings", edit: "Edit",

    data_backup: "Backup & Restore",
    backup_db: "Export DB (Backup)",
    restore_db: "Import DB (Restore)",
    backup_desc: "Export database to Google Drive or local files",
    restore_desc: "Restore database from file (Overwrites current data)",
    restore_confirm_title: "Confirm Restore?",
    restore_confirm_msg: "This will overwrite all current data and cannot be undone. Please ensure you selected the correct backup file.",
    restore_success_msg: "Restore successful! Please restart the App to apply changes.",

    api_guide_title: "How to get Gemini API Key",
    api_step_1: "1. Click button below to go to Google AI Studio.",
    api_step_2: "2. Sign in with your Google account.",
    api_step_3: "3. Click 'Get API Key' or 'Create API Key'.",
    api_step_4: "4. Select 'Create API key in new project'.",
    api_step_5: "5. Copy the key and paste it here.",
    go_to_site: "Go to Website",

    body_metrics: "Body Metrics", record_metrics: "+ Record", target_weight: "Target Weight", target_body_fat: "Target Body Fat",
    intake: "Intake", burned: "Burned", net_intake_pct: "Net Intake %", intake_target: "Intake/Target", 
    quick_record: "Quick Add", no_recent_foods: "No recent records", exercise: "Exercise",
    
    camera: "Camera", scan_barcode: "Scan Code", manual_input: "Manual", 
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
    
    ai_settings: "AI Settings", basic_info: "Basic Info", gender: "Gender", male: "Male", female: "Female", prifile: "Profile",
    birth_date: "Birth Date", height: "Height", weight: "Weight(kg)", body_fat: "Body Fat(%)",
    target_goals: "Targets", training_goal: "Goal", activity_level: "Activity Level", save_settings: "Save Settings",
    api_key_placeholder: "Paste API Key", get_api_key: "Get API Key", how_to_get_key:"How to obtain the API Key？", test_key: "Test Key", test_key_first: "Test Key First", current_model: "Model", language: "Language", version_history: "Version History",
    
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
    target_date: "Target Date",
    days_remaining: "Days Remaining",

    ai_coach: "AI Coach", ai_hello: "Hi! I am your AI Coach.", remaining_budget: "Remaining", generate_plan: "Generate Plan",
    recipe_suggestion: "Recipe Suggestion", workout_suggestion: "Workout Suggestion", ask_ai: "Ask AI...",
    ask_recipe: "Suggest a meal plan?", ask_workout: "Suggest a workout?",
    follow_up_1: "Good for post-workout?", follow_up_2: "How to make it healthier?", follow_up_3: "Best drink pairing?",
    
    ai_analysis: "AI Analysis", analyzing: "Analyzing...", composition: "Composition", suggestion: "Suggestion",
    food_name_placeholder: "Enter name", barcode_scanned: "Barcode: ",
    local_db: "Local DB", loaded: "Loaded", downloaded: "Downloaded", read_failed: "Read Failed",
    scan_failed: "Not Found", scan_failed_msg: "Choose option:",
    scan_ai_option: "Scan Label (AI)", manual_option: "Manual",
    food_name: "Food Name", brand_placeholder: "Brand (Optional)", brand: "Brand",
    portion: "Portion", portion_count: "Count", unit_weight: "Unit Weight",
    total_weight_input: "Total Weight", total_label: "Total",
    switch_to_weight: "Switch to Total", switch_to_serving: "Switch to Servings",
    val_per_100g: "Per 100g", data_incomplete: "Incomplete Data", food_modified_msg: "Values changed. Update original item?",
    save_as_new: "Save as New", update_original: "Update Original",

    record_activity: "Record Activity", select_activity: "Select Activity", custom_activity: "Custom", input_activity_name: "Enter Activity Name",
    activity_intensity: "Intensity", activity_details: "Details", time_min: "Time (min)", distance_km: "Distance (km)", steps: "Steps",
    floors: "Floors", est_calories: "Est. Calories", feeling_notes: "Notes & Feeling", enter_notes: "Enter notes...",
    data_incomplete_msg: "Please select activity and enter at least one value.", activity_name: "Activity Name", category: "Category",

    cat_cardio: "Cardio", cat_gym: "Gym", cat_sport: "Sport", cat_life: "Life", cat_custom: "Custom",
    act_walk: "Walking", act_run_slow: "Jogging", act_run_fast: "Running", act_cycling: "Cycling", act_swim: "Swimming", act_hike: "Hiking", act_jump_rope: "Jump Rope",
    act_weight_training: "Weight Training", act_powerlifting: "Powerlifting", act_yoga: "Yoga", act_pilates: "Pilates", act_hiit: "HIIT", act_elliptical: "Elliptical",
    act_basketball: "Basketball", act_badminton: "Badminton", act_tennis: "Tennis", act_soccer: "Soccer", act_baseball: "Baseball",
    act_housework: "Housework", act_gardening: "Gardening", act_moving: "Moving",
    
    intensity_low: "Low", intensity_medium: "Medium", intensity_high: "High",
    
    increase: "Inc", decrease: "Dec", no_change: "-"
  },
  'ja': {
    tab_home: "ホーム", tab_analysis: "分析", tab_ai_coach: "AIコーチ", tab_settings: "設定",
    welcome: "ようこそ", save: "保存", cancel: "キャンセル", delete: "削除", error: "エラー", success: "成功", loading: "読み込み中...",
    tip: "ヒント", save_success: "保存しました", invalid_input: "無効な入力", settings: "設定", edit: "編集",

    data_backup: "データバックアップ",
    backup_db: "DBをエクスポート",
    restore_db: "DBをインポート",
    backup_desc: "データベースをGoogleドライブまたはローカルに保存",
    restore_desc: "ファイルから復元 (現在のデータは上書きされます)",
    restore_confirm_title: "復元しますか？",
    restore_confirm_msg: "現在のデータは完全に上書きされ、元に戻すことはできません。",
    restore_success_msg: "復元しました！アプリを再起動してください。",
    
    api_guide_title: "Gemini APIキーの取得手順",
    api_step_1: "1. 下のボタンをクリックしてGoogle AI Studioへ移動します。",
    api_step_2: "2. Googleアカウントでログインします。",
    api_step_3: "3. 'Get API Key' または 'Create API Key' をクリックします。",
    api_step_4: "4. 'Create API key in new project' を選択します。",
    api_step_5: "5. 生成されたキーをコピーしてアプリに貼り付けます。",
    go_to_site: "サイトへ移動",

    body_metrics: "身体測定", record_metrics: "+ 記録", target_weight: "目標体重", target_body_fat: "目標体脂肪率",
    intake: "摂取", burned: "消費", net_intake_pct: "純摂取 %", intake_target: "摂取/目標", 
    quick_record: "よく食べる物", no_recent_foods: "履歴なし", exercise: "運動",
    
    camera: "カメラ", scan_barcode: "スキャン", manual_input: "手入力", 
    scan_hint: "バーコードを枠に合わせてください",
    
    breakfast: "朝食", lunch: "昼食", dinner: "夕食", afternoon_tea: "間食", late_night: "夜食", snack: "スナック", no_records: "記録なし",
    
    calories: "カロリー", protein: "タンパク質", fat: "脂質", carbs: "炭水化物", sodium: "ナトリウム",
    sugar: "糖質", fiber: "食物繊維", saturated_fat: "飽和脂肪酸", trans_fat: "トランス脂肪酸", cholesterol: "コレステロール",
    zinc: "亜鉛", magnesium: "マグネシウム", iron: "鉄",

    trend_analysis: "データ分析",
    chart_title_cal: "カロリー収支",
    chart_title_body: "体重と体脂肪率",
    week: "7日間", month: "30日間", avg_daily: "日平均",
    axis_l: "(左)", axis_r: "(右)",

    ai_settings: "AI設定", basic_info: "基本情報", gender: "性別", male: "男性", female: "女性", prifile: "プロフィール",
    birth_date: "生年月日", height: "身長", weight: "体重(kg)", body_fat: "体脂肪率(%)",
    target_goals: "目標設定", training_goal: "トレーニング目標", activity_level: "活動レベル", save_settings: "設定を保存",
    api_key_placeholder: "API Keyを入力", how_to_get_key:"API Keyはどうやって取得しますか？",
    get_api_key: "API Keyを取得", test_key: "キーをテスト", test_key_first: "先にキーをテストしてください", current_model: "モデル", language: "言語", version_history: "バージョン履歴",
    
    lose_weight: "減量", maintain: "維持", gain_weight: "増量", recomp: "ボディメイク", blood_sugar: "血糖値管理",
    lose_weight_desc: "カロリー制限", maintain_desc: "体重維持", gain_weight_desc: "筋肉増強", recomp_desc: "除脂肪と増筋", blood_sugar_desc: "血糖値安定",

    sedentary: "ほぼ座りっぱなし", lightly_active: "軽い運動", moderately_active: "中程度の運動", very_active: "活発な運動", extra_active: "非常に活発",
    sedentary_desc: "運動しない", lightly_active_desc: "週1-3日", moderately_active_desc: "週3-5日", very_active_desc: "週6-7日", extra_active_desc: "肉体労働など",
    target_date: "目標達成日",
    days_remaining: "残り日数",

    ai_coach: "AIコーチ", ai_hello: "こんにちは！AI栄養トレーナーです。", remaining_budget: "残りのカロリー", generate_plan: "プラン作成",
    recipe_suggestion: "レシピ提案", workout_suggestion: "運動提案", ask_ai: "AIに質問...",
    ask_recipe: "おすすめのメニューは？", ask_workout: "おすすめの運動は？",
    follow_up_1: "運動後に適していますか？", follow_up_2: "より健康的にするには？", follow_up_3: "おすすめの飲み物は？",
    
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

    record_activity: "運動を記録", select_activity: "運動を選択", custom_activity: "カスタム", input_activity_name: "運動名を入力",
    activity_intensity: "強度", activity_details: "詳細", time_min: "時間 (分)", distance_km: "距離 (km)", steps: "歩数",
    floors: "階数", est_calories: "推定消費カロリー", feeling_notes: "メモ & 感想", enter_notes: "メモを入力...",
    data_incomplete_msg: "運動を選択し、少なくとも1つの値を入力してください", activity_name: "運動名", category: "カテゴリ",

    cat_cardio: "有酸素", cat_gym: "ジム", cat_sport: "スポーツ", cat_life: "生活活動", cat_custom: "カスタム",
    act_walk: "ウォーキング", act_run_slow: "ジョギング", act_run_fast: "ランニング", act_cycling: "サイクリング", act_swim: "水泳", act_hike: "ハイキング", act_jump_rope: "縄跳び",
    act_weight_training: "筋トレ", act_powerlifting: "パワーリフティング", act_yoga: "ヨガ", act_pilates: "ピラティス", act_hiit: "HIIT", act_elliptical: "エリプティカル",
    act_basketball: "バスケットボール", act_badminton: "バドミントン", act_tennis: "テニス", act_soccer: "サッカー", act_baseball: "野球",
    act_housework: "家事", act_gardening: "ガーデニング", act_moving: "引越し作業",
    
    intensity_low: "低", intensity_medium: "中", intensity_high: "高"
  },
  'ko': {
    tab_home: "홈", tab_analysis: "분석", tab_ai_coach: "AI 코치", tab_settings: "설정",
    welcome: "환영합니다", save: "저장", cancel: "취소", delete: "삭제", error: "오류", success: "성공", loading: "로딩 중...",
    tip: "팁", save_success: "저장되었습니다", invalid_input: "잘못된 입력", settings: "설정", edit: "편집",

    data_backup: "데이터 백업 및 복원",
    backup_db: "데이터베이스 내보내기 (백업)",
    restore_db: "데이터베이스 가져오기 (복원)",
    backup_desc: "데이터베이스 파일을 Google 드라이브 또는 로컬에 내보내기",
    restore_desc: "파일에서 데이터베이스 복원 (현재 데이터 덮어쓰기)",
    restore_confirm_title: "복원하시겠습니까?",
    restore_confirm_msg: "이 작업은 현재 기록을 완전히 덮어쓰며 복구할 수 없습니다. 올바른 백업 파일을 선택했는지 확인하세요.",
    restore_success_msg: "복원 성공! 변경 사항을 적용하려면 앱을 완전히 종료한 후 다시 시작하세요.",
    
    api_guide_title: "Gemini API 키 발급 순서",
    api_step_1: "1. 아래 버튼을 눌러 Google AI Studio로 이동하세요.",
    api_step_2: "2. Google 계정으로 로그인하세요.",
    api_step_3: "3. 'Get API Key' 또는 'Create API Key'를 클릭하세요.",
    api_step_4: "4. 'Create API key in new project'를 선택하세요.",
    api_step_5: "5. 생성된 키를 복사하여 앱에 붙여넣으세요.",
    go_to_site: "사이트로 이동",

    body_metrics: "신체 수치", record_metrics: "+ 기록", target_weight: "목표 체중", target_body_fat: "목표 체지방",
    intake: "섭취", burned: "소모", net_intake_pct: "순 섭취 %", intake_target: "섭취/목표", 
    quick_record: "즐겨찾기", no_recent_foods: "최근 기록 없음", exercise: "운동",
    
    camera: "카메라", scan_barcode: "스캔", manual_input: "직접 입력", 
    scan_hint: "바코드를 사각형 안에 맞추세요",
    
    breakfast: "아침", lunch: "점심", dinner: "저녁", afternoon_tea: "간식", late_night: "야식", snack: "스낵", no_records: "기록 없음",
    
    calories: "칼로리", protein: "단백질", fat: "지방", carbs: "탄수화물", sodium: "나트륨",
    sugar: "당류", fiber: "식이섬유", saturated_fat: "포화지방", trans_fat: "트랜스지방", cholesterol: "콜레스테롤",
    zinc: "아연", magnesium: "마그네슘", iron: "철분",

    trend_analysis: "데이터 분석",
    chart_title_cal: "칼로리 추세",
    chart_title_body: "체중 및 체지방 추세",
    week: "7일", month: "30일", avg_daily: "일평균",
    axis_l: "(좌)", axis_r: "(우)",

    ai_settings: "AI 설정", basic_info: "기본 정보", gender: "성별", male: "남성", female: "여성", prifile: "프로필",
    birth_date: "생년월일", height: "키", weight: "체중(kg)", body_fat: "체지방률(%)",
    target_goals: "목표 설정", training_goal: "훈련 목표", activity_level: "활동 수준", save_settings: "설정 저장",
    api_key_placeholder: "API Key 입력", how_to_get_key:"API Key는 어떻게 얻나요?",
    get_api_key: "API Key 받기", test_key: "키 테스트", test_key_first: "키를 먼저 테스트하세요", current_model: "모델", language: "언어", version_history: "버전 기록",
    
    lose_weight: "체중 감량", maintain: "유지", gain_weight: "체중 증량", recomp: "린매스업", blood_sugar: "혈당 관리",
    lose_weight_desc: "칼로리 제한", maintain_desc: "체중 유지", gain_weight_desc: "근육 증가", recomp_desc: "체지방 감소/근육 증가", blood_sugar_desc: "혈당 안정",

    sedentary: "활동 적음", lightly_active: "가벼운 활동", moderately_active: "보통 활동", very_active: "활발한 활동", extra_active: "매우 활발",
    sedentary_desc: "운동 안 함", lightly_active_desc: "주 1-3일", moderately_active_desc: "주 3-5일", very_active_desc: "주 6-7일", extra_active_desc: "육체 노동",
    target_date: "목표 완료일",
    days_remaining: "남은 일수",
    
    ai_coach: "AI 코치", ai_hello: "안녕하세요! AI 영양 코치입니다.", remaining_budget: "남은 칼로리", generate_plan: "계획 생성",
    recipe_suggestion: "식단 추천", workout_suggestion: "운동 추천", ask_ai: "AI에게 질문...",
    ask_recipe: "추천 메뉴가 있나요?", ask_workout: "추천 운동이 있나요?",
    follow_up_1: "운동 후에 먹어도 되나요?", follow_up_2: "더 건강하게 먹으려면?", follow_up_3: "어울리는 음료는?",
    
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

    record_activity: "운동 기록", select_activity: "운동 선택", custom_activity: "직접 입력", input_activity_name: "운동명 입력",
    activity_intensity: "강도", activity_details: "상세 정보", time_min: "시간 (분)", distance_km: "거리 (km)", steps: "걸음 수",
    floors: "층", est_calories: "예상 칼로리", feeling_notes: "메모 & 느낌", enter_notes: "메모 입력...",
    data_incomplete_msg: "운동을 선택하고 값을 입력하세요", activity_name: "운동명", category: "카테고리",

    cat_cardio: "유산소", cat_gym: "헬스장", cat_sport: "스포츠", cat_life: "생활", cat_custom: "직접 입력",
    act_walk: "걷기", act_run_slow: "조깅", act_run_fast: "달리기", act_cycling: "자전거", act_swim: "수영", act_hike: "등산", act_jump_rope: "줄넘기",
    act_weight_training: "웨이트 트레이닝", act_powerlifting: "파워리프팅", act_yoga: "요가", act_pilates: "필라테스", act_hiit: "HIIT", act_elliptical: "일립티컬",
    act_basketball: "농구", act_badminton: "배드민턴", act_tennis: "테니스", act_soccer: "축구", act_baseball: "야구",
    act_housework: "집안일", act_gardening: "정원 가꾸기", act_moving: "이사/운반",
    
    intensity_low: "저", intensity_medium: "중", intensity_high: "고"
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
    version: "V1.0.9.14",
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
    version: "V1.0.9.14",
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
];

export const getVersionLogs = (lang: string) => {
    return lang === 'zh-TW' ? LOGS_ZH : LOGS_EN;
};