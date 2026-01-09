import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

// ==================== User Settings & Profile ====================
export const userProfiles = sqliteTable("user_profiles", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name"),
  gender: text("gender"), // male, female, other
  birthDate: text("birth_date"), // YYYY-MM-DD
  heightCm: real("height_cm"),
  currentWeightKg: real("current_weight_kg"),
  currentBodyFat: real("current_body_fat"),
  targetWeightKg: real("target_weight_kg"),
  targetBodyFat: real("target_body_fat"),
  targetDate: text("target_date"), // 預計完成日 (YYYY-MM-DD)
  activityLevel: text("activity_level"),
  goal: text("goal"), // lose_weight, maintain, gain_weight
  
  // 營養目標
  dailyCalorieTarget: integer("daily_calorie_target"),
  proteinPercentage: integer("protein_percentage").default(30),
  carbsPercentage: integer("carbs_percentage").default(40),
  fatPercentage: integer("fat_percentage").default(30),
  sodiumTargetMg: integer("sodium_target_mg").default(2300),

  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(strftime('%s', 'now'))`),
  updatedAt: integer("updated_at", { mode: "timestamp" }).default(sql`(strftime('%s', 'now'))`),
});

// ==================== Daily Body Metrics (每日身體數值) ====================
export const dailyMetrics = sqliteTable("daily_metrics", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  date: text("date").notNull(), // Format: YYYY-MM-DD
  weightKg: real("weight_kg"),
  bodyFatPercentage: real("body_fat_percentage"),
  waterMl: real("water_ml").default(0),
  sleepHours: real("sleep_hours"), 
  note: text("note"),
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(strftime('%s', 'now'))`),
});

// ==================== Food Items (Product DB) ====================
export const foodItems = sqliteTable("food_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  brand: text("brand"),
  barcode: text("barcode"),
  
  baseAmount: real("base_amount").default(100), 
  baseUnit: text("base_unit").default("g"),

  aiSummary: text("ai_summary"), 

  // 基礎營養素
  calories: real("calories").notNull(),
  proteinG: real("protein_g").default(0),
  fatG: real("fat_g").default(0),
  carbsG: real("carbs_g").default(0),
  sodiumMg: real("sodium_mg").default(0),
  
  // 詳細營養素
  saturatedFatG: real("saturated_fat_g").default(0), 
  transFatG: real("trans_fat_g").default(0),         
  sugarG: real("sugar_g").default(0),               
  fiberG: real("fiber_g").default(0),               
  cholesterolMg: real("cholesterol_mg").default(0), 
  magnesiumMg: real("magnesium_mg").default(0),     
  zincMg: real("zinc_mg").default(0),               
  ironMg: real("iron_mg").default(0),               
  
  isUserCreated: integer("is_user_created", { mode: "boolean" }).default(true),
  source: text("source").default("manual"),
  updatedAt: integer("updated_at", { mode: "timestamp" }).default(sql`(strftime('%s', 'now'))`),
});

// ==================== Food Logs (飲食紀錄) ====================
export const foodLogs = sqliteTable("food_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  date: text("date").notNull(),
  mealTimeCategory: text("meal_time_category").notNull(),
  loggedAt: integer("logged_at", { mode: "timestamp" }).notNull(),
  
  foodItemId: integer("food_item_id").references(() => foodItems.id),
  foodName: text("food_name").notNull(),
  
  servingType: text("serving_type").default("weight"),
  servingAmount: real("serving_amount"),
  unitWeightG: real("unit_weight_g"),
  
  totalWeightG: real("total_weight_g"), 
  totalCalories: real("total_calories"),
  totalProteinG: real("total_protein_g"),
  totalFatG: real("total_fat_g"),
  totalCarbsG: real("total_carbs_g"),
  totalSodiumMg: real("total_sodium_mg"),
  
  totalSaturatedFatG: real("total_saturated_fat_g").default(0),
  totalTransFatG: real("total_trans_fat_g").default(0),
  totalSugarG: real("total_sugar_g").default(0),
  totalFiberG: real("total_fiber_g").default(0),
  totalCholesterolMg: real("total_cholesterol_mg").default(0),
  totalMagnesiumMg: real("total_magnesium_mg").default(0),
  totalZincMg: real("total_zinc_mg").default(0),
  totalIronMg: real("total_iron_mg").default(0),
  
  imageUrl: text("image_url"),
  aiAnalysisLog: text("ai_analysis_log"),
});

// ==================== Recipes ====================
export const recipes = sqliteTable("recipes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  description: text("description"),
  imageUrl: text("image_url"),
  prepTimeMinutes: integer("prep_time_minutes"),
  cookTimeMinutes: integer("cook_time_minutes"),
  servings: integer("servings").default(1),
  totalCalories: real("total_calories"),
  totalProteinG: real("total_protein_g"),
  totalCarbsG: real("total_carbs_g"),
  totalFatG: real("total_fat_g"),
  mealType: text("meal_type"),
  dietaryPreference: text("dietary_preference"),
  ingredients: text("ingredients"), 
  instructions: text("instructions"),
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(strftime('%s', 'now'))`),
});

// ==================== Reminder Settings (提醒設定) ====================
export const reminderSettings = sqliteTable("reminder_settings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id"), 
  
  // 固定時間提醒 (鬧鐘模式)
  breakfastReminderEnabled: integer("breakfast_reminder_enabled", { mode: "boolean" }).default(false),
  breakfastReminderTime: text("breakfast_reminder_time"), // HH:mm
  lunchReminderEnabled: integer("lunch_reminder_enabled", { mode: "boolean" }).default(false),
  lunchReminderTime: text("lunch_reminder_time"),
  dinnerReminderEnabled: integer("dinner_reminder_enabled", { mode: "boolean" }).default(false),
  dinnerReminderTime: text("dinner_reminder_time"),
  
  // 間隔提醒 (久坐/喝水模式)
  waterReminderEnabled: integer("water_reminder_enabled", { mode: "boolean" }).default(false),
  waterReminderStartTime: text("water_reminder_start_time"), // [新增] 開始時間 HH:mm
  waterReminderEndTime: text("water_reminder_end_time"),     // [新增] 結束時間 HH:mm
  waterReminderIntervalMinutes: integer("water_reminder_interval_minutes").default(60),
});

// ==================== Activity Logs (運動紀錄) ====================
export const activityLogs = sqliteTable("activity_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  date: text("date").notNull(),
  loggedAt: integer("logged_at", { mode: "timestamp" }).notNull(),
  
  category: text("category"),
  activityName: text("activity_name").notNull(),
  
  intensity: text("intensity"),
  durationMinutes: integer("duration_minutes"),
  caloriesBurned: real("calories_burned"),
  steps: integer("steps"),
  distanceKm: real("distance_km"),
  floors: integer("floors"),
  
  feeling: text("feeling"),
  notes: text("notes"),
});