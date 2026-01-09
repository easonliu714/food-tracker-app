import { DarkTheme, DefaultTheme, ThemeProvider } from "@react-navigation/native";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { View, ActivityIndicator, Platform } from "react-native";
// [修正 1] 恢復 Reanimated 引入，這能解決分析頁面一直轉圈的問題
import "react-native-reanimated";

import { useColorScheme } from "@/hooks/use-color-scheme";
import { initDatabase } from "@/lib/db";
import { Colors } from "@/constants/theme";
import { SessionProvider } from "@/hooks/use-auth"; 
// [修正 2] 引入 Health Connect 初始化函式
import { initialize } from "react-native-health-connect";

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

  // 1. 初始化資料庫 & Health Connect
  useEffect(() => {
    async function prepare() {
      try {
        // A. 初始化資料庫
        await initDatabase(); 
        console.log("Database initialized from RootLayout");

        // B. [修正 2] 預先初始化 Health Connect (僅限 Android)
        // 這能避免之後呼叫權限時發生 "lateinit property not initialized" 閃退
        if (Platform.OS === 'android') {
            const isInitialized = await initialize();
            console.log("Health Connect Global Init:", isInitialized);
        }

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
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="login" options={{ headerShown: false }} />
          <Stack.Screen name="+not-found" />
          
          {/* 其他功能頁面 */}
          <Stack.Screen name="camera" options={{ headerShown: false }} />
          <Stack.Screen name="food-recognition" options={{ title: "識別結果" }} /> 
          <Stack.Screen name="barcode-scanner" options={{ headerShown: false }} />
          <Stack.Screen name="barcode-product" options={{ title: "產品詳情" }} />
          <Stack.Screen name="food-editor" options={{ headerShown: false }} />
          <Stack.Screen name="activity-editor" options={{ headerShown: false }} />
        </Stack>
        <StatusBar style="auto" />
      </ThemeProvider>
    </SessionProvider>
  );
}