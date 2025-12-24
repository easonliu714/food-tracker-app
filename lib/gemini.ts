import { GoogleGenerativeAI } from "@google/generative-ai";
import { getSettings } from "./storage";

export async function validateApiKey(apiKey: string) {
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const testModel = genAI.getGenerativeModel({ model: "gemini-flash-latest" }); 
    try {
      await testModel.generateContent("Hi");
    } catch (e: any) {
      if (e.message?.includes("API key not valid") || e.message?.includes("key expired") || e.status === 400) {
         return { valid: false, error: "API Key 無效或已過期" };
      }
    }
    const availableModels = ["gemini-flash-latest", "gemini-1.5-flash", "gemini-1.5-pro", "gemini-pro"];
    return { valid: true, models: availableModels };
  } catch (error: any) {
    return { valid: false, error: error.message || "連線失敗" };
  }
}

async function getModel() {
  const { apiKey, model } = await getSettings();
  if (!apiKey) throw new Error("API Key not found");
  const genAI = new GoogleGenerativeAI(apiKey);
  return genAI.getGenerativeModel({ model: model || "gemini-flash-latest" });
}

// --- AI 功能 ---

export async function suggestRecipe(remainingCalories: number, type: 'STORE'|'COOK', lang: string, profile?: any) {
  try {
    const model = await getModel();
    const age = profile?.birthYear ? new Date().getFullYear() - parseInt(profile.birthYear) : 30;
    const goal = profile?.trainingGoal || "維持身形";
    const status = remainingCalories < 0 ? "超標(負值)" : "充足";
    
    const prompt = `
      You are a professional nutritionist AI.
      User Profile: Age ${age}, Goal: ${goal}.
      Current Calorie Status: ${remainingCalories} kcal remaining (${status}).
      Please suggest a recipe/meal plan (Type: ${type}).
      Language: ${lang}.
      Output JSON format:
      {
        "title": "Meal Name",
        "calories": 500,
        "ingredients": ["item1", "item2"],
        "steps": ["step1", "step2"],
        "reason": "Why this fits the user's current status and goal."
      }
      Only return JSON.
    `;
    const result = await model.generateContent(prompt);
    const text = result.response.text().replace(/```json|```/g, '').trim();
    return JSON.parse(text);
  } catch (e) {
    console.error(e);
    return null;
  }
}

export async function suggestWorkout(profile: any, remainingCalories: number, lang: string) {
  try {
    const model = await getModel();
    const age = profile?.birthYear ? new Date().getFullYear() - parseInt(profile.birthYear) : 30;
    const goal = profile?.trainingGoal || "維持身形";
    const status = remainingCalories < 0 ? "超標(負值)" : "充足";

    const prompt = `
      You are a fitness coach AI.
      User Profile: Age ${age}, Gender ${profile?.gender}, Goal: ${goal}.
      Current Calorie Status: ${remainingCalories} kcal remaining (${status}).
      Suggest a workout session.
      Language: ${lang}.
      Output JSON format:
      {
        "activity": "Activity Name",
        "duration_minutes": 30,
        "estimated_calories": 200,
        "reason": "Why this workout fits the goal and calorie status.",
        "video_url": "https://youtube.com/results?search_query=..." (search query link)
      }
      Only return JSON.
    `;
    const result = await model.generateContent(prompt);
    const text = result.response.text().replace(/```json|```/g, '').trim();
    return JSON.parse(text);
  } catch (e) {
    console.error(e);
    return null;
  }
}

export async function analyzeFoodImage(base64Image: string, lang: string, profile?: any) {
  try {
    const model = await getModel();
    const age = profile?.birthYear ? new Date().getFullYear() - parseInt(profile.birthYear) : 30;
    const goal = profile?.trainingGoal || "維持身形";

    // [修正] 優化 Prompt：要求名稱簡潔，詳細資訊分開
    const prompt = `
      Analyze this food image. 
      Language: ${lang}.
      User Profile: Age ${age}, Goal: ${goal}.

      Provide detailed nutrition facts **PER 100g**.
      Estimate values if not visible.
      
      Required Fields (per 100g):
      - foodName: Concise Name ONLY (e.g. "Chicken Salad"). Do NOT include ingredients here.
      - Basic: Calories, Protein, Carbs, Fat, Sodium
      - Detailed: Sugar, Saturated Fat, Trans Fat, Cholesterol
      - Minerals: Zinc, Magnesium, Iron
      - Composition: Detailed ingredients list.
      - Suggestion: Advice considering the user's goal.

      Output JSON format:
      {
        "foodName": "Concise Food Name",
        "calories_100g": 150,
        "protein_100g": 10,
        "carbs_100g": 20,
        "fat_100g": 5,
        "sodium_100g": 500,
        "sugar_100g": 5,
        "saturated_fat_100g": 1,
        "trans_fat_100g": 0,
        "cholesterol_100g": 30,
        "zinc_100g": 0.5,
        "magnesium_100g": 10,
        "iron_100g": 1.2,
        "composition": "Short composition description",
        "suggestion": "Advice considering the user's goal."
      }
      Only return JSON.
    `;
    const result = await model.generateContent([
      prompt,
      { inlineData: { data: base64Image, mimeType: "image/jpeg" } }
    ]);
    const text = result.response.text().replace(/```json|```/g, '').trim();
    return JSON.parse(text);
  } catch (e) {
    console.error(e);
    return null;
  }
}