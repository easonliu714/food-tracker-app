import { GoogleGenerativeAI } from "@google/generative-ai";
import * as FileSystem from "expo-file-system";
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { getSettings } from "./storage";

// 動態獲取模型
const getModel = async () => {
  const { apiKey, model } = await getSettings();
  if (!apiKey) throw new Error("API Key 未設定");
  const genAI = new GoogleGenerativeAI(apiKey);
  return genAI.getGenerativeModel({ model: model || "gemini-2.5-flash" });
};

// 驗證 Key
export async function validateApiKey(apiKey: string) {
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    const data = await response.json();
    if (data.error) throw new Error(data.error.message);
    const models = (data.models || [])
      .filter((m: any) => m.supportedGenerationMethods?.includes("generateContent"))
      .map((m: any) => m.name.replace("models/", ""));
    models.sort().reverse();
    return { valid: true, models };
  } catch (error: any) {
    return { valid: false, error: error.message };
  }
}

// 1. 分析食物圖片
export async function analyzeFoodImage(imageUri: string, lang: string = 'zh-TW') {
  try {
    const manipulatedImage = await manipulateAsync(imageUri, [{ resize: { width: 512 } }], { compress: 0.6, format: SaveFormat.JPEG, base64: true });
    const model = await getModel();
    const prompt = `
      Analyze this food image. Response language: ${lang}.
      Return ONLY a JSON object (no markdown):
      {
        "foodName": "string (in ${lang})",
        "detectedObject": "string",
        "estimated_weight_g": number (grams),
        "calories": number,
        "macros": { "protein": number, "carbs": number, "fat": number, "sodium": number },
        "suggestion": "string (health advice in ${lang})"
      }
    `;
    const result = await model.generateContent([prompt, { inlineData: { data: manipulatedImage.base64 || "", mimeType: "image/jpeg" } }]);
    return JSON.parse(result.response.text().replace(/```json/g, '').replace(/```/g, '').trim());
  } catch (error) { return null; }
}

// 2. 分析文字
export async function analyzeFoodText(foodName: string, lang: string = 'zh-TW') {
  try {
    const model = await getModel();
    const prompt = `
      Estimate nutrition for "${foodName}". Response language: ${lang}.
      Return ONLY a JSON object:
      {
        "foodName": "${foodName}",
        "detectedObject": "Text Input",
        "estimated_weight_g": number (100g base),
        "calories": number,
        "macros": { "protein": number, "carbs": number, "fat": number, "sodium": number },
        "suggestion": "string (in ${lang})"
      }
    `;
    const result = await model.generateContent(prompt);
    return JSON.parse(result.response.text().replace(/```json/g, '').replace(/```/g, '').trim());
  } catch (error) { return null; }
}

// 3. 食譜建議 (考慮正餐)
export async function suggestRecipe(remainingCalories: number, type: 'STORE' | 'COOKING', lang: string = 'zh-TW') {
  try {
    const model = await getModel();
    const hour = new Date().getHours();
    let mealContext = "snack";
    if (hour < 10) mealContext = "breakfast";
    else if (hour < 14) mealContext = "lunch";
    else if (hour < 20) mealContext = "dinner";
    else mealContext = "late night snack";

    const prompt = `
      Suggest a ${type === 'STORE' ? 'Convenience Store' : 'Home Cooked'} meal.
      Context: Current time ${hour}:00 (${mealContext}). Remaining calories: ${remainingCalories}.
      Response language: ${lang}.
      Target: Main meal (Breakfast/Lunch/Dinner) if appropriate, otherwise snack.
      Return ONLY a JSON object:
      {
        "title": "string",
        "calories": number,
        "ingredients": ["string"],
        "steps": ["string"],
        "reason": "string (Why this fits ${mealContext} and budget)"
      }
    `;
    const result = await model.generateContent(prompt);
    return JSON.parse(result.response.text().replace(/```json/g, '').replace(/```/g, '').trim());
  } catch (error) { return null; }
}

// 4. 運動建議 (優先無輔具)
export async function suggestWorkout(userProfile: any, remainingCalories: number, lang: string = 'zh-TW') {
  try {
    const model = await getModel();
    const prompt = `
      Suggest a workout. User weight: ${userProfile?.currentWeightKg || 70}kg.
      Goal: Burn approx 300kcal or fit remaining ${remainingCalories}.
      Constraint: Prioritize equipment-free exercises or simple props (yoga mat).
      Response language: ${lang}.
      Return ONLY a JSON object:
      {
        "activity": "string",
        "duration_minutes": number,
        "estimated_calories": number,
        "reason": "string",
        "video_url": "string (YouTube search URL)"
      }
    `;
    const result = await model.generateContent(prompt);
    return JSON.parse(result.response.text().replace(/```json/g, '').replace(/```/g, '').trim());
  } catch (error) { return null; }
}

// 5. 公式計算
export function calculateWorkoutCalories(activity: string, durationMinutes: number, weightKg: number, distanceKm: number = 0, steps: number = 0): number {
  const met = 4.0; // 簡化
  let val = met * weightKg * (durationMinutes / 60);
  if (distanceKm > 0) val = Math.max(val, weightKg * distanceKm * 1.036);
  if (steps > 0) val = Math.max(val, steps * 0.04);
  return Math.round(val);
}