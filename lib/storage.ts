import AsyncStorage from '@react-native-async-storage/async-storage';

// (前面 KEYS 和其他函式保持不變)
const KEYS = {
  USER_SESSION: 'user_session',
  PROFILE: 'user_profile',
  FOOD_LOGS: 'food_logs',
  ACTIVITY_LOGS: 'activity_logs',
  PRODUCTS: 'saved_products',
  WEIGHTS: 'weight_history',
  SETTINGS: 'app_settings',
  AI_ADVICE: 'ai_advice',
};

// --- 設定 ---
export const saveSettings = async (settings: any) => {
  const current = await getSettings();
  const newSettings = { ...current, ...settings };
  await AsyncStorage.setItem(KEYS.SETTINGS, JSON.stringify(newSettings));
  return newSettings;
};

export const getSettings = async () => {
  const data = await AsyncStorage.getItem(KEYS.SETTINGS);
  // [修改] 移除 FatSecret 欄位
  return data ? JSON.parse(data) : { 
    apiKey: "", 
    model: "gemini-flash-latest", 
    language: "zh-TW"
  };
};

// --- 使用者 ---
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

// --- 體重 & 體脂歷史 ---
export const saveWeightLog = async (weight: number, bodyFat?: number) => {
  const data = await AsyncStorage.getItem(KEYS.WEIGHTS);
  const history = data ? JSON.parse(data) : [];
  const today = new Date().toISOString().split('T')[0];
  
  const existingIndex = history.findIndex((h: any) => h.date.startsWith(today));
  if (existingIndex >= 0) {
    history[existingIndex].weight = weight;
    if (bodyFat) history[existingIndex].bodyFat = bodyFat;
  } else {
    history.push({ date: new Date().toISOString(), weight, bodyFat: bodyFat || 0 });
  }
  
  if (history.length > 365) history.shift();
  await AsyncStorage.setItem(KEYS.WEIGHTS, JSON.stringify(history));
};

export const getWeightHistory = async () => {
  const data = await AsyncStorage.getItem(KEYS.WEIGHTS);
  return data ? JSON.parse(data) : [];
};

// --- 個人檔案 ---
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

// [重點修正] 產品資料庫存取 (加入日誌)
export const saveProductLocal = async (barcode: string, productData: any) => {
  try {
    console.log(`[Storage] Saving product: ${barcode}`, productData.foodName);
    const data = await AsyncStorage.getItem(KEYS.PRODUCTS);
    const products = data ? JSON.parse(data) : {};
    products[barcode] = productData;
    await AsyncStorage.setItem(KEYS.PRODUCTS, JSON.stringify(products));
    console.log(`[Storage] Product saved successfully.`);
  } catch (e) {
    console.error(`[Storage] Failed to save product`, e);
  }
};

export const getProductByBarcode = async (barcode: string) => {
  try {
    const data = await AsyncStorage.getItem(KEYS.PRODUCTS);
    const products = data ? JSON.parse(data) : {};
    const product = products[barcode];
    console.log(`[Storage] Get product for ${barcode}:`, product ? "Found" : "Not Found");
    return product || null;
  } catch (e) {
    console.error(`[Storage] Failed to get product`, e);
    return null;
  }
};

// ... (以下為飲食紀錄、運動紀錄等，保持原樣)
export const getFoodLogsLocal = async () => {
  const data = await AsyncStorage.getItem(KEYS.FOOD_LOGS);
  return data ? JSON.parse(data) : [];
};

export const getFoodLogById = async (id: number) => {
  const logs = await getFoodLogsLocal();
  return logs.find((l: any) => l.id === id);
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

export const updateActivityLogLocal = async (updatedLog: any) => {
  const existingLogs = await getActivityLogsLocal();
  const updatedLogs = existingLogs.map((log: any) => 
    log.id === updatedLog.id ? { ...log, ...updatedLog } : log
  );
  await AsyncStorage.setItem(KEYS.ACTIVITY_LOGS, JSON.stringify(updatedLogs));
};

export const deleteActivityLogLocal = async (id: number) => {
  const existingLogs = await getActivityLogsLocal();
  const updatedLogs = existingLogs.filter((log: any) => log.id !== id);
  await AsyncStorage.setItem(KEYS.ACTIVITY_LOGS, JSON.stringify(updatedLogs));
};

export const deleteActivityLogsByType = async (type: string) => {
  const existingLogs = await getActivityLogsLocal();
  const updatedLogs = existingLogs.filter((log: any) => log.activityType !== type);
  await AsyncStorage.setItem(KEYS.ACTIVITY_LOGS, JSON.stringify(updatedLogs));
  return existingLogs.length - updatedLogs.length;
};

function toLocalISOString(date: Date) {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().split('T')[0];
}

export const getDailySummaryLocal = async (date: Date = new Date()) => {
  const foodLogs = await getFoodLogsLocal();
  const activityLogs = await getActivityLogsLocal();
  
  const dateStr = toLocalISOString(date);
  
  const todayFood = foodLogs.filter((log: any) => toLocalISOString(new Date(log.loggedAt)) === dateStr);
  const todayActivity = activityLogs.filter((log: any) => toLocalISOString(new Date(log.loggedAt)) === dateStr);
  
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
  logs.forEach((log: any) => {
    if (log.foodName) frequency[log.foodName] = (frequency[log.foodName] || 0) + 1;
  });
  return Object.entries(frequency)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name]) => logs.find((l: any) => l.foodName === name));
};

export const getFrequentActivityTypes = async () => {
  const logs = await getActivityLogsLocal();
  const frequency: Record<string, number> = {};
  const DEFAULT_TYPES = ['走路', '跑步', '爬梯', '打掃', '瑜珈', '一般運動'];
  logs.forEach((log: any) => {
    if (log.activityType) frequency[log.activityType] = (frequency[log.activityType] || 0) + 1;
  });
  const sorted = Object.keys(frequency).sort((a, b) => frequency[b] - frequency[a]);
  return Array.from(new Set([...sorted, ...DEFAULT_TYPES]));
};

export const getAggregatedHistory = async (period: 'week'|'month_day'|'month_week'|'year') => {
  const foodLogs = await getFoodLogsLocal();
  const activityLogs = await getActivityLogsLocal();
  const weightHistory = await getWeightHistory();
  const aggregated: Record<string, any> = {}; 
  const now = new Date();
  let days = 7;
  let keyFunc = (d: Date) => toLocalISOString(d);

  if (period === 'month_day') { days = 30; } 
  else if (period === 'month_week') {
    days = 90;
    keyFunc = (d: Date) => {
      const month = d.getMonth() + 1;
      const firstDay = new Date(d.getFullYear(), d.getMonth(), 1);
      const week = Math.ceil((d.getDate() + firstDay.getDay()) / 7);
      return `${month}月W${week}`;
    };
  } else if (period === 'year') {
    days = 365;
    keyFunc = (d: Date) => `${d.getFullYear()}-${d.getMonth() + 1}`;
  }

  const processLog = (logs: any[], type: 'food'|'activity'|'weight') => {
    logs.forEach((log: any) => {
      const d = new Date(log.loggedAt || log.date);
      if ((now.getTime() - d.getTime()) > days * 86400000) return;
      const k = keyFunc(d);
      if (!aggregated[k]) aggregated[k] = { k, calIn: 0, calOut: 0, pro: 0, carb: 0, fat: 0, sod: 0, weights: [] };
      if (type === 'food') {
        aggregated[k].calIn += (log.totalCalories || 0);
        aggregated[k].pro += (log.totalProteinG || 0);
        aggregated[k].carb += (log.totalCarbsG || 0);
        aggregated[k].fat += (log.totalFatG || 0);
        aggregated[k].sod += (log.totalSodiumMg || 0);
      } else if (type === 'activity') {
        aggregated[k].calOut += (log.caloriesBurned || 0);
      } else if (type === 'weight') {
        aggregated[k].weights.push({ w: log.weight, f: log.bodyFat || 0 });
      }
    });
  };

  processLog(foodLogs, 'food');
  processLog(activityLogs, 'activity');
  processLog(weightHistory, 'weight');

  const result = Object.values(aggregated).map((item: any) => {
    const wCount = item.weights.length;
    const avgW = wCount > 0 ? item.weights.reduce((s:number, x:any)=>s+x.w, 0)/wCount : 0;
    const avgF = wCount > 0 ? item.weights.reduce((s:number, x:any)=>s+x.f, 0)/wCount : 0;
    let divisor = 1;
    if (period === 'month_week') divisor = 7;
    if (period === 'year') divisor = 30;
    return {
      label: item.k,
      caloriesIn: Math.round(item.calIn / divisor),
      caloriesOut: Math.round(item.calOut / divisor),
      protein: Math.round(item.pro / divisor),
      carbs: Math.round(item.carb / divisor),
      fat: Math.round(item.fat / divisor),
      sodium: Math.round(item.sod / divisor),
      weight: avgW,
      bodyFat: avgF
    };
  });
  result.sort((a: any, b: any) => a.label.localeCompare(b.label));
  return result.slice(- (period === 'year' ? 12 : period === 'month_week' ? 12 : 7));
};

export const getHistory7DaysLocal = async () => getAggregatedHistory('week');

export const saveAIAdvice = async (type: 'RECIPE' | 'WORKOUT', advice: any) => {
  const current = await getAIAdvice();
  const updated = { ...current, [type]: advice };
  await AsyncStorage.setItem(KEYS.AI_ADVICE, JSON.stringify(updated));
};

export const getAIAdvice = async () => {
  const data = await AsyncStorage.getItem(KEYS.AI_ADVICE);
  return data ? JSON.parse(data) : { RECIPE: null, WORKOUT: null };
};