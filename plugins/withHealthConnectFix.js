const { withMainActivity, withAndroidManifest } = require('@expo/config-plugins');

/**
 * Health Connect compatibility patch for Expo prebuild.
 *
 * Why this exists:
 * - Expo's generic android.permissions field does not always materialize Android 14+
 *   Health Connect runtime permissions in the generated AndroidManifest.xml.
 * - If the final manifest does not explicitly declare health permissions, Android's
 *   Health Connect settings screen may not list the sideloaded APK as a health app,
 *   so users cannot grant Steps / Sleep access.
 * - This plugin makes the generated native project deterministic for APK testing.
 */
module.exports = function withHealthConnectFix(config) {
  // 1. Patch AndroidManifest.xml.
  config = withAndroidManifest(config, async (config) => {
    const manifest = config.modResults.manifest;
    const app = manifest.application[0];

    // -------------------------------------------------------------------------
    // A. Force Health Connect permissions into the manifest root.
    // -------------------------------------------------------------------------
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

    // -------------------------------------------------------------------------
    // B. Make Health Connect package visible to this app.
    // -------------------------------------------------------------------------
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

    // -------------------------------------------------------------------------
    // C. Add Health Connect rationale intent filter to MainActivity.
    // -------------------------------------------------------------------------
    const mainActivity = app.activity.find((a) => {
      return a.$['android:name'].includes('MainActivity');
    });

    if (mainActivity) {
      console.log('[HealthConnectFix] Found MainActivity:', mainActivity.$['android:name']);

      if (!mainActivity['intent-filter']) {
        mainActivity['intent-filter'] = [];
      }

      const correctAction = 'androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE';

      // Remove old / wrong rationale filters first to avoid duplicate or malformed filters.
      mainActivity['intent-filter'] = mainActivity['intent-filter'].filter((filter) => {
        if (!filter.action) return true;
        return !filter.action.some((action) => {
          const actionName = action?.$?.['android:name'] || '';
          return actionName.includes('ACTION_SHOW_PERMISSIONS_RATIONALE') && actionName !== correctAction;
        });
      });

      const targetFilter = mainActivity['intent-filter'].find((filter) => {
        return filter.action && filter.action.some((a) => a.$['android:name'] === correctAction);
      });

      if (targetFilter) {
        console.log('[HealthConnectFix] Correct rationale intent filter already exists. Verifying category.');
        if (!targetFilter.category) {
          targetFilter.category = [];
        }
        const hasDefaultCategory = targetFilter.category.some((c) => {
          return c.$['android:name'] === 'android.intent.category.DEFAULT';
        });
        if (!hasDefaultCategory) {
          targetFilter.category.push({ $: { 'android:name': 'android.intent.category.DEFAULT' } });
        }
      } else {
        console.log('[HealthConnectFix] Rationale intent filter missing. Injecting.');
        mainActivity['intent-filter'].push({
          action: [{ $: { 'android:name': correctAction } }],
          category: [{ $: { 'android:name': 'android.intent.category.DEFAULT' } }],
        });
      }
    } else {
      console.error('[HealthConnectFix] Could not find MainActivity in Manifest.');
    }

    return config;
  });

  // 2. Patch MainActivity.kt to register the native permission delegate.
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
