import React, { useState, useEffect, useMemo } from "react";
import {
  StyleSheet,
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Platform,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams, Stack } from "expo-router";
import { format } from "date-fns";
import { zhTW } from "date-fns/locale";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { db } from "@/lib/db"; // 請確認 lib/db.ts 已建立
import { foodItems, foodLogs } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";

// 定義餐別與時間對應
const MEAL_PERIODS = [
  { id: "breakfast", label: "早餐", start: 5, end: 10 },
  { id: "lunch", label: "午餐", start: 10, end: 14 },
  { id: "afternoon_tea", label: "下午茶", start: 14, end: 16 },
  { id: "dinner", label: "晚餐", start: 16, end: 20 },
  { id: "late_night", label: "宵夜", start: 20, end: 29 }, // 20:00 - 05:00 (跨日處理)
];

// 預設 100g 基準值
const DEFAULT_NUTRIENTS = {
  calories: 0,
  protein: 0,
  fat: 0,
  carbs: 0,
  sodium: 0,
};

export default function FoodEditorScreen() {
  const router = useRouter();
  const params = useLocalSearchParams(); // 接收 barcode, imageUri, aiData 等參數
  const colorScheme = useColorScheme() ?? "light";
  const theme = Colors[colorScheme];

  // --- State: 時間與日期 ---
  const [recordDate, setRecordDate] = useState(new Date());
  const [recordTime, setRecordTime] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  // --- State: 餐別 ---
  const [selectedMeal, setSelectedMeal] = useState("breakfast");

  // --- State: 食物基本資料 ---
  const [foodName, setFoodName] = useState("");
  const [barcode, setBarcode] = useState<string | null>(null);
  const [dbFoodId, setDbFoodId] = useState<number | null>(null); // 如果是資料庫既有食物
  
  // --- State: 份量輸入 ---
  // inputMode: 'serving' (份數+單份重) | 'weight' (總克數)
  const [inputMode, setInputMode] = useState<"serving" | "weight">("serving");
  const [servings, setServings] = useState("1");
  const [unitWeight, setUnitWeight] = useState("100"); // 單份重量 (g)
  const [totalWeight, setTotalWeight] = useState("100"); // 總重量 (g)

  // --- State: 100g 基準營養素 (Product DB) ---
  const [baseNutrients, setBaseNutrients] = useState(DEFAULT_NUTRIENTS);
  
  // --- State: AI 分析 ---
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<string | null>(null);

  // --- Effect: 初始化 ---
  useEffect(() => {
    // 1. 自動設定餐別
    const currentHour = new Date().getHours();
    const foundMeal = MEAL_PERIODS.find(p => {
        const end = p.end > 24 ? p.end - 24 : p.end;
        if (p.start > p.end) { // 跨日 (e.g. 20 - 5)
            return currentHour >= p.start || currentHour < end;
        }
        return currentHour >= p.start && currentHour < p.end;
    });
    if (foundMeal) setSelectedMeal(foundMeal.id);

    // 2. 處理傳入參數 (Barcode 或 AI資料)
    if (params.barcode) {
      setBarcode(params.barcode as string);
      loadFoodByBarcode(params.barcode as string);
    }
    
    if (params.foodName) {
        setFoodName(params.foodName as string);
    }
    
    // 模擬：如果是從相機過來，假設 params.aiData 存在
    if (params.aiResults) {
        // 這裡解析傳入的 AI JSON 字串
        try {
            const data = JSON.parse(params.aiResults as string);
            setFoodName(data.name);
            setBaseNutrients(data.nutrients);
            setAiSuggestion(data.description);
        } catch(e) { console.error("AI parse error", e); }
    }

  }, [params]);

  // --- Logic: 讀取資料庫 ---
  const loadFoodByBarcode = async (code: string) => {
    // 模擬 DB 查詢
    try {
        const result = await db.select().from(foodItems).where(eq(foodItems.barcode, code)).limit(1);
        if (result.length > 0) {
            const item = result[0];
            setDbFoodId(item.id);
            setFoodName(item.name);
            setBaseNutrients({
                calories: item.calories,
                protein: item.proteinG || 0,
                fat: item.fatG || 0,
                carbs: item.carbsG || 0,
                sodium: item.sodiumMg || 0,
            });
            Alert.alert("已讀取資料庫", `找到商品：${item.name}`);
        }
    } catch (e) {
        console.error(e);
    }
  };

  // --- Logic: 計算總攝取量 ---
  // 當份數改變，更新總重
  useEffect(() => {
    if (inputMode === "serving") {
      const s = parseFloat(servings) || 0;
      const u = parseFloat(unitWeight) || 0;
      setTotalWeight((s * u).toFixed(1));
    }
  }, [servings, unitWeight, inputMode]);

  // 當總重改變(且在總重模式)，反推 (這裡簡單處理，維持單份重=100)
  useEffect(() => {
    if (inputMode === "weight") {
       // 總重改變時，不特別反推份數，除非切換模式
    }
  }, [totalWeight, inputMode]);

  const calculatedTotal = useMemo(() => {
    const weight = parseFloat(totalWeight) || 0;
    const ratio = weight / 100;
    return {
      calories: Math.round(baseNutrients.calories * ratio),
      protein: (baseNutrients.protein * ratio).toFixed(1),
      fat: (baseNutrients.fat * ratio).toFixed(1),
      carbs: (baseNutrients.carbs * ratio).toFixed(1),
      sodium: Math.round(baseNutrients.sodium * ratio),
    };
  }, [totalWeight, baseNutrients]);

  // --- Logic: AI 分析 (模擬) ---
  const handleAiAnalyze = () => {
    if (!foodName) {
        Alert.alert("請輸入食物名稱");
        return;
    }
    setIsAnalyzing(true);
    // 模擬 API 延遲
    setTimeout(() => {
        setIsAnalyzing(false);
        // 模擬回傳數據
        setBaseNutrients({
            calories: 150 + Math.floor(Math.random() * 100),
            protein: 5 + Math.floor(Math.random() * 20),
            fat: 2 + Math.floor(Math.random() * 10),
            carbs: 20 + Math.floor(Math.random() * 30),
            sodium: 100 + Math.floor(Math.random() * 400),
        });
        setAiSuggestion(`AI 分析：${foodName} 通常包含這些營養成分。請確認數據是否符合您的實際食物。`);
    }, 1500);
  };

  // --- Logic: 儲存 ---
  const handleSave = async () => {
    if (!foodName || !totalWeight) {
        Alert.alert("資料不完整", "請輸入名稱與重量");
        return;
    }

    try {
        let currentFoodId = dbFoodId;

        // 1. 如果是新食物或沒有 ID，先建立/更新 Product DB
        // 邏輯：如果已有 ID，且基準值改變，跳出警告
        // 為簡化 Demo，這裡假設如果有 ID 就更新，沒有就新增
        if (currentFoodId) {
             // 實際上應該檢查數值是否變更並詢問用戶
             await db.update(foodItems).set({
                 name: foodName,
                 baseAmount: 100,
                 calories: baseNutrients.calories,
                 proteinG: baseNutrients.protein,
                 fatG: baseNutrients.fat,
                 carbsG: baseNutrients.carbs,
                 sodiumMg: baseNutrients.sodium,
                 updatedAt: new Date(),
             }).where(eq(foodItems.id, currentFoodId));
        } else {
             const res = await db.insert(foodItems).values({
                 name: foodName,
                 barcode: barcode,
                 calories: baseNutrients.calories,
                 proteinG: baseNutrients.protein,
                 fatG: baseNutrients.fat,
                 carbsG: baseNutrients.carbs,
                 sodiumMg: baseNutrients.sodium,
                 isUserCreated: true,
             }).returning({ insertedId: foodItems.id });
             currentFoodId = res[0].insertedId;
        }

        // 2. 寫入 Food Log
        // 組合日期與時間
        const logDate = new Date(recordDate);
        logDate.setHours(recordTime.getHours());
        logDate.setMinutes(recordTime.getMinutes());

        await db.insert(foodLogs).values({
            date: format(logDate, 'yyyy-MM-dd'),
            mealTimeCategory: selectedMeal,
            loggedAt: logDate,
            foodItemId: currentFoodId,
            foodName: foodName,
            servingType: inputMode,
            servingAmount: inputMode === 'serving' ? parseFloat(servings) : parseFloat(totalWeight),
            unitWeightG: inputMode === 'serving' ? parseFloat(unitWeight) : 1,
            totalWeightG: parseFloat(totalWeight),
            totalCalories: calculatedTotal.calories,
            totalProteinG: parseFloat(calculatedTotal.protein),
            totalFatG: parseFloat(calculatedTotal.fat),
            totalCarbsG: parseFloat(calculatedTotal.carbs),
            totalSodiumMg: calculatedTotal.sodium,
        });

        Alert.alert("成功", "飲食紀錄已儲存", [{ text: "OK", onPress: () => router.back() }]);

    } catch (e) {
        console.error(e);
        Alert.alert("錯誤", "儲存失敗");
    }
  };

  // --- Render Components ---

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      {/* 頂部導航列 */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={28} color={theme.text} />
        </TouchableOpacity>
        <ThemedText type="subtitle">編輯食物</ThemedText>
        <TouchableOpacity onPress={handleSave}>
            <Ionicons name="save" size={28} color={theme.tint} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        {/* 日期與時間選擇 */}
        <View style={styles.dateTimeRow}>
            <TouchableOpacity onPress={() => setShowDatePicker(true)} style={styles.dateBtn}>
                <Ionicons name="calendar-outline" size={20} color={theme.text} />
                <ThemedText style={{marginLeft: 8}}>{format(recordDate, "yyyy-MM-dd")}</ThemedText>
            </TouchableOpacity>
            
            <TouchableOpacity onPress={() => setShowTimePicker(true)} style={styles.dateBtn}>
                <Ionicons name="time-outline" size={20} color={theme.text} />
                <ThemedText style={{marginLeft: 8}}>{format(recordTime, "HH:mm")}</ThemedText>
            </TouchableOpacity>
        </View>

        {/* 隱藏的 Picker */}
        {showDatePicker && (
            <DateTimePicker value={recordDate} mode="date" onChange={(e, d) => { setShowDatePicker(false); if(d) setRecordDate(d); }} />
        )}
        {showTimePicker && (
            <DateTimePicker value={recordTime} mode="time" onChange={(e, d) => { setShowTimePicker(false); if(d) setRecordTime(d); }} />
        )}

        {/* 餐別選擇 */}
        <View style={styles.mealSelector}>
            {MEAL_PERIODS.map((meal) => (
                <TouchableOpacity
                    key={meal.id}
                    style={[
                        styles.mealBtn,
                        selectedMeal === meal.id && { backgroundColor: theme.tint }
                    ]}
                    onPress={() => setSelectedMeal(meal.id)}
                >
                    <ThemedText style={{ color: selectedMeal === meal.id ? '#FFF' : theme.text, fontSize: 12 }}>
                        {meal.label}
                    </ThemedText>
                </TouchableOpacity>
            ))}
        </View>

        {/* 食物名稱 & AI 分析按鈕 */}
        <ThemedView style={styles.card}>
            <ThemedText type="defaultSemiBold" style={{marginBottom: 8}}>食物名稱</ThemedText>
            <View style={{flexDirection: 'row', gap: 8}}>
                <TextInput
                    style={[styles.input, { flex: 1, color: theme.text, borderColor: theme.icon }]}
                    value={foodName}
                    onChangeText={setFoodName}
                    placeholder="例如：雞胸肉沙拉"
                    placeholderTextColor={theme.icon}
                />
                <TouchableOpacity 
                    style={[styles.aiBtn, { backgroundColor: isAnalyzing ? theme.icon : '#AF52DE' }]}
                    onPress={handleAiAnalyze}
                    disabled={isAnalyzing}
                >
                    {isAnalyzing ? <ActivityIndicator color="#FFF" /> : <Ionicons name="sparkles" size={20} color="#FFF" />}
                    <ThemedText style={{color: '#FFF', fontSize: 12, marginLeft: 4}}>AI 分析</ThemedText>
                </TouchableOpacity>
            </View>
            {barcode && <ThemedText style={{fontSize: 12, color: theme.icon, marginTop: 4}}>Barcode: {barcode}</ThemedText>}
            
            {/* AI 建議顯示區 */}
            {aiSuggestion && (
                <View style={styles.aiSuggestionBox}>
                    <Ionicons name="information-circle" size={16} color="#AF52DE" />
                    <ThemedText style={{fontSize: 12, color: theme.text, marginLeft: 6, flex: 1}}>
                        {aiSuggestion}
                    </ThemedText>
                </View>
            )}
        </ThemedView>

        {/* 份量輸入 */}
        <ThemedView style={styles.card}>
            <View style={styles.rowBetween}>
                <ThemedText type="defaultSemiBold">攝取份量</ThemedText>
                <TouchableOpacity onPress={() => setInputMode(prev => prev === 'serving' ? 'weight' : 'serving')}>
                    <ThemedText style={{color: theme.tint, fontSize: 14}}>
                        切換至{inputMode === 'serving' ? '總克數' : '份數'}輸入
                    </ThemedText>
                </TouchableOpacity>
            </View>

            {inputMode === 'serving' ? (
                <View style={styles.rowInputs}>
                    <View style={{flex: 1}}>
                        <ThemedText style={styles.labelSmall}>份數</ThemedText>
                        <TextInput
                            style={[styles.input, { color: theme.text, borderColor: theme.icon }]}
                            value={servings}
                            onChangeText={setServings}
                            keyboardType="numeric"
                        />
                    </View>
                    <ThemedText style={{alignSelf: 'flex-end', marginBottom: 12, marginHorizontal: 8}}>X</ThemedText>
                    <View style={{flex: 1}}>
                        <ThemedText style={styles.labelSmall}>單份重(g)</ThemedText>
                        <TextInput
                            style={[styles.input, { color: theme.text, borderColor: theme.icon }]}
                            value={unitWeight}
                            onChangeText={setUnitWeight}
                            keyboardType="numeric"
                        />
                    </View>
                </View>
            ) : (
                <View>
                    <ThemedText style={styles.labelSmall}>總克數(g)</ThemedText>
                    <TextInput
                        style={[styles.input, { color: theme.text, borderColor: theme.icon }]}
                        value={totalWeight}
                        onChangeText={setTotalWeight}
                        keyboardType="numeric"
                    />
                </View>
            )}
            
            <View style={styles.totalSummary}>
                <ThemedText type="defaultSemiBold" style={{color: theme.tint}}>
                    總計: {totalWeight} g
                </ThemedText>
                <ThemedText style={{fontSize: 14}}>
                    熱量: {calculatedTotal.calories} kcal
                </ThemedText>
            </View>
        </ThemedView>

        {/* 100g 基準數值 (Product DB) */}
        <ThemedView style={styles.card}>
            <ThemedText type="defaultSemiBold" style={{marginBottom: 4}}>每 100g 營養素 (基準)</ThemedText>
            <ThemedText style={{fontSize: 12, color: theme.icon, marginBottom: 12}}>
                修改此處數值將更新資料庫，並影響所有引用此食物的紀錄。
            </ThemedText>

            <View style={styles.gridInputs}>
                <NutrientInput label="熱量 (kcal)" value={baseNutrients.calories} 
                    onChange={(v) => setBaseNutrients({...baseNutrients, calories: parseFloat(v) || 0})} theme={theme} />
                <NutrientInput label="蛋白質 (g)" value={baseNutrients.protein} 
                    onChange={(v) => setBaseNutrients({...baseNutrients, protein: parseFloat(v) || 0})} theme={theme} />
                <NutrientInput label="脂肪 (g)" value={baseNutrients.fat} 
                    onChange={(v) => setBaseNutrients({...baseNutrients, fat: parseFloat(v) || 0})} theme={theme} />
                <NutrientInput label="碳水 (g)" value={baseNutrients.carbs} 
                    onChange={(v) => setBaseNutrients({...baseNutrients, carbs: parseFloat(v) || 0})} theme={theme} />
                <NutrientInput label="鈉 (mg)" value={baseNutrients.sodium} 
                    onChange={(v) => setBaseNutrients({...baseNutrients, sodium: parseFloat(v) || 0})} theme={theme} />
            </View>
        </ThemedView>

      </ScrollView>
    </SafeAreaView>
  );
}

// 子元件：營養素輸入框
const NutrientInput = ({ label, value, onChange, theme }: any) => (
    <View style={{width: '48%', marginBottom: 12}}>
        <ThemedText style={{fontSize: 12, color: '#8E8E93', marginBottom: 4}}>{label}</ThemedText>
        <TextInput
            style={[styles.input, { color: theme.text, borderColor: theme.icon, textAlign: 'center' }]}
            value={String(value)}
            onChangeText={onChange}
            keyboardType="numeric"
        />
    </View>
);

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  scrollContent: { padding: 16 },
  dateTimeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  dateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(142, 142, 147, 0.1)',
    flex: 0.48,
    justifyContent: 'center',
  },
  mealSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  mealBtn: {
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 16,
    backgroundColor: 'rgba(142, 142, 147, 0.1)',
  },
  card: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    backgroundColor: 'rgba(142, 142, 147, 0.05)', // 淺灰底
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 16,
  },
  aiBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    borderRadius: 8,
    justifyContent: 'center',
  },
  aiSuggestionBox: {
    flexDirection: 'row',
    backgroundColor: '#F3E5F5',
    padding: 8,
    borderRadius: 8,
    marginTop: 8,
    alignItems: 'flex-start',
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  rowInputs: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  labelSmall: {
    fontSize: 12,
    color: '#8E8E93',
    marginBottom: 4,
  },
  totalSummary: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  gridInputs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
});