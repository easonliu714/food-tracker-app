import { GoogleGenerativeAI } from "@google/generative-ai";
import * as FileSystem from "expo-file-system";
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

// ⚠️ 請填入您的 API Key
const API_KEY = "AIzaSyDpGgc9felzsoqEsx9iBKig3DLSnE5l8_E"; 

const genAI = new GoogleGenerativeAI(API_KEY);

export interface FoodAnalysisResult {
  foodName: string;
  detectedObject: string; // 新增：AI 看到的物件
  calories: number;
  macros: {
    protein: number;
    carbs: number;
    fat: number;
  };
  suggestion: string;
}

export interface RecipeResult {
  title: string;
  calories: number;
  ingredients: string[];
  steps: string[];
  reason: string;
}

export interface WorkoutResult {
  activity: string;
  duration_minutes: number;
  estimated_calories: number;
  reason: string;
}

/// 1. 分析食物 (升級版)
export async function analyzeFoodImage(imageUri: string): Promise<FoodAnalysisResult | null> {
  try {
    console.log("開始處理圖片...", imageUri);
    // 1. 壓縮與轉檔：縮小到寬度 800px，轉成 JPEG，品質 0.7
    const manipulatedImage = await manipulateAsync(
      imageUri,
      [{ resize: { width: 800 } }],
      { compress: 0.7, format: SaveFormat.JPEG, base64: true }
    );
    
    if (!manipulatedImage.base64) throw new Error("圖片處理失敗");
    console.log("圖片處理完成，開始呼叫 AI...");

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    
    // 修改提示詞：要求回傳 detectedObject
    const prompt = `
      Analyze this food image. Return ONLY a JSON object (no markdown) with this structure:
      {
        "foodName": "string (Traditional Chinese, e.g. 紅燒牛肉麵)",
        "detectedObject": "string (What main object did you see?)",
        "calories": number (estimated total),
        "macros": { "protein": number, "carbs": number, "fat": number },
        "suggestion": "string (short health advice in Traditional Chinese)"
      }
      If it's not food, set "foodName" to "無法識別為食物".
    `;

    const result = await model.generateContent([
      prompt,
      { inlineData: { data: manipulatedImage.base64, mimeType: "image/jpeg" } }
    ]);
    
    console.log("AI 回應:", result.response.text());

    const jsonStr = result.response.text().replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(jsonStr);

  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    // 可以回傳一個特殊的錯誤物件讓 UI 知道
    return {
      foodName: "分析失敗",
      detectedObject: "Error",
      calories: 0, macros: { protein: 0, carbs: 0, fat: 0 },
      suggestion: "請檢查網路或稍後再試。亦可切換至手動輸入模式。"
    };
  }
}

// 2. 食譜建議
export async function suggestRecipe(remainingCalories: number, type: 'STORE' | 'COOKING'): Promise<RecipeResult | null> {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const prompt = `
      Suggest a ${type === 'STORE' ? 'Taiwan convenience store combo (7-11/FamilyMart)' : 'simple home-cooked meal'} 
      for a user with ${remainingCalories} kcal budget.
      Return ONLY a JSON object (no markdown) with this structure:
      {
        "title": "string (Traditional Chinese)",
        "calories": number,
        "ingredients": ["string"],
        "steps": ["string"],
        "reason": "string (why this fits)"
      }
    `;
    const result = await model.generateContent(prompt);
    const jsonStr = result.response.text().replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(jsonStr);
  } catch (error) {
    console.error("Recipe Generation Error:", error);
    return null;
  }
}

// 3. 運動建議 (New)
export async function suggestWorkout(userProfile: any, remainingCalories: number, currentTime: Date): Promise<WorkoutResult | null> {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const hour = currentTime.getHours();
    const timeDesc = hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";
    
    const prompt = `
      Suggest a workout activity for a user in Taiwan.
      Context: Time is ${timeDesc} (${hour}:00), Goal: ${userProfile?.goal || 'stay healthy'}, Remaining Calories today: ${remainingCalories}.
      Current weight: ${userProfile?.currentWeightKg || 70}kg.
      Return ONLY a JSON object (no markdown) with:
      {
        "activity": "string (Traditional Chinese, e.g., Jogging, Yoga)",
        "duration_minutes": number,
        "estimated_calories": number,
        "reason": "string (Traditional Chinese, why this fits)"
      }
    `;
    const result = await model.generateContent(prompt);
    const jsonStr = result.response.text().replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(jsonStr);
  } catch (error) {
    console.error("Workout Suggestion Error:", error);
    return null;
  }
}