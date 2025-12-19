import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  USER_SESSION: 'user_session',
  PROFILE: 'user_profile',
  FOOD_LOGS: 'food_logs',
  ACTIVITY_LOGS: 'activity_logs',
  PRODUCTS: 'saved_products',
  WEIGHTS: 'weight_history',
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

// 體重歷史紀錄
export const saveWeightLog = async (weight: number) => {
  const data = await AsyncStorage.getItem(KEYS.WEIGHTS);
  const history = data ? JSON.parse(data) : [];
  const today = new Date().toISOString().split('T')[0];
  
  // 更新或新增今日體重
  const existingIndex = history.findIndex((h: any) => h.date.startsWith(today));
  if (existingIndex >= 0) {
    history[existingIndex].weight = weight;
  } else {
    history.push({ date: new Date().toISOString(), weight });
  }
  
  if (history.length > 30) history.shift();
  await AsyncStorage.setItem(KEYS.WEIGHTS, JSON.stringify(history));
};

export const getWeightHistory = async () => {
  const data = await AsyncStorage.getItem(KEYS.WEIGHTS);
  return data ? JSON.parse(data) : [];
};

export const saveProfileLocal = async (profileData: any) => {
  await AsyncStorage.setItem(KEYS.PROFILE, JSON.stringify(profileData));
  if (profileData.currentWeightKg) {
    await saveWeightLog(profileData.currentWeightKg);
  }
  return profileData;
};

export const getProfileLocal = async () => {
  const data = await AsyncStorage.getItem(KEYS.PROFILE);
  return data ? JSON.parse(data) : null;
};

// 2. 條碼商品庫
export const saveProductLocal = async (barcode: string, productData: any) => {
  const data = await AsyncStorage.getItem(KEYS.PRODUCTS);
  const products = data ? JSON.parse(data) : {};
  products[barcode] = productData;
  await AsyncStorage.setItem(KEYS.PRODUCTS, JSON.stringify(products));
};

export const getProductByBarcode = async (barcode: string) => {
  const data = await AsyncStorage.getItem(KEYS.PRODUCTS);
  const products = data ? JSON.parse(data) : {};
  return products[barcode] || null;
};

// 3. 飲食紀錄
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

// 4. 運動紀錄
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

// 5. 每日摘要
export const getDailySummaryLocal = async (date: Date = new Date()) => {
  const foodLogs = await getFoodLogsLocal();
  const activityLogs = await getActivityLogsLocal();
  
  // 使用本地日期字串比對，避免時區問題
  const dateStr = date.toLocaleDateString('en-CA'); // YYYY-MM-DD
  
  const todayFood = foodLogs.filter((log: any) => new Date(log.loggedAt).toLocaleDateString('en-CA') === dateStr);
  const todayActivity = activityLogs.filter((log: any) => new Date(log.loggedAt).toLocaleDateString('en-CA') === dateStr);
  
  return {
    totalCaloriesIn: todayFood.reduce((sum: number, log: any) => sum + (log.totalCalories || 0), 0),
    totalCaloriesOut: todayActivity.reduce((sum: number, log: any) => sum + (log.caloriesBurned || 0), 0),
    totalProtein: todayFood.reduce((sum: number, log: any) => sum + (log.totalProteinG || 0), 0),
    totalCarbs: todayFood.reduce((sum: number, log: any) => sum + (log.totalCarbsG || 0), 0),
    totalFat: todayFood.reduce((sum: number, log: any) => sum + (log.totalFatG || 0), 0),
    totalSodium: todayFood.reduce((sum: number, log: any) => sum + (log.totalSodiumMg || 0), 0), // [新增]
    foodLogs: todayFood,
    activityLogs: todayActivity
  };
};

export const getFrequentFoodItems = async () => {
  const logs = await getFoodLogsLocal();
  const frequency: Record<string, number> = {};
  logs.forEach((log: any) => {
    const name = log.foodName;
    if (name) frequency[name] = (frequency[name] || 0) + 1;
  });
  
  return Object.entries(frequency)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name]) => logs.find((l: any) => l.foodName === name));
};

// 6. 歷史趨勢 (7天)
export const getHistory7DaysLocal = async () => {
  const foodLogs = await getFoodLogsLocal();
  const activityLogs = await getActivityLogsLocal();
  const weightHistory = await getWeightHistory();
  const history = [];

  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toLocaleDateString('en-CA');

    const dayFood = foodLogs.filter((l: any) => new Date(l.loggedAt).toLocaleDateString('en-CA') === dateStr);
    const dayActivity = activityLogs.filter((l: any) => new Date(l.loggedAt).toLocaleDateString('en-CA') === dateStr);
    
    // 找當天體重，找不到則找最近一筆
    let dayWeight = 0;
    const wLog = weightHistory.find((w: any) => w.date.startsWith(dateStr));
    if (wLog) {
      dayWeight = wLog.weight;
    } else {
      const recent = weightHistory
        .filter((w: any) => w.date < dateStr)
        .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
      dayWeight = recent ? recent.weight : 0;
    }

    history.push({
      date: d,
      caloriesIn: dayFood.reduce((s: number, l: any) => s + (l.totalCalories || 0), 0),
      caloriesOut: dayActivity.reduce((s: number, l: any) => s + (l.caloriesBurned || 0), 0),
      // [新增] 統計三大營養素 + 鈉 (注意: food-recognition 存的是 totalSodiumMg)
      protein: dayFood.reduce((s: number, l: any) => s + (l.totalProteinG || 0), 0),
      carbs: dayFood.reduce((s: number, l: any) => s + (l.totalCarbsG || 0), 0),
      fat: dayFood.reduce((s: number, l: any) => s + (l.totalFatG || 0), 0),
      sodium: dayFood.reduce((s: number, l: any) => s + (l.totalSodiumMg || 0), 0), // 關鍵！
      weight: dayWeight
    });
  }
  return history;
};