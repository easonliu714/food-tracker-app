import { initialize, requestPermission, readRecords } from 'react-native-health-connect';

export async function initHealthConnect() {
  // 1. 初始化
  const isInitialized = await initialize();
  if (!isInitialized) return false;

  // 2. 請求權限
  const permissions = [
    { accessType: 'read', recordType: 'Steps' },
    { accessType: 'read', recordType: 'SleepSession' },
    { accessType: 'read', recordType: 'ExerciseSession' },
  ];
  
  // 3. 執行授權流程
  const granted = await requestPermission(permissions);
  return granted;
}

export async function getHealthData(startTime: Date, endTime: Date) {
  // 讀取步數
  const steps = await readRecords('Steps', {
    timeRangeFilter: { operator: 'between', startTime: startTime.toISOString(), endTime: endTime.toISOString() }
  });

  // 讀取睡眠
  const sleep = await readRecords('SleepSession', {
    timeRangeFilter: { operator: 'between', startTime: startTime.toISOString(), endTime: endTime.toISOString() }
  });

  return { steps, sleep };
}
