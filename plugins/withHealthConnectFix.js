const { withMainActivity, withAndroidManifest } = require('@expo/config-plugins');

/**
 * Health Connect compatibility patch for Expo prebuild.
 *
 * V1.0.22 update:
 * - Android 14+ Health Connect expects apps to expose a VIEW_PERMISSION_USAGE
 *   entry point protected by android.permission.START_VIEW_PERMISSION_USAGE.
 * - Without this activity-alias, a sideloaded APK can fail to appear in the
 *   Health Connect app permission list even when READ_STEPS / READ_SLEEP are
 *   declared in the manifest.
 */
module.exports = function withHealthConnectFix(config) {
  config = withAndroidManifest(config, async (config) => {
    const manifest = config.modResults.manifest;
    const app = manifest.application[0];

    const requiredPermissions = [
      'android.permission.ACTIVITY_RECOGNITION',
      'android.permission.health.READ_STEPS',
      'android.permission.health.READ_SLEEP',
      'android.permission.health.READ_EXERCISE',
      'android.permission.health.WRITE_STEPS',
    ];

    if (!manifest['uses-permission']) {
      manifest['uses-permission'] = [];
    }

    for (const permissionName of requiredPermissions) {
      const exists = manifest['uses-permission'].some((entry) => {
        return entry?.$?.['android:name'] === permissionName;
      });

      if (!exists) {
        console.log(`[HealthConnectFix] Adding uses-permission: ${permissionName}`);
        manifest['uses-permission'].push({
          $: { 'android:name': permissionName },
        });
      }
    }

    if (!manifest.queries) {
      manifest.queries = [];
    }

    const healthConnectPackageName = 'com.google.android.apps.healthdata';
    const hasQuery = manifest.queries.some((q) => {
      return q.package && q.package.some((p) => p.$ && p.$['android:name'] === healthConnectPackageName);
    });

    if (!hasQuery) {
      console.log('[HealthConnectFix] Adding <queries> tag for Health Connect.');
      manifest.queries.push({
        package: [{ $: { 'android:name': healthConnectPackageName } }],
      });
    }

    const mainActivity = app.activity.find((a) => {
      return a.$['android:name'].includes('MainActivity');
    });

    if (mainActivity) {
      console.log('[HealthConnectFix] Found MainActivity:', mainActivity.$['android:name']);

      if (!mainActivity['intent-filter']) {
        mainActivity['intent-filter'] = [];
      }

      const rationaleAction = 'androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE';

      mainActivity['intent-filter'] = mainActivity['intent-filter'].filter((filter) => {
        if (!filter.action) return true;
        return !filter.action.some((action) => {
          const actionName = action?.$?.['android:name'] || '';
          return actionName.includes('ACTION_SHOW_PERMISSIONS_RATIONALE') && actionName !== rationaleAction;
        });
      });

      const rationaleFilter = mainActivity['intent-filter'].find((filter) => {
        return filter.action && filter.action.some((a) => a.$['android:name'] === rationaleAction);
      });

      if (!rationaleFilter) {
        console.log('[HealthConnectFix] Injecting Android 13- rationale intent filter.');
        mainActivity['intent-filter'].push({
          action: [{ $: { 'android:name': rationaleAction } }],
          category: [{ $: { 'android:name': 'android.intent.category.DEFAULT' } }],
        });
      }

      // Android 14+ Health Connect permission management entry point.
      if (!app['activity-alias']) {
        app['activity-alias'] = [];
      }

      const aliasName = '.ViewPermissionUsageActivity';
      const hasHealthUsageAlias = app['activity-alias'].some((alias) => {
        return alias?.$?.['android:name'] === aliasName;
      });

      if (!hasHealthUsageAlias) {
        console.log('[HealthConnectFix] Injecting Android 14+ Health Connect activity-alias.');
        app['activity-alias'].push({
          $: {
            'android:name': aliasName,
            'android:exported': 'true',
            'android:targetActivity': mainActivity.$['android:name'],
            'android:permission': 'android.permission.START_VIEW_PERMISSION_USAGE',
          },
          'intent-filter': [
            {
              action: [{ $: { 'android:name': 'android.intent.action.VIEW_PERMISSION_USAGE' } }],
              category: [{ $: { 'android:name': 'android.intent.category.HEALTH_PERMISSIONS' } }],
            },
          ],
        });
      }
    } else {
      console.error('[HealthConnectFix] Could not find MainActivity in Manifest.');
    }

    return config;
  });

  config = withMainActivity(config, async (config) => {
    let src = config.modResults.contents;
    const packageMatch = src.match(/package\s+[\w.]+/);

    if (packageMatch) {
      const packageLine = packageMatch[0];
      const neededImports = [
        'android.os.Bundle',
        'dev.matinzd.healthconnect.permissions.HealthConnectPermissionDelegate',
      ];
      const importsToAdd = [];

      for (const imp of neededImports) {
        if (!src.includes(`import ${imp}`)) {
          importsToAdd.push(`import ${imp}`);
        }
      }

      if (importsToAdd.length > 0) {
        src = src.replace(packageLine, `${packageLine}\n${importsToAdd.join('\n')}`);
      }
    }

    const delegateCode = 'HealthConnectPermissionDelegate.setPermissionDelegate(this)';
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
