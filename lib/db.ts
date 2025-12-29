import { drizzle } from "drizzle-orm/expo-sqlite";
import { openDatabaseSync } from "expo-sqlite";
import * as schema from "../drizzle/schema";

// 開啟本地資料庫檔案
export const expoDb = openDatabaseSync("food_tracker.db");

// 初始化 Drizzle ORM
export const db = drizzle(expoDb, { schema });

// 初始化資料庫 (建立資料表)
export async function initDatabase() {
  try {
    // 啟用 WAL 模式以提升效能
    await expoDb.execAsync("PRAGMA journal_mode = WAL;");
    
    // 執行 SQL 建立資料表 (對應 schema.ts 的定義)
    await expoDb.execAsync(`
      CREATE TABLE IF NOT EXISTS user_profiles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        gender TEXT,
        height_cm REAL,
        current_weight_kg REAL,
        current_body_fat REAL,
        target_weight_kg REAL,
        target_body_fat REAL,
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
        carbs_g REAL DEFAULT 0,
        fat_g REAL DEFAULT 0,
        sodium_mg REAL DEFAULT 0,
        sugar_g REAL DEFAULT 0,
        fiber_g REAL DEFAULT 0,
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
        total_carbs_g REAL,
        total_fat_g REAL,
        total_sodium_mg REAL,
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
    
    console.log("Database initialized successfully");
  } catch (e) {
    console.error("Database initialization failed:", e);
  }
}