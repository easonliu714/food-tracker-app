// constants/tutorial-steps.ts
import { t } from "@/lib/i18n";

export const getTutorialSteps = (lang: string, userName: string = "User") => {
  return {
    // 首次歡迎
    ONBOARDING_WELCOME: [
      { text: t('tutorial_welcome_1', lang), forceNext: true },
      { text: t('tutorial_welcome_lang_hint', lang), forceNext: true },
      { text: t('tutorial_welcome_2', lang), forceNext: true },
      { text: t('tutorial_welcome_ask_name', lang), action: 'input_name', forceNext: true },
      { text: t('tutorial_welcome_goto_profile', lang), action: 'navigate_profile', forceNext: true }
    ],
    // 個人檔案頁面
    PROFILE_GUIDE: [
        { text: t('tutorial_profile_intro', lang) }, // 修正：使用 intro 作為開場
        { targetKey: 'profile_basic', text: t('tutorial_profile_basic_hint', lang) },
        { targetKey: 'profile_goals', text: t('tutorial_profile_goals_hint', lang) },
        { targetKey: 'profile_ai', text: t('tutorial_profile_ai_hint', lang) },
        { targetKey: 'profile_save', text: t('tutorial_profile_save_hint', lang) }
    ],
    // 首次設定 Profile 的特殊結尾
    ONBOARDING_PROFILE: [
        { targetKey: 'profile_basic', text: t('tutorial_profile_basic_hint', lang) },
        { targetKey: 'profile_goals', text: t('tutorial_profile_goals_hint', lang) },
        { targetKey: 'profile_ai', text: t('tutorial_profile_ai_hint', lang) },
        { targetKey: 'profile_save', text: t('tutorial_profile_save_hint', lang), action: 'end_onboarding' }
    ],
    // 首頁
    HOME_GUIDE: [
        { text: t('tutorial_home_intro', lang, { name: userName }) },
        { targetKey: 'home_metrics', text: t('tutorial_home_metrics_hint', lang) },
        { targetKey: 'home_water', text: t('tutorial_home_water_hint', lang) },
        { targetKey: 'home_energy', text: t('tutorial_home_energy_hint', lang) },
        { targetKey: 'home_actions', text: t('tutorial_home_actions_hint', lang) }
    ],
    // 分析頁面
    ANALYSIS_GUIDE: [
        { text: t('tutorial_analysis_intro', lang) },
        { targetKey: 'analysis_chart', text: t('tutorial_analysis_chart_hint', lang) },
        { targetKey: 'analysis_grid', text: t('tutorial_analysis_grid_hint', lang) }
    ],
    // [新增] AI 教練頁面
    RECIPES_GUIDE: [
        { text: t('tutorial_recipes_intro', lang) },
        { targetKey: 'recipes_history', text: t('tutorial_recipes_history_hint', lang) },
        { targetKey: 'recipes_input', text: t('tutorial_recipes_input_hint', lang) }
    ]
  };
};