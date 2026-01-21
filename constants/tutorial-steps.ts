import { t } from '@/lib/i18n';

export interface TutorialStep {
  targetKey?: string;
  text: string;
  action?: 'input_name' | 'navigate_profile' | 'end_onboarding';
  forceNext?: boolean;
}

export const getTutorialSteps = (lang: string, userName: string): Record<string, TutorialStep[]> => {
  return {
    ONBOARDING_WELCOME: [
      { text: t('tutorial_welcome_1', lang).replace('{name}', userName) || `嗨！我是您的 AI 營養管家 Nomi。` },
      { text: t('tutorial_welcome_2', lang) || "初次見面，請問我該如何稱呼您？", action: 'input_name', forceNext: true },
      { text: t('tutorial_welcome_3', lang) || "太好了！接下來帶您設定個人檔案，這能幫助我提供更精準的建議。", action: 'navigate_profile', forceNext: true }
    ],
    ONBOARDING_PROFILE: [
      { text: t('tutorial_profile_intro', lang) || "這是設定頁面。請先填寫您的基本資料與目標。" },
      { targetKey: 'profile_basic', text: t('tutorial_profile_basic_1', lang) || "性別、年齡與身高是計算基礎代謝率的關鍵。" },
      { targetKey: 'profile_basic', text: t('tutorial_profile_basic_2', lang) || "我會自動更新您最近在首頁輸入的體重、體脂率，讓 AI 運算更精準。" },
      { targetKey: 'profile_goals', text: t('tutorial_profile_goals_1', lang) || "設定您的體重目標與活動量，我會自動為您計算每日熱量預算。" },
      { targetKey: 'profile_goals', text: t('tutorial_profile_goals_2', lang) || "當您的目標改變（例如想增肌或減脂），記得來這裡調整目標設定。" }
      { targetKey: 'profile_save', text: t('tutorial_profile_save', lang) || "填寫完畢後，別忘了按儲存喔！", action: 'end_onboarding' }
    ],
    
    // [分析頁面：多步驟細節導覽]
    ANALYSIS_GUIDE: [
      { text: t('tutorial_analysis_intro', lang) || "歡迎來到分析中心！這裡記錄了您的所有進度。" },
      
      // 1. 週期選擇
      { targetKey: 'analysis_period', text: t('tutorial_analysis_period', lang) || "上方可以切換「週」、「月」或「自訂」週期，查看不同時間範圍的數據。" },
      { targetKey: 'analysis_range', text: t('tutorial_analysis_range', lang) || "如果是自訂模式，可以在這裡選擇具體的起始與結束日期。" },
      
      // 2. 統計方塊 (多頁說明)
      { targetKey: 'analysis_grid', text: t('tutorial_analysis_grid_1', lang) || "這是您的核心數據儀表板，顯示平均攝取、消耗、體重變化等關鍵指標。" },
      { targetKey: 'analysis_grid', text: t('tutorial_analysis_grid_2', lang) || "小技巧：長按任一格子可以進入編輯模式，自由排列或新增您想關注的數據卡片！" },
      
      // 3. 趨勢圖表 (多頁說明)
      { targetKey: 'analysis_chart', text: t('tutorial_analysis_chart_1', lang) || "下方的趨勢圖能幫助您視覺化熱量赤字與體重變化的關聯。" },
      { targetKey: 'analysis_chart', text: t('tutorial_analysis_chart_2', lang) || "您可以雙指縮放 (Pinch) 來查看更細部的每日數據，或是左右滑動查看歷史紀錄。" }
    ],

    HOME_GUIDE: [
      { targetKey: 'home_header', text: t('tutorial_home_header', lang) || `早安，${userName}！點擊這裡可以快速切換日期。` },
      { targetKey: 'home_metrics', text: t('tutorial_home_metrics_1', lang) || "這裡顯示您當前的體重、體脂以及今日的步數與睡眠。" },
      { targetKey: 'home_metrics', text: t('tutorial_home_metrics_2', lang) || "請輸入體重和體脂率後，點擊 + 號新增今日的身體數值。" },
      { targetKey: 'home_metrics', text: t('tutorial_home_metrics_3', lang) || "步數會依據運動紀錄自動統計，請點擊睡眠輸入昨晚的睡眠時長(hhmm)。" },
      { targetKey: 'home_water', text: t('tutorial_home_water', lang) || "別忘了喝水！點擊 + 號可以快速記錄每次的飲水量，- 號則會扣除唷。" },
      { targetKey: 'home_energy', text: t('tutorial_home_energy', lang) || "這是最重要的能量儀表板，即時監控熱量攝取與消耗的平衡。" },
      { targetKey: 'home_actions', text: t('tutorial_home_actions', lang) || "想要記錄飲食或運動？這裡有四個快速入口：拍照、掃碼、手輸與運動紀錄。" },
      { targetKey: 'home_logs', text: t('tutorial_home_logs_1', lang) || "下方是您的飲食與運動流水帳，也包含常用食物的快速新增功能。" }
      { targetKey: 'home_logs', text: t('tutorial_home_logs_2', lang) || "按住項目右滑可以編輯，按住項目左滑可以複製或刪除。" }
    ],

    RECIPES_GUIDE: [
      { text: t('tutorial_recipes_intro', lang) || "我是您的 AI 營養教練，有任何飲食問題都可以問我！" },
      { targetKey: 'Recipe_hotkeys', text: t('tutorial_recipes_hotkeys', lang) || "不知道問什麼？試試上方的快速指令，例如「建議晚餐」或「居家運動」。" },
      { targetKey: 'Recipe_chat', text: t('tutorial_recipes_chat', lang) || "或者在這裡直接輸入您的問題，我會盡力為您解答。" },
      { targetKey: 'Recipe_title', text: t('tutorial_recipes_export', lang) || "對話結束後，您可以將建議匯出成 PDF 保存。" }
    ],

    PROFILE_GUIDE: [
        { targetKey: 'profile_ai', text: t('tutorial_profile_ai', lang) || "非常重要!請提供你自己的 Gemini API Key，在此輸入以獲得更穩定的服務。輸入後別忘了測試和儲存唷。" },
        { targetKey: 'profile_notify', text: t('tutorial_profile_notify_1', lang) || "設定早餐、午餐、晚餐的提醒，養成規律飲食好習慣。" },
        { targetKey: 'profile_notify', text: t('tutorial_profile_notify_2', lang) || "工作之餘也別忘了動一動，喝杯水，保持健康。設定我來提醒吧" },
        { targetKey: 'profile_backup', text: t('tutorial_profile_backup_1', lang) || "定期備份您的資料，換手機也不怕資料遺失。" },
        { targetKey: 'profile_backup', text: t('tutorial_profile_backup_2', lang) || "累積的掃碼成就也可以匯出，跟朋友分享唷。" },
        { targetKey: 'profile_basic', text: t('tutorial_profile_basic_1', lang) || "性別、年齡與身高是計算基礎代謝率的關鍵。" },
        { targetKey: 'profile_basic', text: t('tutorial_profile_basic_2', lang) || "我會自動更新您最近在首頁輸入的體重、體脂率，讓 AI 運算更精準。" },
        { targetKey: 'profile_goals', text: t('tutorial_profile_goals_1', lang) || "設定您的體重目標與活動量，我會自動為您計算每日熱量預算。" },
        { targetKey: 'profile_goals', text: t('tutorial_profile_goals_2', lang) || "當您的目標改變（例如想增肌或減脂），記得來這裡調整目標設定。" }
    ]
  };
};