import {
  initialize,
  requestPermission,
  readRecords,
  getGrantedPermissions,
  getSdkStatus,
  SdkAvailabilityStatus,
} from 'react-native-health-connect';
import { Permission } from 'react-native-health-connect/lib/typescript/types';
import { Platform, Alert, Linking } from 'react-native';

const PERMISSIONS: Permission[] = [
  { accessType: 'read', recordType: 'Steps' },
  { accessType: 'read', recordType: 'SleepSession' },
  { accessType: 'read', recordType: 'ExerciseSession' },
];

export type HealthConnectInitResult = {
  platform: 'android' | 'unsupported';
  sdkStatus: number | string | null;
  initialized: boolean;
  available: boolean;
  granted: {
    steps: boolean;
    sleep: boolean;
    exercise: boolean;
  };
  missing: string[];
  canRead: boolean;
  message: string;
  error?: string;
};

export type HealthDataReadResult = {
  steps: any[];
  sleep: any[];
  errors: string[];
};

const hasPermission = (permissions: Permission[], recordType: Permission['recordType']) => {
  return permissions.some((p) => p.recordType === recordType && p.accessType === 'read');
};

const buildPermissionState = (permissions: Permission[]) => {
  const steps = hasPermission(permissions, 'Steps');
  const sleep = hasPermission(permissions, 'SleepSession');
  const exercise = hasPermission(permissions, 'ExerciseSession');

  return {
    granted: { steps, sleep, exercise },
    missing: [
      !steps ? 'Steps' : null,
      !sleep ? 'SleepSession' : null,
      !exercise ? 'ExerciseSession' : null,
    ].filter(Boolean) as string[],
  };
};

export async function openHealthConnectSettings() {
  if (Platform.OS !== 'android') return;

  const candidates = [
    'android.settings.HEALTH_CONNECT_SETTINGS',
    'android.settings.SETTINGS',
  ];

  for (const url of candidates) {
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
        return;
      }
    } catch (e) {
      console.log('[HealthConnect] Open settings warning:', e);
    }
  }
}

export async function initHealthConnect(): Promise<boolean> {
  const status = await initHealthConnectDetailed();
  if (!status.canRead) {
    console.log('[HealthConnect] Not ready:', status);
  }
  return status.canRead;
}

export async function initHealthConnectDetailed(): Promise<HealthConnectInitResult> {
  if (Platform.OS !== 'android') {
    return {
      platform: 'unsupported',
      sdkStatus: null,
      initialized: false,
      available: false,
      granted: { steps: false, sleep: false, exercise: false },
      missing: ['Android only'],
      canRead: false,
      message: 'Health Connect is only supported on Android in this build.',
    };
  }

  let sdkStatus: number | string | null = null;
  let initialized = false;

  try {
    sdkStatus = await getSdkStatus();
    console.log('[HealthConnect] SDK Status:', sdkStatus);

    try {
      await initialize();
      initialized = true;
    } catch (e: any) {
      initialized = true;
      console.log('[HealthConnect] Init warning:', e?.message || e);
    }

    const beforePermissions = await getGrantedPermissions();
    const before = buildPermissionState(beforePermissions);

    if (before.missing.length === 0) {
      return {
        platform: 'android',
        sdkStatus,
        initialized,
        available: true,
        granted: before.granted,
        missing: [],
        canRead: true,
        message: 'Health Connect permissions are already granted.',
      };
    }

    try {
      await requestPermission(PERMISSIONS);
    } catch (reqErr: any) {
      const message = reqErr?.message || String(reqErr);
      console.error('[HealthConnect] Request permission error:', reqErr);

      return {
        platform: 'android',
        sdkStatus,
        initialized,
        available: true,
        granted: before.granted,
        missing: before.missing,
        canRead: false,
        message: message.includes('fail to map')
          ? 'Health Connect permission request could not be mapped. The APK manifest is likely missing Health Connect permission declarations.'
          : 'Health Connect permission request failed or was cancelled.',
        error: message,
      };
    }

    const afterPermissions = await getGrantedPermissions();
    const after = buildPermissionState(afterPermissions);

    return {
      platform: 'android',
      sdkStatus,
      initialized,
      available: true,
      granted: after.granted,
      missing: after.missing,
      canRead: after.granted.steps || after.granted.sleep || after.granted.exercise,
      message: after.missing.length === 0
        ? 'All requested Health Connect permissions are granted.'
        : `Health Connect permissions are partially granted. Missing: ${after.missing.join(', ')}`,
    };
  } catch (e: any) {
    const message = e?.message || String(e);
    Alert.alert('Health Connect Error', message);
    return {
      platform: 'android',
      sdkStatus,
      initialized,
      available: false,
      granted: { steps: false, sleep: false, exercise: false },
      missing: ['Steps', 'SleepSession', 'ExerciseSession'],
      canRead: false,
      message: 'Health Connect is not available or cannot be initialized.',
      error: message,
    };
  }
}

export async function getHealthData(start: Date, end: Date): Promise<HealthDataReadResult> {
  if (Platform.OS !== 'android') return { steps: [], sleep: [], errors: [] };

  const errors: string[] = [];
  let steps: any[] = [];
  let sleep: any[] = [];

  try {
    const stepsResult = await readRecords('Steps', {
      timeRangeFilter: {
        operator: 'between',
        startTime: start.toISOString(),
        endTime: end.toISOString(),
      },
    });
    steps = stepsResult.records || [];
  } catch (e: any) {
    const message = e?.message || String(e);
    console.log('[HealthConnect] Read steps error:', message);
    errors.push(`Steps: ${message}`);
  }

  try {
    const sleepResult = await readRecords('SleepSession', {
      timeRangeFilter: {
        operator: 'between',
        startTime: start.toISOString(),
        endTime: end.toISOString(),
      },
    });
    sleep = sleepResult.records || [];
  } catch (e: any) {
    const message = e?.message || String(e);
    console.log('[HealthConnect] Read sleep error:', message);
    errors.push(`SleepSession: ${message}`);
  }

  return { steps, sleep, errors };
}

export const connectHealthConnect = initHealthConnect;
