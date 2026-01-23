import "./scripts/load-env.js";
import type { ExpoConfig } from "expo/config";

const bundleId = "space.manus.nutrition_tracker.t20251217000540";
const timestamp = bundleId.split(".").pop()?.replace(/^t/, "") ?? "";
const schemeFromBundleId = `manus${timestamp}`;

const env = {
  appName: 'Nomi',
  appSlug: 'nomi',
  logoUrl: 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663249409721/lBYRAahQjSJDLaqW.png',
  scheme: schemeFromBundleId,
  iosBundleId: bundleId,
  androidPackage: bundleId,
};

const config: ExpoConfig = {
  name: env.appName,
  slug: env.appSlug,
  // [修改開始] 新增 owner 欄位 (根據您的 EAS CLI 提示)
  owner: "easonliu714s-personal-trainer",
  version: "1.0.19",
  orientation: "portrait",
  scheme: "nourish_me", 
  // [新增] EAS Updates 設定 (解決 Build 錯誤)
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
    // 這裡保留權限宣告作為雙重保險
    permissions: [
      "CAMERA",
      "READ_EXTERNAL_STORAGE",
      "WRITE_EXTERNAL_STORAGE",
      // [修改開始] 新增 ACTIVITY_RECOGNITION 權限
      "android.permission.ACTIVITY_RECOGNITION", 
      // 增加 Health Connect 權限宣告
      "android.permission.health.READ_STEPS",
      "android.permission.health.READ_SLEEP",
      "android.permission.health.READ_EXERCISE",
      "android.permission.health.WRITE_STEPS",
    ],
    intentFilters: [
      {
        action: "VIEW",
        autoVerify: true,
        data: [
          {
            scheme: env.scheme,
            host: "*",
          },
        ],
        category: ["BROWSABLE", "DEFAULT"],
      },
    ],
  },
  
  web: {
    output: "static",
    favicon: "./assets/images/favicon.png",
  },
  
  plugins: [
    // [重要] 加回官方插件，讓它負責產生基礎設定
    // [修正] 改用完整的 Class Name，確保插件能找到正確的 Activity
    ["react-native-health-connect", { 
        "rationaleActivityClassName": `${bundleId}.MainActivity`
    }],
    // [重要] 我們的修正腳本放在後面，用來修復官方插件產生的錯誤 Action
    "./plugins/withHealthConnectFix",
    
    "./plugins/withDisableLinting",
    [
      "expo-build-properties",
      {
        android: {
          minSdkVersion: 26,     
          compileSdkVersion: 35, 
          targetSdkVersion: 35,
        },
      },
    ],
    
    "expo-router",
    "expo-localization",
    "expo-sqlite",

    [
      "expo-notifications",
      {
        "icon": "./assets/images/icon.png",
        "color": "#ffffff"
      }
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
    router: {
      origin: false,
    },
    eas: {
      projectId: "00f07adb-465c-4dfc-baef-d332d062f34b",
    },
  },
};

export default config;