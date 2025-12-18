import { z } from "zod";
import { COOKIE_NAME } from "../shared/const.js";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import * as db from "./db";

export const appRouter = router({
  // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  // User Profile
  profile: router({
    get: protectedProcedure.query(({ ctx }) => db.getUserProfile(ctx.user.id)),
    create: protectedProcedure
      .input(
        z.object({
          gender: z.enum(["male", "female", "other"]).optional(),
          birthDate: z.date().optional(),
          heightCm: z.number().optional(),
          currentWeightKg: z.number().optional(),
          targetWeightKg: z.number().optional(),
          activityLevel: z
            .enum(["sedentary", "lightly_active", "moderately_active", "very_active", "extra_active"])
            .optional(),
          goal: z.enum(["lose_weight", "maintain", "gain_weight"]).optional(),
          dailyCalorieTarget: z.number().optional(),
          proteinPercentage: z.number().optional(),
          carbsPercentage: z.number().optional(),
          fatPercentage: z.number().optional(),
        }),
      )
      .mutation(({ ctx, input }) => db.createUserProfile({ userId: ctx.user.id, ...input })),
    update: protectedProcedure
      .input(
        z.object({
          gender: z.enum(["male", "female", "other"]).optional(),
          birthDate: z.date().optional(),
          heightCm: z.number().optional(),
          currentWeightKg: z.number().optional(),
          targetWeightKg: z.number().optional(),
          activityLevel: z
            .enum(["sedentary", "lightly_active", "moderately_active", "very_active", "extra_active"])
            .optional(),
          goal: z.enum(["lose_weight", "maintain", "gain_weight"]).optional(),
          dailyCalorieTarget: z.number().optional(),
          proteinPercentage: z.number().optional(),
          carbsPercentage: z.number().optional(),
          fatPercentage: z.number().optional(),
        }),
      )
      .mutation(({ ctx, input }) => db.updateUserProfile(ctx.user.id, input)),
  }),

  // Food Items
  foodItems: router({
    getById: publicProcedure.input(z.object({ id: z.number() })).query(({ input }) => db.getFoodItemById(input.id)),
    getByBarcode: publicProcedure
      .input(z.object({ barcode: z.string() }))
      .query(({ input }) => db.getFoodItemByBarcode(input.barcode)),
    search: publicProcedure
      .input(z.object({ query: z.string(), limit: z.number().optional() }))
      .query(({ input }) => db.searchFoodItems(input.query, input.limit)),
    create: protectedProcedure
      .input(
        z.object({
          name: z.string(),
          brand: z.string().optional(),
          barcode: z.string().optional(),
          servingSizeG: z.number().optional(),
          servingSizeDescription: z.string().optional(),
          caloriesPerServing: z.number().optional(),
          proteinG: z.number().optional(),
          carbsG: z.number().optional(),
          fatG: z.number().optional(),
          fiberG: z.number().optional(),
          sugarG: z.number().optional(),
          sodiumMg: z.number().optional(),
          cholesterolMg: z.number().optional(),
          vitaminAMcg: z.number().optional(),
          vitaminCMg: z.number().optional(),
          calciumMg: z.number().optional(),
          ironMg: z.number().optional(),
          imageUrl: z.string().optional(),
          source: z.enum(["user", "barcode", "ai", "database"]).optional(),
        }),
      )
      .mutation(({ input }) => db.createFoodItem(input)),
  }),

  // Food Logs
  foodLogs: router({
    getByDate: protectedProcedure
      .input(z.object({ date: z.date() }))
      .query(({ ctx, input }) => db.getFoodLogsByDate(ctx.user.id, input.date)),
    getByRange: protectedProcedure
      .input(z.object({ startDate: z.date(), endDate: z.date() }))
      .query(({ ctx, input }) => db.getFoodLogsByUserId(ctx.user.id, input.startDate, input.endDate)),
    create: protectedProcedure
      .input(
        z.object({
          foodItemId: z.number().optional(),
          mealType: z.enum(["breakfast", "lunch", "dinner", "snack"]),
          foodName: z.string(),
          servings: z.number(),
          totalCalories: z.number(),
          totalProteinG: z.number().optional(),
          totalCarbsG: z.number().optional(),
          totalFatG: z.number().optional(),
          imageUrl: z.string().optional(),
          notes: z.string().optional(),
        }),
      )
      .mutation(({ ctx, input }) => db.createFoodLog({ userId: ctx.user.id, ...input })),
    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          mealType: z.enum(["breakfast", "lunch", "dinner", "snack"]).optional(),
          foodName: z.string().optional(),
          servings: z.number().optional(),
          totalCalories: z.number().optional(),
          totalProteinG: z.number().optional(),
          totalCarbsG: z.number().optional(),
          totalFatG: z.number().optional(),
          notes: z.string().optional(),
        }),
      )
      .mutation(({ input }) => db.updateFoodLog(input.id, input)),
    delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(({ input }) => db.deleteFoodLog(input.id)),
    getDailySummary: protectedProcedure
      .input(z.object({ date: z.date() }))
      .query(({ ctx, input }) => db.getDailyNutritionSummary(ctx.user.id, input.date)),
  }),

  // Recipes
  recipes: router({
    getAll: publicProcedure
      .input(
        z
          .object({
            mealType: z.string().optional(),
            dietaryPreference: z.string().optional(),
            maxCalories: z.number().optional(),
          })
          .optional(),
      )
      .query(({ input }) => db.getAllRecipes(input)),
    getById: publicProcedure.input(z.object({ id: z.number() })).query(({ input }) => db.getRecipeById(input.id)),
    create: protectedProcedure
      .input(
        z.object({
          name: z.string(),
          description: z.string().optional(),
          imageUrl: z.string().optional(),
          prepTimeMinutes: z.number().optional(),
          cookTimeMinutes: z.number().optional(),
          servings: z.number().optional(),
          totalCalories: z.number().optional(),
          totalProteinG: z.number().optional(),
          totalCarbsG: z.number().optional(),
          totalFatG: z.number().optional(),
          mealType: z.enum(["breakfast", "lunch", "dinner", "snack"]).optional(),
          dietaryPreference: z.enum(["none", "vegetarian", "vegan", "low_carb", "high_protein", "keto"]).optional(),
          ingredients: z.string().optional(),
          instructions: z.string().optional(),
        }),
      )
      .mutation(({ input }) => db.createRecipe(input)),
  }),

  // Favorite Recipes
  favoriteRecipes: router({
    getAll: protectedProcedure.query(({ ctx }) => db.getFavoriteRecipes(ctx.user.id)),
    add: protectedProcedure
      .input(z.object({ recipeId: z.number() }))
      .mutation(({ ctx, input }) => db.addFavoriteRecipe({ userId: ctx.user.id, recipeId: input.recipeId })),
    remove: protectedProcedure
      .input(z.object({ recipeId: z.number() }))
      .mutation(({ ctx, input }) => db.removeFavoriteRecipe(ctx.user.id, input.recipeId)),
  }),

  // Reminder Settings
  reminders: router({
    get: protectedProcedure.query(({ ctx }) => db.getReminderSettings(ctx.user.id)),
    create: protectedProcedure
      .input(
        z.object({
          breakfastReminderEnabled: z.number().optional(),
          breakfastReminderTime: z.string().optional(),
          lunchReminderEnabled: z.number().optional(),
          lunchReminderTime: z.string().optional(),
          dinnerReminderEnabled: z.number().optional(),
          dinnerReminderTime: z.string().optional(),
          waterReminderEnabled: z.number().optional(),
          waterReminderIntervalMinutes: z.number().optional(),
        }),
      )
      .mutation(({ ctx, input }) => db.createReminderSettings({ userId: ctx.user.id, ...input })),
    update: protectedProcedure
      .input(
        z.object({
          breakfastReminderEnabled: z.number().optional(),
          breakfastReminderTime: z.string().optional(),
          lunchReminderEnabled: z.number().optional(),
          lunchReminderTime: z.string().optional(),
          dinnerReminderEnabled: z.number().optional(),
          dinnerReminderTime: z.string().optional(),
          waterReminderEnabled: z.number().optional(),
          waterReminderIntervalMinutes: z.number().optional(),
        }),
      )
      .mutation(({ ctx, input }) => db.updateReminderSettings(ctx.user.id, input)),
  }),

  // Activity Logs
  activityLogs: router({
    getAll: protectedProcedure
      .input(
        z
          .object({
            startDate: z.date().optional(),
            endDate: z.date().optional(),
          })
          .optional(),
      )
      .query(({ ctx, input }) => db.getActivityLogs(ctx.user.id, input?.startDate, input?.endDate)),
    create: protectedProcedure
      .input(
        z.object({
          activityType: z.string(),
          durationMinutes: z.number().optional(),
          caloriesBurned: z.number().optional(),
          steps: z.number().optional(),
          distanceKm: z.number().optional(),
        }),
      )
      .mutation(({ ctx, input }) => db.createActivityLog({ userId: ctx.user.id, ...input })),
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => db.deleteActivityLog(input.id)),
  }),
});

export type AppRouter = typeof appRouter;
