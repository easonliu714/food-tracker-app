const { withMainActivity, withAndroidManifest } = require('@expo/config-plugins');

module.exports = function withHealthConnectFix(config) {
  // 1. AndroidManifest 修正 (核心修復)
  config = withAndroidManifest(config, async (config) => {
    const manifest = config.modResults.manifest;
    const mainActivity = manifest.application[0].activity.find(
      (a) => a.$['android:name'] === '.MainActivity'
    );

    if (mainActivity && mainActivity['intent-filter']) {
      // 官方插件會產生一個錯誤的 action 名稱：
      // android.intent.action.androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE
      // 我們要把它修正為正確的：
      // androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE
      
      const wrongAction = "android.intent.action.androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE";
      const correctAction = "androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE";

      let fixed = false;

      // 遍歷所有的 intent-filter 尋找錯誤的那個
      mainActivity['intent-filter'].forEach((filter) => {
        if (filter.action) {
          filter.action.forEach((action) => {
            if (action.$['android:name'] === wrongAction) {
              // 找到兇手，直接修正！
              action.$['android:name'] = correctAction;
              
              // 確保這個 filter 也有 DEFAULT category (通常官方插件會加，但我們再次確認)
              if (!filter.category) {
                filter.category = [];
              }
              const hasDefault = filter.category.some(c => c.$['android:name'] === "android.intent.category.DEFAULT");
              if (!hasDefault) {
                filter.category.push({ $: { "android:name": "android.intent.category.DEFAULT" } });
              }
              fixed = true;
            }
          });
        }
      });

      // 如果完全找不到該 filter (可能插件沒跑或是其他原因)，我們才手動補一個
      // 這是不太可能發生的保險措施
      if (!fixed) {
        // 先檢查是否已經有正確的了
        const hasCorrect = mainActivity['intent-filter'].some(filter => 
          filter.action && filter.action.some(a => a.$['android:name'] === correctAction)
        );

        if (!hasCorrect) {
          mainActivity['intent-filter'].push({
            action: [{ $: { "android:name": correctAction } }],
            category: [{ $: { "android:name": "android.intent.category.DEFAULT" } }]
          });
        }
      }
    }
    
    // 確保 <queries> 標籤存在 (解決 "package not found" 隱患)
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

  // 2. MainActivity 程式碼修正 (保持不變)
  // 這是為了確保 Kotlin/Java 層的 SDK 委派正確初始化
  config = withMainActivity(config, async (config) => {
    let src = config.modResults.contents;
    const packageMatch = src.match(/package\s+[\w.]+/);
    
    // 加入必要的 import
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

    // 加入 onCreate 的委派設定
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
        // 如果沒有 onCreate，手動加入
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