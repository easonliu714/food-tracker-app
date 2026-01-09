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

    // 2. 嘗試請求權限
    // 由於 _layout.tsx 已經執行過 initialize()，這裡直接請求權限應該是安全的。
    // 但為了保險，我們還是可以再 call 一次 initialize (它是冪等的，重複 call 沒關係)
    await initialize(); 

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
    const steps = await readRecords("Steps", {
      timeRangeFilter: {
        operator: "between",
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
      },
    });

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