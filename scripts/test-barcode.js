// 執行方式：node scripts/test-barcode.js <條碼號碼>
// 若未輸入條碼，預設使用 Nutella (3017620422003) 進行測試

const barcode = process.argv[2] || '3017620422003';

console.log(`\n🔍 開始測試條碼查詢: ${barcode}`);
console.log(`------------------------------------------------`);

async function testOpenFoodFacts() {
  const url = `https://world.openfoodfacts.org/api/v0/product/${barcode}.json`;
  console.log(`正在連線 Open Food Facts: ${url}`);

  try {
    // 使用 fetch 模擬 App 的請求
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`HTTP 錯誤! 狀態碼: ${response.status}`);
    }

    const json = await response.json();

    if (json.status === 1 && json.product) {
      const p = json.product;
      console.log(`\n✅ [成功] 找到商品資料！`);
      console.log(`------------------------------------------------`);
      console.log(`📦 商品名稱: ${p.product_name || p.product_name_en || "未知名稱"}`);
      console.log(`🔥 熱量 (100g): ${p.nutriments?.['energy-kcal_100g']} kcal`);
      console.log(`🥩 蛋白質:      ${p.nutriments?.proteins_100g} g`);
      console.log(`🍚 碳水化合物:  ${p.nutriments?.carbohydrates_100g} g`);
      console.log(`🍬 糖:          ${p.nutriments?.sugars_100g} g`);
      console.log(`🥑 脂肪:        ${p.nutriments?.fat_100g} g`);
      console.log(`🧂 鈉:          ${(p.nutriments?.salt_100g || 0) * 400} mg (估算)`);
      console.log(`------------------------------------------------`);
      console.log(`測試結論：API 連線正常，資料結構符合 App 預期。`);
    } else {
      console.log(`\n❌ [失敗] 找不到此條碼的資料 (Status: ${json.status})`);
      console.log(`可能原因：條碼錯誤、商品未登錄於 OFF 資料庫。`);
    }

  } catch (error) {
    console.error(`\n❌ [錯誤] 連線發生異常:`, error.message);
  }
}

// 模擬本地查詢邏輯 (僅驗證邏輯，非真實資料)
function simulateLocalCheck() {
    console.log(`\n(模擬) 步驟 1: 檢查本地資料庫...`);
    console.log(`=> 由於這是終端機環境，無法讀取手機內的 AsyncStorage。`);
    console.log(`=> 在 App 中，程式會先呼叫 getProductByBarcode('${barcode}')`);
    console.log(`=> 若回傳 null，才會執行下方的 API 查詢。\n`);
}

// 執行
simulateLocalCheck();
testOpenFoodFacts();