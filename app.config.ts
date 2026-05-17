// app.config.ts
import "./scripts/load-env.js";
import type { ExpoConfig } from "expo/config";
// [新增] 引入 Config Plugins 工具
import { withAndroidManifest, ConfigPlugin } from "@expo/config-plugins";

const bundleId = "space.manus.nutrition_tracker.t20251217000540";
const timestamp = bundleId.split(".").pop()?.replace(/^t/, "") ?? "";
const schemeFromBundleId = `manus${timestamp}`;
const appVersion = "1.0.25";

const env = {
  appName: 'Nomi',
  appSlug: 'nomi',
  logoUrl: 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663249409721/lBYRAahQjSJDLaqW.png',
  scheme: schemeFromBundleId,
  iosBundleId: bundleId,
  androidPackage: bundleId,
};

// [新增] 自定義 Plugin：注入 Health Connect 所需的 queries 標籤
const withHealthConnectQueries: ConfigPlugin = (config) => {
  return withAndroidManifest(config, async (config) => {
    const androidManifest = config.modResults;
    if (!androidManifest.manifest.queries) {
      androidManifest.manifest.queries = [];
    }
    // 檢查是否已存在 (避免重複添加)
    const hasHealthQuery = androidManifest.manifest.queries.some(
      (q: any) => q.package && q.package[0]?.$?.["android:name"] === "com.google.android.apps.healthdata"
    );

    if (!hasHealthQuery) {
      androidManifest.manifest.queries.push({
        package: [{ $: { "android:name": "com.google.android.apps.healthdata" } }],
      });
    }
    return config;
  });
};

const config: ExpoConfig = {
  name: env.appName,
  slug: env.appSlug,
  owner: "easonliu714s-personal-trainer",
  version: appVersion,
  orientation: "portrait",
  scheme: "nourish_me", 
  updates: {
    url: "https://u.expo.dev/00f07adb-465c-4dfc-baef-d332d062f34b"
  },
  runtimeVersion: {
    policy: "appVersion"
  },
  icon: "./assets/images/icon.png",
  userInterfaceStyle: "automatic",
  locales: {
    "zh-TW": "./locales/zh-TW.json",
    "zh-CN": "./locales/zh-CN.json",
    "en": "./locales/en.json",
    "ja": "./locales/ja.json",
    "ko": "./locales/ko.json"
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: env.iosBundleId,
    infoPlist: {
      UIBackgroundModes: ["audio"],
      NSCameraUsageDescription: "Allow $(PRODUCT_NAME) to access your camera to scan food barcodes and take photos.",
      NSPhotoLibraryUsageDescription: "Allow $(PRODUCT_NAME) to access your photos to import food images for analysis.",
    },
  },
  android: {
    package: env.androidPackage,
    adaptiveIcon: {
      foregroundImage: "./assets/images/adaptive-icon.png",
      backgroundColor: "#ffffff",
    },
    permissions: [
      "CAMERA",
      "READ_EXTERNAL_STORAGE",
      "WRITE_EXTERNAL_STORAGE",
      "android.permission.ACTIVITY_RECOGNITION", 
      "android.permission.health.READ_STEPS",
      "android.permission.health.READ_SLEEP",
      "android.permission.health.READ_EXERCISE",
      "android.permission.health.WRITE_STEPS",
    ],
    intentFilters: [
      {
        action: "VIEW",
        autoVerify: true,
        data: [ { scheme: env.scheme, host: "*" } ],
        category: ["BROWSABLE", "DEFAULT"],
      }
    ],
  },
  web: {
    output: "static",
    favicon: "./assets/images/favicon.png",
  },
  plugins: [
    withHealthConnectQueries,
    ["react-native-health-connect", { 
        "rationaleActivityClassName": `${bundleId}.MainActivity`
    }],
    "./plugins/withHealthConnectFix",
    "./plugins/withDisableLinting",
    [
      "expo-build-properties",
      {
        android: {
          minSdkVersion: 26,
          compileSdkVersion: 36,
          targetSdkVersion: 36,
        },
      },
    ],
    "expo-router",
    "expo-localization",
    "expo-sqlite",
    [
      "expo-notifications",
      { "icon": "./assets/images/icon.png", "color": "#ffffff" }
    ],
    [
      "expo-camera",
      {
        "cameraPermission": "Allow $(PRODUCT_NAME) to access your camera to scan food barcodes and take photos.",
        "microphonePermission": "Allow $(PRODUCT_NAME) to access your microphone.",
        "recordAudioAndroid": false,
      },
    ],
    [
      "expo-image-picker",
      {
        "photosPermission": "Allow $(PRODUCT_NAME) to access your photos to import food images for analysis.",
      },
    ],
    [
      "expo-splash-screen",
      {
        "image": "./assets/images/splash-icon.png",
        "imageWidth": 200,
        "resizeMode": "contain",
        "backgroundColor": "#ffffff",
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    router: { origin: false },
    eas: { projectId: "00f07adb-465c-4dfc-baef-d332d062f34b" },
  },
};

export default config;