import { Tabs } from 'expo-router';
import React from 'react';
import { Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { HapticTab } from '@/components/haptic-tab';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useLanguage, t } from '@/lib/i18n';

export default function TabLayout() {
  const activeTintColor = useThemeColor({}, 'tint');
  const backgroundColor = useThemeColor({}, 'background');
  const lang = useLanguage(); // [關鍵] 訂閱語言變更

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: activeTintColor,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarStyle: Platform.select({
          ios: { position: 'absolute', backgroundColor, borderTopWidth: 0, elevation: 0 },
          default: { backgroundColor, borderTopWidth: 0, elevation: 0 },
        }),
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: t('tab_home', lang), // 動態翻譯
          tabBarIcon: ({ color, focused }) => <Ionicons size={28} name={focused ? "home" : "home-outline"} color={color} />,
        }}
      />
      <Tabs.Screen
        name="analysis"
        options={{
          title: t('tab_analysis', lang),
          tabBarIcon: ({ color, focused }) => <Ionicons size={28} name={focused ? "bar-chart" : "bar-chart-outline"} color={color} />,
        }}
      />
      <Tabs.Screen
        name="recipes"
        options={{
          title: t('tab_ai_coach', lang),
          tabBarIcon: ({ color, focused }) => <Ionicons size={28} name={focused ? "sparkles" : "sparkles-outline"} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('tab_settings', lang),
          tabBarIcon: ({ color, focused }) => <Ionicons size={28} name={focused ? "settings" : "settings-outline"} color={color} />,
        }}
      />
    </Tabs>
  );
}