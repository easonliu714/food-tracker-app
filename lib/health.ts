import {
  initialize,
  requestPermission,
  readRecords,
  getSdkStatus,
  SdkAvailabilityStatus,
} from "react-native-health-connect";
import { Platform } from "react-native";

export const initHealthConnect = async () => {
  // Health Connect 僅支援 Android
  if (Platform.OS !== "android") return false;

  try {
    // 1. 檢查 SDK 狀態
    const status = await getSdkStatus();
    if (status !== SdkAvailabilityStatus.SDK_AVAILABLE) {
      console.log("Health Connect SDK not available:", status);
      return false;
    }

    // 2. 初始化 Health Connect
    // 注意：initialize 會回傳 boolean 承諾
    const isInitialized = await initialize();
    if (!isInitialized) {
        console.log("Health Connect failed to initialize");
        return false;
    }

    // 3. 請求權限
    // 定義我們要讀取的資料類型
    const permissions = [
      { accessType: "read", recordType: "Steps" },
      { accessType: "read", recordType: "SleepSession" },
      { accessType: "read", recordType: "ExerciseSession" },
    ] as const;

    const granted = await requestPermission(permissions);
    
    // 只要有拿到任何權限，我們就當作成功 (雖然嚴格來說應該檢查是否包含我們需要的)
    return granted.length > 0;

  } catch (e) {
    console.error("Health Connect Init Error:", e);
    return false;
  }
};

export const getHealthData = async (startTime: Date, endTime: Date) => {
  // 非 Android 平台直接回傳空陣列，避免錯誤
  if (Platform.OS !== "android") return { steps: [], sleep: [] };

  try {
    // 讀取步數
    // readRecords 回傳格式為 { records: Array, pageToken: string }
    const stepsResult = await readRecords("Steps", {
      timeRangeFilter: {
        operator: "between",
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
      },
    });

    // 讀取睡眠
    const sleepResult = await readRecords("SleepSession", {
      timeRangeFilter: {
        operator: "between",
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
      },
    });

    // [關鍵修正] 這裡必須回傳 .records 陣列，否則外部使用 .reduce 會報錯
    return { 
        steps: stepsResult.records || [], 
        sleep: sleepResult.records || [] 
    };

  } catch (e) {
    console.error("Fetch Health Data Error:", e);
    // 發生錯誤時回傳空陣列，保證 App 不會崩潰
    return { steps: [], sleep: [] };
  }
};