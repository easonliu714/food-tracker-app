const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'app', 'activity-editor.tsx');
let source = fs.readFileSync(filePath, 'utf8');
let changed = false;

function replaceOnce(search, replacement, label) {
  if (!source.includes(search)) {
    console.log(`[patch-activity-editor-i18n] skip ${label}: pattern not found or already patched`);
    return;
  }
  source = source.replace(search, replacement);
  changed = true;
  console.log(`[patch-activity-editor-i18n] patched ${label}`);
}

if (!source.includes("@/lib/activity-localization")) {
  replaceOnce(
    'import { t, useLanguage } from "@/lib/i18n"; // i18n\n',
    'import { t, useLanguage } from "@/lib/i18n"; // i18n\nimport { healthActivityText, isHealthDailyStepsName, localizeActivityName } from "@/lib/activity-localization";\n',
    'activity-localization import'
  );
}

replaceOnce(
`                      const logCatName = log.category;
                      const logActName = log.activityName;

                      for (const cat of ACTIVITY_RAW) {`,
`                      const logCatName = log.category;
                      const logActName = log.activityName;

                      // [V1.0.27] Health Connect 自動產生的日常步數可能仍以 Daily Steps / walking 等舊值存在於 DB。
                      // 進入編輯頁時先轉為目前語系，避免設定繁中時仍顯示英文。
                      if (isHealthDailyStepsName(logActName) || isHealthDailyStepsName(logCatName)) {
                          const customCat = ACTIVITY_RAW.find(c => c.id === 'cat_custom');
                          setCategory(customCat || null);
                          setCustomActivityName(localizeActivityName(logActName, lang));
                          setActivity(null);
                          found = true;
                          return;
                      }

                      for (const cat of ACTIVITY_RAW) {`,
  'existing Health Connect log display'
);

replaceOnce(
`                          setCustomActivityName(logActName);`,
`                          setCustomActivityName(localizeActivityName(logActName, lang));`,
  'custom activity fallback display'
);

replaceOnce(
`             const targetName = params.activityName as string;
             let found = false;

             // 遍歷所有分類尋找符合名稱的項目 (比對翻譯後的名稱)`,
`             const targetName = params.activityName as string;
             let found = false;

             // [V1.0.27] 首頁快捷進入 Health Connect 日常步數時，轉為目前語系顯示。
             if (isHealthDailyStepsName(targetName)) {
                 const customCat = ACTIVITY_RAW.find(c => c.id === 'cat_custom');
                 setCategory(customCat || null);
                 setCustomActivityName(localizeActivityName(targetName, lang));
                 setActivity(null);
                 return;
             }

             // 遍歷所有分類尋找符合名稱的項目 (比對翻譯後的名稱)`,
  'quick-add Health Connect activity display'
);

replaceOnce(
`      // 加入 ?. 以及 || '' 確保萬一 activity 為空時不會報錯
      const finalName = category?.id === 'cat_custom' ? customActivityName : t(activity?.id || '', lang);

      const logData = {
        date: format(logDate, 'yyyy-MM-dd'),
        loggedAt: logDate,
        // [修正] 確保傳入 t 的參數必定為字串
        category: category ? t(category.id, lang) : "",
        activityName: finalName,`,
`      // 加入 ?. 以及 || '' 確保萬一 activity 為空時不會報錯
      const rawFinalName = category?.id === 'cat_custom' ? customActivityName : t(activity?.id || '', lang);
      const isHealthDailySteps = isHealthDailyStepsName(rawFinalName) || isHealthDailyStepsName(category?.id);
      const finalName = isHealthDailySteps ? localizeActivityName(rawFinalName, lang) : rawFinalName;
      const finalCategory = isHealthDailySteps
        ? healthActivityText('health_daily_steps_category', lang)
        : (category ? t(category.id, lang) : "");

      const logData = {
        date: format(logDate, 'yyyy-MM-dd'),
        loggedAt: logDate,
        // [V1.0.27] Health Connect 日常步數以目前語系儲存，並保留舊值辨識能力。
        category: finalCategory,
        activityName: finalName,`,
  'save Health Connect localized name/category'
);

replaceOnce(
`                        {category?.id === 'cat_custom' ? (customActivityName || t('custom_activity', lang)) : (activity ? t(activity.id, lang) : t('select_activity', lang))}`, 
`                        {category?.id === 'cat_custom' ? (localizeActivityName(customActivityName, lang) || t('custom_activity', lang)) : (activity ? t(activity.id, lang) : t('select_activity', lang))}`,
  'selector button Health Connect display'
);

if (changed) {
  fs.writeFileSync(filePath, source, 'utf8');
  console.log('[patch-activity-editor-i18n] activity-editor.tsx patched successfully.');
} else {
  console.log('[patch-activity-editor-i18n] no changes required.');
}
