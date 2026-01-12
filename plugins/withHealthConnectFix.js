const { withMainActivity, withAndroidManifest } = require('@expo/config-plugins');

module.exports = function withHealthConnectFix(config) {
  // 1. 修正 MainActivity (解決閃退、權限空值、引用衝突問題)
  config = withMainActivity(config, async (config) => {
    let src = config.modResults.contents;

    // A. 處理 Import (避免重複)
    const packageMatch = src.match(/package\s+[\w.]+/);
    if (!packageMatch) return config; 
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
        src = src.replace(
            packageLine,
            `${packageLine}\n${importsToAdd.join('\n')}`
        );
    }

    // B. 注入 Permission Delegate
    const delegateCode = `HealthConnectPermissionDelegate.setPermissionDelegate(this)`;

    if (!src.includes(delegateCode)) {
      if (src.includes('fun onCreate')) {
        if (src.includes('super.onCreate(savedInstanceState)')) {
          src = src.replace(
            'super.onCreate(savedInstanceState)',
            `super.onCreate(savedInstanceState)\n    ${delegateCode}`
          );
        } else {
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

  // 2. 修正 AndroidManifest.xml (解決無法連結、Action 名稱錯誤問題)
  config = withAndroidManifest(config, async (config) => {
    const manifest = config.modResults.manifest;

    // A. 處理 <queries> (Package Visibility)
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

    // B. 處理 <intent-filter> (Rationale Activity) - [關鍵修正]
    // 我們需要找到主要的 Activity (通常是 MainActivity) 並注入正確的 intent-filter
    const mainActivity = manifest.application[0].activity.find(
      (a) => a.$['android:name'] === '.MainActivity'
    );

    if (mainActivity) {
      if (!mainActivity['intent-filter']) {
        mainActivity['intent-filter'] = [];
      }

      const rationaleActionName = "androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE";
      
      // 檢查是否已存在 (避免重複)
      const hasRationaleFilter = mainActivity['intent-filter'].some(filter => 
        filter.action && filter.action.some(action => action.$['android:name'] === rationaleActionName)
      );

      if (!hasRationaleFilter) {
        mainActivity['intent-filter'].push({
          action: [{ $: { "android:name": rationaleActionName } }],
          // 必須加入 DEFAULT category，否則系統無法啟動此 Intent
          category: [{ $: { "android:name": "android.intent.category.DEFAULT" } }]
        });
      }
    }

    return config;
  });

  return config;
};