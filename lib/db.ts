import { drizzle } from "drizzle-orm/expo-sqlite";
import { openDatabaseSync } from "expo-sqlite";
import { eq, and, gte, lte, desc, sql, asc } from "drizzle-orm";
import * as schema from "../drizzle/schema";
import { 
  userProfiles, foodItems, foodLogs, recipes, 
  reminderSettings, activityLogs, dailyMetrics 
} from "../drizzle/schema";

// 開啟本地資料庫檔案
export const expoDb = openDatabaseSync("food_tracker.db");

// 初始化 Drizzle ORM
export const db = drizzle(expoDb, { schema });

// 初始化資料庫 (建立資料表與欄位遷移)
export async function initDatabase() {
  try {
    // 啟用 WAL 模式以提升效能
    await expoDb.execAsync("PRAGMA journal_mode = WAL;");
    
    // 1. 建立資料表 (SQL 保持您原本提供的內容，確保結構完整)
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
        water_reminder_interval_minutes INTEGER DEFAULT 60
      );
    `);

    // 2. Migration 邏輯 (保持不變，略過錯誤)
    const addColumn = async (table: string, columnDef: string) => {
      try { await expoDb.execAsync(`ALTER TABLE ${table} ADD COLUMN ${columnDef}`); } catch (e) {}
    };
    
    // 確保所有擴充欄位都存在
    await addColumn("user_profiles", "birth_date TEXT");
    await addColumn("user_profiles", "target_date TEXT");
    await addColumn("food_items", "saturated_fat_g REAL DEFAULT 0");
    await addColumn("food_items", "trans_fat_g REAL DEFAULT 0");
    await addColumn("food_items", "sugar_g REAL DEFAULT 0");
    await addColumn("food_items", "fiber_g REAL DEFAULT 0");
    await addColumn("food_items", "cholesterol_mg REAL DEFAULT 0");
    await addColumn("food_items", "magnesium_mg REAL DEFAULT 0");
    await addColumn("food_items", "zinc_mg REAL DEFAULT 0");
    await addColumn("food_items", "iron_mg REAL DEFAULT 0");
    await addColumn("food_logs", "total_saturated_fat_g REAL DEFAULT 0");
    await addColumn("food_logs", "total_trans_fat_g REAL DEFAULT 0");
    await addColumn("food_logs", "total_sugar_g REAL DEFAULT 0");
    await addColumn("food_logs", "total_fiber_g REAL DEFAULT 0");
    await addColumn("food_logs", "total_cholesterol_mg REAL DEFAULT 0");
    await addColumn("food_logs", "total_magnesium_mg REAL DEFAULT 0");
    await addColumn("food_logs", "total_zinc_mg REAL DEFAULT 0");
    await addColumn("food_logs", "total_iron_mg REAL DEFAULT 0");

    console.log("Database initialized and migrated successfully");
  } catch (e) {
    console.error("Database initialization failed:", e);
  }
}

// =========================================================
//  以下為從 server/db.ts 移植過來的 Helper Functions
//  這些函式可以直接在 APP 的前端頁面或 Hooks 中呼叫
// =========================================================

// --- User Profile ---

export async function getUserProfile() {
  // 單機版通常只有一個用戶，取第一個，若無則建立預設
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

// --- Food Items ---

export async function getFoodItemById(id: number) {
  const result = await db.select().from(foodItems).where(eq(foodItems.id, id));
  return result[0] || null;
}

export async function getFoodItemByBarcode(barcode: string) {
  const result = await db.select().from(foodItems).where(eq(foodItems.barcode, barcode));
  return result[0] || null;
}

export async function createFoodItem(data: typeof foodItems.$inferInsert) {
  const result = await db.insert(foodItems).values(data).returning({ insertedId: foodItems.id });
  return result[0].insertedId;
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
  // SQLite 儲存日期格式為 YYYY-MM-DD
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
