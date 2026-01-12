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
    const status = await getSdkStatus();
    if (status !== SdkAvailabilityStatus.SDK_AVAILABLE) {
      Alert.alert("Debug", `SDK Status Error: ${status}\n(1=Unavail, 2=UpdateReq, 3=Avail)`);
      return false;
    }

    const isInitialized = await initialize();
    if (!isInitialized) {
        // 在某些手機上即使 initialize 回傳 false 也能運作，但通常是設定問題
        console.log("Health Connect initialize returned false"); 
    }

    try {
        const granted = await requestPermission(PERMISSIONS);
        
        // 如果回傳空，再確認一次現有權限
        if (granted.length === 0) {
            const check = await getGrantedPermissions();
            if (check.length === 0) {
                // 這是最關鍵的錯誤：系統拒絕顯示權限視窗
                Alert.alert("Debug", "Permission Request Failed.\nReturns empty list.\nCheck: Manifest Category or Settings Block.");
                return false;
            }
            return true;
        }
        return true;
    } catch (permError: any) {
        Alert.alert("Debug", `Permission Error: ${permError.message}`);
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

export const connectHealthConnect = initHealthConnect;