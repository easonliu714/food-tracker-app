const { withMainActivity, withAndroidManifest } = require('@expo/config-plugins');

module.exports = function withHealthConnectFix(config) {
  
  // 1. 針對 AndroidManifest.xml 進行強制修正
  config = withAndroidManifest(config, async (config) => {
    const manifest = config.modResults.manifest;
    const app = manifest.application[0];

    // 尋找 MainActivity (支援 .MainActivity 或 完整路徑)
    const mainActivity = app.activity.find(
      (a) => a.$['android:name'].includes('MainActivity')
    );

    if (mainActivity) {
      console.log("[HealthConnectFix] Found MainActivity:", mainActivity.$['android:name']);

      if (!mainActivity['intent-filter']) {
        mainActivity['intent-filter'] = [];
      }

      // 定義正確的 Action
      // 注意：這是 Health SDK 用來啟動你的 App 權限說明頁面的 Action
      const correctAction = "androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE";
      
      // 檢查是否已經存在正確的 Filter
      const hasCorrectFilter = mainActivity['intent-filter'].some(filter => 
        filter.action && filter.action.some(a => a.$['android:name'] === correctAction)
      );

      if (hasCorrectFilter) {
        console.log("[HealthConnectFix] Correct Intent Filter already exists. Verifying category...");
        // 確保該 Filter 也有 DEFAULT category
        const targetFilter = mainActivity['intent-filter'].find(filter => 
            filter.action && filter.action.some(a => a.$['android:name'] === correctAction)
        );
        if (targetFilter && !targetFilter.category) {
             targetFilter.category = [];
        }
        if (targetFilter && !targetFilter.category.some(c => c.$['android:name'] === "android.intent.category.DEFAULT")) {
             targetFilter.category.push({ $: { "android:name": "android.intent.category.DEFAULT" } });
             console.log("[HealthConnectFix] Added missing DEFAULT category.");
        }
      } else {
        console.log("[HealthConnectFix] Intent Filter missing. FORCING injection.");
        
        // 移除所有可能錯誤的舊設定 (包含 android.intent.action... 開頭的錯誤版本)
        mainActivity['intent-filter'] = mainActivity['intent-filter'].filter(filter => {
            if (!filter.action) return true;
            const actionName = filter.action[0].$['android:name'];
            // 移除任何看似 Health Rationale 但不是正確 androidx 的設定
            return !actionName.includes("ACTION_SHOW_PERMISSIONS_RATIONALE");
        });

        // 注入正確的設定
        mainActivity['intent-filter'].push({
          action: [{ $: { "android:name": correctAction } }],
          category: [{ $: { "android:name": "android.intent.category.DEFAULT" } }]
        });
      }
    } else {
      console.error("[HealthConnectFix] ⚠️ Could not find MainActivity in Manifest!");
    }
    
    // 確保 <queries> 存在
    if (!manifest.queries) {
      manifest.queries = [];
    }
    const healthConnectPackageName = "com.google.android.apps.healthdata";
    const hasQuery = manifest.queries.some(q => 
      q.package && q.package.some(p => p.$ && p.$["android:name"] === healthConnectPackageName)
    );
    if (!hasQuery) {
      console.log("[HealthConnectFix] Adding <queries> tag for Health Connect.");
      manifest.queries.push({
        package: [{ $: { "android:name": healthConnectPackageName } }]
      });
    }

    return config;
  });

  // 2. MainActivity.kt 程式碼修正 (這部分通常沒問題，保持原樣)
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