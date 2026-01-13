const { withMainActivity, withAndroidManifest } = require('@expo/config-plugins');

module.exports = function withHealthConnectFix(config) {
  // 1. MainActivity 修正 (保持不變，因為這部分沒問題)
  config = withMainActivity(config, async (config) => {
    let src = config.modResults.contents;
    const packageMatch = src.match(/package\s+[\w.]+/);
    if (packageMatch) {
      const packageLine = packageMatch[0];
      const neededImports = [
          'android.os.Bundle',
          'dev.matinzd.healthconnect.permissions.HealthConnectPermissionDelegate'
      ];
      let importsToAdd = [];
      for (const imp of neededImports) {
          if (!src.includes(`import ${imp}`)) {
              importsToAdd.push(`import ${imp}`);
          }
      }
      if (importsToAdd.length > 0) {
          src = src.replace(packageLine, `${packageLine}\n${importsToAdd.join('\n')}`);
      }
    }

    const delegateCode = `HealthConnectPermissionDelegate.setPermissionDelegate(this)`;
    if (!src.includes(delegateCode)) {
      const superOnCreateRegex = /super\.onCreate\([^)]*\)/;
      if (src.includes('fun onCreate')) {
        if (superOnCreateRegex.test(src)) {
          src = src.replace(superOnCreateRegex, `$&\n    ${delegateCode}`);
        } else {
          src = src.replace(/fun\s+onCreate\s*\([^)]*\)\s*\{/, `$& \n    ${delegateCode}`);
        }
      } else {
        const lastBraceIndex = src.lastIndexOf('}');
        if (lastBraceIndex !== -1) {
          const onCreateMethod = `
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    ${delegateCode}
  }
`;
          src = src.substring(0, lastBraceIndex) + onCreateMethod + src.substring(lastBraceIndex);
        }
      }
    }
    config.modResults.contents = src;
    return config;
  });

  // 2. AndroidManifest 修正 (加入清理邏輯)
  config = withAndroidManifest(config, async (config) => {
    const manifest = config.modResults.manifest;

    if (!manifest.queries) {
      manifest.queries = [];
    }
    const healthConnectPackageName = "com.google.android.apps.healthdata";
    const hasQuery = manifest.queries.some(q => 
      q.package && q.package.some(p => p.$ && p.$["android:name"] === healthConnectPackageName)
    );
    if (!hasQuery) {
      manifest.queries.push({
        package: [{ $: { "android:name": healthConnectPackageName } }]
      });
    }

    const mainActivity = manifest.application[0].activity.find(
      (a) => a.$['android:name'] === '.MainActivity'
    );

    if (mainActivity) {
      if (!mainActivity['intent-filter']) {
        mainActivity['intent-filter'] = [];
      }

      // [清理邏輯] 移除所有錯誤的 Action (帶有 android.intent.action. 前綴的)
      // 這些通常是由官方插件或 Expo 自動產生的
      const wrongActionName = "android.intent.action.androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE";
      mainActivity['intent-filter'] = mainActivity['intent-filter'].filter(filter => {
        const hasWrongAction = filter.action && filter.action.some(action => action.$['android:name'] === wrongActionName);
        return !hasWrongAction;
      });

      // [注入邏輯] 確保正確的 Intent Filter 存在
      const rationaleActionName = "androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE";
      const defaultCategoryName = "android.intent.category.DEFAULT";

      const existingFilter = mainActivity['intent-filter'].find(filter => 
        filter.action && filter.action.some(action => action.$['android:name'] === rationaleActionName)
      );

      if (existingFilter) {
        if (!existingFilter.category) existingFilter.category = [];
        const hasCategory = existingFilter.category.some(c => c.$['android:name'] === defaultCategoryName);
        if (!hasCategory) {
          existingFilter.category.push({ $: { "android:name": defaultCategoryName } });
        }
      } else {
        mainActivity['intent-filter'].push({
          action: [{ $: { "android:name": rationaleActionName } }],
          category: [{ $: { "android:name": defaultCategoryName } }]
        });
      }
    }

    return config;
  });

  return config;
};