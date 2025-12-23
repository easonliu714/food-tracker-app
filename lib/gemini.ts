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
  console.log(`[Mobile Log] Calc: Type=${typeKey} Min=${durationMin} W=${weightKg} -> ${burned} kcal`);
  return Math.round(burned);
};

// 建立模型實例
const getModel = (apiKey: string, modelName: string) => {
  return new GoogleGenerativeAI(apiKey).getGenerativeModel({ model: modelName });
};

// JSON 清理工具
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

// [核心] 執行請求 (含自動降級邏輯)
async function executeRequestWithFallback(apiKey: string, content: any, primaryModel: string = "gemini-flash-latest") {
  const secondaryModel = "gemini-1.5-flash";

  try {
    // 嘗試優先模型
    console.log(`[Mobile Log] 正在嘗試主模型: ${primaryModel}`);
    const model = getModel(apiKey, primaryModel);
    const result = await model.generateContent(content);
    return result;
  } catch (error: any) {
    console.error(`[Mobile Error] 主模型 (${primaryModel}) 失敗:`, error.message);
    
    // 如果主模型失敗，且主模型不是 1.5-flash，則嘗試降級
    if (primaryModel !== secondaryModel) {
      console.log(`[Mobile Log] 自動切換至備用模型: ${secondaryModel} 重試中...`);
      try {
        const fallbackModel = getModel(apiKey, secondaryModel);
        const fallbackResult = await fallbackModel.generateContent(content);
        console.log(`[Mobile Log] 備用模型 (${secondaryModel}) 執行成功！`);
        return fallbackResult;
      } catch (fallbackError: any) {
        console.error(`[Mobile Error] 備用模型 (${secondaryModel}) 也失敗:`, fallbackError.message);
        throw fallbackError; // 兩個都失敗才拋出錯誤
      }
    } else {
      throw error;
    }
  }
}

export async function validateApiKey(apiKey: string) {
  try {
    const cleanKey = apiKey.trim();
    if (!cleanKey) throw new Error("Key is empty");
    
    const content = "Hi";
    // 這裡我們直接用 executeRequestWithFallback 來測試
    // 如果 latest 失敗但 1.5 成功，也會視為驗證通過
    await executeRequestWithFallback(cleanKey, content, "gemini-flash-latest");
    
    console.log("[Mobile Log] API Key 驗證成功 (含自動降級測試)");
    
    return { valid: true, models: ["gemini-flash-latest", "gemini-1.5-flash"] };
  } catch (e: any) {
    console.error("[Mobile Error] API Key 驗證全數失敗:", e.message);
    return { valid: false, error: e.message || "Unknown Error" };
  }
}

async function sendPrompt(prompt: string, imageBase64?: string) {
  try {
    const settings = await getSettings();
    if (!settings.apiKey) throw new Error("API Key not set");

    // 優先使用設定的模型，預設為 latest
    const preferredModel = settings.model || "gemini-flash-latest";
    const apiKey = settings.apiKey.trim();
    
    console.log(`[Mobile Log] 發送請求 Prompt長度: ${prompt.length}`);
    
    const content = imageBase64 
      ? [{ inlineData: { data: imageBase64, mimeType: "image/jpeg" } }, prompt] 
      : prompt;

    // 呼叫具備降級功能的執行器
    const result = await executeRequestWithFallback(apiKey, content, preferredModel);
    
    const text = result.response.text();
    console.log("[Mobile Log] 收到回應 (前100字):", text.substring(0, 100).replace(/\n/g, ' '));
    
    const jsonStr = cleanJson(text);
    return JSON.parse(jsonStr);
  } catch (e: any) {
    console.error("[Mobile Error] 最終請求失敗:", e.message);
    return null; // 回傳 null 讓 UI 處理
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
         1. "description_suffix": Short composition description (e.g. "Fried, with sauce").
         2. "detailed_analysis": Provide composition details AND specific intake advice.
         Return JSON: { "foodName": "string", "description_suffix": "string", "calories": number, "macros": {"protein": number, "carbs": number, "fat": number, "sodium": number}, "estimated_weight_g": number, "detailed_analysis": "string" }`;
    
    return await sendPrompt(prompt, base64);
  } catch (e: any) {
    console.error("[Mobile Error] 圖片讀取失敗:", e.message);
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
    ? `User is OVER budget by ${Math.abs(remainingCal)} kcal. Suggest a High-Intensity/Cardio workout to burn it off.`
    : `User has ${remainingCal} kcal remaining. Suggest a moderate/maintenance workout for health.`;

  const prompt = `
    Context: Age ${new Date().getFullYear() - (profile?.birthYear || 2000)}, Weight ${profile?.currentWeightKg}kg. ${goal}
    Output Language: ${lang}. 
    Return JSON: { "activity": "string", "duration_minutes": number, "estimated_calories": number, "reason": "string", "video_url": "string" }
  `;
  return await sendPrompt(prompt);
}