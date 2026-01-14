const { withMainActivity, withAndroidManifest } = require('@expo/config-plugins');

module.exports = function withHealthConnectFix(config) {
  // 1. AndroidManifest 修正 (採用「先刪除後新增」策略，避免重複或衝突)
  config = withAndroidManifest(config, async (config) => {
    const manifest = config.modResults.manifest;
    const mainActivity = manifest.application[0].activity.find(
      (a) => a.$['android:name'] === '.MainActivity'
    );

    if (mainActivity) {
      if (!mainActivity['intent-filter']) {
        mainActivity['intent-filter'] = [];
      }

      const correctAction = "androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE";
      const wrongAction = "android.intent.action.androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE"; // 官方插件產生的錯誤名稱

      // [關鍵步驟]：先移除所有與 Health Connect 權限相關的 Filter (無論對錯)
      // 這樣可以防止官方插件產生的錯誤 Filter 殘留，或是我們產生了重複的 Filter
      mainActivity['intent-filter'] = mainActivity['intent-filter'].filter(filter => {
        if (!filter.action) return true;
        const hasTargetAction = filter.action.some(a => 
          a.$['android:name'] === correctAction || a.$['android:name'] === wrongAction
        );
        return !hasTargetAction; // 如果包含目標 Action 就移除
      });

      // [關鍵步驟]：手動加入唯一且正確的 Filter
      mainActivity['intent-filter'].push({
        action: [{ $: { "android:name": correctAction } }],
        category: [{ $: { "android:name": "android.intent.category.DEFAULT" } }]
      });
    }
    
    // 確保 <queries> 標籤存在 (解決 Android 11+ 套件可見性問題)
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

    return config;
  });

  // 2. MainActivity 程式碼修正 (保持不變，確保 SDK 初始化)
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

  return config;
};