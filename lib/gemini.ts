import { GoogleGenerativeAI } from "@google/generative-ai";
import { getSettings } from "./storage";
import * as FileSystem from 'expo-file-system';

// Polyfill
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

export const calculateWorkoutCalories = (typeKey: string, durationMin: number, weightKg: number, distanceKm?: number, steps?: number): number => {
  let met = 4.0;
  if (METS[typeKey]) met = METS[typeKey];
  else if (typeKey.includes('run')) met = 9.8;
  else if (typeKey.includes('walk')) met = 3.8;
  
  if (distanceKm && durationMin > 0) {
    const speed = distanceKm / (durationMin/60);
    if(typeKey === 'running' && speed > 10) met = 11.0;
  }
  const burned = (met * 3.5 * weightKg / 200) * durationMin;
  console.log(`[Mobile Log] Calc: Type=${typeKey} Min=${durationMin} W=${weightKg} -> ${burned} kcal`);
  return Math.round(burned);
};

const getModel = (apiKey: string, modelName: string) => {
  return new GoogleGenerativeAI(apiKey).getGenerativeModel({ model: modelName });
};

function cleanJson(text: string): string {
  try {
    let clean = text.replace(/```json/g, "").replace(/```/g, "").trim();
    const firstOpen = clean.indexOf('{');
    const lastClose = clean.lastIndexOf('}');
    if (firstOpen !== -1 && lastClose !== -1) {
      clean = clean.substring(firstOpen, lastClose + 1);
    }
    return clean;
  } catch (e) {
    return text;
  }
}

// [核心修正] 恢復 V1.0.4 邏輯：只做測試，回傳所有可用模型，不自動挑選
export async function validateApiKey(apiKey: string) {
  try {
    const cleanKey = apiKey.trim();
    if (!cleanKey) throw new Error("Key is empty");
    
    console.log("[Mobile Log] 正在測試 API Key 有效性...");
    
    // 使用最基礎的 gemini-1.5-flash 進行連線測試
    const model = getModel(cleanKey, "gemini-1.5-flash");
    await model.generateContent("Hi");
    
    console.log("[Mobile Log] 測試成功，回傳模型列表供使用者選擇");
    
    // 回傳固定的模型清單 (包含最新的 2.0 Flash Exp，這可能就是您手機上的 2.5 效果)
    const availableModels = [
      "gemini-1.5-flash", 
      "gemini-1.5-pro", 
      "gemini-2.0-flash-exp", // 這是目前最新的 Experimental 版本
      "gemini-flash-latest"   // 舊的別名
    ];
    
    return { valid: true, models: availableModels };
  } catch (e: any) {
    console.error("[Mobile Error] API Key 測試失敗:", e.message);
    return { valid: false, error: e.message };
  }
}

async function sendPrompt(prompt: string, imageBase64?: string) {
  try {
    const settings = await getSettings();
    if (!settings.apiKey) throw new Error("API Key not set");

    // [核心修正] 嚴格遵守使用者在設定頁面選擇的模型，不做自動切換
    const modelName = settings.model || "gemini-1.5-flash";
    const apiKey = settings.apiKey.trim();
    
    console.log(`[Mobile Log] 使用模型: ${modelName}, 發送請求...`);
    
    const model = getModel(apiKey, modelName);
    
    const content = imageBase64 
      ? [{ inlineData: { data: imageBase64, mimeType: "image/jpeg" } }, prompt] 
      : prompt;

    const result = await model.generateContent(content);
    const text = result.response.text();
    console.log("[Mobile Log] 收到回應 (前50字):", text.substring(0, 50).replace(/\n/g, ' '));
    
    const jsonStr = cleanJson(text);
    return JSON.parse(jsonStr);
  } catch (e: any) {
    console.error(`[Mobile Error] 模型 ${settings.model} 執行失敗:`, e.message);
    // 直接拋出錯誤，讓 UI 顯示並引導使用者去設定頁面切換
    throw e;
  }
}

export async function identifyWorkoutType(input: string) {
  const prompt = `Identify workout: "${input}". Return JSON { "key": "running|walking|cycling|swimming|yoga|pilates|weight_lifting|hiit|basketball|soccer|tennis|hiking|stair_climbing|dance|cleaning" } (default "custom")`;
  try {
    const res = await sendPrompt(prompt);
    return res || { key: 'custom', name: input };
  } catch {
    return { key: 'custom', name: input };
  }
}

export async function analyzeFoodImage(imageUri: string, lang: string = 'zh-TW', mode: 'NORMAL' | 'OCR' = 'NORMAL') {
  try {
    const base64 = await FileSystem.readAsStringAsync(imageUri, { encoding: FileSystem.EncodingType.Base64 });
    const prompt = mode === 'OCR' 
      ? `OCR task. Extract nutrition facts label. Output Language: ${lang}. Return JSON: { "foodName": "string", "calories": number, "macros": {"protein": number, "carbs": number, "fat": number, "sodium": number}, "estimated_weight_g": 100 }`
      : `Nutritionist task. Analyze food image. Output Language: ${lang}. 
         Requirements:
         1. "description_suffix": Short composition description (e.g. "Fried").
         2. "detailed_analysis": Provide composition details AND specific intake advice.
         Return JSON: { "foodName": "string", "description_suffix": "string", "calories": number, "macros": {"protein": number, "carbs": number, "fat": number, "sodium": number}, "estimated_weight_g": number, "detailed_analysis": "string" }`;
    
    return await sendPrompt(prompt, base64);
  } catch (e: any) {
    console.error("[Mobile Error] 圖片分析流程錯誤:", e.message);
    return null;
  }
}

export async function analyzeFoodText(textInput: string, lang: string = 'zh-TW') {
  const prompt = `Analyze food: "${textInput}". Output Language: ${lang}. 
    Requirements: "detailed_analysis" must include ingredients and health advice.
    Return JSON: { "foodName": "string", "description_suffix": "string", "calories": number, "macros": { "protein": number, "carbs": number, "fat": number, "sodium": number }, "estimated_weight_g": number, "detailed_analysis": "string" }`;
  return await sendPrompt(prompt);
}

export async function suggestRecipe(remainingCal: number, type: 'STORE'|'COOK', lang: string) {
  const prompt = `Suggest a ${type} recipe/meal under ${Math.abs(remainingCal)}kcal. Output Language: ${lang}. Return JSON: { "title": "string", "calories": number, "ingredients": ["string"], "steps": ["string"], "reason": "string" }`;
  return await sendPrompt(prompt);
}

export async function suggestWorkout(profile: any, remainingCal: number, lang: string) {
  const isOver = remainingCal < 0;
  const goal = isOver 
    ? `User is OVER budget by ${Math.abs(remainingCal)} kcal. Suggest High-Intensity workout.`
    : `User has ${remainingCal} kcal remaining. Suggest moderate workout.`;

  const prompt = `
    Context: Age ${new Date().getFullYear() - (profile?.birthYear || 2000)}, Weight ${profile?.currentWeightKg}kg. ${goal}
    Output Language: ${lang}. 
    Return JSON: { "activity": "string", "duration_minutes": number, "estimated_calories": number, "reason": "string", "video_url": "string" }
  `;
  return await sendPrompt(prompt);
}