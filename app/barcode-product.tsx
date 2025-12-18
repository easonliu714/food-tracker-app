import { useLocalSearchParams, useRouter } from "expo-router";
import { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useThemeColor } from "@/hooks/use-theme-color";
import { trpc } from "@/lib/trpc";

interface ProductData {
  name: string;
  brand?: string;
  servingSizeG: number;
  servingSizeDescription: string;
  caloriesPerServing: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export default function BarcodeProductScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const [isLoading, setIsLoading] = useState(true);
  const [servings, setServings] = useState(1);
  const [productData, setProductData] = useState<ProductData>({
    name: "未知產品",
    brand: "",
    servingSizeG: 100,
    servingSizeDescription: "100g",
    caloriesPerServing: 0,
    proteinG: 0,
    carbsG: 0,
    fatG: 0,
  });

  const backgroundColor = useThemeColor({}, "background");
  const cardBackground = useThemeColor({}, "cardBackground");
  const tintColor = useThemeColor({}, "tint");
  const textColor = useThemeColor({}, "text");
  const textSecondary = useThemeColor({}, "textSecondary");

  const barcode = params.barcode as string;

  const createFoodLogMutation = trpc.foodLogs.create.useMutation({
    onSuccess: () => {
      router.back();
      router.back(); // Go back twice to return to home
    },
  });

  useEffect(() => {
    // TODO: Query barcode database or API
    // For now, simulate API call
    setTimeout(() => {
      setProductData({
        name: "全麥麵包",
        brand: "健康品牌",
        servingSizeG: 50,
        servingSizeDescription: "2片 (50g)",
        caloriesPerServing: 120,
        proteinG: 5,
        carbsG: 22,
        fatG: 2,
      });
      setIsLoading(false);
    }, 1500);
  }, [barcode]);

  const handleAddToLog = async () => {
    try {
      await createFoodLogMutation.mutateAsync({
        mealType: "breakfast", // TODO: Let user select meal type
        foodName: `${productData.brand ? productData.brand + " " : ""}${productData.name}`,
        servings: servings * 10, // Store as integer * 10
        totalCalories: Math.round(productData.caloriesPerServing * servings),
        totalProteinG: Math.round(productData.proteinG * servings * 10),
        totalCarbsG: Math.round(productData.carbsG * servings * 10),
        totalFatG: Math.round(productData.fatG * servings * 10),
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
        <ThemedText type="subtitle">產品資訊</ThemedText>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content}>
        {isLoading ? (
          <View style={[styles.card, { backgroundColor: cardBackground }]}>
            <ActivityIndicator size="large" color={tintColor} />
            <ThemedText style={styles.loadingText}>正在查詢產品資訊...</ThemedText>
          </View>
        ) : (
          <>
            {/* Product info */}
            <View style={[styles.card, { backgroundColor: cardBackground }]}>
              <ThemedText type="title" style={styles.productName}>
                {productData.name}
              </ThemedText>
              {productData.brand && (
                <ThemedText style={[styles.brandName, { color: textSecondary }]}>
                  {productData.brand}
                </ThemedText>
              )}
              <View style={styles.divider} />
              <ThemedText style={[styles.barcodeText, { color: textSecondary }]}>
                條碼: {barcode}
              </ThemedText>
            </View>

            {/* Serving size */}
            <View style={[styles.card, { backgroundColor: cardBackground }]}>
              <ThemedText type="subtitle" style={styles.cardTitle}>
                份量設定
              </ThemedText>
              <View style={styles.servingControl}>
                <ThemedText style={{ color: textSecondary }}>
                  每份: {productData.servingSizeDescription}
                </ThemedText>
                <View style={styles.servingAdjust}>
                  <Pressable
                    onPress={() => setServings(Math.max(0.5, servings - 0.5))}
                    style={[styles.adjustButton, { borderColor: tintColor }]}
                  >
                    <Ionicons name="remove" size={20} color={tintColor} />
                  </Pressable>
                  <TextInput
                    style={[styles.servingInput, { backgroundColor, color: textColor }]}
                    value={servings.toString()}
                    onChangeText={(text) => {
                      const value = parseFloat(text) || 0.5;
                      setServings(value);
                    }}
                    keyboardType="decimal-pad"
                  />
                  <Pressable
                    onPress={() => setServings(servings + 0.5)}
                    style={[styles.adjustButton, { borderColor: tintColor }]}
                  >
                    <Ionicons name="add" size={20} color={tintColor} />
                  </Pressable>
                </View>
              </View>
            </View>

            {/* Nutrition facts */}
            <View style={[styles.card, { backgroundColor: cardBackground }]}>
              <ThemedText type="subtitle" style={styles.cardTitle}>
                營養成分 (每 {servings} 份)
              </ThemedText>
              <View style={styles.nutritionList}>
                <View style={styles.nutritionRow}>
                  <ThemedText style={styles.nutritionLabel}>卡路里</ThemedText>
                  <ThemedText style={[styles.nutritionValue, { color: tintColor }]}>
                    {Math.round(productData.caloriesPerServing * servings)} kcal
                  </ThemedText>
                </View>
                <View style={styles.nutritionRow}>
                  <ThemedText style={styles.nutritionLabel}>蛋白質</ThemedText>
                  <ThemedText style={[styles.nutritionValue, { color: tintColor }]}>
                    {(productData.proteinG * servings).toFixed(1)} g
                  </ThemedText>
                </View>
                <View style={styles.nutritionRow}>
                  <ThemedText style={styles.nutritionLabel}>碳水化合物</ThemedText>
                  <ThemedText style={[styles.nutritionValue, { color: tintColor }]}>
                    {(productData.carbsG * servings).toFixed(1)} g
                  </ThemedText>
                </View>
                <View style={styles.nutritionRow}>
                  <ThemedText style={styles.nutritionLabel}>脂肪</ThemedText>
                  <ThemedText style={[styles.nutritionValue, { color: tintColor }]}>
                    {(productData.fatG * servings).toFixed(1)} g
                  </ThemedText>
                </View>
              </View>
            </View>
          </>
        )}
      </ScrollView>

      {/* Bottom button */}
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
          onPress={handleAddToLog}
          disabled={isLoading || createFoodLogMutation.isPending}
          style={[
            styles.addButton,
            { backgroundColor: tintColor },
            (isLoading || createFoodLogMutation.isPending) && styles.buttonDisabled,
          ]}
        >
          {createFoodLogMutation.isPending ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <ThemedText style={styles.addButtonText}>加入記錄</ThemedText>
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
  card: {
    margin: 16,
    padding: 20,
    borderRadius: 16,
    gap: 12,
  },
  loadingText: {
    textAlign: "center",
    marginTop: 8,
    fontSize: 16,
    lineHeight: 22,
  },
  productName: {
    fontSize: 28,
    lineHeight: 34,
  },
  brandName: {
    fontSize: 16,
    lineHeight: 22,
  },
  divider: {
    height: 1,
    backgroundColor: "#E5E5EA",
    marginVertical: 8,
  },
  barcodeText: {
    fontSize: 14,
    lineHeight: 18,
  },
  cardTitle: {
    marginBottom: 8,
    fontSize: 20,
    lineHeight: 25,
  },
  servingControl: {
    gap: 12,
  },
  servingAdjust: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  adjustButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    justifyContent: "center",
    alignItems: "center",
  },
  servingInput: {
    width: 80,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    fontSize: 18,
    textAlign: "center",
    fontWeight: "600",
    lineHeight: 24,
  },
  nutritionList: {
    gap: 12,
  },
  nutritionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  nutritionLabel: {
    fontSize: 16,
    lineHeight: 22,
  },
  nutritionValue: {
    fontSize: 18,
    fontWeight: "600",
    lineHeight: 24,
  },
  bottomBar: {
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#E5E5EA",
  },
  addButton: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
  },
  addButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
    lineHeight: 22,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});
