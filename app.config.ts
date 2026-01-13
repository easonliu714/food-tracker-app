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
  version: "1.0.14", 
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
    // 我們已經在這裡手動宣告了權限，所以不需要官方插件自動加入
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
    // [重要修正] 移除了 "react-native-health-connect"，避免它產生錯誤的 Intent Filter
    // 我們的 withHealthConnectFix 已經手動處理了所有必要設定

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