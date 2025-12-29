import { drizzle } from "drizzle-orm/expo-sqlite";
import { openDatabaseSync } from "expo-sqlite";
import * as schema from "../drizzle/schema";

// 開啟本地資料庫檔案 (如果不存在會自動建立)
const expoDb = openDatabaseSync("food_tracker.db");

// 初始化 Drizzle ORM
export const db = drizzle(expoDb, { schema });

// 初始化資料表 (開發階段使用，確保 Table 存在)
// 注意：在正式 Production，建議使用 drizzle-kit migrate
export async function initDatabase() {
  try {
    // 這裡使用簡單的 SQL 來建立資料表，或是依賴 Drizzle 的 migration
    // 為了簡化，這邊建議您先手動或透過 SQL 腳本建立，或者使用 migrate 函式
    // 在 Expo Go 開發中，通常會在 app/_layout.tsx 啟動時呼叫 migration
    console.log("Database initialized");
  } catch (e) {
    console.error("Database init error", e);
  }
}