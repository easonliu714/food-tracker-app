import {
  initialize,
  requestPermission,
  readRecords,
  getGrantedPermissions,
  getSdkStatus,
} from 'react-native-health-connect';
import { Permission } from 'react-native-health-connect/lib/typescript/types';
import { Platform, Alert, Linking } from 'react-native';

const PERMISSIONS: Permission[] = [
  { accessType: 'read', recordType: 'Steps' },
  { accessType: 'read', recordType: 'SleepSession' },
  { accessType: 'read', recordType: 'ExerciseSession' },
];

const SOURCE_PRIORITY = [
  'fitbit',
  'com.fitbit',
  'com.fitbit.fitbitmobile',
  'google.android.apps.fitness',
  'com.google.android.apps.fitness',
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
  diagnostics: {
    steps: {
      rawCount: number;
      selectedOrigin: string;
      originTotals: Record<string, number>;
    };
    sleep: {
      rawCount: number;
      selectedOrigin: string;
      originHours: Record<string, number>;
    };
  };
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

const getOrigin = (record: any): string => {
  const candidates = [
    record?.metadata?.dataOrigin?.packageName,
    record?.metadata?.dataOrigin,
    record?.metadata?.clientRecordId,
    record?.metadata?.device?.manufacturer,
    record?.metadata?.device?.model,
  ];

  const found = candidates.find((v) => typeof v === 'string' && v.trim().length > 0);
  return (found || 'unknown').toString().toLowerCase();
};

const pickPreferredOrigin = (totals: Record<string, number>): string | null => {
  const origins = Object.keys(totals).filter((origin) => totals[origin] > 0);
  if (origins.length === 0) return null;

  for (const keyword of SOURCE_PRIORITY) {
    const matched = origins.find((origin) => origin.includes(keyword));
    if (matched) return matched;
  }

  // Fallback: choose the largest single source rather than summing across all sources.
  // This prevents double counting when Health Connect contains the same metric from
  // Fitbit, Google Fit, phone sensor, and derived/merged sources at the same time.
  return origins.sort((a, b) => totals[b] - totals[a])[0];
};

const recordOverlapHours = (record: any, start: Date, end: Date): number => {
  const recordStart = new Date(record.startTime).getTime();
  const recordEnd = new Date(record.endTime).getTime();
  const windowStart = start.getTime();
  const windowEnd = end.getTime();
  const overlapStart = Math.max(recordStart, windowStart);
  const overlapEnd = Math.min(recordEnd, windowEnd);
  if (!Number.isFinite(overlapStart) || !Number.isFinite(overlapEnd) || overlapEnd <= overlapStart) {
    return 0;
  }
  return (overlapEnd - overlapStart) / (1000 * 60 * 60);
};

const clipSleepRecord = (record: any, start: Date, end: Date) => {
  const recordStart = new Date(record.startTime).getTime();
  const recordEnd = new Date(record.endTime).getTime();
  const overlapStart = Math.max(recordStart, start.getTime());
  const overlapEnd = Math.min(recordEnd, end.getTime());

  return {
    ...record,
    startTime: new Date(overlapStart).toISOString(),
    endTime: new Date(overlapEnd).toISOString(),
  };
};

const selectStepRecords = (records: any[]) => {
  const originTotals: Record<string, number> = {};
  for (const record of records) {
    const origin = getOrigin(record);
    originTotals[origin] = (originTotals[origin] || 0) + (Number(record.count) || 0);
  }

  const selectedOrigin = pickPreferredOrigin(originTotals);
  if (!selectedOrigin) {
    return { selected: [], selectedOrigin: 'none', originTotals };
  }

  return {
    selected: records.filter((record) => getOrigin(record) === selectedOrigin),
    selectedOrigin,
    originTotals,
  };
};

const selectSleepRecords = (records: any[], start: Date, end: Date) => {
  const originHours: Record<string, number> = {};
  for (const record of records) {
    const origin = getOrigin(record);
    originHours[origin] = (originHours[origin] || 0) + recordOverlapHours(record, start, end);
  }

  const selectedOrigin = pickPreferredOrigin(originHours);
  if (!selectedOrigin) {
    return { selected: [], selectedOrigin: 'none', originHours };
  }

  return {
    selected: records
      .filter((record) => getOrigin(record) === selectedOrigin)
      .map((record) => clipSleepRecord(record, start, end))
      .filter((record) => new Date(record.endTime).getTime() > new Date(record.startTime).getTime()),
    selectedOrigin,
    originHours,
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
  if (Platform.OS !== 'android') {
    return {
      steps: [],
      sleep: [],
      errors: [],
      diagnostics: {
        steps: { rawCount: 0, selectedOrigin: 'unsupported', originTotals: {} },
        sleep: { rawCount: 0, selectedOrigin: 'unsupported', originHours: {} },
      },
    };
  }

  const errors: string[] = [];
  let rawSteps: any[] = [];
  let rawSleep: any[] = [];

  try {
    const stepsResult = await readRecords('Steps', {
      timeRangeFilter: {
        operator: 'between',
        startTime: start.toISOString(),
        endTime: end.toISOString(),
      },
    });
    rawSteps = stepsResult.records || [];
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
    rawSleep = sleepResult.records || [];
  } catch (e: any) {
    const message = e?.message || String(e);
    console.log('[HealthConnect] Read sleep error:', message);
    errors.push(`SleepSession: ${message}`);
  }

  const stepSelection = selectStepRecords(rawSteps);
  const sleepSelection = selectSleepRecords(rawSleep, start, end);

  console.log('[HealthConnect] Steps origin totals:', stepSelection.originTotals, 'selected:', stepSelection.selectedOrigin);
  console.log('[HealthConnect] Sleep origin hours:', sleepSelection.originHours, 'selected:', sleepSelection.selectedOrigin);

  return {
    steps: stepSelection.selected,
    sleep: sleepSelection.selected,
    errors,
    diagnostics: {
      steps: {
        rawCount: rawSteps.length,
        selectedOrigin: stepSelection.selectedOrigin,
        originTotals: stepSelection.originTotals,
      },
      sleep: {
        rawCount: rawSleep.length,
        selectedOrigin: sleepSelection.selectedOrigin,
        originHours: sleepSelection.originHours,
      },
    },
  };
}

export const connectHealthConnect = initHealthConnect;
