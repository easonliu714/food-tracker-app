import "./scripts/load-env.js";
import type { ExpoConfig } from "expo/config";

const bundleId = "space.manus.nutrition_tracker.t20251217000540";
const timestamp = bundleId.split(".").pop()?.replace(/^t/, "") ?? "";
const schemeFromBundleId = `manus${timestamp}`;

const env = {
  appName: 'Food Tracker',
  appSlug: 'nutrition_tracker',
  logoUrl: 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663249409721/lBYRAahQjSJDLaqW.png',
  scheme: schemeFromBundleId,
  iosBundleId: bundleId,
  androidPackage: bundleId,
};

const config: ExpoConfig = {
  name: env.appName,
  slug: env.appSlug,
  version: "1.0.14", // 建議進版，確保安裝時視為新版本
  orientation: "portrait",
  scheme: "foodtracker", 

  icon: "./assets/images/icon.png",
  userInterfaceStyle: "automatic",
  
  locales: {
    "zh-Hant": "./locales/zh-Hant.json",
    "zh-ch": "./locales/zh-ch.json",
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
      "android.permission.health.READ_STEPS",
      "android.permission.health.READ_SLEEP",
      "android.permission.health.READ_EXERCISE",
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
    ["react-native-health-connect", { 
        "rationalActivityClassName": ".MainActivity" // 明確指定 Activity
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
      projectId: "270c42a4-05c2-4c3a-aafa-476afbf0121f",
    },
  },
};

export default config;