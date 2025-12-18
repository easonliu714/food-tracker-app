import { int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ==================== User Profiles ====================
export const userProfiles = mysqlTable("user_profiles", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  gender: mysqlEnum("gender", ["male", "female", "other"]),
  birthDate: timestamp("birthDate"),
  heightCm: int("heightCm"), // Height in cm
  currentWeightKg: int("currentWeightKg"), // Weight in kg * 10 (e.g., 70.5kg = 705)
  targetWeightKg: int("targetWeightKg"),
  activityLevel: mysqlEnum("activityLevel", [
    "sedentary",
    "lightly_active",
    "moderately_active",
    "very_active",
    "extra_active",
  ]).default("sedentary"),
  goal: mysqlEnum("goal", ["lose_weight", "maintain", "gain_weight"]).default("maintain"),
  dailyCalorieTarget: int("dailyCalorieTarget"),
  proteinPercentage: int("proteinPercentage").default(30),
  carbsPercentage: int("carbsPercentage").default(40),
  fatPercentage: int("fatPercentage").default(30),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// ==================== Food Items ====================
export const foodItems = mysqlTable("food_items", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  brand: varchar("brand", { length: 255 }),
  barcode: varchar("barcode", { length: 128 }).unique(),
  servingSizeG: int("servingSizeG"), // Serving size in grams
  servingSizeDescription: varchar("servingSizeDescription", { length: 255 }),
  caloriesPerServing: int("caloriesPerServing"),
  proteinG: int("proteinG"), // * 10 (e.g., 5.5g = 55)
  carbsG: int("carbsG"), // * 10
  fatG: int("fatG"), // * 10
  fiberG: int("fiberG"), // * 10
  sugarG: int("sugarG"), // * 10
  sodiumMg: int("sodiumMg"),
  cholesterolMg: int("cholesterolMg"),
  vitaminAMcg: int("vitaminAMcg"),
  vitaminCMg: int("vitaminCMg"),
  calciumMg: int("calciumMg"),
  ironMg: int("ironMg"),
  imageUrl: text("imageUrl"),
  source: mysqlEnum("source", ["user", "barcode", "ai", "database"]).default("database"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// ==================== Food Logs ====================
export const foodLogs = mysqlTable("food_logs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  foodItemId: int("foodItemId"),
  mealType: mysqlEnum("mealType", ["breakfast", "lunch", "dinner", "snack"]).notNull(),
  foodName: varchar("foodName", { length: 255 }).notNull(),
  servings: int("servings").default(10), // * 10 (e.g., 1.5 servings = 15)
  totalCalories: int("totalCalories").notNull(),
  totalProteinG: int("totalProteinG"), // * 10
  totalCarbsG: int("totalCarbsG"), // * 10
  totalFatG: int("totalFatG"), // * 10
  imageUrl: text("imageUrl"),
  notes: text("notes"),
  loggedAt: timestamp("loggedAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// ==================== Recipes ====================
export const recipes = mysqlTable("recipes", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  imageUrl: text("imageUrl"),
  prepTimeMinutes: int("prepTimeMinutes"),
  cookTimeMinutes: int("cookTimeMinutes"),
  servings: int("servings").default(1),
  totalCalories: int("totalCalories"),
  totalProteinG: int("totalProteinG"), // * 10
  totalCarbsG: int("totalCarbsG"), // * 10
  totalFatG: int("totalFatG"), // * 10
  mealType: mysqlEnum("mealType", ["breakfast", "lunch", "dinner", "snack"]),
  dietaryPreference: mysqlEnum("dietaryPreference", [
    "none",
    "vegetarian",
    "vegan",
    "low_carb",
    "high_protein",
    "keto",
  ]).default("none"),
  ingredients: text("ingredients"),
  instructions: text("instructions"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// ==================== Favorite Recipes ====================
export const favoriteRecipes = mysqlTable("favorite_recipes", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  recipeId: int("recipeId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ==================== Reminder Settings ====================
export const reminderSettings = mysqlTable("reminder_settings", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  breakfastReminderEnabled: int("breakfastReminderEnabled").default(0), // 0 or 1
  breakfastReminderTime: varchar("breakfastReminderTime", { length: 5 }),
  lunchReminderEnabled: int("lunchReminderEnabled").default(0),
  lunchReminderTime: varchar("lunchReminderTime", { length: 5 }),
  dinnerReminderEnabled: int("dinnerReminderEnabled").default(0),
  dinnerReminderTime: varchar("dinnerReminderTime", { length: 5 }),
  waterReminderEnabled: int("waterReminderEnabled").default(0),
  waterReminderIntervalMinutes: int("waterReminderIntervalMinutes").default(60),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// ==================== Activity Logs ====================
export const activityLogs = mysqlTable("activity_logs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  activityType: varchar("activityType", { length: 100 }).notNull(),
  durationMinutes: int("durationMinutes"),
  caloriesBurned: int("caloriesBurned"),
  steps: int("steps"),
  distanceKm: int("distanceKm"), // * 100 (e.g., 5.5km = 550)
  loggedAt: timestamp("loggedAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ==================== Type Exports ====================
export type UserProfile = typeof userProfiles.$inferSelect;
export type InsertUserProfile = typeof userProfiles.$inferInsert;

export type FoodItem = typeof foodItems.$inferSelect;
export type InsertFoodItem = typeof foodItems.$inferInsert;

export type FoodLog = typeof foodLogs.$inferSelect;
export type InsertFoodLog = typeof foodLogs.$inferInsert;

export type Recipe = typeof recipes.$inferSelect;
export type InsertRecipe = typeof recipes.$inferInsert;

export type FavoriteRecipe = typeof favoriteRecipes.$inferSelect;
export type InsertFavoriteRecipe = typeof favoriteRecipes.$inferInsert;

export type ReminderSetting = typeof reminderSettings.$inferSelect;
export type InsertReminderSetting = typeof reminderSettings.$inferInsert;

export type ActivityLog = typeof activityLogs.$inferSelect;
export type InsertActivityLog = typeof activityLogs.$inferInsert;
