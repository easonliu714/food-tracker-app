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

  // 檢查資料庫是否有用戶資料
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

  // 路由保護：如果未登入且不在 login 頁面，則踢回 login
  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === "(tabs)";

    if (!isAuthenticated && inAuthGroup) {
      router.replace("/login");
    } else if (isAuthenticated && segments[0] === "login") {
      router.replace("/(tabs)");
    }
  }, [isAuthenticated, segments, isLoading]);

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
      router.replace("/(tabs)");
    } catch (e) {
      console.error("Login failed", e);
      throw e;
    }
  };

  const logout = () => {
    // 單機版通常不刪除資料，只是一種狀態切換，或者清除 userProfiles (視需求而定)
    // 這裡示範：不刪資料，只導回登入頁 (模擬登出)
    setIsAuthenticated(false);
    router.replace("/login");
  };

  return (
    <AuthContext.Provider value={{ login, logout, isAuthenticated, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}