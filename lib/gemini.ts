import { GoogleGenerativeAI } from "@google/generative-ai";
import { getSettings } from "./storage";
import * as FileSystem from 'expo-file-system';

// Polyfill for TextEncoder
if (typeof global.TextEncoder === 'undefined') {
  const { TextEncoder, TextDecoder } = require('text-encoding');
  global.TextEncoder = TextEncoder;
  global.TextDecoder = TextDecoder;
}

const METS: Record<string, number> = {
  'running': 9.8, 'walking': 3.8, 'cycling': 7.5, 'swimming': 8.0,
  'yoga': 2.5, 'pilates': 3.0, 'weight_lifting': 5.0, 'hiit': 8.0,
  'basketball': 6.5, 'soccer': 7.0, 'tennis': 7.3,
  'hiking': 6.0, 'stair_climbing': 9.0, 'dance': 5.0, 'cleaning': 3.0
};

export const calculateWorkoutCalories = (
  typeKey: string, 
  durationMin: number, 
  weightKg: number, 
  distanceKm?: number,
  steps?: number
): number => {
  let met = 4.0;
  if (METS[typeKey]) met = METS[typeKey];
  else if (typeKey.includes('run')) met = 9.8;
  else if (typeKey.includes('walk')) met = 3.8;
  
  if (distanceKm && durationMin > 0) {
    const speed = distanceKm / (durationMin/60);
    if(typeKey === 'running' && speed > 10) met = 11.0;
  }
  
  const burned = (met * 3.5 * weightKg / 200) * durationMin;
  console.log(`[Calc] Type:${typeKey} Min:${durationMin} W:${weightKg} -> ${burned} kcal`);
  return Math.round(burned);
};

// 統一取得模型實例 (強制預設 2.5-flash)
const getModel = (apiKey: string, modelName: string = "gemini-2.5-flash") => {
  console.log(`[Gemini] Init Model: ${modelName}`);
  const genAI = new GoogleGenerativeAI(apiKey);
  return genAI.getGenerativeModel({ model: modelName });
};

export async function validateApiKey(apiKey: string) {
  try {
    const cleanKey = apiKey.trim();
    if (!cleanKey) throw new Error("Key is empty");
    
    // 強制使用 2.5 進行驗證，因為 1.5 在您的環境會 404
    const model = getModel(cleanKey, "gemini-2.5-flash");
    console.log("[Gemini] Sending validation request...");
    
    await model.generateContent("Hi");
    
    console.log("[Gemini] Validation Success!");
    return { valid: true, models: ["gemini-2.5-flash", "gemini-1.5-flash"] };
  } catch (e: any) {
    console.error("[Gemini] Validation FAILED:", e.message);
    return { valid: false, error: e.message || "Unknown Error" };
  }
}

// 通用請求處理器 (含錯誤處理與日誌)
async function sendPrompt(prompt: string, imageBase64?: string) {
  try {
    const settings = await getSettings();
    if (!settings.apiKey) throw new Error("API Key not set");

    // 優先使用設定值，若無則使用 2.5-flash
    const modelName = settings.model || "gemini-2.5-flash";
    const model = getModel(settings.apiKey.trim(), modelName);
    
    console.log(`[Gemini] Sending Request... Prompt Length: ${prompt.length}`);
    
    const content = imageBase64 
      ? [{ inlineData: { data: imageBase64, mimeType: "image/jpeg" } }, prompt] 
      : prompt;

    const result = await model.generateContent(content);
    const text = result.response.text();
    console.log("[Gemini] Response Received (First 50 chars):", text.substring(0, 50).replace(/\n/g, ' '));
    
    // 清理 Markdown 格式
    const jsonStr = text.replace(/```json|```/g, "").trim();
    return JSON.parse(jsonStr);
  } catch (e: any) {
    console.error("[Gemini] Request FAILED:", e.message);
    return null;
  }
}

export async function identifyWorkoutType(input: string) {
  const prompt = `Identify workout: "${input}". Return JSON { "key": "running|walking|cycling|swimming|yoga|pilates|weight_lifting|hiit|basketball|soccer|tennis|hiking|stair_climbing|dance|cleaning" } (default "custom")`;
  const res = await sendPrompt(prompt);
  return res || { key: 'custom', name: input };
}

export async function analyzeFoodImage(imageUri: string, lang: string = 'zh-TW', mode: 'NORMAL' | 'OCR' = 'NORMAL') {
  try {
    const base64 = await FileSystem.readAsStringAsync(imageUri, { encoding: FileSystem.EncodingType.Base64 });
    const prompt = mode === 'OCR' 
      ? `OCR task. Extract nutrition facts label. Output Language: ${lang}. Return JSON: { "foodName": "string", "calories": number, "macros": {"protein": number, "carbs": number, "fat": number, "sodium": number}, "estimated_weight_g": 100 }`
      : `Nutritionist task. Analyze food image. Output Language: ${lang}. Return JSON: { "foodName": "string", "description_suffix": "string", "calories": number, "macros": {"protein": number, "carbs": number, "fat": number, "sodium": number}, "estimated_weight_g": number, "detailed_analysis": "string (Health advice)" }`;
    
    return await sendPrompt(prompt, base64);
  } catch (e) {
    console.error("Read File Error:", e);
    return null;
  }
}

export async function analyzeFoodText(textInput: string, lang: string = 'zh-TW') {
  const prompt = `Analyze food: "${textInput}". Output Language: ${lang}. Return JSON: { "foodName": "string", "description_suffix": "string", "calories": number, "macros": { "protein": number, "carbs": number, "fat": number, "sodium": number }, "estimated_weight_g": number, "detailed_analysis": "string" }`;
  return await sendPrompt(prompt);
}

export async function suggestRecipe(remainingCal: number, type: 'STORE'|'COOK', lang: string) {
  // [修正] 明確指定 Output Language
  const prompt = `Suggest a ${type} recipe/meal under ${remainingCal}kcal. Output Language: ${lang}. Return JSON: { "title": "string", "calories": number, "ingredients": ["string"], "steps": ["string"], "reason": "string" }`;
  return await sendPrompt(prompt);
}

export async function suggestWorkout(profile: any, remainingCal: number, lang: string) {
  // [修正] 明確指定 Output Language
  const prompt = `Suggest a workout for weight ${profile?.currentWeightKg}kg to burn calories (budget: ${remainingCal}). Output Language: ${lang}. Return JSON: { "activity": "string", "duration_minutes": number, "estimated_calories": number, "reason": "string", "video_url": "string" }`;
  return await sendPrompt(prompt);
}