import { GoogleGenerativeAI } from "@google/generative-ai";
import { getSettings } from "./storage";
import * as FileSystem from 'expo-file-system';

// Polyfill for TextEncoder
if (typeof global.TextEncoder === 'undefined') {
  const { TextEncoder, TextDecoder } = require('text-encoding');
  global.TextEncoder = TextEncoder;
  global.TextDecoder = TextDecoder;
}

// METs table (Strict English Keys)
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
  
  const calories = (met * 3.5 * weightKg / 200) * durationMin;
  return Math.round(calories);
};

// 取得模型實例 (統一管理)
const getModel = (apiKey: string, modelName: string) => {
  const genAI = new GoogleGenerativeAI(apiKey);
  return genAI.getGenerativeModel({ model: modelName });
};

export async function validateApiKey(apiKey: string) {
  try {
    const cleanKey = apiKey.trim();
    if (!cleanKey) throw new Error("Key is empty");
    
    const genAI = new GoogleGenerativeAI(cleanKey);
    
    // 嘗試順序：1.5-flash -> 1.5-pro -> gemini-pro (舊版穩定)
    const modelsToTry = ["gemini-1.5-flash", "gemini-1.5-pro", "gemini-pro"];
    let validModel = "";

    for (const m of modelsToTry) {
      try {
        const model = genAI.getGenerativeModel({ model: m });
        await model.generateContent("Hello");
        validModel = m;
        break; // 成功就跳出
      } catch (innerE) {
        console.log(`Model ${m} failed, trying next...`);
      }
    }

    if (!validModel) throw new Error("All models failed. Check API Key.");
    
    // 回傳成功與可用模型列表
    return { valid: true, models: modelsToTry };
  } catch (e: any) {
    console.error("API Validation Fatal Error:", e);
    return { valid: false, error: e.message || "Invalid Key" };
  }
}

export async function identifyWorkoutType(input: string) {
  try {
    const settings = await getSettings();
    if (!settings.apiKey) return { key: 'custom', name: input };

    // 優先使用設定的模型，若無則預設 flash
    const modelName = settings.model || "gemini-1.5-flash";
    const model = getModel(settings.apiKey.trim(), modelName);

    const prompt = `
      Map activity "${input}" to one of: 
      [running, walking, cycling, swimming, yoga, pilates, weight_lifting, hiit, basketball, soccer, tennis, hiking, stair_climbing, dance, cleaning].
      If unclear, return "custom".
      Return JSON: { "key": "string" }
    `;

    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const jsonStr = text.replace(/```json/g, "").replace(/```/g, "").trim();
    return JSON.parse(jsonStr);
  } catch (e) {
    return { key: 'custom', name: input };
  }
}

export async function analyzeFoodImage(imageUri: string, lang: string = 'zh-TW', mode: 'NORMAL' | 'OCR' = 'NORMAL') {
  try {
    const settings = await getSettings();
    if (!settings.apiKey) throw new Error("No API Key");

    const modelName = settings.model || "gemini-1.5-flash";
    const model = getModel(settings.apiKey.trim(), modelName);
    const base64 = await FileSystem.readAsStringAsync(imageUri, { encoding: FileSystem.EncodingType.Base64 });
    
    let prompt = mode === 'OCR' ? 
      `Extract nutrition from label. Language: ${lang}. Return JSON: { "foodName": "string", "calories": number, "macros": {"protein": number, "carbs": number, "fat": number, "sodium": number}, "estimated_weight_g": 100 }` :
      `Analyze food image. Identify dish, ingredients. Language: ${lang}. Return JSON: { "foodName": "string", "description_suffix": "string", "calories": number, "macros": {"protein": number, "carbs": number, "fat": number, "sodium": number}, "estimated_weight_g": number, "detailed_analysis": "string" }`;

    const result = await model.generateContent([
      { inlineData: { data: base64, mimeType: "image/jpeg" } },
      prompt
    ]);

    const text = result.response.text();
    const jsonStr = text.replace(/```json/g, "").replace(/```/g, "").trim();
    return JSON.parse(jsonStr);
  } catch (e) {
    console.error("Analysis Error:", e);
    return null;
  }
}

export async function analyzeFoodText(textInput: string, lang: string = 'zh-TW') {
  // (與 analyzeFoodImage 類似邏輯，略過重複代碼以節省空間，請確保這部分存在)
  try {
    const settings = await getSettings();
    if (!settings.apiKey) throw new Error("No API Key");
    const model = getModel(settings.apiKey.trim(), settings.model || "gemini-1.5-flash");
    const prompt = `Analyze food: "${textInput}". Output Language: ${lang}. Return JSON: { "foodName": "string", "description_suffix": "string", "calories": number, "macros": { "protein": number, "carbs": number, "fat": number, "sodium": number }, "estimated_weight_g": number, "detailed_analysis": "string" }`;
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    return JSON.parse(text.replace(/```json/g, "").replace(/```/g, "").trim());
  } catch (e) { return null; }
}