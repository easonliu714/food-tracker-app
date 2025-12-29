import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  StyleSheet,
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { format } from "date-fns";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { db } from "@/lib/db";
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
  { id: "late_night", label: "宵夜", start: 20, end: 29 }, 
];

const DEFAULT_NUTRIENTS = {
  calories: 0,
  protein: 0,
  fat: 0, saturatedFat: 0, transFat: 0,
  carbs: 0, sugar: 0, fiber: 0,
  sodium: 0, cholesterol: 0, magnesium: 0, zinc: 0, iron: 0
};

export default function FoodEditorScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const colorScheme = useColorScheme() ?? "light";
  const theme = Colors[colorScheme];

  // --- State ---
  const [logId, setLogId] = useState<number | null>(null); // 編輯模式用
  
  const [recordDate, setRecordDate] = useState(new Date());
  const [recordTime, setRecordTime] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  
  const [selectedMeal, setSelectedMeal] = useState("breakfast");
  const [mealManuallyChanged, setMealManuallyChanged] = useState(false); // 追蹤用戶是否手動修改過餐別

  const [foodName, setFoodName] = useState("");
  const [barcode, setBarcode] = useState<string | null>(null);
  const [dbFoodId, setDbFoodId] = useState<number | null>(null); // 關聯的 Product DB ID
  
  const [inputMode, setInputMode] = useState<"serving" | "weight">("serving");
  const [servings, setServings] = useState("1");
  const [unitWeight, setUnitWeight] = useState("100");
  const [totalWeight, setTotalWeight] = useState("100");

  // 100g 基準營養素
  const [baseNutrients, setBaseNutrients] = useState(DEFAULT_NUTRIENTS);
  // 紀錄載入時的初始基準值 (用於比對變更)
  const [initialBaseNutrients, setInitialBaseNutrients] = useState<typeof DEFAULT_NUTRIENTS | null>(null);
  
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // --- Effect: 初始化 (處理參數或載入紀錄) ---
  useEffect(() => {
    async function init() {
      // A. 編輯既有紀錄
      if (params.logId) {
        setIsLoading(true);
        const id = parseInt(params.logId as string);
        setLogId(id);
        const logRes = await db.select().from(foodLogs).where(eq(foodLogs.id, id));
        if (logRes.length > 0) {
          const log = logRes[0];
          setRecordDate(log.loggedAt);
          setRecordTime(log.loggedAt);
          setSelectedMeal(log.mealTimeCategory);
          setMealManuallyChanged(true); // 編輯時視為手動鎖定
          setFoodName(log.foodName);
          setInputMode(log.servingType as any || 'weight');
          setServings(log.servingAmount?.toString() || "1");
          setUnitWeight(log.unitWeightG?.toString() || "100");
          setTotalWeight(log.totalWeightG?.toString() || "100");
          setDbFoodId(log.foodItemId);

          // 載入關聯的 Product DB 基準值
          if (log.foodItemId) {
            const itemRes = await db.select().from(foodItems).where(eq(foodItems.id, log.foodItemId));
            if (itemRes.length > 0) {
              const item = itemRes[0];
              const nutrients = {
                calories: item.calories,
                protein: item.proteinG || 0,
                fat: item.fatG || 0, saturatedFat: item.saturatedFatG || 0, transFat: item.transFatG || 0,
                carbs: item.carbsG || 0, sugar: item.sugarG || 0, fiber: item.fiberG || 0,
                sodium: item.sodiumMg || 0, cholesterol: item.cholesterolMg || 0, magnesium: item.magnesiumMg || 0, zinc: item.zincMg || 0, iron: item.ironMg || 0
              };
              setBaseNutrients(nutrients);
              setInitialBaseNutrients(nutrients); // 保存初始狀態
            }
          }
        }
        setIsLoading(false);
        return;
      }

      // B. 新增紀錄 (Barocde / Image / Default)
      // 自動設定時間為現在
      updateCategoryByTime(new Date());

      if (params.barcode) {
        const code = params.barcode as string;
        setBarcode(code);
        await loadFoodByBarcode(code);
      } else if (params.imageUri) {
         // 模擬 AI 讀圖
         setIsAnalyzing(true);
         setTimeout(() => {
             setFoodName("AI 識別食物");
             setIsAnalyzing(false);
             Alert.alert("AI 分析", "已識別圖片，請確認數值");
         }, 1000);
      }
    }
    init();
  }, [params]);

  // --- Logic: 時間連動餐別 ---
  const updateCategoryByTime = (date: Date) => {
    // 如果用戶已經手動選過餐別，就不自動跳轉
    // 但在新增模式下，初始載入時 mealManuallyChanged 為 false
    if (mealManuallyChanged && !params.logId) return; 

    const currentHour = date.getHours();
    const foundMeal = MEAL_PERIODS.find(p => {
        const end = p.end > 24 ? p.end - 24 : p.end;
        if (p.start > p.end) return currentHour >= p.start || currentHour < end;
        return currentHour >= p.start && currentHour < p.end;
    });
    if (foundMeal) setSelectedMeal(foundMeal.id);
  };

  const handleTimeChange = (date: Date) => {
    setRecordTime(date);
    if (!logId) { // 僅在新增模式下，修改時間會連動餐別 (除非手動鎖定邏輯要更嚴格)
       updateCategoryByTime(date);
    }
  };

  // --- Logic: 讀取資料庫/API ---
  const loadFoodByBarcode = async (code: string) => {
    setIsLoading(true);
    try {
        // 1. 優先查 Local DB
        const localRes = await db.select().from(foodItems).where(eq(foodItems.barcode, code)).limit(1);
        if (localRes.length > 0) {
            const item = localRes[0];
            setDbFoodId(item.id);
            setFoodName(item.name);
            const nutrients = {
                calories: item.calories,
                protein: item.proteinG || 0,
                fat: item.fatG || 0, saturatedFat: item.saturatedFatG || 0, transFat: item.transFatG || 0,
                carbs: item.carbsG || 0, sugar: item.sugarG || 0, fiber: item.fiberG || 0,
                sodium: item.sodiumMg || 0, cholesterol: item.cholesterolMg || 0, magnesium: item.magnesiumMg || 0, zinc: item.zincMg || 0, iron: item.ironMg || 0
            };
            setBaseNutrients(nutrients);
            setInitialBaseNutrients(nutrients);
            Alert.alert("本地資料庫", `已載入：${item.name}`);
        } else {
            // 2. 查 OpenFoodFacts API
            const response = await fetch(`https://world.openfoodfacts.org/api/v0/product/${code}.json`);
            const data = await response.json();
            if (data.status === 1) {
                const p = data.product;
                const n = p.nutriments;
                setFoodName(p.product_name || "未知商品");
                setBaseNutrients({
                    calories: n["energy-kcal_100g"] || 0,
                    protein: n.protein_100g || 0,
                    fat: n.fat_100g || 0, saturatedFat: n["saturated-fat_100g"] || 0, transFat: n["trans-fat_100g"] || 0,
                    carbs: n.carbohydrates_100g || 0, sugar: n.sugars_100g || 0, fiber: n.fiber_100g || 0,
                    sodium: (n.salt_100g || 0) * 400, // salt to sodium approx
                    cholesterol: (n.cholesterol_100g || 0) * 1000, // g to mg usually
                    magnesium: (n.magnesium_100g || 0) * 1000,
                    zinc: (n.zinc_100g || 0) * 1000,
                    iron: (n.iron_100g || 0) * 1000,
                });
                Alert.alert("OpenFoodFacts", "已從網路下載產品資訊");
            } else {
                Alert.alert("查無資料", "資料庫與網路皆無此商品，請手動輸入");
            }
        }
    } catch (e) {
        console.error(e);
        Alert.alert("錯誤", "讀取條碼失敗");
    } finally {
        setIsLoading(false);
    }
  };

  // --- Logic: 計算顯示數值 ---
  useEffect(() => {
    if (inputMode === "serving") {
      const s = parseFloat(servings) || 0;
      const u = parseFloat(unitWeight) || 0;
      setTotalWeight((s * u).toFixed(1));
    }
  }, [servings, unitWeight, inputMode]);

  const calculatedTotal = useMemo(() => {
    const weight = parseFloat(totalWeight) || 0;
    const ratio = weight / 100;
    const calc = (val: number) => (val * ratio).toFixed(1);
    const calcMg = (val: number) => Math.round(val * ratio);
    
    return {
      calories: Math.round(baseNutrients.calories * ratio),
      protein: calc(baseNutrients.protein),
      fat: calc(baseNutrients.fat),
      carbs: calc(baseNutrients.carbs),
      sodium: calcMg(baseNutrients.sodium),
      // ... others can be calculated similarly for display if needed
    };
  }, [totalWeight, baseNutrients]);

  // --- Logic: 儲存 (包含防呆) ---
  const handleSave = async () => {
    if (!foodName || !totalWeight) return Alert.alert("資料不完整", "請輸入名稱與重量");

    // 檢查基準值是否變更
    let hasBaseChange = false;
    if (dbFoodId && initialBaseNutrients) {
       hasBaseChange = JSON.stringify(baseNutrients) !== JSON.stringify(initialBaseNutrients);
    }

    if (hasBaseChange) {
        Alert.alert(
            "基準數值變更",
            "您修改了每 100g 的營養成分，這將影響所有關聯此食物的歷史紀錄。請問您要？",
            [
                { text: "取消", style: "cancel" },
                { text: "另存為新食物", onPress: () => saveToDb(true) }, // Force Create New
                { text: "更新所有紀錄", onPress: () => saveToDb(false) }, // Update Existing
            ]
        );
    } else {
        saveToDb(false);
    }
  };

  const saveToDb = async (forceCreateNew: boolean) => {
     try {
        let currentFoodId = dbFoodId;
        
        // 1. Product DB 操作
        const itemData = {
            name: foodName,
            barcode: barcode,
            baseAmount: 100,
            calories: baseNutrients.calories,
            proteinG: baseNutrients.protein,
            fatG: baseNutrients.fat, saturatedFatG: baseNutrients.saturatedFat, transFatG: baseNutrients.transFat,
            carbsG: baseNutrients.carbs, sugarG: baseNutrients.sugar, fiberG: baseNutrients.fiber,
            sodiumMg: baseNutrients.sodium, cholesterolMg: baseNutrients.cholesterol, 
            magnesiumMg: baseNutrients.magnesium, zincMg: baseNutrients.zinc, ironMg: baseNutrients.iron,
            updatedAt: new Date(),
        };

        if (currentFoodId && !forceCreateNew) {
            await db.update(foodItems).set(itemData).where(eq(foodItems.id, currentFoodId));
        } else {
            const res = await db.insert(foodItems).values({ ...itemData, isUserCreated: true }).returning({ insertedId: foodItems.id });
            currentFoodId = res[0].insertedId;
        }

        // 2. Log 操作
        const logDate = new Date(recordDate);
        logDate.setHours(recordTime.getHours());
        logDate.setMinutes(recordTime.getMinutes());

        const weight = parseFloat(totalWeight) || 0;
        const ratio = weight / 100;

        const logData = {
            date: format(logDate, 'yyyy-MM-dd'),
            mealTimeCategory: selectedMeal,
            loggedAt: logDate,
            foodItemId: currentFoodId,
            foodName: foodName,
            servingType: inputMode,
            servingAmount: inputMode === 'serving' ? parseFloat(servings) : weight,
            unitWeightG: inputMode === 'serving' ? parseFloat(unitWeight) : 1,
            totalWeightG: weight,
            
            // Snapshots
            totalCalories: baseNutrients.calories * ratio,
            totalProteinG: baseNutrients.protein * ratio,
            totalFatG: baseNutrients.fat * ratio,
            totalCarbsG: baseNutrients.carbs * ratio,
            totalSodiumMg: baseNutrients.sodium * ratio,
            
            totalSaturatedFatG: baseNutrients.saturatedFat * ratio,
            totalTransFatG: baseNutrients.transFat * ratio,
            totalSugarG: baseNutrients.sugar * ratio,
            totalFiberG: baseNutrients.fiber * ratio,
            totalCholesterolMg: baseNutrients.cholesterol * ratio,
            totalMagnesiumMg: baseNutrients.magnesium * ratio,
            totalZincMg: baseNutrients.zinc * ratio,
            totalIronMg: baseNutrients.iron * ratio,
        };

        if (logId) {
            await db.update(foodLogs).set(logData).where(eq(foodLogs.id, logId));
        } else {
            await db.insert(foodLogs).values(logData);
        }

        Alert.alert("成功", "紀錄已儲存", [{ text: "OK", onPress: () => router.back() }]);
     } catch (e) {
         console.error(e);
         Alert.alert("儲存失敗");
     }
  };

  // --- Helpers for Input ---
  const updateNutrient = (key: keyof typeof baseNutrients, val: string) => {
      setBaseNutrients(prev => ({ ...prev, [key]: parseFloat(val) || 0 }));
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{flex:1}}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}><Ionicons name="arrow-back" size={28} color={theme.text} /></TouchableOpacity>
        <ThemedText type="subtitle">{logId ? "編輯紀錄" : "新增食物"}</ThemedText>
        <TouchableOpacity onPress={handleSave}><Ionicons name="save" size={28} color={theme.tint} /></TouchableOpacity>
      </View>

      {isLoading ? <ActivityIndicator size="large" style={{marginTop: 50}}/> : 
      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        {/* 日期與時間 */}
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

        {showDatePicker && <DateTimePicker value={recordDate} mode="date" onChange={(e, d) => { setShowDatePicker(false); if(d) setRecordDate(d); }} />}
        {showTimePicker && <DateTimePicker value={recordTime} mode="time" onChange={(e, d) => { setShowTimePicker(false); if(d) handleTimeChange(d); }} />}

        {/* 餐別選擇 */}
        <View style={styles.mealSelector}>
            {MEAL_PERIODS.map((meal) => (
                <TouchableOpacity
                    key={meal.id}
                    style={[styles.mealBtn, selectedMeal === meal.id && { backgroundColor: theme.tint }]}
                    onPress={() => { setSelectedMeal(meal.id); setMealManuallyChanged(true); }}
                >
                    <ThemedText style={{ color: selectedMeal === meal.id ? '#FFF' : theme.text, fontSize: 12 }}>{meal.label}</ThemedText>
                </TouchableOpacity>
            ))}
        </View>

        {/* 食物名稱 */}
        <ThemedView style={styles.card}>
            <ThemedText type="defaultSemiBold" style={{marginBottom: 8}}>食物名稱</ThemedText>
            <View style={{flexDirection: 'row', gap: 8}}>
                <TextInput
                    style={[styles.input, { flex: 1, color: theme.text, borderColor: theme.icon }]}
                    value={foodName}
                    onChangeText={setFoodName}
                    placeholder="輸入名稱或掃描條碼"
                    placeholderTextColor={theme.icon}
                />
            </View>
            {barcode && <ThemedText style={{fontSize: 12, color: theme.icon, marginTop: 4}}>Barcode: {barcode}</ThemedText>}
        </ThemedView>

        {/* 份量輸入 */}
        <ThemedView style={styles.card}>
            <View style={styles.rowBetween}>
                <ThemedText type="defaultSemiBold">攝取份量</ThemedText>
                <TouchableOpacity onPress={() => setInputMode(prev => prev === 'serving' ? 'weight' : 'serving')}>
                    <ThemedText style={{color: theme.tint, fontSize: 14}}>切換至{inputMode === 'serving' ? '總克數' : '份數'}</ThemedText>
                </TouchableOpacity>
            </View>
            {inputMode === 'serving' ? (
                <View style={styles.rowInputs}>
                    <View style={{flex: 1}}><ThemedText style={styles.labelSmall}>份數</ThemedText><TextInput style={[styles.input, {color:theme.text, borderColor:theme.icon}]} value={servings} onChangeText={setServings} keyboardType="numeric"/></View>
                    <ThemedText style={{alignSelf: 'flex-end', marginBottom: 12, marginHorizontal: 8}}>X</ThemedText>
                    <View style={{flex: 1}}><ThemedText style={styles.labelSmall}>單份重(g)</ThemedText><TextInput style={[styles.input, {color:theme.text, borderColor:theme.icon}]} value={unitWeight} onChangeText={setUnitWeight} keyboardType="numeric"/></View>
                </View>
            ) : (
                <View><ThemedText style={styles.labelSmall}>總克數(g)</ThemedText><TextInput style={[styles.input, {color:theme.text, borderColor:theme.icon}]} value={totalWeight} onChangeText={setTotalWeight} keyboardType="numeric"/></View>
            )}
            <View style={styles.totalSummary}>
                <ThemedText type="defaultSemiBold" style={{color: theme.tint}}>總計: {totalWeight} g</ThemedText>
                <ThemedText style={{fontSize: 14}}>熱量: {calculatedTotal.calories} kcal</ThemedText>
            </View>
        </ThemedView>

        {/* 詳細營養素 (每 100g) */}
        <ThemedView style={styles.card}>
            <ThemedText type="defaultSemiBold" style={{marginBottom: 12}}>每 100g 基準營養素</ThemedText>
            
            <NutrientRow label="熱量 (kcal)" val={baseNutrients.calories} k="calories" update={updateNutrient} theme={theme} isMain/>
            
            <View style={styles.divider}/>
            <NutrientRow label="蛋白質 (g)" val={baseNutrients.protein} k="protein" update={updateNutrient} theme={theme} isMain/>
            
            <View style={styles.divider}/>
            <NutrientRow label="總脂肪 (g)" val={baseNutrients.fat} k="fat" update={updateNutrient} theme={theme} isMain/>
            <View style={{paddingLeft: 16}}>
                <NutrientRow label="飽和脂肪 (g)" val={baseNutrients.saturatedFat} k="saturatedFat" update={updateNutrient} theme={theme}/>
                <NutrientRow label="反式脂肪 (g)" val={baseNutrients.transFat} k="transFat" update={updateNutrient} theme={theme}/>
                <NutrientRow label="膽固醇 (mg)" val={baseNutrients.cholesterol} k="cholesterol" update={updateNutrient} theme={theme}/>
            </View>

            <View style={styles.divider}/>
            <NutrientRow label="碳水化合物 (g)" val={baseNutrients.carbs} k="carbs" update={updateNutrient} theme={theme} isMain/>
            <View style={{paddingLeft: 16}}>
                <NutrientRow label="糖 (g)" val={baseNutrients.sugar} k="sugar" update={updateNutrient} theme={theme}/>
                <NutrientRow label="膳食纖維 (g)" val={baseNutrients.fiber} k="fiber" update={updateNutrient} theme={theme}/>
            </View>

            <View style={styles.divider}/>
            <NutrientRow label="鈉 (mg)" val={baseNutrients.sodium} k="sodium" update={updateNutrient} theme={theme} isMain/>
            <View style={{paddingLeft: 16}}>
                <NutrientRow label="鎂 (mg)" val={baseNutrients.magnesium} k="magnesium" update={updateNutrient} theme={theme}/>
                <NutrientRow label="鋅 (mg)" val={baseNutrients.zinc} k="zinc" update={updateNutrient} theme={theme}/>
                <NutrientRow label="鐵 (mg)" val={baseNutrients.iron} k="iron" update={updateNutrient} theme={theme}/>
            </View>
        </ThemedView>
      </ScrollView>
      }
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const NutrientRow = ({ label, val, k, update, theme, isMain }: any) => (
    <View style={{flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom: 8}}>
        <ThemedText style={{fontSize: isMain?14:13, fontWeight: isMain?'600':'400', color: theme.text}}>{label}</ThemedText>
        <TextInput
            style={[styles.input, {width: 80, paddingVertical: 4, height: 32, textAlign:'center', color:theme.text, borderColor: theme.icon}]}
            value={val.toString()}
            onChangeText={(v) => update(k, v)}
            keyboardType="numeric"
        />
    </View>
);

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#eee' },
  scrollContent: { padding: 16 },
  dateTimeRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  dateBtn: { flexDirection: 'row', alignItems: 'center', padding: 10, borderRadius: 8, backgroundColor: 'rgba(120,120,120,0.1)', flex: 0.48 },
  mealSelector: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  mealBtn: { paddingVertical: 6, paddingHorizontal: 8, borderRadius: 16, backgroundColor: 'rgba(120,120,120,0.1)' },
  card: { padding: 16, borderRadius: 12, marginBottom: 16, backgroundColor: 'rgba(120,120,120,0.05)' },
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, fontSize: 16, paddingVertical: 8 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  rowInputs: { flexDirection: 'row', alignItems: 'flex-end' },
  labelSmall: { fontSize: 12, color: '#888', marginBottom: 4 },
  totalSummary: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#eee', flexDirection: 'row', justifyContent: 'space-between' },
  divider: { height: 1, backgroundColor: '#eee', marginVertical: 8 },
});