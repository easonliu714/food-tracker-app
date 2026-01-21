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
      { text: t('tutorial_welcome_1', lang, { name: userName }) }, // [修正] 用 { name: userName } 對應 json 中的 {{name}}
      { text: t('tutorial_welcome_2', lang), action: 'input_name', forceNext: true },
      { text: t('tutorial_welcome_3', lang), action: 'navigate_profile', forceNext: true }
    ],
    ONBOARDING_PROFILE: [
      { text: t('tutorial_profile_intro', lang) },
      { targetKey: 'profile_basic', text: t('tutorial_profile_basic_1', lang) },
      { targetKey: 'profile_basic', text: t('tutorial_profile_basic_2', lang) },
      { targetKey: 'profile_goals', text: t('tutorial_profile_goals_1', lang) },
      { targetKey: 'profile_goals', text: t('tutorial_profile_goals_2', lang) },
      { targetKey: 'profile_save', text: t('tutorial_profile_save', lang), action: 'end_onboarding' }
    ],
    
    ANALYSIS_GUIDE: [
      { text: t('tutorial_analysis_intro', lang) },
      { targetKey: 'analysis_period', text: t('tutorial_analysis_period', lang) },
      { targetKey: 'analysis_range', text: t('tutorial_analysis_range', lang) },
      { targetKey: 'analysis_grid', text: t('tutorial_analysis_grid_1', lang) },
      { targetKey: 'analysis_grid', text: t('tutorial_analysis_grid_2', lang) },
      { targetKey: 'analysis_chart', text: t('tutorial_analysis_chart_1', lang) },
      { targetKey: 'analysis_chart', text: t('tutorial_analysis_chart_2', lang) }
    ],

    HOME_GUIDE: [
      // [修正] 傳入參數 { Name: userName } 對應 json 中的 {{Name}}
      { targetKey: 'home_header', text: t('tutorial_home_header', lang, { Name: userName }) },
      { targetKey: 'home_metrics', text: t('tutorial_home_metrics_1', lang) },
      { targetKey: 'home_metrics', text: t('tutorial_home_metrics_2', lang) },
      { targetKey: 'home_metrics', text: t('tutorial_home_metrics_3', lang) },
      { targetKey: 'home_water', text: t('tutorial_home_water', lang) },
      { targetKey: 'home_energy', text: t('tutorial_home_energy', lang) },
      { targetKey: 'home_actions', text: t('tutorial_home_actions', lang) },
      { targetKey: 'home_logs', text: t('tutorial_home_logs_1', lang) },
      { targetKey: 'home_logs', text: t('tutorial_home_logs_2', lang) }
    ],

    RECIPES_GUIDE: [
      { text: t('tutorial_recipes_intro', lang) },
      { targetKey: 'Recipe_hotkeys', text: t('tutorial_recipes_hotkeys', lang) },
      { targetKey: 'Recipe_chat', text: t('tutorial_recipes_chat', lang) },
      { targetKey: 'Recipe_title', text: t('tutorial_recipes_export', lang) }
    ],

    PROFILE_GUIDE: [
        { targetKey: 'profile_ai', text: t('tutorial_profile_ai', lang) },
        { targetKey: 'profile_notify', text: t('tutorial_profile_notify_1', lang) },
        { targetKey: 'profile_notify', text: t('tutorial_profile_notify_2', lang) },
        { targetKey: 'profile_backup', text: t('tutorial_profile_backup_1', lang) },
        { targetKey: 'profile_backup', text: t('tutorial_profile_backup_2', lang) },
        { targetKey: 'profile_basic', text: t('tutorial_profile_basic_1', lang) },
        { targetKey: 'profile_basic', text: t('tutorial_profile_basic_2', lang) },
        { targetKey: 'profile_goals', text: t('tutorial_profile_goals_1', lang) },
        { targetKey: 'profile_goals', text: t('tutorial_profile_goals_2', lang) }
    ]
  };
};