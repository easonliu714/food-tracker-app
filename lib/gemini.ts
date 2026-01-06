import { GoogleGenerativeAI } from "@google/generative-ai";
import { getSettings } from "./storage";
import { differenceInDays } from "date-fns";
import * as FileSystem from 'expo-file-system';

async function getModel() {
  const { apiKey, model } = await getSettings();
  if (!apiKey) throw new Error("API Key not found");
  const genAI = new GoogleGenerativeAI(apiKey);
  // 使用 gemini-1.5-flash，速度快且支援長文本
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

// [FIX] 強制格式化指令 (Strict Formatting)
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
        const chatHistory = history.map(h => ({
            role: h.role,
            parts: h.parts
        }));

        const chat = model.startChat({
            history: chatHistory,
            generationConfig: { maxOutputTokens: 8192 }, // 確保長篇回覆不被截斷
        });

        let systemInstruction = "";
        
        if (profile) {
            const context = getProfileContext(profile);
            const status = `(Current Status: Remaining Calories: ${profile.remaining} kcal.)`;
            systemInstruction = `${context}\n${status}\n`;
        }
        
        // 組合指令：系統上下文 + 格式要求 + 語言要求
        const langInstruction = `(IMPORTANT: Reply in ${lang} language only. Ensure all generated search links and keywords are also in ${lang}.)`;
        const finalMessage = `${systemInstruction}${formattingInstruction}${langInstruction}\n\n${newMessage}`;
        
        const result = await chat.sendMessage(finalMessage);
        return result.response.text();
    } catch (e) {
        console.error("Chat Error:", e);
        throw e; 
    }
}

// 圖像分析
export async function analyzeFoodImage(base64Image: string, lang: string, profile?: any) {
  try {
    const model = await getModel();
    const context = profile ? getProfileContext(profile) : "";

    const prompt = `
      You are a professional nutritionist.
      Analyze the provided image (plated meal or nutrition label).

      Task:
      1. Identify food item(s).
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

// 文字分析
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
