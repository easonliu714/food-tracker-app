// scripts/test-key.js
const { GoogleGenerativeAI } = require("@google/generative-ai");

// ⚠️ 請在此填入您的真實 API Key
const API_KEY = "AIzaSyBu_-bfj2ThpQWsC3ts19Cs3eAjyga2wDI"; 

async function test() {
  console.log("🚀 開始測試 API Key 連線...");
  console.log(`🔑 Key 前五碼: ${API_KEY.substring(0, 5)}...`);

  try {
    const genAI = new GoogleGenerativeAI(API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    console.log("📡 發送請求給 Google...");
    const result = await model.generateContent("Hello, are you working?");
    const response = await result.response;
    const text = response.text();

    console.log("\n✅ 測試成功！(Success)");
    console.log("🤖 AI 回覆:", text);
  } catch (error) {
    console.error("\n❌ 測試失敗 (Failed)");
    console.error("錯誤代碼:", error.message);
    if (error.message.includes("404")) {
      console.log("👉 [診斷] 404 錯誤：通常是因為 Key 綁定了 Android 應用程式限制，但在純腳本環境下無法驗證。請到 Google Console 暫時移除限制。");
    }
  }
}

test();