import { GoogleGenerativeAI } from "@google/generative-ai";
import { getSettings } from "./storage";
import { differenceInDays, subDays, format } from "date-fns";
import * as FileSystem from 'expo-file-system';
import { db } from "./db";
import { foodLogs, activityLogs, dailyMetrics } from "@/drizzle/schema";
import { gte, desc, eq } from "drizzle-orm";

async function getModel() {
  const { apiKey, model } = await getSettings();
  if (!apiKey) throw new Error("API Key not found");
  const genAI = new GoogleGenerativeAI(apiKey);
  return genAI.getGenerativeModel({ model: model || "gemini-flash-latest" });
}

export async function validateApiKey(apiKey: string) {
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const testModel = genAI.getGenerativeModel({ model: "gemini-flash-latest" });
    await testModel.generateContent("Hi");
    return { valid: true, models: ["gemini-flash-latest", "gemini-1.5-flash", "gemini-1.5-pro", "gemini-1.0-pro"] };
  } catch (error: any) {
    return { valid: false, error: error.message || "Invalid Key" };
  }
}

const getProfileContext = (profile: any) => {
    if (!profile) return "";
    
    let age = 30;
    if (profile.birthDate) {
        age = new Date().getFullYear() - new Date(profile.birthDate).getFullYear();
    }
    
    let deadlineInfo = "";
    if (profile.targetDate) {
        const diff = differenceInDays(new Date(profile.targetDate), new Date());
        if (diff > 0) deadlineInfo = `, Target Deadline: ${profile.targetDate} (${diff} days remaining)`;
        else if (diff === 0) deadlineInfo = `, Target Deadline: Today`;
        else deadlineInfo = `, Target Deadline: Passed`;
    }

    return `User Profile: Age ${age}, Gender: ${profile.gender || 'N/A'}, Goal: ${profile.goal || "Maintain"}${deadlineInfo}`;
};

// [修改] 獲取使用者近 7 日數據摘要 (包含睡眠)
async function getUserRecentStats() {
    try {
        const endDate = new Date();
        const startDate = subDays(endDate, 7);
        const startStr = format(startDate, "yyyy-MM-dd");

        // 1. 飲食
        const foods = await db.select().from(foodLogs).where(gte(foodLogs.date, startStr));
        // 2. 運動
        const activities = await db.select().from(activityLogs).where(gte(activityLogs.date, startStr));
        // 3. 身體數值 & 飲水 & [新增] 睡眠
        const metrics = await db.select().from(dailyMetrics).where(gte(dailyMetrics.date, startStr)).orderBy(desc(dailyMetrics.date));

        // 彙整數據
        let statsStr = "Here is the user's data for the last 7 days:\n";
        
        // 每日摘要
        const dailyMap = new Map();
        foods.forEach(f => {
            if(!dailyMap.has(f.date)) dailyMap.set(f.date, {cal:0, pro:0, fat:0, carb:0, items:[]});
            const d = dailyMap.get(f.date);
            d.cal += f.totalCalories || 0;
            d.pro += f.totalProteinG || 0;
            d.fat += f.totalFatG || 0;
            d.carb += f.totalCarbsG || 0;
            d.items.push(f.foodName);
        });

        dailyMap.forEach((val, date) => {
            const metric = metrics.find(m => m.date === date);
            const acts = activities.filter(a => a.date === date);
            const burn = acts.reduce((acc, cur) => acc + (cur.caloriesBurned||0), 0);
            const water = metric?.waterMl || 0;
            const weight = metric?.weightKg ? `${metric.weightKg}kg` : "N/A";
            const fat = metric?.bodyFatPercentage ? `${metric.bodyFatPercentage}%` : "N/A";
            // [新增] 睡眠顯示
            const sleep = metric?.sleepHours ? `${metric.sleepHours}h` : "N/A";

            statsStr += `- [${date}]: Intake: ${Math.round(val.cal)}kcal (P:${Math.round(val.pro)}g, F:${Math.round(val.fat)}g, C:${Math.round(val.carb)}g). Burned: ${Math.round(burn)}kcal. Water: ${water}ml. Sleep: ${sleep}. Weight: ${weight}, Body Fat: ${fat}. Foods: ${val.items.slice(0,5).join(', ')}...\n`;
        });

        return statsStr;
    } catch (e) {
        console.error("Stats Error", e);
        return "";
    }
}

// 強制格式化指令
const formattingInstruction = `
[FORMATTING RULES - STRICTLY FOLLOW]
1. **TABLES**: You MUST use Markdown Tables for any list of items, ingredients, or equipment.
   - Example: | Item | Qty | Calories |
2. **LISTS**: Use bullet points (-) for step-by-step instructions.
3. **LINKS**: Provide hyperlinks as [Title](URL). 
   - IMPORTANT: The 'Title' and any search queries in the URL MUST be in the user's requested language (e.g., Traditional Chinese), NOT in English.
4. **STRUCTURE**: Use '### Heading' for sections. Use **Bold** for emphasis.
5. **CLARITY**: Do not output large blocks of text. Break it down visually.
`;

export async function chatWithAI(history: any[], newMessage: string, profile: any, lang: string) {
    try {
        const model = await getModel();
        
        // 抓取統計資料
        const recentStats = await getUserRecentStats();

        const chatHistory = history.map(h => ({
            role: h.role,
            parts: h.parts
        }));

        const chat = model.startChat({
            history: chatHistory,
            generationConfig: { maxOutputTokens: 8192 },
        });

        let systemInstruction = "";
        
        if (profile) {
            const context = getProfileContext(profile);
            const status = `(Current Status: Remaining Calories: ${profile.remaining} kcal.)`;
            systemInstruction = `${context}\n${status}\n\n[RECENT DATA]\n${recentStats}\n\n(Based on the data above, provide specific dietary and exercise advice. Consider sleep and water intake as well.)\n`;
        }
        
        const langInstruction = `(IMPORTANT: Reply in ${lang} language only. Ensure all generated search links and keywords are also in ${lang}.)`;
        const finalMessage = `${systemInstruction}${formattingInstruction}${langInstruction}\n\n${newMessage}`;
        
        const result = await chat.sendMessage(finalMessage);
        return result.response.text();
    } catch (e) {
        console.error("Chat Error:", e);
        throw e; 
    }
}

// [修改開始] 增加 foodNameHint 參數
export async function analyzeFoodImage(base64Image: string, lang: string, profile?: any, foodNameHint?: string) {
  try {
    const model = await getModel();
    const context = profile ? getProfileContext(profile) : "";

    // [修改] 動態調整 Prompt
    let userHint = "";
    if (foodNameHint) {
        userHint = `USER HINT: The user has identified this food as "${foodNameHint}". Please prioritize this name for your analysis, but combined with the image content to estimate portion size and specific ingredients.`;
    }

    const prompt = `
      You are a professional nutritionist.
      Analyze the provided image (plated meal or nutrition label).
      ${userHint}

      Task:
      1. Identify food item(s) (If user provided a hint, use it as the primary identification).
      2. ESTIMATE serving size (g/ml). Do NOT default to 100g unless unsure.
      3. Analyze nutrition facts for that serving size.
      4. Provide composition analysis and health advice.

      Language: ${lang}.
      ${context}.

      Output JSON ONLY:
      {
        "foodName": "string",
        "estimated_weight_g": number, 
        "calories": number, "protein": number, "fat": number, "carbs": number, "sodium": number,
        "sugar": number, "fiber": number, "saturated_fat": number, "trans_fat": number, "cholesterol": number,
        "zinc": number, "magnesium": number, "iron": number,
        "composition": "string",
        "suggestion": "string"
      }
    `;

    const result = await model.generateContent([
      prompt,
      { inlineData: { data: base64Image, mimeType: "image/jpeg" } }
    ]);
    
    const text = result.response.text().replace(/```json|```/g, '').trim();
    return JSON.parse(text);
  } catch (e) {
    console.error("Analyze Error:", e);
    return null;
  }
}

export async function analyzeFoodText(foodName: string, lang: string, profile?: any) {
    try {
      const model = await getModel();
      const context = profile ? getProfileContext(profile) : "";
  
      const prompt = `
        You are a professional nutritionist. Estimate nutrition for: "${foodName}".
        Assume standard serving size.
        Language: ${lang}.
        ${context}.
  
        Output JSON ONLY:
        {
          "foodName": "${foodName}",
          "estimated_weight_g": 100,
          "calories": 0, "protein": 0, "fat": 0, "carbs": 0, "sodium": 0,
          "sugar": 0, "fiber": 0, "saturated_fat": 0, "trans_fat": 0, "cholesterol": 0,
          "zinc": 0, "magnesium": 0, "iron": 0,
          "composition": "string",
          "suggestion": "string"
        }
      `;
  
      const result = await model.generateContent(prompt);
      const text = result.response.text().replace(/```json|```/g, '').trim();
      return JSON.parse(text);
    } catch (e) {
      console.error("Text Analyze Error:", e);
      return null;
    }
}