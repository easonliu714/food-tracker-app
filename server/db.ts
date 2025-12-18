import { eq, and, gte, lte, desc, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser,
  users,
  userProfiles,
  foodItems,
  foodLogs,
  recipes,
  favoriteRecipes,
  reminderSettings,
  activityLogs,
  InsertUserProfile,
  InsertFoodItem,
  InsertFoodLog,
  InsertRecipe,
  InsertFavoriteRecipe,
  InsertReminderSetting,
  InsertActivityLog,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// ==================== User Profiles ====================

export async function getUserProfile(userId: number) {
  const db = await getDb();
  if (!db) return null;

  const result = await db.select().from(userProfiles).where(eq(userProfiles.userId, userId));
  return result[0] || null;
}

export async function createUserProfile(data: InsertUserProfile) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(userProfiles).values(data);
  return Number(result[0].insertId);
}

export async function updateUserProfile(userId: number, data: Partial<InsertUserProfile>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(userProfiles).set(data).where(eq(userProfiles.userId, userId));
}

// ==================== Food Items ====================

export async function getFoodItemById(id: number) {
  const db = await getDb();
  if (!db) return null;

  const result = await db.select().from(foodItems).where(eq(foodItems.id, id));
  return result[0] || null;
}

export async function getFoodItemByBarcode(barcode: string) {
  const db = await getDb();
  if (!db) return null;

  const result = await db.select().from(foodItems).where(eq(foodItems.barcode, barcode));
  return result[0] || null;
}

export async function createFoodItem(data: InsertFoodItem) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(foodItems).values(data);
  return Number(result[0].insertId);
}

export async function searchFoodItems(query: string, limit = 20) {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(foodItems)
    .where(sql`${foodItems.name} LIKE ${`%${query}%`}`)
    .limit(limit);
}

// ==================== Food Logs ====================

export async function getFoodLogsByUserId(userId: number, startDate?: Date, endDate?: Date) {
  const db = await getDb();
  if (!db) return [];

  if (startDate && endDate) {
    return db
      .select()
      .from(foodLogs)
      .where(and(eq(foodLogs.userId, userId), gte(foodLogs.loggedAt, startDate), lte(foodLogs.loggedAt, endDate)) as any)
      .orderBy(desc(foodLogs.loggedAt));
  }

  return db.select().from(foodLogs).where(eq(foodLogs.userId, userId)).orderBy(desc(foodLogs.loggedAt));
}

export async function getFoodLogsByDate(userId: number, date: Date) {
  const db = await getDb();
  if (!db) return [];

  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  return db
    .select()
    .from(foodLogs)
    .where(and(eq(foodLogs.userId, userId), gte(foodLogs.loggedAt, startOfDay), lte(foodLogs.loggedAt, endOfDay)) as any)
    .orderBy(foodLogs.loggedAt);
}

export async function createFoodLog(data: InsertFoodLog) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(foodLogs).values(data);
  return Number(result[0].insertId);
}

export async function updateFoodLog(id: number, data: Partial<InsertFoodLog>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(foodLogs).set(data).where(eq(foodLogs.id, id));
}

export async function deleteFoodLog(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.delete(foodLogs).where(eq(foodLogs.id, id));
}

// ==================== Nutrition Summary ====================

export async function getDailyNutritionSummary(userId: number, date: Date) {
  const db = await getDb();
  if (!db) return null;

  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  const result = await db
    .select({
      totalCalories: sql<number>`SUM(${foodLogs.totalCalories})`,
      totalProtein: sql<number>`SUM(${foodLogs.totalProteinG})`,
      totalCarbs: sql<number>`SUM(${foodLogs.totalCarbsG})`,
      totalFat: sql<number>`SUM(${foodLogs.totalFatG})`,
    })
    .from(foodLogs)
    .where(and(eq(foodLogs.userId, userId), gte(foodLogs.loggedAt, startOfDay), lte(foodLogs.loggedAt, endOfDay)) as any);

  return result[0] || { totalCalories: 0, totalProtein: 0, totalCarbs: 0, totalFat: 0 };
}

// ==================== Recipes ====================

export async function getAllRecipes(filters?: {
  mealType?: string;
  dietaryPreference?: string;
  maxCalories?: number;
}) {
  const db = await getDb();
  if (!db) return [];

  const conditions: any[] = [];

  if (filters?.mealType) {
    conditions.push(eq(recipes.mealType, filters.mealType as any));
  }

  if (filters?.dietaryPreference) {
    conditions.push(eq(recipes.dietaryPreference, filters.dietaryPreference as any));
  }

  if (filters?.maxCalories) {
    conditions.push(lte(recipes.totalCalories, filters.maxCalories));
  }

  if (conditions.length > 0) {
    return db.select().from(recipes).where(and(...conditions) as any).orderBy(recipes.name);
  }

  return db.select().from(recipes).orderBy(recipes.name);
}

export async function getRecipeById(id: number) {
  const db = await getDb();
  if (!db) return null;

  const result = await db.select().from(recipes).where(eq(recipes.id, id));
  return result[0] || null;
}

export async function createRecipe(data: InsertRecipe) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(recipes).values(data);
  return Number(result[0].insertId);
}

// ==================== Favorite Recipes ====================

export async function getFavoriteRecipes(userId: number) {
  const db = await getDb();
  if (!db) return [];

  return db
    .select({
      id: favoriteRecipes.id,
      recipeId: favoriteRecipes.recipeId,
      createdAt: favoriteRecipes.createdAt,
      recipe: recipes,
    })
    .from(favoriteRecipes)
    .leftJoin(recipes, eq(favoriteRecipes.recipeId, recipes.id))
    .where(eq(favoriteRecipes.userId, userId))
    .orderBy(desc(favoriteRecipes.createdAt));
}

export async function addFavoriteRecipe(data: InsertFavoriteRecipe) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(favoriteRecipes).values(data);
  return Number(result[0].insertId);
}

export async function removeFavoriteRecipe(userId: number, recipeId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .delete(favoriteRecipes)
    .where(and(eq(favoriteRecipes.userId, userId), eq(favoriteRecipes.recipeId, recipeId)) as any);
}

// ==================== Reminder Settings ====================

export async function getReminderSettings(userId: number) {
  const db = await getDb();
  if (!db) return null;

  const result = await db.select().from(reminderSettings).where(eq(reminderSettings.userId, userId));
  return result[0] || null;
}

export async function createReminderSettings(data: InsertReminderSetting) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(reminderSettings).values(data);
  return Number(result[0].insertId);
}

export async function updateReminderSettings(userId: number, data: Partial<InsertReminderSetting>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(reminderSettings).set(data).where(eq(reminderSettings.userId, userId));
}

// ==================== Activity Logs ====================

export async function getActivityLogs(userId: number, startDate?: Date, endDate?: Date) {
  const db = await getDb();
  if (!db) return [];

  if (startDate && endDate) {
    return db
      .select()
      .from(activityLogs)
      .where(and(eq(activityLogs.userId, userId), gte(activityLogs.loggedAt, startDate), lte(activityLogs.loggedAt, endDate)) as any)
      .orderBy(desc(activityLogs.loggedAt));
  }

  return db.select().from(activityLogs).where(eq(activityLogs.userId, userId)).orderBy(desc(activityLogs.loggedAt));
}

export async function createActivityLog(data: InsertActivityLog) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(activityLogs).values(data);
  return Number(result[0].insertId);
}

export async function deleteActivityLog(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.delete(activityLogs).where(eq(activityLogs.id, id));
}
