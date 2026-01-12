import {
  initialize,
  requestPermission,
  readRecords,
  getGrantedPermissions,
  getSdkStatus,
  SdkAvailabilityStatus,
} from 'react-native-health-connect';
import { Permission } from 'react-native-health-connect/lib/typescript/types';

// 定義需要的權限列表
const PERMISSIONS: Permission[] = [
  { accessType: 'read', recordType: 'Steps' },
  { accessType: 'read', recordType: 'SleepSession' },
  { accessType: 'read', recordType: 'ExerciseSession' },
];

/**
 * 初始化並請求權限
 * @returns boolean 是否成功連結
 */
export async function connectHealthConnect(): Promise<boolean> {
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
      // 這裡通常需要引導使用者去 Play Store 更新，但暫時回傳 false
      return false;
    }

    console.log("[HealthConnect] Initializing...");
    const isInitialized = await initialize();
    console.log(`[HealthConnect] Initialized result: ${isInitialized}`);

    if (!isInitialized) {
        console.error("[HealthConnect] Initialize returned false. Check logs/manifest.");
        // 注意：有些設備即使 initialize 回傳 false，仍可繼續請求權限，視版本而定，
        // 但通常 false 代表無法與服務溝通 (例如 package visibility 問題)
        // 我們這裡不直接 return false，嘗試繼續往下跑跑看，或觀察 log
    }

    console.log("[HealthConnect] Requesting permissions...");
    // 請求權限
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
    if (e && e.message) {
        console.error("[HealthConnect] Error Message:", e.message);
    }
    return false;
  }
}

/**
 * 讀取今日步數
 */
export async function readTodaySteps(): Promise<number> {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const now = new Date();

    const result = await readRecords('Steps', {
      timeRangeFilter: {
        operator: 'between',
        startTime: today.toISOString(),
        endTime: now.toISOString(),
      },
    });

    // 加總所有步數紀錄
    const totalSteps = result.reduce((sum, record) => sum + record.count, 0);
    console.log(`[HealthConnect] Read Steps: ${totalSteps}`);
    return totalSteps;
  } catch (e) {
    console.error("[HealthConnect] Read Steps Error:", e);
    return 0;
  }
}

/**
 * 讀取今日燃燒卡路里 (從運動紀錄)
 * 注意：這只是 Active Calories，BMR 需要另外算
 */
export async function readTodayCaloriesBurned(): Promise<number> {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const now = new Date();

    // 這裡我們只讀取 ExerciseSession，有些 App 會寫入 TotalCaloriesBurned
    // 這裡示範讀取運動期間的熱量
    // 實務上 Health Connect 有 'TotalCaloriesBurned' record type，但需要額外權限
    // 這裡暫時回傳 0 或依需求擴充
    return 0;
  } catch (e) {
    console.error("[HealthConnect] Read Calories Error:", e);
    return 0;
  }
}