const { withMainActivity, withAndroidManifest } = require('@expo/config-plugins');

module.exports = function withHealthConnectFix(config) {
  // 1. 修正 MainActivity (解決閃退、權限空值、引用衝突問題)
  config = withMainActivity(config, async (config) => {
    let src = config.modResults.contents;

    // A. 處理 Import (避免重複)
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

    // B. 注入 Permission Delegate
    const delegateCode = `HealthConnectPermissionDelegate.setPermissionDelegate(this)`;

    if (!src.includes(delegateCode)) {
      // 改進正則表達式，匹配 super.onCreate(null) 或 super.onCreate(savedInstanceState)
      const superOnCreateRegex = /super\.onCreate\([^)]*\)/;
      
      if (src.includes('fun onCreate')) {
        if (superOnCreateRegex.test(src)) {
          // 插在 super.onCreate(...) 之後，確保 Activity 初始化完成
          src = src.replace(
            superOnCreateRegex,
            `$&\n    ${delegateCode}`
          );
        } else {
          // 若找不到 super (罕見)，插在函式開頭
          src = src.replace(/fun\s+onCreate\s*\([^)]*\)\s*\{/, `$& \n    ${delegateCode}`);
        }
      } else {
        // 如果沒有 onCreate，手動建立
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

  // 2. 修正 AndroidManifest.xml (解決無法連結問題)
  config = withAndroidManifest(config, async (config) => {
    const manifest = config.modResults.manifest;

    // A. 處理 <queries>
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

    // B. 處理 <intent-filter> (Rationale Activity) - [強制修正邏輯]
    const mainActivity = manifest.application[0].activity.find(
      (a) => a.$['android:name'] === '.MainActivity'
    );

    if (mainActivity) {
      if (!mainActivity['intent-filter']) {
        mainActivity['intent-filter'] = [];
      }

      const rationaleActionName = "androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE";
      const defaultCategoryName = "android.intent.category.DEFAULT";

      // 尋找是否已存在該 Action 的 filter
      const existingFilter = mainActivity['intent-filter'].find(filter => 
        filter.action && filter.action.some(action => action.$['android:name'] === rationaleActionName)
      );

      if (existingFilter) {
        // 如果 Filter 已存在，檢查是否有 category
        if (!existingFilter.category) existingFilter.category = [];
        
        const hasCategory = existingFilter.category.some(c => c.$['android:name'] === defaultCategoryName);
        
        // 若缺少 DEFAULT category，強制補上
        if (!hasCategory) {
          existingFilter.category.push({ $: { "android:name": defaultCategoryName } });
        }
      } else {
        // 若 Filter 不存在，建立完整的
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