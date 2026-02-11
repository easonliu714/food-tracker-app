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
    console.log("Health Connect SDK Status:", status);
    
    // 即使 Status 不是 SDK_AVAILABLE，也嘗試初始化，因為部分裝置回傳值可能有異
    try {
        await initialize();
    } catch (e) {
        console.log("Init warning (might be already initialized):", e);
    }

    const grantedPermissions = await getGrantedPermissions();
    // [修正 6] 更嚴謹的權限檢查邏輯
    const missingPermissions = PERMISSIONS.filter(p => 
        !grantedPermissions.some(g => g.recordType === p.recordType && g.accessType === p.accessType)
    );

    if (missingPermissions.length === 0) {
        return true;
    }

    try {
        const granted = await requestPermission(PERMISSIONS);
        // 如果使用者取消或失敗，granted 會是空陣列
        return granted.length > 0;
    } catch (reqErr: any) {
        // [修正 6] 捕捉特定錯誤
        console.error("Health Connect Request Error:", reqErr);
        if (reqErr.message.includes("fail to map")) {
             Alert.alert("Configuration Error", "Health Connect not configured properly in AndroidManifest. XML config missing.");
        }
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