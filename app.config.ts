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
  version: "1.0.13", // [修改] 更新版本號
  orientation: "portrait",
  // 建議：直接給定一個固定的 scheme 名稱，比較穩定
  scheme: "foodtracker", // 建議改成簡單的英文單字，全部小寫

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
    permissions: [
      "CAMERA",
      "READ_EXTERNAL_STORAGE",
      "WRITE_EXTERNAL_STORAGE",
      // [關鍵] Google Health Connect 權限
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
    // [新增] 1. 引入剛剛建立的 Lint 停用插件
    "./plugins/withDisableLinting",

    // [保留] 2. Android 建置屬性 (Health Connect 需要)
    [
      "expo-build-properties",
      {
        android: {
          minSdkVersion: 26,     // Health Connect 要求最低 26
          compileSdkVersion: 35, // 建議對應 Android 15
          targetSdkVersion: 35,
        },
      },
    ],
    
    "expo-router",
    "expo-localization",
    "expo-sqlite",
    // [關鍵] Health Connect Plugin
    "react-native-health-connect",
    
    // [已移除] 導致錯誤的 nabbra/expo-android-app-name-localization 已刪除

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
      projectId: "e7eda4dd-d630-4f8d-8b68-34e211c164f2",
    },
  },
  //owner: "easonliu714",
};

export default config;