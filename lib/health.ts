import {
  initialize,
  requestPermission,
  readRecords,
  getGrantedPermissions,
  getSdkStatus,
  SdkAvailabilityStatus,
} from 'react-native-health-connect';
import { Permission } from 'react-native-health-connect/lib/typescript/types';
import { Platform, Alert } from 'react-native';

const PERMISSIONS: Permission[] = [
  { accessType: 'read', recordType: 'Steps' },
  { accessType: 'read', recordType: 'SleepSession' },
  { accessType: 'read', recordType: 'ExerciseSession' },
];

export async function initHealthConnect(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;

  try {
    // 1. 檢查 SDK 狀態
    const status = await getSdkStatus();
    
    // [修改開始] Android 14+ (API 34) 內建 Health Connect，狀態可能是 SDK_AVAILABLE
    // 舊版則需要安裝 app
    if (status !== SdkAvailabilityStatus.SDK_AVAILABLE) {
       // 嘗試引導使用者，但如果是 Android 16 (Preview)，有時候狀態碼會有變異，先不阻擋
       console.warn("Health Connect SDK Status:", status);
    }

    // 2. 初始化
    // 在 Android 14+ 上，這步通常會自動成功或被忽略，但在舊版是必須的
    try {
        await initialize();
    } catch (e) {
        // 忽略初始化錯誤，繼續嘗試請求權限
        console.log("Health Connect initialize info:", e); 
    }

    // 3. 請求權限
    try {
        // 先檢查是否已經有權限了
        const grantedPermissions = await getGrantedPermissions();
        // 簡單比對：如果有拿到任何權限，通常代表已授權過（簡化邏輯）
        const hasAllPermissions = PERMISSIONS.every(p => 
            grantedPermissions.some(g => g.recordType === p.recordType && g.accessType === p.accessType)
        );

        if (hasAllPermissions) {
            return true;
        }

        // 若無，則彈出視窗請求
        const granted = await requestPermission(PERMISSIONS);
        
        // Android 14+ 如果使用者在系統設定中把權限設為「永遠拒絕」，requestPermission 會直接回傳空陣列而不跳窗
        // 這時需要引導使用者去設定
        if (granted.length === 0) {
             // 再次確認，怕是 requestPermission 行為差異
             const check = await getGrantedPermissions();
             return check.length > 0;
        }
        return true;
    } catch (permError: any) {
        console.error("Health Connect Permission Error:", permError);
        // 如果錯誤訊息包含 "background intent"，通常是 AndroidManifest 設定問題
        return false;
    }

  } catch (e: any) {
    Alert.alert("Health Connect Error", e.message);
    return false;
  }
}

export async function getHealthData(start: Date, end: Date) {
  if (Platform.OS !== 'android') return { steps: [], sleep: [] };

  try {
    const stepsResult = await readRecords('Steps', {
      timeRangeFilter: {
        operator: 'between',
        startTime: start.toISOString(),
        endTime: end.toISOString(),
      },
    });

    const sleepResult = await readRecords('SleepSession', {
      timeRangeFilter: {
        operator: 'between',
        startTime: start.toISOString(),
        endTime: end.toISOString(),
      },
    });

    return {
      steps: stepsResult.records || [],
      sleep: sleepResult.records || []
    };

  } catch (e: any) {
    Alert.alert("Debug", `Read Data Error: ${e.message}`);
    return { steps: [], sleep: [] };
  }
}

export const connectHealthConnect = initHealthConnect;