import "./scripts/load-env.js";
import type { ExpoConfig } from "expo/config";

const bundleId = "space.manus.nutrition_tracker.t20251217000540";
const timestamp = bundleId.split(".").pop()?.replace(/^t/, "") ?? "";
const schemeFromBundleId = `manus${timestamp}`;

const env = {
  appName: '營養追蹤',
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
  icon: "./assets/images/icon.png",
  scheme: env.scheme,
  userInterfaceStyle: "automatic",
  newArchEnabled: true,
  ios: {
    supportsTablet: true,
    bundleIdentifier: env.iosBundleId,
    infoPlist: {
      UIBackgroundModes: ["audio"],
      NSCameraUsageDescription: "此應用程式需要使用相機來拍攝食物照片,以便進行營養分析。",
      NSPhotoLibraryUsageDescription: "此應用程式需要存取您的相簿來選擇食物照片。",
      NSMicrophoneUsageDescription: "此應用程式不需要使用麥克風。",
    },
  },
  android: {
    adaptiveIcon: {
      backgroundColor: "#E6F4FE",
      foregroundImage: "./assets/images/android-icon-foreground.png",
      backgroundImage: "./assets/images/android-icon-background.png",
      monochromeImage: "./assets/images/android-icon-monochrome.png",
    },
    // [修正] 移除 versionCode，讓 EAS Build 自動管理或在 eas.json 設定
    // [修正] 移除 edgeToEdgeEnabled 和 predictiveBackGestureEnabled 以消除型別警示
    package: env.androidPackage,
    permissions: [
      "POST_NOTIFICATIONS",
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
        "cameraPermission": "允許 $(PRODUCT_NAME) 使用相機來拍攝食物照片和掃描條碼。",
        "microphonePermission": "此應用程式不需要使用麥克風。",
        "recordAudioAndroid": false,
      },
    ],
    [
      "expo-image-picker",
      {
        "photosPermission": "允許 $(PRODUCT_NAME) 存取您的相簿來選擇食物照片。",
      },
    ],
    [
      "expo-splash-screen",
      {
        "image": "./assets/images/splash-icon.png",
        "imageWidth": 200,
        "resizeMode": "contain",
        "backgroundColor": "#ffffff",
        "dark": {
          "backgroundColor": "#000000",
        },
      },
    ],
  ],
  extra: {
    eas: {
      projectId: "e7eda4dd-d630-4f8d-8b68-34e211c164f2"
    }
  },
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
};

export default config;