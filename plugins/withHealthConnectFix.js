const { withMainActivity, withAndroidManifest } = require('@expo/config-plugins');

module.exports = function withHealthConnectFix(config) {
  // 1. 修正 MainActivity (解決閃退、權限空值、引用衝突問題)
  config = withMainActivity(config, async (config) => {
    let src = config.modResults.contents;

    // 取得 package 宣告行，作為插入點
    const packageMatch = src.match(/package\s+[\w.]+/);
    if (!packageMatch) {
        return config; 
    }
    const packageLine = packageMatch[0];

    // 定義我們需要確保存在的 imports
    const neededImports = [
        'android.os.Bundle',
        'dev.matinzd.healthconnect.permissions.HealthConnectPermissionDelegate'
    ];

    // 檢查並收集尚未存在的 imports
    let importsToAdd = [];
    for (const imp of neededImports) {
        if (!src.includes(`import ${imp}`)) {
            importsToAdd.push(`import ${imp}`);
        }
    }

    // 如果有缺少的 imports，插入在 package 宣告下方
    if (importsToAdd.length > 0) {
        src = src.replace(
            packageLine,
            `${packageLine}\n${importsToAdd.join('\n')}`
        );
    }

    // 注入 Permission Delegate
    const delegateCode = `HealthConnectPermissionDelegate.setPermissionDelegate(this)`;

    // 確保不會重複注入 delegate 程式碼
    if (!src.includes(delegateCode)) {
      if (src.includes('fun onCreate')) {
        // 情況 A: 已經有 onCreate
        if (src.includes('super.onCreate(savedInstanceState)')) {
          src = src.replace(
            'super.onCreate(savedInstanceState)',
            `super.onCreate(savedInstanceState)\n    ${delegateCode}`
          );
        } else {
          // 有 onCreate 但沒 super (罕見)
          src = src.replace(/fun\s+onCreate\s*\([^)]*\)\s*\{/, `$& \n    ${delegateCode}`);
        }
      } else {
        // 情況 B: 沒有 onCreate (Expo 預設模版常見)，手動建立
        // 尋找 class MainActivity ... { 的結尾 (最後一個 })
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