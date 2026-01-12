const { withMainActivity, withAndroidManifest } = require('@expo/config-plugins');

module.exports = function withHealthConnectFix(config) {
  // 1. 修正 MainActivity (解決閃退問題)
  config = withMainActivity(config, async (config) => {
    let src = config.modResults.contents;

    if (!src.includes('dev.matinzd.healthconnect.permissions.HealthConnectPermissionDelegate')) {
      src = src.replace(
        /package\s+[\w.]+/,
        `$&
import dev.matinzd.healthconnect.permissions.HealthConnectPermissionDelegate`
      );
    }

    if (!src.includes('HealthConnectPermissionDelegate.setPermissionDelegate(this)')) {
      if (src.includes('super.onCreate(savedInstanceState)')) {
        src = src.replace(
          'super.onCreate(savedInstanceState)',
          `super.onCreate(savedInstanceState)
    HealthConnectPermissionDelegate.setPermissionDelegate(this)`
        );
      } else {
        const onCreateRegex = /fun\s+onCreate\s*\([^)]*\)\s*\{/;
        if (onCreateRegex.test(src)) {
            src = src.replace(onCreateRegex, `$&
    HealthConnectPermissionDelegate.setPermissionDelegate(this)`);
        }
      }
    }

    config.modResults.contents = src;
    return config;
  });

  // 2. 修正 AndroidManifest.xml (解決無法連結/無提示問題)
  // Android 11+ 需要設定 <queries> 才能看見 Health Connect App
  config = withAndroidManifest(config, async (config) => {
    const manifest = config.modResults.manifest;

    if (!manifest.queries) {
      manifest.queries = [];
    }

    const healthConnectPackageName = "com.google.android.apps.healthdata";
    
    // 檢查是否已存在
    const hasQuery = manifest.queries.some(q => 
      q.package && q.package.some(p => p.$ && p.$.name === healthConnectPackageName)
    );

    if (!hasQuery) {
      manifest.queries.push({
        package: [{ $: { name: healthConnectPackageName } }]
      });
    }

    return config;
  });

  return config;
};