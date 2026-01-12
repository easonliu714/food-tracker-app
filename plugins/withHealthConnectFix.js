const { withMainActivity } = require('@expo/config-plugins');

module.exports = function withHealthConnectFix(config) {
  return withMainActivity(config, async (config) => {
    let src = config.modResults.contents;

    // 1. 添加必要的 Import
    if (!src.includes('dev.matinzd.healthconnect.permissions.HealthConnectPermissionDelegate')) {
      src = src.replace(
        /package\s+[\w.]+/,
        `$&
import dev.matinzd.healthconnect.permissions.HealthConnectPermissionDelegate`
      );
    }

    // 2. 在 onCreate 中註冊 Permission Delegate
    // 檢查是否已存在，避免重複添加
    if (!src.includes('HealthConnectPermissionDelegate.setPermissionDelegate(this)')) {
      // 尋找 super.onCreate(savedInstanceState) 並在之後插入
      if (src.includes('super.onCreate(savedInstanceState)')) {
        src = src.replace(
          'super.onCreate(savedInstanceState)',
          `super.onCreate(savedInstanceState)
    HealthConnectPermissionDelegate.setPermissionDelegate(this)`
        );
      } else {
        // 如果找不到 super.onCreate (罕見)，嘗試在 onCreate 函數開頭插入
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
};