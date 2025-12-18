import { useLocalSearchParams, useRouter } from "expo-router";
import { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  Image,
  Pressable,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useThemeColor } from "@/hooks/use-theme-color";
import { trpc } from "@/lib/trpc";

interface NutritionData {
  foodName: string;
  servings: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export default function FoodRecognitionScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const [isAnalyzing, setIsAnalyzing] = useState(true);
  const [nutritionData, setNutritionData] = useState<NutritionData>({
    foodName: "未知食物",
    servings: 1,
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
  });

  const backgroundColor = useThemeColor({}, "background");
  const cardBackground = useThemeColor({}, "cardBackground");
  const tintColor = useThemeColor({}, "tint");
  const textColor = useThemeColor({}, "text");
  const textSecondary = useThemeColor({}, "textSecondary");

  const imageUri = params.imageUri as string;

  const createFoodLogMutation = trpc.foodLogs.create.useMutation({
    onSuccess: () => {
      router.back();
    },
  });

  useEffect(() => {
    // TODO: Integrate with AI image recognition API
    // For now, simulate API call
    setTimeout(() => {
      setNutritionData({
        foodName: "雞胸肉沙拉",
        servings: 1,
        calories: 350,
        protein: 35,
        carbs: 20,
        fat: 12,
      });
      setIsAnalyzing(false);
    }, 2000);
  }, []);

  const handleAddToLog = async () => {
    try {
      await createFoodLogMutation.mutateAsync({
        mealType: "lunch", // TODO: Let user select meal type
        foodName: nutritionData.foodName,
        servings: nutritionData.servings * 10, // Store as integer * 10
        totalCalories: nutritionData.calories,
        totalProteinG: nutritionData.protein * 10,
        totalCarbsG: nutritionData.carbs * 10,
        totalFatG: nutritionData.fat * 10,
        imageUrl: imageUri,
      });
    } catch (error: any) {
      if (error.data?.code === "UNAUTHORIZED") {
        router.push("/");
        return;
      }
      console.error("Error adding food log:", error);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor }]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            paddingTop: Math.max(insets.top, 20),
            backgroundColor: cardBackground,
          },
        ]}
      >
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={textColor} />
        </Pressable>
        <ThemedText type="subtitle">食物識別</ThemedText>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content}>
        {/* Food image */}
        <View style={styles.imageContainer}>
          <Image source={{ uri: imageUri }} style={styles.foodImage} resizeMode="cover" />
        </View>

        {/* Recognition result */}
        {isAnalyzing ? (
          <View style={[styles.card, { backgroundColor: cardBackground }]}>
            <ActivityIndicator size="large" color={tintColor} />
            <ThemedText style={styles.analyzingText}>正在分析食物...</ThemedText>
          </View>
        ) : (
          <View style={[styles.card, { backgroundColor: cardBackground }]}>
            <ThemedText type="subtitle" style={styles.cardTitle}>
              識別結果
            </ThemedText>

            {/* Food name */}
            <View style={styles.inputGroup}>
              <ThemedText style={[styles.label, { color: textSecondary }]}>食物名稱</ThemedText>
              <TextInput
                style={[styles.input, { backgroundColor, color: textColor }]}
                value={nutritionData.foodName}
                onChangeText={(text) => setNutritionData({ ...nutritionData, foodName: text })}
                placeholderTextColor={textSecondary}
              />
            </View>

            {/* Servings */}
            <View style={styles.inputGroup}>
              <ThemedText style={[styles.label, { color: textSecondary }]}>份量</ThemedText>
              <TextInput
                style={[styles.input, { backgroundColor, color: textColor }]}
                value={nutritionData.servings.toString()}
                onChangeText={(text) => {
                  const value = parseFloat(text) || 1;
                  setNutritionData({ ...nutritionData, servings: value });
                }}
                keyboardType="decimal-pad"
                placeholderTextColor={textSecondary}
              />
            </View>

            {/* Nutrition info */}
            <View style={styles.nutritionGrid}>
              <View style={styles.nutritionItem}>
                <ThemedText style={[styles.nutritionValue, { color: tintColor }]}>
                  {nutritionData.calories}
                </ThemedText>
                <ThemedText style={[styles.nutritionLabel, { color: textSecondary }]}>卡路里</ThemedText>
              </View>
              <View style={styles.nutritionItem}>
                <ThemedText style={[styles.nutritionValue, { color: tintColor }]}>
                  {nutritionData.protein}g
                </ThemedText>
                <ThemedText style={[styles.nutritionLabel, { color: textSecondary }]}>蛋白質</ThemedText>
              </View>
              <View style={styles.nutritionItem}>
                <ThemedText style={[styles.nutritionValue, { color: tintColor }]}>
                  {nutritionData.carbs}g
                </ThemedText>
                <ThemedText style={[styles.nutritionLabel, { color: textSecondary }]}>碳水</ThemedText>
              </View>
              <View style={styles.nutritionItem}>
                <ThemedText style={[styles.nutritionValue, { color: tintColor }]}>
                  {nutritionData.fat}g
                </ThemedText>
                <ThemedText style={[styles.nutritionLabel, { color: textSecondary }]}>脂肪</ThemedText>
              </View>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Bottom buttons */}
      <View
        style={[
          styles.bottomBar,
          {
            paddingBottom: Math.max(insets.bottom, 20),
            backgroundColor: cardBackground,
          },
        ]}
      >
        <Pressable
          onPress={() => router.back()}
          style={[styles.button, styles.secondaryButton, { borderColor: tintColor }]}
        >
          <ThemedText style={[styles.buttonText, { color: tintColor }]}>重新拍攝</ThemedText>
        </Pressable>
        <Pressable
          onPress={handleAddToLog}
          disabled={isAnalyzing || createFoodLogMutation.isPending}
          style={[
            styles.button,
            styles.primaryButton,
            { backgroundColor: tintColor },
            (isAnalyzing || createFoodLogMutation.isPending) && styles.buttonDisabled,
          ]}
        >
          {createFoodLogMutation.isPending ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <ThemedText style={[styles.buttonText, { color: "#FFFFFF" }]}>加入記錄</ThemedText>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5EA",
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    flex: 1,
  },
  imageContainer: {
    width: "100%",
    height: 250,
    backgroundColor: "#000000",
  },
  foodImage: {
    width: "100%",
    height: "100%",
  },
  card: {
    margin: 16,
    padding: 20,
    borderRadius: 16,
    gap: 16,
  },
  cardTitle: {
    marginBottom: 8,
    fontSize: 20,
    lineHeight: 25,
  },
  analyzingText: {
    textAlign: "center",
    marginTop: 8,
    fontSize: 16,
    lineHeight: 22,
  },
  inputGroup: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    lineHeight: 18,
  },
  input: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    fontSize: 16,
    lineHeight: 22,
  },
  nutritionGrid: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginTop: 8,
  },
  nutritionItem: {
    alignItems: "center",
    gap: 4,
  },
  nutritionValue: {
    fontSize: 24,
    fontWeight: "bold",
    lineHeight: 30,
  },
  nutritionLabel: {
    fontSize: 12,
    lineHeight: 16,
  },
  bottomBar: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: "#E5E5EA",
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
  },
  primaryButton: {
    // backgroundColor set dynamically
  },
  secondaryButton: {
    borderWidth: 2,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "600",
    lineHeight: 22,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});
