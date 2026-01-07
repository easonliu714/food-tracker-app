import "./scripts/load-env.js";
import type { ExpoConfig } from "expo/config";

const bundleId = "space.manus.nutrition_tracker.t20251217000540";
const timestamp = bundleId.split(".").pop()?.replace(/^t/, "") ?? "";
const schemeFromBundleId = `manus${timestamp}`;

const env = {
  appName: 'Food Tracker', // [建議] 預設名稱改為英文，作為 Fallback
  appSlug: 'nutrition_tracker',
  logoUrl: 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663249409721/lBYRAahQjSJDLaqW.png',
  scheme: schemeFromBundleId,
  iosBundleId: bundleId,
  androidPackage: bundleId,
};

const config: ExpoConfig = {
  name: env.appName,
  slug: env.appSlug,
  version: "1.0.4",
  orientation: "portrait",
  
  // [圖示設定] 
  icon: "./assets/images/icon.png", // iOS 與舊版 Android 使用
  userInterfaceStyle: "automatic",
  
  // [iOS 語系設定] 引入語系檔
  locales: {
    "zh-Hant": "./locales/zh-Hant.json",
    "en": "./locales/en.json",
    // 若有日韓語需求可在此新增
    "ja": "./locales/ja.json",
    "ko": "./locales/ko.json"
  },

  ios: {
    supportsTablet: true,
    bundleIdentifier: env.iosBundleId,
    infoPlist: {
      UIBackgroundModes: ["audio"],
      // 注意：這裡的權限說明是「預設值」(通常是英文)。
      // 真正的多國語系文字會從 locales/*.json 中讀取並覆蓋這裡。
      NSCameraUsageDescription: "Allow $(PRODUCT_NAME) to access your camera to scan food barcodes and take photos.",
      NSPhotoLibraryUsageDescription: "Allow $(PRODUCT_NAME) to access your photos to import food images for analysis.",
    },
  },
  
  android: {
    package: env.androidPackage,
    // [Android 圖示設定] 自適應圖示
    adaptiveIcon: {
      foregroundImage: "./assets/images/adaptive-icon.png", // 只有 Logo 主體，透明背景
      backgroundColor: "#ffffff", // 背景色
    },
    permissions: [
      "CAMERA",
      "READ_EXTERNAL_STORAGE",
      "WRITE_EXTERNAL_STORAGE",
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
    "expo-router",
    "expo-localization",
    "expo-sqlite",
    
    // [Android App 名稱多語系 Plugin]
    [
      "@nabbra/expo-android-app-name-localization",
      {
        localizedAppNames: {
          "zh-Hant": "營養追蹤", // 繁體中文名稱
          "en": "Food Tracker",  // 英文名稱
          "zh-CN": "营养追踪",   // 簡體中文
          "ja": "栄養トラッカー", // 日文
          "ko": "영양 추적기"    // 韓文
        }
      }
    ],

    [
      "expo-notifications",
      {
        "icon": "./assets/images/icon.png",
        "color": "#ffffff"
      }
    ],
    
    // [權限設定]
    // 這裡設定的是「預設」語言。多語系會由 locales/zh-Hant.json 自動覆寫 iOS 的 Info.plist
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
    // [必要時可修正] 暫時關閉 React Compiler 以解決 react/compiler-runtime 錯誤
    //reactCompiler: false,
    typedRoutes: true,
  },
  extra: {
    router: {
      origin: false,
    },
    eas: {
      projectId: "3487f8cc-8b3d-4260-9366-f08466601402",
    },
  },
  owner: "easonliu714",
};

export default config;
