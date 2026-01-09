import * as SQLite from "expo-sqlite";
import { drizzle } from "drizzle-orm/expo-sqlite";
import { eq, and, gte, lte, desc, sql, asc } from "drizzle-orm"; 
import { 
  userProfiles, foodItems, foodLogs, recipes, 
  reminderSettings, activityLogs, dailyMetrics 
} from "../drizzle/schema";

// 開啟本地資料庫檔案
export const expoDb = SQLite.openDatabaseSync("food_tracker.db");

// 初始化 Drizzle ORM
export const db = drizzle(expoDb);

// 定義目前資料庫版本，當 Schema 變更時需增加此數字
const CURRENT_DB_VERSION = 1;

// 初始化資料庫 (建立資料表與欄位遷移)
export async function initDatabase() {
  try {
    // 啟用 WAL 模式以提升效能
    await expoDb.execAsync("PRAGMA journal_mode = WAL;");
    
    // 檢查當前資料庫版本
    const result = await expoDb.getFirstAsync<{ user_version: number }>("PRAGMA user_version");
    const currentVersion = result?.user_version ?? 0;
    console.log(`[DB] Current Version: ${currentVersion}, Target: ${CURRENT_DB_VERSION}`);

    // 若是全新安裝或版本為 0，建立所有資料表
    if (currentVersion < 1) {
      console.log("[DB] Creating tables for version 1...");
      await expoDb.execAsync(`
        CREATE TABLE IF NOT EXISTS user_profiles (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT,
          gender TEXT,
          birth_date TEXT,
          height_cm REAL,
          current_weight_kg REAL,
          current_body_fat REAL,
          target_weight_kg REAL,
          target_body_fat REAL, 
          target_date TEXT,
          activity_level TEXT,
          goal TEXT,
          daily_calorie_target INTEGER,
          protein_percentage INTEGER DEFAULT 30,
          carbs_percentage INTEGER DEFAULT 40,
          fat_percentage INTEGER DEFAULT 30,
          sodium_target_mg INTEGER DEFAULT 2300,
          created_at INTEGER,
          updated_at INTEGER
        );

        CREATE TABLE IF NOT EXISTS daily_metrics (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          date TEXT NOT NULL,
          weight_kg REAL,
          body_fat_percentage REAL,
          water_ml REAL DEFAULT 0,
          sleep_hours REAL,
          note TEXT,
          created_at INTEGER
        );

        CREATE TABLE IF NOT EXISTS food_items (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          brand TEXT,
          barcode TEXT,
          base_amount REAL DEFAULT 100,
          base_unit TEXT DEFAULT 'g',
          ai_summary TEXT, 
          calories REAL NOT NULL,
          protein_g REAL DEFAULT 0,
          fat_g REAL DEFAULT 0,
          carbs_g REAL DEFAULT 0,
          sodium_mg REAL DEFAULT 0, 
          saturated_fat_g REAL DEFAULT 0, 
          trans_fat_g REAL DEFAULT 0, 
          sugar_g REAL DEFAULT 0, 
          fiber_g REAL DEFAULT 0, 
          cholesterol_mg REAL DEFAULT 0, 
          magnesium_mg REAL DEFAULT 0, 
          zinc_mg REAL DEFAULT 0, 
          iron_mg REAL DEFAULT 0, 
          is_user_created INTEGER DEFAULT 1,
          source TEXT DEFAULT 'manual',
          updated_at INTEGER
        );

        CREATE TABLE IF NOT EXISTS food_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          date TEXT NOT NULL,
          meal_time_category TEXT NOT NULL,
          logged_at INTEGER NOT NULL,
          food_item_id INTEGER,
          food_name TEXT NOT NULL,
          serving_type TEXT DEFAULT 'weight',
          serving_amount REAL,
          unit_weight_g REAL,
          total_weight_g REAL,
          total_calories REAL,
          total_protein_g REAL,
          total_fat_g REAL,
          total_carbs_g REAL,
          total_sodium_mg REAL, 
          total_saturated_fat_g REAL DEFAULT 0, 
          total_trans_fat_g REAL DEFAULT 0, 
          total_sugar_g REAL DEFAULT 0, 
          total_fiber_g REAL DEFAULT 0, 
          total_cholesterol_mg REAL DEFAULT 0, 
          total_magnesium_mg REAL DEFAULT 0, 
          total_zinc_mg REAL DEFAULT 0, 
          total_iron_mg REAL DEFAULT 0, 
          image_url TEXT,
          ai_analysis_log TEXT
        );

        CREATE TABLE IF NOT EXISTS activity_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          date TEXT NOT NULL,
          logged_at INTEGER NOT NULL,
          category TEXT,
          activity_name TEXT NOT NULL,
          intensity TEXT,
          duration_minutes INTEGER,
          calories_burned REAL,
          steps INTEGER,
          distance_km REAL,
          floors INTEGER,
          feeling TEXT,
          notes TEXT
        );
        
        CREATE TABLE IF NOT EXISTS recipes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          description TEXT,
          image_url TEXT,
          prep_time_minutes INTEGER,
          cook_time_minutes INTEGER,
          servings INTEGER DEFAULT 1,
          total_calories REAL,
          total_protein_g REAL,
          total_carbs_g REAL,
          total_fat_g REAL,
          meal_type TEXT,
          dietary_preference TEXT,
          ingredients TEXT,
          instructions TEXT,
          created_at INTEGER
        );

        CREATE TABLE IF NOT EXISTS reminder_settings (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER,
          breakfast_reminder_enabled INTEGER DEFAULT 0,
          breakfast_reminder_time TEXT,
          lunch_reminder_enabled INTEGER DEFAULT 0,
          lunch_reminder_time TEXT,
          dinner_reminder_enabled INTEGER DEFAULT 0,
          dinner_reminder_time TEXT,
          water_reminder_enabled INTEGER DEFAULT 0,
          water_reminder_interval_minutes INTEGER DEFAULT 60,
          water_reminder_start_time TEXT,
          water_reminder_end_time TEXT
        );
      `);
    }

    // [Migration Fix] 針對舊用戶，手動檢查並新增缺少的欄位
    // 這能解決 "no column named water_reminder_start_time" 的錯誤
    await performMigrations();

    // 更新版本號
    await expoDb.execAsync(`PRAGMA user_version = ${CURRENT_DB_VERSION}`);
    console.log("[DB] Initialization and migration completed successfully");

  } catch (e) {
    console.error("[DB] Initialization failed:", e);
  }
}

// 簡易手動遷移函式
async function performMigrations() {
    try {
        // 1. 檢查 reminder_settings 是否有 water_reminder_start_time
        const reminderInfo = await expoDb.getAllAsync("PRAGMA table_info(reminder_settings)");
        // @ts-ignore
        const hasStartTime = reminderInfo.some((col: any) => col.name === 'water_reminder_start_time');
        
        if (!hasStartTime) {
            console.log("[DB] Migrating: Adding water_reminder_start_time/end_time columns...");
            await expoDb.execAsync(`
                ALTER TABLE reminder_settings ADD COLUMN water_reminder_start_time TEXT;
                ALTER TABLE reminder_settings ADD COLUMN water_reminder_end_time TEXT;
            `);
        }

        // 2. 檢查 daily_metrics 是否有 sleep_hours
        const metricInfo = await expoDb.getAllAsync("PRAGMA table_info(daily_metrics)");
        // @ts-ignore
        const hasSleep = metricInfo.some((col: any) => col.name === 'sleep_hours');
        if (!hasSleep) {
             console.log("[DB] Migrating: Adding sleep_hours to daily_metrics...");
             await expoDb.execAsync(`ALTER TABLE daily_metrics ADD COLUMN sleep_hours REAL;`);
        }
        
        // 3. 檢查 daily_metrics 是否有 water_ml
        // @ts-ignore
        const hasWater = metricInfo.some((col: any) => col.name === 'water_ml');
        if (!hasWater) {
             console.log("[DB] Migrating: Adding water_ml to daily_metrics...");
             await expoDb.execAsync(`ALTER TABLE daily_metrics ADD COLUMN water_ml REAL DEFAULT 0;`);
        }

        // 4. 詳細營養素欄位補全 (針對 food_items 與 food_logs)
        const itemInfo = await expoDb.getAllAsync("PRAGMA table_info(food_items)");
        // @ts-ignore
        const hasSatFat = itemInfo.some((col: any) => col.name === 'saturated_fat_g');
        
        if (!hasSatFat) {
            console.log("[DB] Migrating: Adding detailed nutrients...");
            const nutrients = [
              "saturated_fat_g REAL DEFAULT 0", "trans_fat_g REAL DEFAULT 0", 
              "sugar_g REAL DEFAULT 0", "fiber_g REAL DEFAULT 0", 
              "cholesterol_mg REAL DEFAULT 0", "magnesium_mg REAL DEFAULT 0", 
              "zinc_mg REAL DEFAULT 0", "iron_mg REAL DEFAULT 0"
            ];
            for (const nut of nutrients) {
              try { await expoDb.execAsync(`ALTER TABLE food_items ADD COLUMN ${nut}`); } catch(e) {}
              try { await expoDb.execAsync(`ALTER TABLE food_logs ADD COLUMN total_${nut.split(' ')[0]} REAL DEFAULT 0`); } catch(e) {}
            }
        }
        
        // 5. 確保 AI Summary 與 Barcode 存在
        // @ts-ignore
        if (!itemInfo.some((c:any) => c.name === 'ai_summary')) await expoDb.execAsync(`ALTER TABLE food_items ADD COLUMN ai_summary TEXT`);
        // @ts-ignore
        if (!itemInfo.some((c:any) => c.name === 'barcode')) await expoDb.execAsync(`ALTER TABLE food_items ADD COLUMN barcode TEXT`);

    } catch (e) {
        console.warn("[DB] Migration warning (ignore if columns exist):", e);
    }
}

// =========================================================
//  Helper Functions
// =========================================================

// --- User Profile ---

export async function getUserProfile() {
  let result = await db.select().from(userProfiles).limit(1);
  if (result.length === 0) {
      await db.insert(userProfiles).values({ 
        name: "User", 
        dailyCalorieTarget: 2000,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      result = await db.select().from(userProfiles).limit(1);
  }
  return result[0];
}

export async function updateUserProfile(data: Partial<typeof userProfiles.$inferInsert>) {
  const profile = await getUserProfile();
  await db.update(userProfiles)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(userProfiles.id, profile.id));
}

export async function getLatestTwoDailyMetrics() {
  const result = await db
    .select()
    .from(dailyMetrics)
    .orderBy(desc(dailyMetrics.date))
    .limit(2);
  return result; 
}

// --- Food Items ---

export async function getFoodItemById(id: number) {
  const result = await db.select().from(foodItems).where(eq(foodItems.id, id));
  return result[0] || null;
}

export async function getFoodItemByBarcode(barcode: string) {
  const result = await db
    .select()
    .from(foodItems)
    .where(eq(foodItems.barcode, barcode))
    .orderBy(desc(foodItems.updatedAt)); 
  
  return result[0] || null;
}

export async function createFoodItem(data: typeof foodItems.$inferInsert) {
  const result = await db.insert(foodItems).values(data).returning({ insertedId: foodItems.id });
  return result[0].insertedId;
}

export async function updateFoodItem(id: number, data: Partial<typeof foodItems.$inferInsert>) {
  await db.update(foodItems)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(foodItems.id, id));
}

export async function searchFoodItems(query: string, limit = 20) {
  return db
    .select()
    .from(foodItems)
    .where(sql`${foodItems.name} LIKE ${`%${query}%`}`)
    .limit(limit);
}

// --- Food Logs ---

export async function getFoodLogsByDate(date: Date) {
  const dateStr = date.toISOString().split('T')[0];
  return db
    .select()
    .from(foodLogs)
    .where(eq(foodLogs.date, dateStr))
    .orderBy(desc(foodLogs.loggedAt));
}

export async function createFoodLog(data: typeof foodLogs.$inferInsert) {
  const result = await db.insert(foodLogs).values(data).returning({ insertedId: foodLogs.id });
  return result[0].insertedId;
}

export async function duplicateFoodLog(originalLogId: number) {
  const originalLog = await db.select().from(foodLogs).where(eq(foodLogs.id, originalLogId)).limit(1);
  if (!originalLog || originalLog.length === 0) return null;

  const log = originalLog[0];
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];

  const { id, loggedAt, date, ...rest } = log;
  
  const result = await db.insert(foodLogs).values({
    ...rest,
    date: dateStr,
    loggedAt: now,
  }).returning({ insertedId: foodLogs.id });
  
  return result[0].insertedId;
}

export async function updateFoodLog(id: number, data: Partial<typeof foodLogs.$inferInsert>) {
  await db.update(foodLogs).set(data).where(eq(foodLogs.id, id));
}

export async function deleteFoodLog(id: number) {
  await db.delete(foodLogs).where(eq(foodLogs.id, id));
}

// --- Nutrition Summary ---

export async function getDailyNutritionSummary(date: Date) {
  const dateStr = date.toISOString().split('T')[0];
  const result = await db
    .select({
      totalCalories: sql<number>`SUM(${foodLogs.totalCalories})`,
      totalProtein: sql<number>`SUM(${foodLogs.totalProteinG})`,
      totalCarbs: sql<number>`SUM(${foodLogs.totalCarbsG})`,
      totalFat: sql<number>`SUM(${foodLogs.totalFatG})`,
      totalSodium: sql<number>`SUM(${foodLogs.totalSodiumMg})`,
    })
    .from(foodLogs)
    .where(eq(foodLogs.date, dateStr));

  return result[0] || { 
    totalCalories: 0, totalProtein: 0, totalCarbs: 0, totalFat: 0, totalSodium: 0 
  };
}

// --- Recipes ---

export async function getAllRecipes(filters?: {
  mealType?: string;
  maxCalories?: number;
}) {
  const conditions: any[] = [];

  if (filters?.mealType) {
    conditions.push(eq(recipes.mealType, filters.mealType));
  }

  if (filters?.maxCalories) {
    conditions.push(lte(recipes.totalCalories, filters.maxCalories));
  }

  if (conditions.length > 0) {
    return db.select().from(recipes).where(and(...conditions)).orderBy(recipes.name);
  }

  return db.select().from(recipes).orderBy(recipes.name);
}

export async function createRecipe(data: typeof recipes.$inferInsert) {
  const result = await db.insert(recipes).values(data).returning({ insertedId: recipes.id });
  return result[0].insertedId;
}

// --- Activity Logs ---

export async function getActivityLogsByDate(date: Date) {
  const dateStr = date.toISOString().split('T')[0];
  return db
    .select()
    .from(activityLogs)
    .where(eq(activityLogs.date, dateStr))
    .orderBy(desc(activityLogs.loggedAt));
}

export async function createActivityLog(data: typeof activityLogs.$inferInsert) {
  const result = await db.insert(activityLogs).values(data).returning({ insertedId: activityLogs.id });
  return result[0].insertedId;
}

export async function deleteActivityLog(id: number) {
  await db.delete(activityLogs).where(eq(activityLogs.id, id));
}

export async function getFrequentActivities(limit = 5) {
  const rawLogs = await db.select().from(activityLogs).orderBy(desc(activityLogs.date)).limit(100);
  
  const frequency: Record<string, number> = {};
  rawLogs.forEach(log => {
    if (log.activityName) {
      frequency[log.activityName] = (frequency[log.activityName] || 0) + 1;
    }
  });

  const sortedNames = Object.entries(frequency)
    .sort((a, b) => b[1] - a[1]) 
    .slice(0, limit)
    .map(([name]) => name);

  return sortedNames;
}

// [新增] 取得指定日期範圍的每日統計 (供月曆與分析頁面使用)
export async function getRangeStats(startDateStr: string, endDateStr: string) {
  const logs = await db.select({
    date: foodLogs.date,
    calories: foodLogs.totalCalories
  })
  .from(foodLogs)
  .where(and(gte(foodLogs.date, startDateStr), lte(foodLogs.date, endDateStr)));

  const activities = await db.select({
    date: activityLogs.date,
    caloriesBurned: activityLogs.caloriesBurned
  })
  .from(activityLogs)
  .where(and(gte(activityLogs.date, startDateStr), lte(activityLogs.date, endDateStr)));

  const stats: Record<string, { intake: number, burned: number, net: number }> = {};
  
  const updateStat = (date: string, type: 'intake'|'burned', val: number) => {
      if (!stats[date]) stats[date] = { intake: 0, burned: 0, net: 0 };
      stats[date][type] += val;
      stats[date].net = stats[date].intake - stats[date].burned;
  };

  logs.forEach(l => updateStat(l.date, 'intake', l.calories || 0));
  activities.forEach(a => updateStat(a.date, 'burned', a.caloriesBurned || 0));

  return stats;
}