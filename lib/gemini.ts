import { GoogleGenerativeAI } from "@google/generative-ai";
import * as FileSystem from "expo-file-system";
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

// 🛑【重要】請將下方引號內的文字換成您剛剛申請的「新」API Key
// 且不要再將此檔案內容貼到公開網路上
const API_KEY = "AIzaSyCVO2w1BZ9bOaX5QY7RnOr-Vadhi-5dcSc"; 

const genAI = new GoogleGenerativeAI(API_KEY);

export interface FoodAnalysisResult {
  foodName: string;
  detectedObject: string;
  calories: number;
  macros: {
    protein: number;
    carbs: number;
    fat: number;
    sodium: number; // 鈉
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

// 1. 分析食物圖片
export async function analyzeFoodImage(imageUri: string): Promise<FoodAnalysisResult | null> {
  try {
    console.log("Processing image...");
    const manipulatedImage = await manipulateAsync(
      imageUri,
      [{ resize: { width: 512 } }], // 縮小至 512px 加速上傳
      { compress: 0.6, format: SaveFormat.JPEG, base64: true }
    );
    
    // 使用最新模型
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    
    const prompt = `
      Analyze this food image. Return ONLY a JSON object (no markdown) with this structure:
      {
        "foodName": "string (Traditional Chinese)",
        "detectedObject": "string (What did you see?)",
        "calories": number (estimated total),
        "macros": { 
          "protein": number, 
          "carbs": number, 
          "fat": number,
          "sodium": number (mg) 
        },
        "suggestion": "string (short health advice in Traditional Chinese)"
      }
      If it's not food, set "foodName" to "無法識別為食物".
    `;

    const result = await model.generateContent([
      prompt,
      { inlineData: { data: manipulatedImage.base64 || "", mimeType: "image/jpeg" } }
    ]);
    
    const text = result.response.text();
    console.log("AI Raw Response:", text); // 除錯用
    
    const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(jsonStr);
  } catch (error) {
    console.error("Gemini Image Error:", error);
    return null;
  }
}

// 2. 分析食物文字
export async function analyzeFoodText(foodName: string): Promise<FoodAnalysisResult | null> {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const prompt = `
      Estimate nutrition for "${foodName}" (standard serving). Return ONLY a JSON object (no markdown) with:
      {
        "foodName": "${foodName}",
        "detectedObject": "Text Input",
        "calories": number,
        "macros": { "protein": number, "carbs": number, "fat": number, "sodium": number },
        "suggestion": "string (Traditional Chinese)"
      }
    `;
    const result = await model.generateContent(prompt);
    const jsonStr = result.response.text().replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(jsonStr);
  } catch (error) {
    console.error("Gemini Text Error:", error);
    return null;
  }
}

// 3. 食譜建議
export async function suggestRecipe(remainingCalories: number, type: 'STORE' | 'COOKING'): Promise<RecipeResult | null> {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const prompt = `
      Suggest a ${type === 'STORE' ? 'Taiwan convenience store combo' : 'simple home-cooked meal'} 
      for a user with ${remainingCalories} kcal budget.
      Return ONLY a JSON object (no markdown) with keys: title, calories, ingredients, steps, reason.
    `;
    const result = await model.generateContent(prompt);
    const jsonStr = result.response.text().replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(jsonStr);
  } catch (error) {
    return null;
  }
}

// 4. 運動建議 (純 AI)
export async function suggestWorkout(userProfile: any, remainingCalories: number): Promise<WorkoutResult | null> {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const prompt = `
      Suggest a workout for a user (${userProfile?.currentWeightKg || 70}kg) to burn approx 300kcal.
      Remaining budget: ${remainingCalories}.
      Return ONLY a JSON object (no markdown) with keys: activity, duration_minutes, estimated_calories, reason.
    `;
    const result = await model.generateContent(prompt);
    const jsonStr = result.response.text().replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(jsonStr);
  } catch (error) {
    return null;
  }
}

// 5. 運動熱量計算公式 (優先使用)
export function calculateWorkoutCalories(
  activity: string, durationMinutes: number, weightKg: number, distanceKm: number = 0, steps: number = 0
): number {
  const METs: Record<string, number> = {
    '慢走': 3.0, '快走': 4.5, '慢跑': 7.0, '快跑': 11.0, 
    '跑步機': 5.0, '爬梯': 8.0, '一般運動': 4.0
  };
  const met = METs[activity] || 4.0;
  
  let val = met * weightKg * (durationMinutes / 60);
  if (distanceKm > 0) val = Math.max(val, weightKg * distanceKm * 1.036);
  if (steps > 0) val = Math.max(val, steps * 0.04);
  
  return Math.round(val);
}