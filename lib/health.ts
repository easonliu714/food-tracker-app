import {
  initialize,
  requestPermission,
  readRecords,
  getGrantedPermissions,
  getSdkStatus,
  SdkAvailabilityStatus,
} from 'react-native-health-connect';
import { Permission } from 'react-native-health-connect/lib/typescript/types';
import { Platform } from 'react-native';

// 定義需要的權限列表
const PERMISSIONS: Permission[] = [
  { accessType: 'read', recordType: 'Steps' },
  { accessType: 'read', recordType: 'SleepSession' },
  { accessType: 'read', recordType: 'ExerciseSession' },
];

/**
 * 初始化並請求權限 (對應首頁的 initHealthConnect)
 * @returns boolean 是否成功連結
 */
export async function initHealthConnect(): Promise<boolean> {
  // iOS 不支援 Health Connect
  if (Platform.OS !== 'android') return false;

  try {
    console.log("[HealthConnect] Checking SDK status...");
    const status = await getSdkStatus();
    console.log(`[HealthConnect] SDK Status: ${status}`);

    if (status === SdkAvailabilityStatus.SDK_UNAVAILABLE) {
      console.error("[HealthConnect] SDK Unavailable on this device.");
      return false;
    }

    if (status === SdkAvailabilityStatus.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED) {
      console.error("[HealthConnect] Provider update required.");
      return false;
    }

    console.log("[HealthConnect] Initializing...");
    const isInitialized = await initialize();
    console.log(`[HealthConnect] Initialized result: ${isInitialized}`);

    // 注意：即使 initialize 回傳 false，有時仍可請求權限 (視 SDK 版本與狀態)

    console.log("[HealthConnect] Requesting permissions...");
    const granted = await requestPermission(PERMISSIONS);
    console.log("[HealthConnect] Permissions requested. Granted list:", JSON.stringify(granted));

    // 再次確認權限
    const permissions = await getGrantedPermissions();
    console.log("[HealthConnect] Final Granted Permissions:", JSON.stringify(permissions));

    // 只要有任何一個權限被允許，我們就視為成功
    const isSuccess = permissions.length > 0;
    return isSuccess;

  } catch (e: any) {
    console.error("[HealthConnect] Connection Error:", e);
    return false;
  }
}

/**
 * 讀取指定範圍的健康數據 (對應首頁的 getHealthData)
 * @param start 開始時間
 * @param end 結束時間
 */
export async function getHealthData(start: Date, end: Date) {
  if (Platform.OS !== 'android') return { steps: [], sleep: [] };

  try {
    console.log(`[HealthConnect] Fetching data from ${start.toISOString()} to ${end.toISOString()}`);
    
    // 讀取步數
    const stepsResult = await readRecords('Steps', {
      timeRangeFilter: {
        operator: 'between',
        startTime: start.toISOString(),
        endTime: end.toISOString(),
      },
    });

    // 讀取睡眠
    const sleepResult = await readRecords('SleepSession', {
      timeRangeFilter: {
        operator: 'between',
        startTime: start.toISOString(),
        endTime: end.toISOString(),
      },
    });

    console.log(`[HealthConnect] Fetched ${stepsResult.length} step records and ${sleepResult.length} sleep records.`);

    return {
      steps: stepsResult,
      sleep: sleepResult
    };

  } catch (e) {
    console.error("[HealthConnect] Read Data Error:", e);
    // 發生錯誤時回傳空陣列，避免首頁崩潰
    return { steps: [], sleep: [] };
  }
}

// 為了相容性保留舊函數名稱 (選用)
export const connectHealthConnect = initHealthConnect;