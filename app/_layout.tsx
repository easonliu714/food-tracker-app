import { DarkTheme, DefaultTheme, ThemeProvider } from "@react-navigation/native";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { View, ActivityIndicator } from "react-native";

// [修正 1] 恢復 Reanimated 引入！這是分析頁面圖表能正常顯示的關鍵
import "react-native-reanimated";

import { useColorScheme } from "@/hooks/use-color-scheme";
import { initDatabase } from "@/lib/db";
import { Colors } from "@/constants/theme";
import { SessionProvider } from "@/hooks/use-auth"; 
// [修改開始] 引入 TutorialProvider
import { TutorialProvider } from '@/context/TutorialContext';

// 防止 Splash Screen 自動隱藏，直到資源載入完成
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? "light"];
  
  // 資料庫準備狀態
  const [dbReady, setDbReady] = useState(false);
  
  // 載入字型
  const [loaded] = useFonts({
    SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
  });

  // 1. 初始化資料庫
  useEffect(() => {
    async function prepare() {
      try {
        await initDatabase(); 
        console.log("Database initialized from RootLayout");
      } catch (e) {
        console.warn("Init Error:", e);
      } finally {
        setDbReady(true); 
      }
    }
    prepare();
  }, []);

  // 2. 隱藏 Splash Screen
  useEffect(() => {
    if (loaded && dbReady) {
      SplashScreen.hideAsync();
    }
  }, [loaded, dbReady]);

  // 3. 載入期間顯示轉圈圈
  if (!loaded || !dbReady) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: theme.background }}>
        <ActivityIndicator size="large" color={theme.tint} />
      </View>
    );
  }

  // 4. 渲染 APP 導航結構
  return (
    <SessionProvider>
      <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
        {/* [修改開始] 包裹 TutorialProvider */}
        <TutorialProvider>
          <Stack>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="login" options={{ headerShown: false }} />
            <Stack.Screen name="camera" options={{ headerShown: false }} />
            <Stack.Screen name="barcode-scanner" options={{ headerShown: false }} />
            <Stack.Screen name="food-editor" options={{ headerShown: false }} />
            <Stack.Screen name="activity-editor" options={{ headerShown: false }} />
          </Stack>
        </TutorialProvider>
      </ThemeProvider>
    </SessionProvider>
  );
}