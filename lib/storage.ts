import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  USER_SESSION: 'user_session',
  PROFILE: 'user_profile',
  FOOD_LOGS: 'food_logs',
  ACTIVITY_LOGS: 'activity_logs',
  PRODUCTS: 'saved_products',
  WEIGHTS: 'weight_history',
  SETTINGS: 'app_settings',
};

// 設定 (API Key, Model, Language)
export const saveSettings = async (settings: { apiKey?: string; model?: string; language?: string }) => {
  const current = await getSettings();
  const newSettings = { ...current, ...settings };
  await AsyncStorage.setItem(KEYS.SETTINGS, JSON.stringify(newSettings));
  return newSettings;
};

export const getSettings = async () => {
  const data = await AsyncStorage.getItem(KEYS.SETTINGS);
  return data ? JSON.parse(data) : { apiKey: "", model: "gemini-2.5-flash", language: "zh-TW" };
};

// ... (User Session 保持不變) ...
export const loginLocal = async (name: string) => { const user = { name, id: 'local_user', email: 'local@device' }; await AsyncStorage.setItem(KEYS.USER_SESSION, JSON.stringify(user)); return user; };
export const logoutLocal = async () => { await AsyncStorage.removeItem(KEYS.USER_SESSION); };
export const getLocalUser = async () => { const data = await AsyncStorage.getItem(KEYS.USER_SESSION); return data ? JSON.parse(data) : null; };

// 體重與體脂歷史
export const saveWeightLog = async (weight: number, bodyFat?: number) => {
  const data = await AsyncStorage.getItem(KEYS.WEIGHTS);
  const history = data ? JSON.parse(data) : [];
  const today = new Date().toISOString().split('T')[0]; // UTC date logic for simple grouping
  
  const existingIndex = history.findIndex((h: any) => h.date.startsWith(today));
  if (existingIndex >= 0) {
    history[existingIndex].weight = weight;
    if (bodyFat) history[existingIndex].bodyFat = bodyFat;
  } else {
    history.push({ date: new Date().toISOString(), weight, bodyFat: bodyFat || 0 });
  }
  
  // 移除 30 筆限制，改為保留更多以支援年視圖 (例如 365 筆)
  if (history.length > 365) history.shift();
  await AsyncStorage.setItem(KEYS.WEIGHTS, JSON.stringify(history));
};

export const getWeightHistory = async () => {
  const data = await AsyncStorage.getItem(KEYS.WEIGHTS);
  return data ? JSON.parse(data) : [];
};

export const saveProfileLocal = async (profileData: any) => {
  await AsyncStorage.setItem(KEYS.PROFILE, JSON.stringify(profileData));
  if (profileData.currentWeightKg) {
    await saveWeightLog(profileData.currentWeightKg, profileData.bodyFatPercentage);
  }
  return profileData;
};

export const getProfileLocal = async () => {
  const data = await AsyncStorage.getItem(KEYS.PROFILE);
  return data ? JSON.parse(data) : null;
};

// ... (Products, FoodLogs, ActivityLogs CRUD 保持不變) ...
export const saveProductLocal = async (barcode: string, productData: any) => { const data = await AsyncStorage.getItem(KEYS.PRODUCTS); const products = data ? JSON.parse(data) : {}; products[barcode] = productData; await AsyncStorage.setItem(KEYS.PRODUCTS, JSON.stringify(products)); };
export const getProductByBarcode = async (barcode: string) => { const data = await AsyncStorage.getItem(KEYS.PRODUCTS); const products = data ? JSON.parse(data) : {}; return products[barcode] || null; };
export const getFoodLogsLocal = async () => { const data = await AsyncStorage.getItem(KEYS.FOOD_LOGS); return data ? JSON.parse(data) : []; };
export const saveFoodLogLocal = async (log: any) => { const existingLogs = await getFoodLogsLocal(); const newLog = { ...log, id: Date.now(), loggedAt: log.loggedAt || new Date().toISOString() }; const updatedLogs = [newLog, ...existingLogs]; await AsyncStorage.setItem(KEYS.FOOD_LOGS, JSON.stringify(updatedLogs)); return newLog; };
export const updateFoodLogLocal = async (updatedLog: any) => { const existingLogs = await getFoodLogsLocal(); const updatedLogs = existingLogs.map((log: any) => log.id === updatedLog.id ? { ...log, ...updatedLog } : log); await AsyncStorage.setItem(KEYS.FOOD_LOGS, JSON.stringify(updatedLogs)); };
export const deleteFoodLogLocal = async (id: number) => { const existingLogs = await getFoodLogsLocal(); const updatedLogs = existingLogs.filter((log: any) => log.id !== id); await AsyncStorage.setItem(KEYS.FOOD_LOGS, JSON.stringify(updatedLogs)); };
export const getActivityLogsLocal = async () => { const data = await AsyncStorage.getItem(KEYS.ACTIVITY_LOGS); return data ? JSON.parse(data) : []; };
export const saveActivityLogLocal = async (log: any) => { const existingLogs = await getActivityLogsLocal(); const newLog = { ...log, id: Date.now(), loggedAt: log.loggedAt || new Date().toISOString() }; const updatedLogs = [newLog, ...existingLogs]; await AsyncStorage.setItem(KEYS.ACTIVITY_LOGS, JSON.stringify(updatedLogs)); return newLog; };
export const updateActivityLogLocal = async (updatedLog: any) => { const existingLogs = await getActivityLogsLocal(); const updatedLogs = existingLogs.map((log: any) => log.id === updatedLog.id ? { ...log, ...updatedLog } : log); await AsyncStorage.setItem(KEYS.ACTIVITY_LOGS, JSON.stringify(updatedLogs)); };
export const deleteActivityLogLocal = async (id: number) => { const existingLogs = await getActivityLogsLocal(); const updatedLogs = existingLogs.filter((log: any) => log.id !== id); await AsyncStorage.setItem(KEYS.ACTIVITY_LOGS, JSON.stringify(updatedLogs)); };

// 5. 每日摘要 (修正日期比對邏輯)
export const getDailySummaryLocal = async (date: Date = new Date()) => {
  const foodLogs = await getFoodLogsLocal();
  const activityLogs = await getActivityLogsLocal();
  // 修正：使用本地日期格式 YYYY-MM-DD
  const toLocalISO = (d: Date) => {
    const offset = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - offset).toISOString().split('T')[0];
  };
  const dateStr = toLocalISO(date);
  
  const todayFood = foodLogs.filter((log: any) => toLocalISO(new Date(log.loggedAt)) === dateStr);
  const todayActivity = activityLogs.filter((log: any) => toLocalISO(new Date(log.loggedAt)) === dateStr);
  
  return {
    totalCaloriesIn: todayFood.reduce((sum: number, log: any) => sum + (log.totalCalories || 0), 0),
    totalCaloriesOut: todayActivity.reduce((sum: number, log: any) => sum + (log.caloriesBurned || 0), 0),
    totalProtein: todayFood.reduce((sum: number, log: any) => sum + (log.totalProteinG || 0), 0),
    totalCarbs: todayFood.reduce((sum: number, log: any) => sum + (log.totalCarbsG || 0), 0),
    totalFat: todayFood.reduce((sum: number, log: any) => sum + (log.totalFatG || 0), 0),
    totalSodium: todayFood.reduce((sum: number, log: any) => sum + (log.totalSodiumMg || 0), 0),
    foodLogs: todayFood,
    activityLogs: todayActivity
  };
};

export const getFrequentFoodItems = async () => {
  const logs = await getFoodLogsLocal();
  const frequency: Record<string, number> = {};
  logs.forEach((log: any) => { if(log.foodName) frequency[log.foodName] = (frequency[log.foodName] || 0) + 1; });
  return Object.entries(frequency).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name]) => logs.find((l: any) => l.foodName === name));
};

// 6. 分析資料獲取 (改為獲取所有原始資料，讓前端處理聚合)
export const getAllHistoryData = async () => {
  const foodLogs = await getFoodLogsLocal();
  const activityLogs = await getActivityLogsLocal();
  const weightHistory = await getWeightHistory();
  return { foodLogs, activityLogs, weightHistory };
};