import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  USER_SESSION: 'user_session',
  PROFILE: 'user_profile',
  FOOD_LOGS: 'food_logs',
  ACTIVITY_LOGS: 'activity_logs', // 新增運動紀錄 Key
};

// 1. 使用者 & 個人檔案
export const loginLocal = async (name: string) => {
  const user = { name, id: 'local_user', email: 'local@device' };
  await AsyncStorage.setItem(KEYS.USER_SESSION, JSON.stringify(user));
  return user;
};

export const logoutLocal = async () => {
  await AsyncStorage.removeItem(KEYS.USER_SESSION);
};

export const getLocalUser = async () => {
  const data = await AsyncStorage.getItem(KEYS.USER_SESSION);
  return data ? JSON.parse(data) : null;
};

export const saveProfileLocal = async (profileData: any) => {
  await AsyncStorage.setItem(KEYS.PROFILE, JSON.stringify(profileData));
  return profileData;
};

export const getProfileLocal = async () => {
  const data = await AsyncStorage.getItem(KEYS.PROFILE);
  return data ? JSON.parse(data) : null;
};

// 2. 飲食紀錄 (CRUD)
export const getFoodLogsLocal = async () => {
  const data = await AsyncStorage.getItem(KEYS.FOOD_LOGS);
  return data ? JSON.parse(data) : [];
};

export const saveFoodLogLocal = async (log: any) => {
  const existingLogs = await getFoodLogsLocal();
  const newLog = { ...log, id: Date.now(), loggedAt: log.loggedAt || new Date().toISOString() };
  const updatedLogs = [newLog, ...existingLogs];
  await AsyncStorage.setItem(KEYS.FOOD_LOGS, JSON.stringify(updatedLogs));
  return newLog;
};

export const updateFoodLogLocal = async (updatedLog: any) => {
  const existingLogs = await getFoodLogsLocal();
  const updatedLogs = existingLogs.map((log: any) => 
    log.id === updatedLog.id ? { ...log, ...updatedLog } : log
  );
  await AsyncStorage.setItem(KEYS.FOOD_LOGS, JSON.stringify(updatedLogs));
};

export const deleteFoodLogLocal = async (id: number) => {
  const existingLogs = await getFoodLogsLocal();
  const updatedLogs = existingLogs.filter((log: any) => log.id !== id);
  await AsyncStorage.setItem(KEYS.FOOD_LOGS, JSON.stringify(updatedLogs));
};

// 3. 運動紀錄 (New)
export const getActivityLogsLocal = async () => {
  const data = await AsyncStorage.getItem(KEYS.ACTIVITY_LOGS);
  return data ? JSON.parse(data) : [];
};

export const saveActivityLogLocal = async (log: any) => {
  const existingLogs = await getActivityLogsLocal();
  const newLog = { ...log, id: Date.now(), loggedAt: log.loggedAt || new Date().toISOString() };
  const updatedLogs = [newLog, ...existingLogs];
  await AsyncStorage.setItem(KEYS.ACTIVITY_LOGS, JSON.stringify(updatedLogs));
  return newLog;
};

export const deleteActivityLogLocal = async (id: number) => {
  const existingLogs = await getActivityLogsLocal();
  const updatedLogs = existingLogs.filter((log: any) => log.id !== id);
  await AsyncStorage.setItem(KEYS.ACTIVITY_LOGS, JSON.stringify(updatedLogs));
};

// 4. 進階查詢功能
export const getDailySummaryLocal = async (date: Date = new Date()) => {
  const foodLogs = await getFoodLogsLocal();
  const activityLogs = await getActivityLogsLocal();
  const dateStr = date.toISOString().split('T')[0];
  
  const todayFood = foodLogs.filter((log: any) => log.loggedAt.startsWith(dateStr));
  const todayActivity = activityLogs.filter((log: any) => log.loggedAt.startsWith(dateStr));
  
  return {
    totalCaloriesIn: todayFood.reduce((sum: number, log: any) => sum + (log.totalCalories || 0), 0),
    totalCaloriesOut: todayActivity.reduce((sum: number, log: any) => sum + (log.caloriesBurned || 0), 0),
    totalProtein: todayFood.reduce((sum: number, log: any) => sum + (log.totalProteinG || 0), 0),
    totalCarbs: todayFood.reduce((sum: number, log: any) => sum + (log.totalCarbsG || 0), 0),
    totalFat: todayFood.reduce((sum: number, log: any) => sum + (log.totalFatG || 0), 0),
    foodLogs: todayFood,
    activityLogs: todayActivity
  };
};

export const getFrequentFoodItems = async () => {
  const logs = await getFoodLogsLocal();
  const frequency: Record<string, number> = {};
  logs.forEach((log: any) => {
    // 簡單用名稱分組
    const name = log.foodName;
    frequency[name] = (frequency[name] || 0) + 1;
  });
  
  // 取前 5 名
  return Object.entries(frequency)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name]) => {
      // 找回該食物的詳細資料(取最新一筆)
      const refLog = logs.find((l: any) => l.foodName === name);
      return refLog;
    });
};

export const getHistory7DaysLocal = async () => {
  const foodLogs = await getFoodLogsLocal();
  const activityLogs = await getActivityLogsLocal();
  const history = [];

  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];

    const dayFood = foodLogs.filter((l: any) => l.loggedAt.startsWith(dateStr));
    const dayActivity = activityLogs.filter((l: any) => l.loggedAt.startsWith(dateStr));

    history.push({
      date: d,
      caloriesIn: dayFood.reduce((s: number, l: any) => s + (l.totalCalories || 0), 0),
      caloriesOut: dayActivity.reduce((s: number, l: any) => s + (l.caloriesBurned || 0), 0),
    });
  }
  return history;
};