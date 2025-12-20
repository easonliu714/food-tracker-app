import { Tabs } from 'expo-router';
import React from 'react';
import { Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons'; // 改用 Ionicons

import { HapticTab } from '@/components/haptic-tab';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useThemeColor } from '@/hooks/use-theme-color';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const activeTintColor = useThemeColor({}, 'tint');
  const backgroundColor = useThemeColor({}, 'background'); // 取得背景色

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: activeTintColor,
        headerShown: false,
        tabBarButton: HapticTab,
        // 移除 TabBarBackground，改用純色背景
        tabBarStyle: Platform.select({
          ios: {
            position: 'absolute',
            backgroundColor: backgroundColor, // 確保有背景色
            borderTopWidth: 0,
            elevation: 0,
          },
          default: {
            backgroundColor: backgroundColor,
            borderTopWidth: 0,
            elevation: 0,
          },
        }),
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: '首頁',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons size={28} name={focused ? "home" : "home-outline"} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="analysis"
        options={{
          title: '分析',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons size={28} name={focused ? "bar-chart" : "bar-chart-outline"} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="recipes"
        options={{
          title: 'AI教練',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons size={28} name={focused ? "sparkles" : "sparkles-outline"} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: '設定',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons size={28} name={focused ? "settings" : "settings-outline"} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}