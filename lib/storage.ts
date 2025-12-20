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

// 設定
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

// 使用者
export const loginLocal = async (name: string) => { const user = { name, id: 'local_user', email: 'local@device' }; await AsyncStorage.setItem(KEYS.USER_SESSION, JSON.stringify(user)); return user; };
export const logoutLocal = async () => { await AsyncStorage.removeItem(KEYS.USER_SESSION); };
export const getLocalUser = async () => { const data = await AsyncStorage.getItem(KEYS.USER_SESSION); return data ? JSON.parse(data) : null; };

// 體重歷史
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

// 商品庫
export const saveProductLocal = async (barcode: string, productData: any) => { const data = await AsyncStorage.getItem(KEYS.PRODUCTS); const products = data ? JSON.parse(data) : {}; products[barcode] = productData; await AsyncStorage.setItem(KEYS.PRODUCTS, JSON.stringify(products)); };
export const getProductByBarcode = async (barcode: string) => { const data = await AsyncStorage.getItem(KEYS.PRODUCTS); const products = data ? JSON.parse(data) : {}; return products[barcode] || null; };

// 飲食紀錄
export const getFoodLogsLocal = async () => { const data = await AsyncStorage.getItem(KEYS.FOOD_LOGS); return data ? JSON.parse(data) : []; };
export const saveFoodLogLocal = async (log: any) => { const existingLogs = await getFoodLogsLocal(); const newLog = { ...log, id: Date.now(), loggedAt: log.loggedAt || new Date().toISOString() }; const updatedLogs = [newLog, ...existingLogs]; await AsyncStorage.setItem(KEYS.FOOD_LOGS, JSON.stringify(updatedLogs)); return newLog; };
export const updateFoodLogLocal = async (updatedLog: any) => { const existingLogs = await getFoodLogsLocal(); const updatedLogs = existingLogs.map((log: any) => log.id === updatedLog.id ? { ...log, ...updatedLog } : log); await AsyncStorage.setItem(KEYS.FOOD_LOGS, JSON.stringify(updatedLogs)); };
export const deleteFoodLogLocal = async (id: number) => { const existingLogs = await getFoodLogsLocal(); const updatedLogs = existingLogs.filter((log: any) => log.id !== id); await AsyncStorage.setItem(KEYS.FOOD_LOGS, JSON.stringify(updatedLogs)); };

// 運動紀錄
export const getActivityLogsLocal = async () => { const data = await AsyncStorage.getItem(KEYS.ACTIVITY_LOGS); return data ? JSON.parse(data) : []; };
export const saveActivityLogLocal = async (log: any) => { const existingLogs = await getActivityLogsLocal(); const newLog = { ...log, id: Date.now(), loggedAt: log.loggedAt || new Date().toISOString() }; const updatedLogs = [newLog, ...existingLogs]; await AsyncStorage.setItem(KEYS.ACTIVITY_LOGS, JSON.stringify(updatedLogs)); return newLog; };
export const updateActivityLogLocal = async (updatedLog: any) => { const existingLogs = await getActivityLogsLocal(); const updatedLogs = existingLogs.map((log: any) => log.id === updatedLog.id ? { ...log, ...updatedLog } : log); await AsyncStorage.setItem(KEYS.ACTIVITY_LOGS, JSON.stringify(updatedLogs)); };
export const deleteActivityLogLocal = async (id: number) => { const existingLogs = await getActivityLogsLocal(); const updatedLogs = existingLogs.filter((log: any) => log.id !== id); await AsyncStorage.setItem(KEYS.ACTIVITY_LOGS, JSON.stringify(updatedLogs)); };

// 每日摘要
export const getDailySummaryLocal = async (date: Date = new Date()) => {
  const foodLogs = await getFoodLogsLocal();
  const activityLogs = await getActivityLogsLocal();
  const dateStr = formatDate(date);
  
  const todayFood = foodLogs.filter((log: any) => formatDate(new Date(log.loggedAt)) === dateStr);
  const todayActivity = activityLogs.filter((log: any) => formatDate(new Date(log.loggedAt)) === dateStr);
  
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

// 常用食物
export const getFrequentFoodItems = async () => {
  const logs = await getFoodLogsLocal();
  const frequency: Record<string, number> = {};
  logs.forEach((log: any) => { if(log.foodName) frequency[log.foodName] = (frequency[log.foodName] || 0) + 1; });
  return Object.entries(frequency).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name]) => logs.find((l: any) => l.foodName === name));
};

// [新增] 常用運動 (依次數排序)
export const getFrequentActivityTypes = async () => {
  const logs = await getActivityLogsLocal();
  const frequency: Record<string, number> = {};
  const DEFAULT_TYPES = ['快走', '慢走', '慢跑', '快跑', '跑步機', '爬梯', '一般運動'];
  
  logs.forEach((log: any) => { if(log.activityType) frequency[log.activityType] = (frequency[log.activityType] || 0) + 1; });
  
  // 將有紀錄的排前面，沒紀錄的排後面
  const sorted = Object.keys(frequency).sort((a, b) => frequency[b] - frequency[a]);
  const combined = Array.from(new Set([...sorted, ...DEFAULT_TYPES]));
  return combined;
};

// 萬用聚合查詢 (支援 analysis.tsx 的所有週期)
export const getAggregatedHistory = async (period: 'week'|'month_day'|'month_week'|'year') => {
  const foodLogs = await getFoodLogsLocal();
  const activityLogs = await getActivityLogsLocal();
  const weightHistory = await getWeightHistory();
  
  const aggregated: Record<string, any> = {}; // Key: 日期/週/月
  const now = new Date();

  // 定義範圍與 Key 生成邏輯
  let days = 7;
  let keyFunc = (d: Date) => formatDate(d); // 預設: 日期 YYYY-MM-DD

  if (period === 'month_day') {
    days = 30;
  } else if (period === 'month_week') {
    days = 90; // 最近 3 個月
    keyFunc = (d: Date) => {
      const month = d.getMonth() + 1;
      const week = Math.ceil((d.getDate() + new Date(d.getFullYear(), d.getMonth(), 1).getDay()) / 7);
      return `${month}月W${week}`;
    };
  } else if (period === 'year') {
    days = 365;
    keyFunc = (d: Date) => `${d.getFullYear()}-${d.getMonth() + 1}`; // YYYY-M
  }

  // 1. 初始化資料結構
  // 為了圖表連續性，我們可以先生成所有需要的 key (這裡簡化，只處理有資料的或是最近 N 天)
  // 若要嚴謹，應先產生所有時間點的空 buckets。這裡採用動態生成。

  // 2. 聚合飲食
  foodLogs.forEach((log: any) => {
    const d = new Date(log.loggedAt);
    if ((now.getTime() - d.getTime()) > days * 86400000) return; // 超出範圍
    const k = keyFunc(d);
    if (!aggregated[k]) aggregated[k] = { k, count: 0, calIn: 0, calOut: 0, pro: 0, carb: 0, fat: 0, sod: 0, weights: [] };
    
    aggregated[k].calIn += (log.totalCalories || 0);
    aggregated[k].pro += (log.totalProteinG || 0);
    aggregated[k].carb += (log.totalCarbsG || 0);
    aggregated[k].fat += (log.totalFatG || 0);
    aggregated[k].sod += (log.totalSodiumMg || 0);
    // 注意：如果是週/月，這裡其實是累加了多次「日總和」，這在營養素分析上是合理的(總量)
    // 但如果要顯示「每日平均」，最後要除以天數。這裡我們先算總量，UI 層再決定是否除以 7 或 30
  });

  // 3. 聚合運動
  activityLogs.forEach((log: any) => {
    const d = new Date(log.loggedAt);
    if ((now.getTime() - d.getTime()) > days * 86400000) return;
    const k = keyFunc(d);
    if (!aggregated[k]) aggregated[k] = { k, count: 0, calIn: 0, calOut: 0, pro: 0, carb: 0, fat: 0, sod: 0, weights: [] };
    aggregated[k].calOut += (log.caloriesBurned || 0);
  });

  // 4. 聚合體重 (取平均)
  weightHistory.forEach((log: any) => {
    const d = new Date(log.date);
    if ((now.getTime() - d.getTime()) > days * 86400000) return;
    const k = keyFunc(d);
    if (!aggregated[k]) aggregated[k] = { k, count: 0, calIn: 0, calOut: 0, pro: 0, carb: 0, fat: 0, sod: 0, weights: [] };
    aggregated[k].weights.push({ w: log.weight, f: log.bodyFat || 0 });
  });

  // 5. 轉換為陣列並排序
  const result = Object.values(aggregated).map((item: any) => {
    const wCount = item.weights.length;
    const avgW = wCount > 0 ? item.weights.reduce((s:number, x:any)=>s+x.w, 0)/wCount : 0;
    const avgF = wCount > 0 ? item.weights.reduce((s:number, x:any)=>s+x.f, 0)/wCount : 0;
    
    // 如果是較長週期 (週/月)，營養素和熱量通常也希望看「平均每日」表現，以免數值過大
    // 這裡做一個簡單估計：如果该 key 涵蓋多天，應除以天數。
    // 但資料庫沒有紀錄「該 key 有幾天有資料」。
    // 為了圖表一致性，我們回傳「總量」，UI 顯示時若為週/月，建議顯示「平均」
    // 這裡簡化：全部回傳原始累加值，體重回傳平均值。
    
    // [修正] 對於 analysis.tsx，我們希望顯示的是「平均每日攝取」，所以如果是週，除以7；月，除以30
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

  // 排序 (簡單字串排序通常有效 YYYY-MM-DD)
  // 對於 '10月W2' 這種格式，可能需要自訂排序，這裡簡化
  result.sort((a: any, b: any) => a.label.localeCompare(b.label));
  
  // 只取最後 N 筆
  return result.slice(- (period === 'year' ? 12 : period === 'month_week' ? 12 : 7));
};

// Helper: 格式化日期 YYYY-MM-DD
function formatDate(date: Date) {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().split('T')[0];
}