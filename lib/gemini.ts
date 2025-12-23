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

// [修正] 預設使用 gemini-1.5-flash (穩定版)
const getModel = (apiKey: string, modelName: string) => {
  // 若設定為 latest，自動對應到 1.5-flash
  const targetModel = (modelName === 'gemini-flash-latest' || !modelName) ? 'gemini-1.5-flash' : modelName;
  console.log(`[Gemini] Init Model: ${targetModel}`);
  const genAI = new GoogleGenerativeAI(apiKey);
  return genAI.getGenerativeModel({ model: targetModel });
};

// [新增] 強力 JSON 清理函式 (解決 Unexpected character 問題)
function cleanJson(text: string): string {
  try {
    // 1. 移除 Markdown 標記
    let clean = text.replace(/```json/g, "").replace(/```/g, "").trim();
    // 2. 尋找第一個 { 與最後一個 }，排除前後雜訊
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

export async function validateApiKey(apiKey: string) {
  try {
    const cleanKey = apiKey.trim();
    if (!cleanKey) throw new Error("Key is empty");
    
    // 測試兩個常用模型
    const model = getModel(cleanKey, "gemini-1.5-flash");
    console.log("[Gemini] Sending validation request...");
    await model.generateContent("Hi");
    console.log("[Gemini] Validation Success!");
    
    return { valid: true, models: ["gemini-1.5-flash", "gemini-1.5-pro", "gemini-flash-latest"] };
  } catch (e: any) {
    console.error("[Gemini] Validation FAILED:", e.message);
    return { valid: false, error: e.message || "Unknown Error" };
  }
}

async function sendPrompt(prompt: string, imageBase64?: string) {
  try {
    const settings = await getSettings();
    if (!settings.apiKey) throw new Error("API Key not set");

    const modelName = settings.model || "gemini-1.5-flash";
    const model = getModel(settings.apiKey.trim(), modelName);
    
    console.log(`[Gemini] Sending Request... Prompt Length: ${prompt.length}`);
    
    const content = imageBase64 
      ? [{ inlineData: { data: imageBase64, mimeType: "image/jpeg" } }, prompt] 
      : prompt;

    const result = await model.generateContent(content);
    const text = result.response.text();
    console.log("[Gemini] Raw Response (First 100 chars):", text.substring(0, 100).replace(/\n/g, ' '));
    
    const jsonStr = cleanJson(text);
    return JSON.parse(jsonStr);
  } catch (e: any) {
    console.error("[Gemini] Request FAILED:", e.message);
    console.error("[Gemini] Full Error:", JSON.stringify(e, null, 2));
    throw e; // 拋出錯誤讓前端捕獲
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
         2. "detailed_analysis": Provide composition details AND specific intake advice (e.g. "High fat, reduce intake").
         Return JSON: { "foodName": "string", "description_suffix": "string", "calories": number, "macros": {"protein": number, "carbs": number, "fat": number, "sodium": number}, "estimated_weight_g": number, "detailed_analysis": "string" }`;
    
    return await sendPrompt(prompt, base64);
  } catch (e) {
    console.error("Analyze Image Error:", e);
    return null;
  }
}

export async function analyzeFoodText(textInput: string, lang: string = 'zh-TW') {
  const prompt = `Analyze food: "${textInput}". Output Language: ${lang}. 
    Requirements: "detailed_analysis" must include ingredients and health advice.
    Return JSON: { "foodName": "string", "description_suffix": "string", "calories": number, "macros": { "protein": number, "carbs": number, "fat": number, "sodium": number }, "estimated_weight_g": number, "detailed_analysis": "string" }`;
  try {
    return await sendPrompt(prompt);
  } catch (e) {
    return null;
  }
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