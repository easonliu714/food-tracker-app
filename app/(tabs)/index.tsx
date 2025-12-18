import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { ProgressRing } from "@/components/progress-ring";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useAuth } from "@/hooks/use-auth";
import { useThemeColor } from "@/hooks/use-theme-color";
import { trpc } from "@/lib/trpc";

interface FoodLogItem {
  id: number;
  mealType: string;
  foodName: string;
  totalCalories: number;
  loggedAt: Date;
}

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const [refreshing, setRefreshing] = useState(false);

  const backgroundColor = useThemeColor({}, "background");
  const cardBackground = useThemeColor({}, "cardBackground");
  const tintColor = useThemeColor({}, "tint");
  const textColor = useThemeColor({}, "text");
  const textSecondary = useThemeColor({}, "textSecondary");

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const { data: profile } = trpc.profile.get.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const {
    data: todayLogs,
    isLoading: logsLoading,
    refetch: refetchLogs,
  } = trpc.foodLogs.getByDate.useQuery(
    { date: today },
    {
      enabled: isAuthenticated,
    },
  );

  const {
    data: dailySummary,
    isLoading: summaryLoading,
    refetch: refetchSummary,
  } = trpc.foodLogs.getDailySummary.useQuery(
    { date: today },
    {
      enabled: isAuthenticated,
    },
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetchLogs(), refetchSummary()]);
    setRefreshing(false);
  };

  const currentCalories = dailySummary?.totalCalories || 0;
  const targetCalories = profile?.dailyCalorieTarget || 2000;
  const progress = currentCalories / targetCalories;

  const currentProtein = (dailySummary?.totalProtein || 0) / 10;
  const currentCarbs = (dailySummary?.totalCarbs || 0) / 10;
  const currentFat = (dailySummary?.totalFat || 0) / 10;

  const targetProtein = (targetCalories * (profile?.proteinPercentage || 30)) / 100 / 4;
  const targetCarbs = (targetCalories * (profile?.carbsPercentage || 40)) / 100 / 4;
  const targetFat = (targetCalories * (profile?.fatPercentage || 30)) / 100 / 9;

  const getMealTypeLabel = (mealType: string) => {
    const labels: Record<string, string> = {
      breakfast: "早餐",
      lunch: "午餐",
      dinner: "晚餐",
      snack: "點心",
    };
    return labels[mealType] || mealType;
  };

  const getMealTypeIcon = (mealType: string) => {
    const icons: Record<string, string> = {
      breakfast: "sunny",
      lunch: "restaurant",
      dinner: "moon",
      snack: "cafe",
    };
    return icons[mealType] || "restaurant";
  };

  if (authLoading) {
    return (
      <ThemedView style={styles.container}>
        <ActivityIndicator size="large" color={tintColor} />
      </ThemedView>
    );
  }

  if (!isAuthenticated) {
    return (
      <ThemedView style={[styles.container, styles.centerContent]}>
        <Ionicons name="nutrition" size={80} color={tintColor} style={{ marginBottom: 24 }} />
        <ThemedText type="title" style={{ marginBottom: 16, fontSize: 28, lineHeight: 34 }}>
          營養追蹤
        </ThemedText>
        <ThemedText style={[styles.welcomeText, { color: textSecondary, marginBottom: 32 }]}>
          請先登入以開始追蹤您的飲食和營養
        </ThemedText>
        <Pressable
          onPress={() => router.push("/login")}
          style={[styles.loginButton, { backgroundColor: tintColor }]}
        >
          <ThemedText style={styles.loginButtonText}>登入</ThemedText>
        </Pressable>
      </ThemedView>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        {/* Header */}
        <View style={[styles.header, { paddingTop: Math.max(insets.top, 20) }]}>
          <View>
            <ThemedText type="subtitle" style={{ fontSize: 16, lineHeight: 22 }}>
              {new Date().toLocaleDateString("zh-TW", { month: "long", day: "numeric" })}
            </ThemedText>
            <ThemedText type="title" style={{ fontSize: 32, lineHeight: 38 }}>
              今日進度
            </ThemedText>
          </View>
        </View>

        {/* Calorie Progress Ring */}
        <View style={[styles.progressSection, { backgroundColor: cardBackground }]}>
          <ProgressRing
            progress={progress}
            current={currentCalories}
            target={targetCalories}
            size={200}
            strokeWidth={16}
          />
        </View>

        {/* Macros Summary */}
        <View style={[styles.macrosCard, { backgroundColor: cardBackground }]}>
          <ThemedText type="subtitle" style={styles.cardTitle}>
            營養素攝取
          </ThemedText>
          <View style={styles.macrosGrid}>
            <View style={styles.macroItem}>
              <View style={styles.macroBar}>
                <View
                  style={[
                    styles.macroProgress,
                    {
                      backgroundColor: "#FF6B6B",
                      width: `${Math.min((currentProtein / targetProtein) * 100, 100)}%`,
                    },
                  ]}
                />
              </View>
              <View style={styles.macroInfo}>
                <ThemedText style={[styles.macroLabel, { color: textSecondary }]}>蛋白質</ThemedText>
                <ThemedText style={styles.macroValue}>
                  {currentProtein.toFixed(1)}g / {targetProtein.toFixed(0)}g
                </ThemedText>
              </View>
            </View>

            <View style={styles.macroItem}>
              <View style={styles.macroBar}>
                <View
                  style={[
                    styles.macroProgress,
                    {
                      backgroundColor: "#4ECDC4",
                      width: `${Math.min((currentCarbs / targetCarbs) * 100, 100)}%`,
                    },
                  ]}
                />
              </View>
              <View style={styles.macroInfo}>
                <ThemedText style={[styles.macroLabel, { color: textSecondary }]}>碳水化合物</ThemedText>
                <ThemedText style={styles.macroValue}>
                  {currentCarbs.toFixed(1)}g / {targetCarbs.toFixed(0)}g
                </ThemedText>
              </View>
            </View>

            <View style={styles.macroItem}>
              <View style={styles.macroBar}>
                <View
                  style={[
                    styles.macroProgress,
                    {
                      backgroundColor: "#FFD93D",
                      width: `${Math.min((currentFat / targetFat) * 100, 100)}%`,
                    },
                  ]}
                />
              </View>
              <View style={styles.macroInfo}>
                <ThemedText style={[styles.macroLabel, { color: textSecondary }]}>脂肪</ThemedText>
                <ThemedText style={styles.macroValue}>
                  {currentFat.toFixed(1)}g / {targetFat.toFixed(0)}g
                </ThemedText>
              </View>
            </View>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <Pressable
            onPress={() => router.push("/camera")}
            style={[styles.actionButton, styles.primaryAction, { backgroundColor: tintColor }]}
          >
            <Ionicons name="camera" size={28} color="#FFFFFF" />
            <ThemedText style={styles.primaryActionText}>拍攝食物</ThemedText>
          </Pressable>

          <Pressable
            onPress={() => router.push("/barcode-scanner")}
            style={[styles.actionButton, styles.secondaryAction, { borderColor: tintColor }]}
          >
            <Ionicons name="barcode-outline" size={24} color={tintColor} />
            <ThemedText style={[styles.secondaryActionText, { color: tintColor }]}>掃描條碼</ThemedText>
          </Pressable>
        </View>

        {/* Today's Food Log */}
        <View style={[styles.logSection, { backgroundColor: cardBackground }]}>
          <ThemedText type="subtitle" style={styles.cardTitle}>
            今日飲食記錄
          </ThemedText>

          {logsLoading ? (
            <ActivityIndicator color={tintColor} style={{ marginVertical: 20 }} />
          ) : !todayLogs || todayLogs.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="restaurant-outline" size={48} color={textSecondary} />
              <ThemedText style={[styles.emptyText, { color: textSecondary }]}>
                尚無飲食記錄
              </ThemedText>
              <ThemedText style={[styles.emptyHint, { color: textSecondary }]}>
                點擊上方按鈕開始記錄
              </ThemedText>
            </View>
          ) : (
            <View style={styles.logList}>
              {todayLogs.map((log: any) => (
                <View key={log.id} style={styles.logItem}>
                  <View style={[styles.logIcon, { backgroundColor: `${tintColor}20` }]}>
                    <Ionicons name={getMealTypeIcon(log.mealType) as any} size={20} color={tintColor} />
                  </View>
                  <View style={styles.logContent}>
                    <ThemedText style={styles.logMealType}>
                      {getMealTypeLabel(log.mealType)}
                    </ThemedText>
                    <ThemedText style={[styles.logFoodName, { color: textColor }]}>
                      {log.foodName}
                    </ThemedText>
                  </View>
                  <ThemedText style={[styles.logCalories, { color: tintColor }]}>
                    {log.totalCalories} kcal
                  </ThemedText>
                </View>
              ))}
            </View>
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  centerContent: {
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  welcomeText: {
    textAlign: "center",
    fontSize: 16,
    lineHeight: 22,
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  progressSection: {
    alignItems: "center",
    paddingVertical: 32,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 20,
  },
  macrosCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 20,
    borderRadius: 16,
  },
  cardTitle: {
    marginBottom: 16,
    fontSize: 20,
    lineHeight: 25,
  },
  macrosGrid: {
    gap: 16,
  },
  macroItem: {
    gap: 8,
  },
  macroBar: {
    height: 8,
    backgroundColor: "#E5E5EA",
    borderRadius: 4,
    overflow: "hidden",
  },
  macroProgress: {
    height: "100%",
    borderRadius: 4,
  },
  macroInfo: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  macroLabel: {
    fontSize: 14,
    lineHeight: 18,
  },
  macroValue: {
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 18,
  },
  quickActions: {
    flexDirection: "row",
    paddingHorizontal: 16,
    gap: 12,
    marginBottom: 16,
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
    minHeight: 56,
  },
  primaryAction: {
    flex: 2,
  },
  secondaryAction: {
    flex: 1,
    borderWidth: 2,
  },
  primaryActionText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
    lineHeight: 22,
  },
  secondaryActionText: {
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 18,
  },
  logSection: {
    marginHorizontal: 16,
    padding: 20,
    borderRadius: 16,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 32,
    gap: 8,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: "600",
    lineHeight: 22,
  },
  emptyHint: {
    fontSize: 14,
    lineHeight: 18,
  },
  logList: {
    gap: 12,
  },
  logItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  logIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  logContent: {
    flex: 1,
  },
  logMealType: {
    fontSize: 12,
    color: "#8E8E93",
    lineHeight: 16,
  },
  logFoodName: {
    fontSize: 16,
    fontWeight: "500",
    lineHeight: 22,
  },
  logCalories: {
    fontSize: 16,
    fontWeight: "600",
    lineHeight: 22,
  },
  loginButton: {
    paddingVertical: 16,
    paddingHorizontal: 48,
    borderRadius: 12,
    minHeight: 52,
  },
  loginButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
    lineHeight: 22,
  },
});
