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
    if (status !== SdkAvailabilityStatus.SDK_AVAILABLE) {
      // [除錯] 彈出狀態碼
      Alert.alert("Debug", `SDK Status Unavailable: ${status}\n(1=Unavail, 2=UpdateRequired, 3=Available)`);
      return false;
    }

    // 2. 初始化
    const isInitialized = await initialize();
    if (!isInitialized) {
        // [除錯] 初始化失敗
        Alert.alert("Debug", "Health Connect Initialize returned FALSE");
        return false;
    }

    // 3. 請求權限
    try {
        const granted = await requestPermission(PERMISSIONS);
        
        // [除錯] 顯示拿到的權限數量
        if (granted.length === 0) {
            // 嘗試再次確認權限 (有時候 requestPermission 回傳空但實際上有權限)
            const checkAgain = await getGrantedPermissions();
            if (checkAgain.length === 0) {
                Alert.alert("Debug", "Permission Request returned EMPTY list.\n(Delegate issue or User cancelled)");
                return false;
            }
            return true;
        }
        return true;
    } catch (permError: any) {
        Alert.alert("Debug", `Request Permission Error: ${permError.message}`);
        return false;
    }

  } catch (e: any) {
    Alert.alert("Debug", `Init Error: ${e.message}`);
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

// 相容舊名稱
export const connectHealthConnect = initHealthConnect;