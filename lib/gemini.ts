import { GoogleGenerativeAI } from "@google/generative-ai";
import * as FileSystem from "expo-file-system";
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { getSettings } from "./storage";

// 動態獲取 AI 實例
const getGenAI = async () => {
  const { apiKey } = await getSettings();
  if (!apiKey) throw new Error("API Key 未設定，請至個人頁面設定");
  return new GoogleGenerativeAI(apiKey);
};

// 動態獲取模型
const getModel = async () => {
  const { apiKey, model } = await getSettings();
  if (!apiKey) throw new Error("API Key 未設定");
  const genAI = new GoogleGenerativeAI(apiKey);
  // 預設使用 2.5-flash，如果有設定則用設定值
  return genAI.getGenerativeModel({ model: model || "gemini-2.5-flash" });
};

// 0. 測試 API Key 並取得可用模型
export async function validateApiKey(apiKey: string) {
  try {
    // 透過 ListModels API 測試
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    const data = await response.json();
    
    if (data.error) throw new Error(data.error.message);
    
    // 過濾出 generateContent 支援的模型
    const models = (data.models || [])
      .filter((m: any) => m.supportedGenerationMethods?.includes("generateContent"))
      .map((m: any) => m.name.replace("models/", ""));
      
    // 排序，讓較新的模型排前面 (簡單邏輯)
    models.sort().reverse();
    
    return { valid: true, models };
  } catch (error: any) {
    return { valid: false, error: error.message };
  }
}

// 1. 分析食物圖片
export async function analyzeFoodImage(imageUri: string) {
  try {
    const manipulatedImage = await manipulateAsync(
      imageUri,
      [{ resize: { width: 512 } }],
      { compress: 0.6, format: SaveFormat.JPEG, base64: true }
    );
    
    const model = await getModel();
    const prompt = `
      Analyze this food image. Return ONLY a JSON object (no markdown):
      {
        "foodName": "string (Traditional Chinese)",
        "detectedObject": "string",
        "estimated_weight_g": number (total grams),
        "calories": number (total),
        "macros": { "protein": number, "carbs": number, "fat": number, "sodium": number (mg) },
        "suggestion": "string (Traditional Chinese)"
      }
      If not food, set "foodName" to "無法識別為食物".
    `;

    const result = await model.generateContent([
      prompt,
      { inlineData: { data: manipulatedImage.base64 || "", mimeType: "image/jpeg" } }
    ]);
    
    const jsonStr = result.response.text().replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(jsonStr);
  } catch (error) {
    console.error("AI Error:", error);
    return null;
  }
}

// 2. 分析食物文字
export async function analyzeFoodText(foodName: string) {
  try {
    const model = await getModel();
    const prompt = `
      Estimate nutrition for "${foodName}" (standard serving). Return ONLY a JSON object (no markdown):
      {
        "foodName": "${foodName}",
        "detectedObject": "Text Input",
        "estimated_weight_g": number (standard weight),
        "calories": number,
        "macros": { "protein": number, "carbs": number, "fat": number, "sodium": number },
        "suggestion": "string (Traditional Chinese)"
      }
    `;
    const result = await model.generateContent(prompt);
    const jsonStr = result.response.text().replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(jsonStr);
  } catch (error) {
    return null;
  }
}

// 3. 食譜建議
export async function suggestRecipe(remainingCalories: number, type: 'STORE' | 'COOKING') {
  try {
    const model = await getModel();
    const prompt = `
      Suggest a ${type === 'STORE' ? 'Taiwan convenience store combo' : 'simple home-cooked meal'} 
      for a user with ${remainingCalories} kcal budget.
      Return ONLY a JSON object (no markdown) with: { "title": string, "calories": number, "ingredients": string[], "steps": string[], "reason": string }.
    `;
    const result = await model.generateContent(prompt);
    const jsonStr = result.response.text().replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(jsonStr);
  } catch (error) {
    return null;
  }
}

// 4. 運動建議
export async function suggestWorkout(userProfile: any, remainingCalories: number) {
  try {
    const model = await getModel();
    const prompt = `
      Suggest a workout for a user (${userProfile?.currentWeightKg || 70}kg) to burn approx 300kcal.
      Remaining budget: ${remainingCalories}.
      Return ONLY a JSON object (no markdown) with: { "activity": string, "duration_minutes": number, "estimated_calories": number, "reason": string, "video_url": "string (YouTube search URL)" }.
    `;
    const result = await model.generateContent(prompt);
    const jsonStr = result.response.text().replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(jsonStr);
  } catch (error) {
    return null;
  }
}

// 5. 運動熱量計算
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