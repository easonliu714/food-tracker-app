import { GoogleGenerativeAI } from "@google/generative-ai";
import * as FileSystem from "expo-file-system";
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

// ⚠️ 請填入您的 API Key
const API_KEY = "AIzaSyDpGgc9felzsoqEsx9iBKig3DLSnE5l8_E"; 
const genAI = new GoogleGenerativeAI(API_KEY);

export interface FoodAnalysisResult {
  foodName: string;
  detectedObject: string;
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

// 1. 分析食物圖片 (含壓縮)
export async function analyzeFoodImage(imageUri: string): Promise<FoodAnalysisResult | null> {
  try {
    const manipulatedImage = await manipulateAsync(
      imageUri,
      [{ resize: { width: 800 } }],
      { compress: 0.7, format: SaveFormat.JPEG, base64: true }
    );
    
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const prompt = `
      Analyze this food image. Return ONLY a JSON object (no markdown) with this structure:
      {
        "foodName": "string (Traditional Chinese)",
        "detectedObject": "string (What main object did you see?)",
        "calories": number (estimated total),
        "macros": { "protein": number, "carbs": number, "fat": number },
        "suggestion": "string (short health advice in Traditional Chinese)"
      }
      If it's not food, set "foodName" to "無法識別為食物".
    `;

    const result = await model.generateContent([
      prompt,
      { inlineData: { data: manipulatedImage.base64 || "", mimeType: "image/jpeg" } }
    ]);
    
    const jsonStr = result.response.text().replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(jsonStr);
  } catch (error) {
    console.error("Gemini Image Analysis Error:", error);
    return null;
  }
}

// 2. 分析食物文字 (修復：讓手動輸入也能用 AI)
export async function analyzeFoodText(foodName: string): Promise<FoodAnalysisResult | null> {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const prompt = `
      Estimate nutrition for "${foodName}" (standard serving). Return ONLY a JSON object (no markdown) with:
      {
        "foodName": "${foodName}",
        "detectedObject": "Text Input",
        "calories": number (estimated per serving),
        "macros": { "protein": number, "carbs": number, "fat": number },
        "suggestion": "string (short health advice in Traditional Chinese)"
      }
    `;
    const result = await model.generateContent(prompt);
    const jsonStr = result.response.text().replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(jsonStr);
  } catch (error) {
    console.error("Gemini Text Analysis Error:", error);
    return null;
  }
}

// 3. 食譜建議
export async function suggestRecipe(remainingCalories: number, type: 'STORE' | 'COOKING'): Promise<RecipeResult | null> {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const prompt = `
      Suggest a ${type === 'STORE' ? 'Taiwan convenience store combo' : 'simple home-cooked meal'} 
      for a user with ${remainingCalories} kcal budget.
      Return ONLY a JSON object (no markdown) with: { title, calories, ingredients:[], steps:[], reason }.
    `;
    const result = await model.generateContent(prompt);
    const jsonStr = result.response.text().replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(jsonStr);
  } catch (error) {
    console.error("Recipe Error:", error);
    return null;
  }
}

// 4. 運動建議
export async function suggestWorkout(userProfile: any, remainingCalories: number): Promise<WorkoutResult | null> {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const prompt = `
      Suggest a workout for a user (${userProfile?.currentWeightKg || 70}kg) to burn approx 300kcal.
      Remaining budget: ${remainingCalories}.
      Return ONLY a JSON object (no markdown) with: { activity, duration_minutes, estimated_calories, reason }.
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
  activity: string, 
  durationMinutes: number, 
  weightKg: number,
  distanceKm: number = 0,
  steps: number = 0
): number {
  // METs 表 (代謝當量)
  const METs: Record<string, number> = {
    '慢走': 3.0, '快走': 4.5, '慢跑': 7.0, '快跑': 11.0, 
    '跑步機': 5.0, '爬梯': 8.0, '一般運動': 4.0
  };

  const met = METs[activity] || 4.0;
  
  // 公式 A: 基於時間 (Cal = MET * Kg * Hour)
  let caloriesByTime = met * weightKg * (durationMinutes / 60);

  // 公式 B: 基於距離 (粗略: Kg * Km * 1.036)
  let caloriesByDist = 0;
  if (distanceKm > 0) {
    caloriesByDist = weightKg * distanceKm * 1.036;
  }

  // 公式 C: 基於步數 (粗略: 1步 = 0.04 kcal)
  let caloriesBySteps = 0;
  if (steps > 0) {
    caloriesBySteps = steps * 0.04;
  }

  // 優先順序: 距離 > 步數 > 時間 (取最大值或特定邏輯，這裡取最大值以避免低估)
  return Math.round(Math.max(caloriesByDist, caloriesBySteps, caloriesByTime));
}