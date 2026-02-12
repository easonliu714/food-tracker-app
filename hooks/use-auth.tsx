import React, { useContext, createContext, type PropsWithChildren, useState, useEffect } from "react";
import { useRouter, useSegments } from "expo-router";
import { db } from "@/lib/db";
import { userProfiles } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

const AuthContext = createContext<{
  login: (name: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
  isLoading: boolean;
}>({
  login: async () => {},
  logout: () => {},
  isAuthenticated: false,
  isLoading: false,
});

export function useAuth() {
  return useContext(AuthContext);
}

export function SessionProvider({ children }: PropsWithChildren) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const segments = useSegments();

  // 檢查資料庫是否有用戶資料 (保留此邏輯以供狀態判斷)
  useEffect(() => {
    async function checkUser() {
      try {
        const result = await db.select().from(userProfiles).limit(1);
        if (result.length > 0) {
          setIsAuthenticated(true);
        } else {
          setIsAuthenticated(false);
        }
      } catch (e) {
        console.error("Auth check failed", e);
      } finally {
        setIsLoading(false);
      }
    }
    checkUser();
  }, []);

  // [關鍵修正] 徹底移除「路由保護」邏輯
  // 我們不再因為沒有用戶資料就強制踢回 login 頁面
  /* useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === "(tabs)";

    if (!isAuthenticated && inAuthGroup) {
      router.replace("/login");
    } else if (isAuthenticated && segments[0] === "login") {
      router.replace("/(tabs)");
    }
  }, [isAuthenticated, segments, isLoading]);
  */

  const login = async (name: string) => {
    try {
      // 檢查是否已存在
      const existing = await db.select().from(userProfiles).limit(1);
      
      if (existing.length === 0) {
        // 建立新用戶
        await db.insert(userProfiles).values({
          name: name,
          createdAt: new Date(),
          updatedAt: new Date(),
          // 預設值
          gender: 'male', 
          activityLevel: 'sedentary',
          goal: 'maintain',
          dailyCalorieTarget: 2000
        });
      } else {
        // 更新現有名稱
        await db.update(userProfiles).set({ name: name }).where(eq(userProfiles.id, existing[0].id));
      }
      
      setIsAuthenticated(true);
      // login 功能現在主要由導覽員在背景執行，這裡保留以備不時之需，但不強制導航
      // router.replace("/(tabs)"); 
    } catch (e) {
      console.error("Login failed", e);
      throw e;
    }
  };

  const logout = () => {
    // 單機版通常不刪除資料，只是一種狀態切換，或者清除 userProfiles (視需求而定)
    // 這裡示範：不刪資料，只導回登入頁 (模擬登出)
    setIsAuthenticated(false);
    // 登出也不再跳轉到 login，因為 login 頁面已被棄用
    // 您可以決定是否要導向其他地方，或者直接重置導覽狀態
  };

  return (
    <AuthContext.Provider value={{ login, logout, isAuthenticated, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}