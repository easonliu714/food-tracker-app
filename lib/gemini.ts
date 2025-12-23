import { GoogleGenerativeAI } from "@google/generative-ai";
import { getSettings } from "./storage";

// 驗證 API Key 並回傳可用模型
export async function validateApiKey(apiKey: string) {
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    // 使用 listModels 測試連線
    const modelQuery = await genAI.getGenerativeModel({ model: "gemini-pro" }); 
    // 實際上 listModels 需要 Admin SDK 或直接發 requests，這邊用簡單的 generateContent 測試
    // 但為了取得模型清單，正規做法如下，若失敗代表 Key 無效
    
    // 為了更準確測試，我們嘗試一個極小的生成請求
    const testModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash" }); // 假設使用較新模型
    try {
      await testModel.generateContent("Hi");
    } catch (e: any) {
      // 捕捉特定錯誤
      if (e.message?.includes("API key not valid") || e.message?.includes("key expired") || e.status === 400) {
         return { valid: false, error: "API Key 無效或已過期" };
      }
      // 若是 Model 不存在，Key 可能是好的，繼續往下
    }

    // 模擬回傳模型清單 (Gemini Client SDK 目前不一定支援 listModels，通常手動維護清單)
    // 這裡我們列出目前支援的穩定模型
    const availableModels = [
      "gemini-2.0-flash", 
      "gemini-1.5-flash", 
      "gemini-1.5-pro", 
      "gemini-pro", 
      "gemini-flash-latest"
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
  return genAI.getGenerativeModel({ model: model || "gemini-1.5-flash" });
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

// 簡單的熱量計算 (非 AI)
export function calculateWorkoutCalories(type: string, duration: number, weight: number, dist?: number, steps?: number) {
  // 簡易 METs 表
  const mets: Record<string, number> = {
    'walk': 3.5, 'run': 8, 'yoga': 2.5, 'swim': 6, 'cycle': 5,
    '快走': 4.5, '慢跑': 7, '爬梯': 8, '健身': 5
  };
  let met = 4;
  for(const k in mets) {
     if(type.includes(k)) met = mets[k];
  }
  // Formula: kcal = MET * weight(kg) * duration(hr)
  return Math.round(met * weight * (duration/60));
}