const { withMainActivity, withAndroidManifest } = require('@expo/config-plugins');

module.exports = function withHealthConnectFix(config) {
  // 1. 修正 MainActivity (解決閃退與權限回傳空值問題)
  config = withMainActivity(config, async (config) => {
    let src = config.modResults.contents;

    // A. 加入 Import
    if (!src.includes('dev.matinzd.healthconnect.permissions.HealthConnectPermissionDelegate')) {
      // 確保有 package 宣告，插在 package 下方或檔案最前面
      if (src.includes('package ')) {
        src = src.replace(
          /package\s+[\w.]+/,
          `$&
import android.os.Bundle
import dev.matinzd.healthconnect.permissions.HealthConnectPermissionDelegate`
        );
      } else {
         src = `import android.os.Bundle
import dev.matinzd.healthconnect.permissions.HealthConnectPermissionDelegate
` + src;
      }
    }

    // B. 注入 Permission Delegate
    const delegateCode = `HealthConnectPermissionDelegate.setPermissionDelegate(this)`;

    if (!src.includes(delegateCode)) {
      // 情況 1: MainActivity 已有 onCreate 方法 -> 插在 super.onCreate 之後
      if (src.includes('fun onCreate')) {
        if (src.includes('super.onCreate(savedInstanceState)')) {
          src = src.replace(
            'super.onCreate(savedInstanceState)',
            `super.onCreate(savedInstanceState)
    ${delegateCode}`
          );
        } else {
          // 有 onCreate 但沒 super (罕見)，插在函式開頭
          src = src.replace(/fun\s+onCreate\s*\([^)]*\)\s*\{/, `$&
    ${delegateCode}`);
        }
      } 
      // 情況 2: MainActivity 沒有 onCreate 方法 (Expo 預設模版常見情況) -> 手動建立 onCreate
      else {
        // 尋找 class MainActivity ... { 的結尾 (最後一個 })
        // 我們要在 class 內部的最後面插入 onCreate
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

  // 2. 修正 AndroidManifest.xml (解決無法連結/無提示問題)
  config = withAndroidManifest(config, async (config) => {
    const manifest = config.modResults.manifest;

    if (!manifest.queries) {
      manifest.queries = [];
    }

    const healthConnectPackageName = "com.google.android.apps.healthdata";
    
    // 檢查是否已存在 (android:name)
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

  return config;
};