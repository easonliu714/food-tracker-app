import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

// ==================== User Settings & Profile ====================
export const userProfiles = sqliteTable("user_profiles", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name"),
  gender: text("gender"), // male, female, other
  heightCm: real("height_cm"),
  currentWeightKg: real("current_weight_kg"),
  currentBodyFat: real("current_body_fat"),
  targetWeightKg: real("target_weight_kg"),
  targetBodyFat: real("target_body_fat"),
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

  calories: real("calories").notNull(),
  proteinG: real("protein_g").default(0),
  carbsG: real("carbs_g").default(0),
  fatG: real("fat_g").default(0),
  sodiumMg: real("sodium_mg").default(0),
  sugarG: real("sugar_g").default(0),
  fiberG: real("fiber_g").default(0),
  
  isUserCreated: integer("is_user_created", { mode: "boolean" }).default(true),
  source: text("source").default("manual"),
  updatedAt: integer("updated_at", { mode: "timestamp" }).default(sql`(strftime('%s', 'now'))`),
});

// ==================== Food Logs (飲食紀錄) ====================
export const foodLogs = sqliteTable("food_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  date: text("date").notNull(), // YYYY-MM-DD
  mealTimeCategory: text("meal_time_category").notNull(), // breakfast, lunch, afternoon_tea, dinner, late_night
  loggedAt: integer("logged_at", { mode: "timestamp" }).notNull(),
  
  foodItemId: integer("food_item_id").references(() => foodItems.id),
  foodName: text("food_name").notNull(),
  
  servingType: text("serving_type").default("weight"),
  servingAmount: real("serving_amount"),
  unitWeightG: real("unit_weight_g"),
  
  totalWeightG: real("total_weight_g"), 
  totalCalories: real("total_calories"),
  totalProteinG: real("total_protein_g"),
  totalCarbsG: real("total_carbs_g"),
  totalFatG: real("total_fat_g"),
  totalSodiumMg: real("total_sodium_mg"),
  
  imageUrl: text("image_url"),
  aiAnalysisLog: text("ai_analysis_log"),
});

// ==================== Recipes (食譜 - 從原本結構遷移) ====================
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
  ingredients: text("ingredients"), // JSON string or text
  instructions: text("instructions"),
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(strftime('%s', 'now'))`),
});

// ==================== Reminder Settings (提醒設定) ====================
export const reminderSettings = sqliteTable("reminder_settings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id"), // 保留欄位但不強制關聯，單機版通常只有一個用戶
  breakfastReminderEnabled: integer("breakfast_reminder_enabled", { mode: "boolean" }).default(false),
  breakfastReminderTime: text("breakfast_reminder_time"),
  lunchReminderEnabled: integer("lunch_reminder_enabled", { mode: "boolean" }).default(false),
  lunchReminderTime: text("lunch_reminder_time"),
  dinnerReminderEnabled: integer("dinner_reminder_enabled", { mode: "boolean" }).default(false),
  dinnerReminderTime: text("dinner_reminder_time"),
  waterReminderEnabled: integer("water_reminder_enabled", { mode: "boolean" }).default(false),
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