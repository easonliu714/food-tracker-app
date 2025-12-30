import { GoogleGenerativeAI } from "@google/generative-ai";
import { getSettings } from "./storage";
import { differenceInDays } from "date-fns";

async function getModel() {
  const { apiKey, model } = await getSettings();
  if (!apiKey) throw new Error("API Key not found");
  const genAI = new GoogleGenerativeAI(apiKey);
  return genAI.getGenerativeModel({ model: model || "gemini-flash-latest" });
}

export async function validateApiKey(apiKey: string) {
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const testModel = genAI.getGenerativeModel({ model: "gemini-flash-latest" });
    await testModel.generateContent("Hi");
    return { valid: true, models: ["gemini-flash-latest", "gemini-1.5-flash", "gemini-1.5-pro"] };
  } catch (error: any) {
    return { valid: false, error: error.message || "Invalid Key" };
  }
}

// [新增] 輔助函式：產生包含年齡與期限的上下文
const getProfileContext = (profile: any) => {
    // 1. 計算年齡
    let age = 30;
    if (profile?.birthDate) {
        age = new Date().getFullYear() - new Date(profile.birthDate).getFullYear();
    }
    
    // 2. 計算目標期限
    let deadlineInfo = "";
    if (profile?.targetDate) {
        const diff = differenceInDays(new Date(profile.targetDate), new Date());
        if (diff > 0) {
            deadlineInfo = `, Target Deadline: ${profile.targetDate} (${diff} days remaining)`;
        } else if (diff === 0) {
            deadlineInfo = `, Target Deadline: Today`;
        } else {
            deadlineInfo = `, Target Deadline: Passed (${Math.abs(diff)} days ago)`;
        }
    }

    return `User Profile: Age ${age}, Gender: ${profile?.gender || 'N/A'}, Goal: ${profile?.goal || "Maintain"}${deadlineInfo}`;
};

// 圖像分析
export async function analyzeFoodImage(base64Image: string, lang: string, profile?: any) {
  try {
    const model = await getModel();
    const context = getProfileContext(profile);

    const prompt = `
      You are a professional nutritionist. Analyze this food image.
      Output ONLY valid JSON.
      Language: ${lang}.
      ${context}.

      Required JSON Structure:
      {
        "foodName": "Short Name",
        "calories_100g": 0, "protein_100g": 0, "fat_100g": 0, "carbs_100g": 0, "sodium_100g": 0,
        "sugar_100g": 0, "fiber_100g": 0, "saturated_fat_100g": 0, "trans_fat_100g": 0, "cholesterol_100g": 0,
        "zinc_100g": 0, "magnesium_100g": 0, "iron_100g": 0,
        "composition": "Ingredients list...",
        "suggestion": "Advice based on user goal and remaining days..."
      }
    `;

    const result = await model.generateContent([
      prompt,
      { inlineData: { data: base64Image, mimeType: "image/jpeg" } }
    ]);
    
    const text = result.response.text().replace(/```json|```/g, '').trim();
    return JSON.parse(text);
  } catch (e) {
    console.error("Analyze Error:", e);
    return null;
  }
}

// 純文字食物分析
export async function analyzeFoodText(foodName: string, lang: string, profile?: any) {
    try {
      const model = await getModel();
      const context = getProfileContext(profile);
  
      const prompt = `
        You are a professional nutritionist. Estimate nutrition for: "${foodName}".
        Output ONLY valid JSON.
        Language: ${lang}.
        ${context}.
  
        Required JSON Structure:
        {
          "foodName": "${foodName}",
          "calories_100g": 0, "protein_100g": 0, "fat_100g": 0, "carbs_100g": 0, "sodium_100g": 0,
          "sugar_100g": 0, "fiber_100g": 0, "saturated_fat_100g": 0, "trans_fat_100g": 0, "cholesterol_100g": 0,
          "zinc_100g": 0, "magnesium_100g": 0, "iron_100g": 0,
          "composition": "Estimated ingredients...",
          "suggestion": "Advice based on user goal..."
        }
      `;
  
      const result = await model.generateContent(prompt);
      const text = result.response.text().replace(/```json|```/g, '').trim();
      return JSON.parse(text);
    } catch (e) {
      console.error("Text Analyze Error:", e);
      return null;
    }
}

// 聊天對話
export async function chatWithAI(history: any[], newMessage: string, profile: any, lang: string) {
    try {
        const model = await getModel();
        const chatHistory = history.map(h => ({
            role: h.role,
            parts: h.parts
        }));

        const chat = model.startChat({
            history: chatHistory,
            generationConfig: { maxOutputTokens: 800 },
        });

        const context = getProfileContext(profile);
        const status = `(Current Status: Remaining Calories: ${profile?.remaining} kcal. Language: ${lang}.)`;
        
        const result = await chat.sendMessage(`${context}\n${status}\nUser: ${newMessage}`);
        return result.response.text();
    } catch (e) {
        console.error("Chat Error:", e);
        return "AI is busy, please try again.";
    }
}

export async function suggestRecipe(remainingCalories: number, type: 'STORE'|'COOK', lang: string, profile?: any) {
  try {
    const model = await getModel();
    const context = getProfileContext(profile);
    const status = remainingCalories < 0 ? "Exceeded (Negative)" : "Sufficient";
    
    const prompt = `
      You are a professional nutritionist AI.
      ${context}.
      Current Calorie Status: ${remainingCalories} kcal remaining (${status}).
      
      Please suggest a recipe/meal plan (Type: ${type}).
      **IMPORTANT: Reply in language code: ${lang}.**
      
      Output JSON format:
      {
        "title": "Meal Name (in ${lang})",
        "calories": 500,
        "ingredients": ["item1", "item2"],
        "steps": ["step1", "step2"],
        "reason": "Reason based on timeline and goal (in ${lang})"
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
    const context = getProfileContext(profile);
    const status = remainingCalories < 0 ? "Exceeded (Negative)" : "Sufficient";

    const prompt = `
      You are a fitness coach AI.
      ${context}.
      Current Calorie Status: ${remainingCalories} kcal remaining (${status}).
      
      Suggest a workout session considering the deadline.
      **IMPORTANT: Reply in language code: ${lang}.**
      
      Output JSON format:
      {
        "activity": "Activity Name (in ${lang})",
        "duration_minutes": 30,
        "estimated_calories": 200,
        "reason": "Reason based on deadline urgency (in ${lang})",
        "video_url": "https://youtube.com/results?search_query=..."
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