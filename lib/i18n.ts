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
    tab_home: '首頁', tab_analysis: '分析', tab_ai_coach: 'AI教練', tab_settings: '設定',
    activity_level: '活動量', sedentary: '久坐 (x1.2)', lightly_active: '輕度 (x1.375)', moderately_active: '中度 (x1.55)', very_active: '高度 (x1.725)', extra_active: '極度 (x1.9)',
    gender: '性別', male: '男', female: '女', birth_year: '出生年', height: '身高(cm)', weight: '體重(kg)', body_fat: '體脂率(%)', target_weight: '目標(kg)',
    goal: '目標', lose_weight: '減重', maintain: '維持', gain_weight: '增重', daily_target: '每日目標', save_settings: '儲存設定', logout: '登出',
    version_history: '版次歷程', ai_settings: 'AI 設定', current_model: '目前使用模型', test_key: '測試並取得模型', api_key_placeholder: '請貼上您的 API Key',
    trend_analysis: '趨勢分析', intake: '攝取', burned: '消耗', protein: '蛋白質', carbs: '碳水', fat: '脂肪', sodium: '鈉',
    week: '周', month_day: '月(日)', month_week: '月(週)', year: '年',
    manual_input: '手輸', photo: '拍照', scan: '掃碼', workout: '運動', today_overview: '今日概覽', quick_record: '快速紀錄', no_record: '尚無紀錄',
    ai_coach: 'AI 智能教練', recipe_suggestion: '食譜建議', workout_suggestion: '運動建議', generate_plan: '生成計畫', remaining_budget: '目前剩餘額度',
    watch_video: '觀看教學影片', ingredients: '食材', steps: '步驟', reason: '建議原因', estimated_weight: '估計重量 (g)', confirm_save: '確認並儲存',
    food_name: '食物名稱', calories: '熱量', suggestion_limit: '每日建議攝取量', alert_over: '超過建議值',
    export_pdf: '匯出 PDF', edit: '編輯', delete: '刪除',
    swipe_hint: '(右滑編輯/左滑刪除)',
    basic_info: '基本資料',
    api_key_warning: '若AI功能異常，請確認此欄位是否已填寫正確金鑰。',
    input_hint_ai: '(輸入後按AI估算營養)',
    scan_failed_title: '查無資料',
    scan_failed_msg: '找不到此條碼，是否改用拍照辨識營養標示？',
    use_camera: '使用拍照辨識',
    update_base_title: '營養素變更',
    update_base_msg: '您修改了營養素基準。是否要同步更新資料庫中的此產品？(選擇"否"則只修改本次紀錄)',
    yes_update_all: '是，更新資料庫',
    no_update_one: '否，只改這筆',
    meal_time: '用餐時段',
    standard_value: '基準數值 (每 1 份)',
    input_serving: '輸入份數',
    input_gram: '輸入克數',
    confirm_save_btn: '確認並儲存',
    ai_analyzing: 'AI 估算中...',
    switch_manual: '切換手動',
    return_ai: '返回 AI',
    nutrition_distribution: '營養素分佈',
    ai_analysis_result: 'AI 分析摘要',
    ocr_hint: '請拍攝食品包裝上的「營養標示」表格與「品名」',
    input_time: '輸入時間 (分)',
    input_dist: '輸入距離 (km)',
    input_steps: '輸入步數',
    input_floors: '輸入樓層',
    est_burned: '預估消耗',
    estimated_weight: '估計重量 (g)',
    ai_identify_workout: 'AI 辨識運動類型',
    ai_identified_as: '已識別為',
    // Workout Types (English Keys mapped to Local)
    running: '跑步', walking: '走路', cycling: '騎腳踏車', swimming: '游泳',
    yoga: '瑜珈', pilates: '皮拉提斯', weight_lifting: '重量訓練', hiit: '高強度間歇 (HIIT)',
    basketball: '籃球', soccer: '足球', tennis: '網球',
    hiking: '爬山', stair_climbing: '爬樓梯', dance: '跳舞', cleaning: '打掃/家事',
    custom: '自訂'
  },
  'en': {
    tab_home: 'Home', tab_analysis: 'Analysis', tab_ai_coach: 'AI Coach', tab_settings: 'Settings',
    activity_level: 'Activity Level', sedentary: 'Sedentary', lightly_active: 'Lightly Active', moderately_active: 'Moderately Active', very_active: 'Very Active', extra_active: 'Extra Active',
    gender: 'Gender', male: 'Male', female: 'Female', birth_year: 'Birth Year', height: 'Height (cm)', weight: 'Weight (kg)', body_fat: 'Body Fat (%)', target_weight: 'Target (kg)',
    goal: 'Goal', lose_weight: 'Lose Weight', maintain: 'Maintain', gain_weight: 'Gain Weight', daily_target: 'Daily Target', save_settings: 'Save Settings', logout: 'Logout',
    version_history: 'Version History', ai_settings: 'AI Settings', current_model: 'Current Model', test_key: 'Test & Get Models', api_key_placeholder: 'Paste your API Key here',
    trend_analysis: 'Trend Analysis', intake: 'Intake', burned: 'Burned', protein: 'Prot', carbs: 'Carb', fat: 'Fat', sodium: 'Sod',
    week: 'Week', month_day: 'Month(Day)', month_week: 'Month(Week)', year: 'Year',
    manual_input: 'Manual', photo: 'Photo', scan: 'Scan', workout: 'Workout', today_overview: 'Today Overview', quick_record: 'Quick Add', no_record: 'No records',
    ai_coach: 'AI Coach', recipe_suggestion: 'Recipe', workout_suggestion: 'Workout', generate_plan: 'Generate Plan', remaining_budget: 'Remaining Budget',
    watch_video: 'Watch Video', ingredients: 'Ingredients', steps: 'Steps', reason: 'Reason', estimated_weight: 'Est. Weight (g)', confirm_save: 'Confirm & Save',
    food_name: 'Food Name', calories: 'Calories', suggestion_limit: 'Daily Suggestion', alert_over: 'Exceeded',
    export_pdf: 'Export PDF', edit: 'Edit', delete: 'Delete',
    swipe_hint: '(Swipe Right Edit/Left Delete)',
    basic_info: 'Basic Info',
    api_key_warning: 'If AI features fail, please check if the API Key is correct.',
    input_hint_ai: '(Press AI Estimate after input)',
    scan_failed_title: 'Product Not Found',
    scan_failed_msg: 'Barcode not found. Use camera to analyze nutrition label?',
    use_camera: 'Use Camera',
    update_base_title: 'Nutrition Changed',
    update_base_msg: 'You changed the base nutrition. Update the product database? (No = only update this log)',
    yes_update_all: 'Yes, Update DB',
    no_update_one: 'No, This Log Only',
    meal_time: 'Meal Time',
    standard_value: 'Standard Value (Per Serving)',
    input_serving: 'Input Servings',
    input_gram: 'Input Grams',
    confirm_save_btn: 'Confirm & Save',
    ai_analyzing: 'AI Analyzing...',
    switch_manual: 'Switch Manual',
    return_ai: 'Return to AI',
    nutrition_distribution: 'Nutrition Distribution',
    ai_analysis_result: 'AI Analysis',
    ocr_hint: 'Please photograph the "Nutrition Facts" label and product name.',
    input_time: 'Time (min)',
    input_dist: 'Dist (km)',
    input_steps: 'Steps',
    input_floors: 'Floors',
    est_burned: 'Est. Burned',
    estimated_weight: 'Est. Weight (g)',
    ai_identify_workout: 'AI Identify Activity',
    ai_identified_as: 'Identified as',
    // Workout Types
    running: 'Running', walking: 'Walking', cycling: 'Cycling', swimming: 'Swimming',
    yoga: 'Yoga', pilates: 'Pilates', weight_lifting: 'Weight Lifting', hiit: 'HIIT',
    basketball: 'Basketball', soccer: 'Soccer', tennis: 'Tennis',
    hiking: 'Hiking', stair_climbing: 'Stairs', dance: 'Dancing', cleaning: 'Cleaning',
    custom: 'Custom'
  },
  'ja': {
    tab_home: 'ホーム', tab_analysis: '分析', tab_ai_coach: 'AIコーチ', tab_settings: '設定',
    activity_level: '活動レベル', sedentary: '座りっぱなし', lightly_active: '軽い運動', moderately_active: '中程度の運動', very_active: '高い運動', extra_active: '非常に高い',
    gender: '性別', male: '男性', female: '女性', birth_year: '生まれ年', height: '身長(cm)', weight: '体重(kg)', body_fat: '体脂肪率(%)', target_weight: '目標(kg)',
    goal: '目標', lose_weight: '減量', maintain: '維持', gain_weight: '増量', daily_target: '一日の目標', save_settings: '設定を保存', logout: 'ログアウト',
    version_history: 'バージョン履歴', ai_settings: 'AI設定', current_model: '現在のモデル', test_key: 'キーをテスト', api_key_placeholder: 'APIキーを入力してください',
    trend_analysis: '傾向分析', intake: '摂取', burned: '消費', protein: 'タンパク質', carbs: '炭水化物', fat: '脂質', sodium: '塩分',
    week: '週', month_day: '月(日)', month_week: '月(週)', year: '年',
    manual_input: '手動', photo: '写真', scan: 'スキャン', workout: '運動', today_overview: '今日の概要', quick_record: 'クイック記録', no_record: '記録なし',
    ai_coach: 'AIコーチ', recipe_suggestion: 'レシピ提案', workout_suggestion: '運動提案', generate_plan: 'プラン作成', remaining_budget: '残りカロリー',
    watch_video: '動画を見る', ingredients: '材料', steps: '手順', reason: '理由', estimated_weight: '推定重量 (g)', confirm_save: '確認して保存',
    food_name: '食品名', calories: 'カロリー', suggestion_limit: '推奨摂取量', alert_over: '超過',
    export_pdf: 'PDF出力', edit: '編集', delete: '削除',
    swipe_hint: '(右スワイプで編集/左で削除)',
    basic_info: '基本情報',
    api_key_warning: 'AI機能が動作しない場合は、APIキーを確認してください。',
    input_hint_ai: '(入力後にAI見積もりを押す)',
    scan_failed_title: '見つかりません',
    scan_failed_msg: 'バーコードが見つかりません。写真で栄養成分表示を読み取りますか？',
    use_camera: 'カメラを使用',
    update_base_title: '栄養素の変更',
    update_base_msg: '基準栄養素を変更しました。データベースも更新しますか？（いいえ＝この記録のみ更新）',
    yes_update_all: 'はい、更新します',
    no_update_one: 'いいえ、これだけ',
    meal_time: '食事の時間',
    standard_value: '基準値 (1人前)',
    input_serving: '人数を入力',
    input_gram: 'グラムを入力',
    confirm_save_btn: '確認して保存',
    ai_analyzing: 'AI分析中...',
    switch_manual: '手動に切り替え',
    return_ai: 'AIに戻る',
    nutrition_distribution: '栄養素の内訳',
    ai_analysis_result: 'AI分析結果',
    ocr_hint: '「栄養成分表示」と商品名を撮影してください。',
    input_time: '時間 (分)',
    input_dist: '距離 (km)',
    input_steps: '歩数',
    input_floors: '階数',
    est_burned: '推定消費',
    estimated_weight: '推定重量 (g)',
    ai_identify_workout: 'AI運動識別',
    ai_identified_as: '識別結果',
    // Workout
    running: 'ランニング', walking: 'ウォーキング', cycling: 'サイクリング', swimming: '水泳',
    yoga: 'ヨガ', pilates: 'ピラティス', weight_lifting: '筋トレ', hiit: 'HIIT',
    basketball: 'バスケ', soccer: 'サッカー', tennis: 'テニス',
    hiking: 'ハイキング', stair_climbing: '階段昇降', dance: 'ダンス', cleaning: '掃除',
    custom: 'カスタム'
  },
  'ko': {
    tab_home: '홈', tab_analysis: '분석', tab_ai_coach: 'AI 코치', tab_settings: '설정',
    activity_level: '활동량', sedentary: '좌식', lightly_active: '가벼운 활동', moderately_active: '중등도 활동', very_active: '활발한 활동', extra_active: '매우 활발',
    gender: '성별', male: '남성', female: '여성', birth_year: '출생년도', height: '키(cm)', weight: '체중(kg)', body_fat: '체지방률(%)', target_weight: '목표 체중(kg)',
    goal: '목표', lose_weight: '감량', maintain: '유지', gain_weight: '증량', daily_target: '일일 목표', save_settings: '설정 저장', logout: '로그아웃',
    version_history: '버전 기록', ai_settings: 'AI 설정', current_model: '현재 모델', test_key: '테스트 및 모델 가져오기', api_key_placeholder: 'API 키를 입력하세요',
    trend_analysis: '트렌드 분석', intake: '섭취', burned: '소모', protein: '단백질', carbs: '탄수화물', fat: '지방', sodium: '나트륨',
    week: '주', month_day: '월(일)', month_week: '월(주)', year: '년',
    manual_input: '수동', photo: '사진', scan: '스캔', workout: '운동', today_overview: '오늘의 개요', quick_record: '빠른 기록', no_record: '기록 없음',
    ai_coach: 'AI 코치', recipe_suggestion: '레시피 제안', workout_suggestion: '운동 제안', generate_plan: '계획 생성', remaining_budget: '남은 예산',
    watch_video: '비디오 보기', ingredients: '재료', steps: '단계', reason: '이유', estimated_weight: '예상 무게 (g)', confirm_save: '확인 및 저장',
    food_name: '음식 이름', calories: '칼로리', suggestion_limit: '일일 권장량', alert_over: '초과',
    export_pdf: 'PDF 내보내기', edit: '편집', delete: '삭제',
    swipe_hint: '(오른쪽: 편집 / 왼쪽: 삭제)',
    basic_info: '기본 정보',
    api_key_warning: 'AI 기능이 작동하지 않으면 API 키를 확인하세요.',
    input_hint_ai: '(입력 후 AI 추정 누르기)',
    scan_failed_title: '자료 없음',
    scan_failed_msg: '바코드를 찾을 수 없습니다. 사진으로 영양 성분을 분석하시겠습니까?',
    use_camera: '카메라 사용',
    update_base_title: '영양소 변경',
    update_base_msg: '기준 영양소를 변경했습니다. 데이터베이스도 업데이트하시겠습니까? (아니요 = 이 기록만 변경)',
    yes_update_all: '예, 업데이트',
    no_update_one: '아니요, 이 기록만',
    meal_time: '식사 시간',
    standard_value: '기준 값 (1인분)',
    input_serving: '인분 입력',
    input_gram: '그램 입력',
    confirm_save_btn: '확인 및 저장',
    ai_analyzing: 'AI 분석 중...',
    switch_manual: '수동 전환',
    return_ai: 'AI로 복귀',
    nutrition_distribution: '영양소 분포',
    ai_analysis_result: 'AI 분석 결과',
    ocr_hint: '식품 포장의 "영양 성분표"와 제품명을 촬영해 주세요.',
    input_time: '시간 (분)',
    input_dist: '거리 (km)',
    input_steps: '걸음 수',
    input_floors: '층수',
    est_burned: '예상 소모',
    estimated_weight: '예상 무게 (g)',
    ai_identify_workout: 'AI 운동 식별',
    ai_identified_as: '식별됨',
    // Workout
    running: '달리기', walking: '걷기', cycling: '자전거', swimming: '수영',
    yoga: '요가', pilates: '필라테스', weight_lifting: '웨이트', hiit: 'HIIT',
    basketball: '농구', soccer: '축구', tennis: '테니스',
    hiking: '등산', stair_climbing: '계단 오르기', dance: '춤', cleaning: '청소',
    custom: '사용자 지정'
  },
  'fr': {
    tab_home: 'Accueil', tab_analysis: 'Analyse', tab_ai_coach: 'Coach IA', tab_settings: 'Paramètres',
    activity_level: 'Niveau d\'activité', sedentary: 'Sédentaire', lightly_active: 'Légèrement actif', moderately_active: 'Modérément actif', very_active: 'Très actif', extra_active: 'Extrêmement actif',
    gender: 'Genre', male: 'Homme', female: 'Femme', birth_year: 'Année de naissance', height: 'Taille (cm)', weight: 'Poids (kg)', body_fat: 'Masse grasse (%)', target_weight: 'Poids cible (kg)',
    goal: 'Objectif', lose_weight: 'Perdre du poids', maintain: 'Maintenir', gain_weight: 'Prendre du poids', daily_target: 'Objectif quotidien', save_settings: 'Enregistrer', logout: 'Déconnexion',
    version_history: 'Historique des versions', ai_settings: 'Paramètres IA', current_model: 'Modèle actuel', test_key: 'Tester la clé', api_key_placeholder: 'Collez votre clé API ici',
    trend_analysis: 'Analyse des tendances', intake: 'Apport', burned: 'Brûlé', protein: 'Prot', carbs: 'Gluc', fat: 'Lip', sodium: 'Sod',
    week: 'Semaine', month_day: 'Mois(Jour)', month_week: 'Mois(Semaine)', year: 'Année',
    manual_input: 'Manuel', photo: 'Photo', scan: 'Scan', workout: 'Sport', today_overview: 'Aperçu du jour', quick_record: 'Ajout rapide', no_record: 'Aucun enregistrement',
    ai_coach: 'Coach IA', recipe_suggestion: 'Recette', workout_suggestion: 'Entraînement', generate_plan: 'Générer un plan', remaining_budget: 'Budget restant',
    watch_video: 'Voir la vidéo', ingredients: 'Ingrédients', steps: 'Étapes', reason: 'Raison', estimated_weight: 'Poids est. (g)', confirm_save: 'Confirmer & Enregistrer',
    food_name: 'Nom de l\'aliment', calories: 'Calories', suggestion_limit: 'Limite quotidienne', alert_over: 'Dépassé',
    export_pdf: 'Exporter PDF', edit: 'Éditer', delete: 'Supprimer',
    swipe_hint: '(Glisser droite: Éditer / Gauche: Supprimer)',
    basic_info: 'Infos de base',
    api_key_warning: 'Si l\'IA échoue, vérifiez votre clé API.',
    input_hint_ai: '(Appuyez sur Estimer IA après saisie)',
    scan_failed_title: 'Produit introuvable',
    scan_failed_msg: 'Code-barres introuvable. Utiliser la caméra pour l\'étiquette ?',
    use_camera: 'Utiliser la caméra',
    update_base_title: 'Nutrition modifiée',
    update_base_msg: 'Vous avez modifié la base. Mettre à jour la base de données ? (Non = seulement cet enregistrement)',
    yes_update_all: 'Oui, mettre à jour',
    no_update_one: 'Non, juste ceci',
    meal_time: 'Repas',
    standard_value: 'Valeur standard (par portion)',
    input_serving: 'Nb portions',
    input_gram: 'Nb grammes',
    confirm_save_btn: 'Confirmer & Enregistrer',
    ai_analyzing: 'Analyse IA...',
    switch_manual: 'Mode manuel',
    return_ai: 'Retour IA',
    nutrition_distribution: 'Répartition nutritionnelle',
    ai_analysis_result: 'Résultat Analyse IA',
    ocr_hint: 'Photographiez l\'étiquette nutritionnelle et le nom.',
    input_time: 'Temps (min)',
    input_dist: 'Dist (km)',
    input_steps: 'Pas',
    input_floors: 'Étages',
    est_burned: 'Est. Brûlé',
    estimated_weight: 'Poids est. (g)',
    ai_identify_workout: 'Identifier Sport IA',
    ai_identified_as: 'Identifié comme',
    // Workout
    running: 'Course', walking: 'Marche', cycling: 'Vélo', swimming: 'Natation',
    yoga: 'Yoga', pilates: 'Pilates', weight_lifting: 'Musculation', hiit: 'HIIT',
    basketball: 'Basket', soccer: 'Football', tennis: 'Tennis',
    hiking: 'Randonnée', stair_climbing: 'Escaliers', dance: 'Danse', cleaning: 'Ménage',
    custom: 'Personnalisé'
  },
  'ru': {
    tab_home: 'Главная', tab_analysis: 'Анализ', tab_ai_coach: 'AI Тренер', tab_settings: 'Настройки',
    activity_level: 'Активность', sedentary: 'Сидячий', lightly_active: 'Лёгкая', moderately_active: 'Средняя', very_active: 'Высокая', extra_active: 'Экстремальная',
    gender: 'Пол', male: 'Муж', female: 'Жен', birth_year: 'Год рождения', height: 'Рост (см)', weight: 'Вес (кг)', body_fat: 'Жир (%)', target_weight: 'Цель (кг)',
    goal: 'Цель', lose_weight: 'Похудеть', maintain: 'Поддерживать', gain_weight: 'Набрать', daily_target: 'Дневная цель', save_settings: 'Сохранить', logout: 'Выйти',
    version_history: 'История версий', ai_settings: 'Настройки AI', current_model: 'Текущая модель', test_key: 'Тест ключа', api_key_placeholder: 'Вставьте API ключ',
    trend_analysis: 'Анализ трендов', intake: 'Прием', burned: 'Расход', protein: 'Белки', carbs: 'Углев', fat: 'Жиры', sodium: 'Натрий',
    week: 'Неделя', month_day: 'Месяц(День)', month_week: 'Месяц(Неделя)', year: 'Год',
    manual_input: 'Вручную', photo: 'Фото', scan: 'Скан', workout: 'Спорт', today_overview: 'Обзор дня', quick_record: 'Быстро', no_record: 'Нет записей',
    ai_coach: 'AI Тренер', recipe_suggestion: 'Рецепт', workout_suggestion: 'Тренировка', generate_plan: 'Создать план', remaining_budget: 'Остаток',
    watch_video: 'Смотреть видео', ingredients: 'Ингредиенты', steps: 'Шаги', reason: 'Причина', estimated_weight: 'Вес (г)', confirm_save: 'Сохранить',
    food_name: 'Еда', calories: 'Калории', suggestion_limit: 'Дневной лимит', alert_over: 'Превышено',
    export_pdf: 'Экспорт PDF', edit: 'Изменить', delete: 'Удалить',
    swipe_hint: '(Свайп вправо: Изм / Влево: Удал)',
    basic_info: 'Основная инфо',
    api_key_warning: 'Если AI не работает, проверьте ключ.',
    input_hint_ai: '(Нажмите AI после ввода)',
    scan_failed_title: 'Не найдено',
    scan_failed_msg: 'Штрих-код не найден. Снять этикетку?',
    use_camera: 'Камера',
    update_base_title: 'Изменение состава',
    update_base_msg: 'Обновить базу данных? (Нет = только эту запись)',
    yes_update_all: 'Да, обновить',
    no_update_one: 'Нет, только эту',
    meal_time: 'Время еды',
    standard_value: 'Базовое значение (порция)',
    input_serving: 'Порции',
    input_gram: 'Граммы',
    confirm_save_btn: 'Сохранить',
    ai_analyzing: 'Анализ AI...',
    switch_manual: 'Ручной режим',
    return_ai: 'Вернуться к AI',
    nutrition_distribution: 'Распределение БЖУ',
    ai_analysis_result: 'Результат AI',
    ocr_hint: 'Сфотографируйте таблицу калорийности и название.',
    input_time: 'Время (мин)',
    input_dist: 'Дист (км)',
    input_steps: 'Шаги',
    input_floors: 'Этажи',
    est_burned: 'Расход',
    estimated_weight: 'Вес (г)',
    ai_identify_workout: 'AI Определить',
    ai_identified_as: 'Определено как',
    // Workout
    running: 'Бег', walking: 'Ходьба', cycling: 'Велосипед', swimming: 'Плавание',
    yoga: 'Йога', pilates: 'Пилатес', weight_lifting: 'Силовая', hiit: 'HIIT',
    basketball: 'Баскетбол', soccer: 'Футбол', tennis: 'Теннис',
    hiking: 'Хаикинг', stair_climbing: 'Лестница', dance: 'Танцы', cleaning: 'Уборка',
    custom: 'Другое'
  }
};

const LOGS_ZH = [
  { version: '1.0.7', date: '2025-12-22', content: '運動係數與語言分離；新增運動 AI 辨識功能；修正分析圖表套件依賴。' },
  { version: '1.0.6', date: '2025-12-22', content: '全語言介面優化；恢復AI分析詳情；新增掃碼轉OCR模式；運動熱量算法優化。' },
  { version: '1.0.5', date: '2025-12-22', content: '修正語言切換問題；優化編輯流程；新增TDEE自動計算；修正運動熱量預估。' },
  { version: '1.0.4', date: '2025-12-21', content: 'UI/UX全面優化：解決語言切換延遲問題；新增相簿匯入功能；AI教練建議分開儲存；鈉含量單位修正。' },
];

const LOGS_EN = [
  { version: '1.0.7', date: '2025-12-22', content: 'Decoupled workout coefficient from language; Added AI Workout ID; Fixed Chart dependency.' },
  { version: '1.0.6', date: '2025-12-22', content: 'Full language support; Restored AI details; Added Scan-to-OCR mode; Optimized workout calorie calc.' },
  { version: '1.0.5', date: '2025-12-22', content: 'Fixed language switch; Optimized edit flow; Added auto TDEE calc; Fixed workout calorie estimation.' },
  { version: '1.0.4', date: '2025-12-21', content: 'UI/UX Optimization: Fixed language delay; Added gallery import; Separate AI advice storage; Sodium unit fix.' },
];

export const getVersionLogs = (lang: string) => {
  return lang === 'zh-TW' ? LOGS_ZH : LOGS_EN;
};

export const t = (key: string, lang: string = 'zh-TW') => {
  const dict = TRANSLATIONS[lang as keyof typeof TRANSLATIONS] || TRANSLATIONS['en'];
  return dict[key as keyof typeof dict] || TRANSLATIONS['en'][key as any] || key;
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