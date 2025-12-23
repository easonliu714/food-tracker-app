const { GoogleGenerativeAI } = require("@google/generative-ai");

// ⚠️ 請在此填入您的真實 API Key
const API_KEY = "AIzaSyB25jArJujUL4kwmYOdpcAOuW4ZBzh92-w"; 

async function test() {
  console.log("🚀 開始雙階段 API Key 測試...");
  console.log(`🔑 Key 前五碼: ${API_KEY.substring(0, 5)}...`);

  const genAI = new GoogleGenerativeAI(API_KEY);
  
  // 1. 測試穩定版 (Flash)
  console.log("\n[階段一] 測試 gemini-1.5-flash (穩定版)...");
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    await model.generateContent("Hi");
    console.log("✅ 1.5-flash: 成功！(最推薦使用)");
  } catch (e) {
    console.log(`❌ 1.5-flash: 失敗 (${getReason(e)})`);
  }

  // 2. 測試最新版 (Latest)
  console.log("\n[階段二] 測試 gemini-flash-latest (實驗版)...");
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });
    await model.generateContent("Hi");
    console.log("✅ flash-latest: 成功！");
  } catch (e) {
    console.log(`❌ flash-latest: 失敗 (${getReason(e)})`);
  }
}

function getReason(e) {
  if (e.message.includes("429")) return "配額額滿/429";
  if (e.message.includes("404")) return "無權限/404";
  return e.message;
}

test();