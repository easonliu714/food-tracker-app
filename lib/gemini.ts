import { GoogleGenerativeAI } from "@google/generative-ai";
import { getSettings } from "./storage";

// 驗證 API Key 並回傳可用模型
export async function validateApiKey(apiKey: string) {
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    // 使用 flash-latest 進行輕量測試
    const testModel = genAI.getGenerativeModel({ model: "gemini-flash-latest" }); 
    try {
      await testModel.generateContent("Hi");
    } catch (e: any) {
      if (e.message?.includes("API key not valid") || e.message?.includes("key expired") || e.status === 400) {
         return { valid: false, error: "API Key 無效或已過期" };
      }
    }

    // 更新模型清單，優先推薦 flash-latest
    const availableModels = [
      "gemini-flash-latest",
      "gemini-2.0-flash-exp",
      "gemini-1.5-flash",
      "gemini-1.5-pro", 
      "gemini-pro"
    ];
    
    return { valid: true, models: availableModels };
  } catch (error: any) {
    return { valid: false, error: error.message || "連線失敗" };
  }
}

// 取得實例
async function getModel() {
  const { apiKey, model } = await getSettings();
  if (!apiKey) throw new Error("API Key not found");
  const genAI = new GoogleGenerativeAI(apiKey);
  // 若設定中的模型失效，自動 fallback 到 gemini-flash-latest
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
      
      Strategy:
      - If remaining calories is negative, suggest a strict, low-calorie, high-satiety meal (e.g., salads, lean protein).
      - If positive, suggest a balanced meal fitting the budget.
      - Align with the goal (e.g., Muscle gain -> high protein).

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
      Strategy:
      - If calorie status is negative (over budget), suggest a higher intensity or longer duration cardio/HIIT to burn it off.
      - If positive, focus on strength or maintenance based on goal.
      
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

    const prompt = `
      Analyze this food image. 
      Language: ${lang}.
      User Profile: Age ${age}, Goal: ${goal}.

      Provide:
      1. Food Name (Specific).
      2. Nutrition facts per 100g (estimate).
      3. Composition (short description of ingredients).
      4. Intake Suggestion (Advice based on user goal).

      Output JSON format:
      {
        "foodName": "Name",
        "calories_100g": 150,
        "protein_100g": 10,
        "carbs_100g": 20,
        "fat_100g": 5,
        "composition": "Short composition description (e.g. Rice, Chicken, Sauce)",
        "suggestion": "Advice considering the user's goal (e.g. Good for muscle gain, but watch the sauce)."
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