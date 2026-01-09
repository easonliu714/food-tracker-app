import {
  initialize,
  requestPermission,
  readRecords,
  getSdkStatus,
  SdkAvailabilityStatus,
} from "react-native-health-connect";
import { Platform } from "react-native";

export const initHealthConnect = async () => {
  if (Platform.OS !== "android") return false;

  try {
    // 1. 檢查 SDK 狀態
    const status = await getSdkStatus();
    if (status !== SdkAvailabilityStatus.SDK_AVAILABLE) {
      console.log("Health Connect SDK not available:", status);
      return false;
    }

    // 2. 初始化 (關鍵：必須在使用前呼叫，且最好是在 User Interaction 期間)
    const isInitialized = await initialize();
    if (!isInitialized) {
        console.log("Health Connect failed to initialize");
        return false;
    }

    // 3. 請求權限
    const permissions = [
      { accessType: "read", recordType: "Steps" },
      { accessType: "read", recordType: "SleepSession" },
      { accessType: "read", recordType: "ExerciseSession" },
    ] as const;

    const granted = await requestPermission(permissions);
    return granted.length > 0;

  } catch (e) {
    console.error("Health Connect Init Error:", e);
    return false;
  }
};

export const getHealthData = async (startTime: Date, endTime: Date) => {
  if (Platform.OS !== "android") return { steps: [], sleep: [] };

  try {
    // 讀取步數
    const steps = await readRecords("Steps", {
      timeRangeFilter: {
        operator: "between",
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
      },
    });

    // 讀取睡眠
    const sleep = await readRecords("SleepSession", {
      timeRangeFilter: {
        operator: "between",
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
      },
    });

    return { steps, sleep };
  } catch (e) {
    console.error("Fetch Health Data Error:", e);
    return { steps: [], sleep: [] };
  }
};