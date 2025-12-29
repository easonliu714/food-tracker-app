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
  Platform,
  Image
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

// 餐別定義
const MEAL_PERIODS = [
  { id: "breakfast", label: "早餐", start: 5, end: 10 },
  { id: "lunch", label: "午餐", start: 10, end: 14 },
  { id: "afternoon_tea", label: "下午茶", start: 14, end: 16 },
  { id: "dinner", label: "晚餐", start: 16, end: 20 },
  { id: "late_night", label: "宵夜", start: 20, end: 29 }, 
];

// 預設營養素 (String 格式以支援小數點輸入體驗)
const DEFAULT_NUTRIENTS = {
  calories: "0", protein: "0", fat: "0", saturatedFat: "0", transFat: "0",
  carbs: "0", sugar: "0", fiber: "0", sodium: "0", cholesterol: "0", magnesium: "0", zinc: "0", iron: "0"
};

export default function FoodEditorScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const colorScheme = useColorScheme() ?? "light";
  const theme = Colors[colorScheme];

  // --- State ---
  const [logId, setLogId] = useState<number | null>(null);
  const [recordDate, setRecordDate] = useState(new Date());
  
  // UI 狀態
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState("");

  // 餐別邏輯
  const [selectedMeal, setSelectedMeal] = useState("breakfast");
  const [mealManuallyChanged, setMealManuallyChanged] = useState(false);

  // 食物基本資料
  const [foodName, setFoodName] = useState("");
  const [barcode, setBarcode] = useState<string | null>(null);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [dbFoodId, setDbFoodId] = useState<number | null>(null); 
  
  // 份量
  const [inputMode, setInputMode] = useState<"serving" | "weight">("serving");
  const [servings, setServings] = useState("1");
  const [unitWeight, setUnitWeight] = useState("100");
  const [totalWeight, setTotalWeight] = useState("100");

  // 營養素 (基準 100g)
  const [baseNutrients, setBaseNutrients] = useState(DEFAULT_NUTRIENTS);
  const [initialBaseNutrients, setInitialBaseNutrients] = useState<typeof DEFAULT_NUTRIENTS | null>(null);

  // 防止 useEffect 無限迴圈的 Ref
  const isInitialized = useRef(false);

  // --- 初始化 Effect ---
  useEffect(() => {
    if (isInitialized.current) return;
    isInitialized.current = true;

    async function init() {
      try {
        if (params.logId) {
          // 編輯模式
          const id = parseInt(params.logId as string);
          setLogId(id);
          const logRes = await db.select().from(foodLogs).where(eq(foodLogs.id, id));
          
          if (logRes.length > 0) {
            const log = logRes[0];
            setRecordDate(new Date(log.loggedAt));
            setSelectedMeal(log.mealTimeCategory);
            setMealManuallyChanged(true); // 編輯時鎖定餐別
            
            setFoodName(log.foodName);
            setInputMode(log.servingType as any || 'weight');
            setServings(String(log.servingAmount || "1"));
            setUnitWeight(String(log.unitWeightG || "100"));
            setTotalWeight(String(log.totalWeightG || "100"));
            setDbFoodId(log.foodItemId);
            if (log.imageUrl) setImageUri(log.imageUrl);

            // 載入基準值
            if (log.foodItemId) {
              const itemRes = await db.select().from(foodItems).where(eq(foodItems.id, log.foodItemId));
              if (itemRes.length > 0) {
                const item = itemRes[0];
                const nutrients = mapDbToState(item);
                setBaseNutrients(nutrients);
                setInitialBaseNutrients(nutrients);
              }
            }
          }
        } else {
          // 新增模式
          const now = new Date();
          setRecordDate(now);
          updateCategoryByTime(now);

          if (params.barcode) {
            setBarcode(params.barcode as string);
            await loadFoodByBarcode(params.barcode as string);
          } else if (params.imageUri) {
             setImageUri(params.imageUri as string);
             if (params.analyze === "true") {
                analyzeImage();
             }
          }
        }
      } catch (e) {
        console.error("Init Error:", e);
      } finally {
        setIsLoading(false);
      }
    }
    init();
  }, []);

  // --- Helper Functions ---

  const mapDbToState = (item: any) => ({
      calories: String(item.calories || 0), 
      protein: String(item.proteinG || 0), 
      fat: String(item.fatG || 0),
      saturatedFat: String(item.saturatedFatG || 0), 
      transFat: String(item.transFatG || 0),
      carbs: String(item.carbsG || 0), 
      sugar: String(item.sugarG || 0), 
      fiber: String(item.fiberG || 0),
      sodium: String(item.sodiumMg || 0), 
      cholesterol: String(item.cholesterolMg || 0),
      magnesium: String(item.magnesiumMg || 0), 
      zinc: String(item.zincMg || 0), 
      iron: String(item.ironMg || 0)
  });

  const updateCategoryByTime = (date: Date) => {
    const h = date.getHours();
    // 跨日判斷：例如 20:00~05:00
    const found = MEAL_PERIODS.find(p => {
        const end = p.end > 24 ? p.end - 24 : p.end;
        if (p.start > p.end) {
            return h >= p.start || h < end;
        }
        return h >= p.start && h < p.end;
    });
    if (found) setSelectedMeal(found.id);
  };

  const loadFoodByBarcode = async (code: string) => {
    try {
        // 1. 本地 DB
        const localRes = await db.select().from(foodItems).where(eq(foodItems.barcode, code)).limit(1);
        if (localRes.length > 0) {
            const item = localRes[0];
            setDbFoodId(item.id);
            setFoodName(item.name);
            const nutrients = mapDbToState(item);
            setBaseNutrients(nutrients);
            setInitialBaseNutrients(nutrients);
            Alert.alert("本地資料庫", `已載入：${item.name}`);
        } else {
            // 2. OpenFoodFacts
            const response = await fetch(`https://world.openfoodfacts.org/api/v0/product/${code}.json`);
            const data = await response.json();
            if (data.status === 1) {
                const p = data.product;
                const n = p.nutriments;
                setFoodName(p.product_name || "未知商品");
                setBaseNutrients({
                    ...DEFAULT_NUTRIENTS,
                    calories: String(n["energy-kcal_100g"] || 0),
                    protein: String(n.protein_100g || 0),
                    fat: String(n.fat_100g || 0), saturatedFat: String(n["saturated-fat_100g"] || 0), transFat: String(n["trans-fat_100g"] || 0),
                    carbs: String(n.carbohydrates_100g || 0), sugar: String(n.sugars_100g || 0), fiber: String(n.fiber_100g || 0),
                    sodium: String((n.salt_100g || 0) * 400), // approx
                });
                Alert.alert("OpenFoodFacts", "已從網路下載產品資訊");
            } else {
                Alert.alert("查無資料", "請手動輸入營養標示");
            }
        }
    } catch (e) {
        console.error(e);
        Alert.alert("錯誤", "讀取條碼失敗");
    }
  };

  const analyzeImage = async () => {
      setIsAnalyzing(true);
      // 模擬 AI
      setTimeout(() => {
          setFoodName("AI 識別：雞胸肉便當");
          setBaseNutrients({
              ...DEFAULT_NUTRIENTS,
              calories: "160", protein: "25", fat: "5", carbs: "10", sodium: "150"
          });
          setAiSuggestion("AI 已分析圖片，請核對數值是否正確。");
          setIsAnalyzing(false);
      }, 1500);
  };

  // --- Event Handlers ---

  const handleDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) {
        const newDate = new Date(selectedDate);
        newDate.setHours(recordDate.getHours());
        newDate.setMinutes(recordDate.getMinutes());
        setRecordDate(newDate);
    }
  };

  const handleTimeChange = (event: any, selectedDate?: Date) => {
    setShowTimePicker(false);
    if (selectedDate) {
        const newDate = new Date(recordDate);
        newDate.setHours(selectedDate.getHours());
        newDate.setMinutes(selectedDate.getMinutes());
        setRecordDate(newDate);
        
        // 僅在新增模式且未手動修改過餐別時，連動餐別
        if (!logId && !mealManuallyChanged) {
           updateCategoryByTime(newDate);
        }
    }
  };

  const handleMealChange = (mealId: string) => {
      setSelectedMeal(mealId);
      setMealManuallyChanged(true); // 用戶手動點擊後，鎖定餐別
  };

  const updateNutrient = (key: keyof typeof baseNutrients, val: string) => {
      setBaseNutrients(prev => ({ ...prev, [key]: val }));
  };

  // --- 計算 ---
  useEffect(() => {
    if (inputMode === "serving") {
      const s = parseFloat(servings) || 0;
      const u = parseFloat(unitWeight) || 0;
      setTotalWeight((s * u).toFixed(1));
    }
  }, [servings, unitWeight, inputMode]);

  const calculatedTotal = useMemo(() => {
    const w = parseFloat(totalWeight) || 0;
    const ratio = w / 100;
    return Math.round((parseFloat(baseNutrients.calories) || 0) * ratio);
  }, [totalWeight, baseNutrients]);

  // --- 儲存 ---
  const handleSave = async () => {
    if (!foodName || !totalWeight) return Alert.alert("資料不完整", "請輸入名稱與重量");

    let hasBaseChange = false;
    if (dbFoodId && initialBaseNutrients) {
       hasBaseChange = JSON.stringify(baseNutrients) !== JSON.stringify(initialBaseNutrients);
    }

    if (hasBaseChange) {
        Alert.alert(
            "基準數值變更",
            "您修改了每 100g 的營養成分，這將影響所有關聯此食物的歷史紀錄。",
            [
                { text: "取消", style: "cancel" },
                { text: "另存為新食物", onPress: () => saveToDb(true) },
                { text: "更新所有紀錄", onPress: () => saveToDb(false) },
            ]
        );
    } else {
        saveToDb(false);
    }
  };

  const saveToDb = async (forceNew: boolean) => {
      try {
        let currentFoodId = dbFoodId;
        
        // Helper to parse float safe
        const pf = (v: string) => parseFloat(v) || 0;

        const itemData = {
            name: foodName,
            barcode: barcode,
            baseAmount: 100,
            calories: pf(baseNutrients.calories),
            proteinG: pf(baseNutrients.protein),
            fatG: pf(baseNutrients.fat),
            saturatedFatG: pf(baseNutrients.saturatedFat),
            transFatG: pf(baseNutrients.transFat),
            carbsG: pf(baseNutrients.carbs),
            sugarG: pf(baseNutrients.sugar),
            fiberG: pf(baseNutrients.fiber),
            sodiumMg: pf(baseNutrients.sodium),
            cholesterolMg: pf(baseNutrients.cholesterol),
            magnesiumMg: pf(baseNutrients.magnesium),
            zincMg: pf(baseNutrients.zinc),
            ironMg: pf(baseNutrients.iron),
            updatedAt: new Date(),
        };

        if (currentFoodId && !forceNew) {
            await db.update(foodItems).set(itemData).where(eq(foodItems.id, currentFoodId));
        } else {
            const res = await db.insert(foodItems).values({ ...itemData, isUserCreated: true }).returning({ insertedId: foodItems.id });
            currentFoodId = res[0].insertedId;
        }

        const w = parseFloat(totalWeight) || 0;
        const ratio = w / 100;

        const logData = {
            date: format(recordDate, 'yyyy-MM-dd'),
            mealTimeCategory: selectedMeal,
            loggedAt: recordDate,
            foodItemId: currentFoodId,
            foodName: foodName,
            servingType: inputMode,
            servingAmount: pf(servings),
            unitWeightG: pf(unitWeight),
            totalWeightG: w,
            totalCalories: pf(baseNutrients.calories) * ratio,
            totalProteinG: pf(baseNutrients.protein) * ratio,
            totalFatG: pf(baseNutrients.fat) * ratio,
            totalCarbsG: pf(baseNutrients.carbs) * ratio,
            totalSodiumMg: pf(baseNutrients.sodium) * ratio,
            imageUrl: imageUri,
        };

        if (logId) {
            await db.update(foodLogs).set(logData).where(eq(foodLogs.id, logId));
        } else {
            await db.insert(foodLogs).values(logData);
        }
        Alert.alert("成功", "已儲存", [{ text: "OK", onPress: () => router.back() }]);
      } catch(e) { console.error(e); Alert.alert("錯誤", "儲存失敗"); }
  };

  const NutrientRow = ({ label, val, k, update, isMain }: any) => (
    <View style={{flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom: 8}}>
        <ThemedText style={{fontSize: isMain?14:13, fontWeight: isMain?'600':'400', color: theme.text}}>{label}</ThemedText>
        <TextInput
            style={[styles.input, {width: 80, paddingVertical: 4, height: 32, textAlign:'center', color:theme.text, borderColor: theme.icon}]}
            value={val}
            onChangeText={(v) => update(k, v)}
            keyboardType="numeric"
            placeholder="0"
            placeholderTextColor="#999"
        />
    </View>
  );

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
                <ThemedText style={{marginLeft: 8}}>{format(recordDate, "HH:mm")}</ThemedText>
            </TouchableOpacity>
        </View>
        {showDatePicker && <DateTimePicker value={recordDate} mode="date" onChange={handleDateChange} />}
        {showTimePicker && <DateTimePicker value={recordDate} mode="time" onChange={handleTimeChange} />}

        {/* 圖片預覽 */}
        {imageUri && (
            <View style={styles.imagePreview}>
                <Image source={{ uri: imageUri }} style={{ width: '100%', height: 200, borderRadius: 12 }} />
                {isAnalyzing && (
                    <View style={styles.analyzingOverlay}>
                        <ActivityIndicator color="#FFF" />
                        <ThemedText style={{color:'#FFF', marginTop:8}}>AI 分析中...</ThemedText>
                    </View>
                )}
            </View>
        )}
        {aiSuggestion ? <View style={styles.aiBox}><ThemedText style={{fontSize:12}}>{aiSuggestion}</ThemedText></View> : null}

        {/* 餐別選擇 */}
        <View style={styles.mealSelector}>
            {MEAL_PERIODS.map((meal) => (
                <TouchableOpacity key={meal.id} style={[styles.mealBtn, selectedMeal === meal.id && { backgroundColor: theme.tint }]} onPress={() => handleMealChange(meal.id)}>
                    <ThemedText style={{ color: selectedMeal === meal.id ? '#FFF' : theme.text, fontSize: 12 }}>{meal.label}</ThemedText>
                </TouchableOpacity>
            ))}
        </View>

        {/* 食物名稱 */}
        <ThemedView style={styles.card}>
            <ThemedText type="defaultSemiBold" style={{marginBottom: 8}}>食物名稱</ThemedText>
            <TextInput style={[styles.input, { color: theme.text, borderColor: theme.icon }]} value={foodName} onChangeText={setFoodName} placeholder="輸入名稱" placeholderTextColor={theme.icon} />
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
                <ThemedText style={{fontSize: 14}}>熱量: {calculatedTotal} kcal</ThemedText>
            </View>
        </ThemedView>

        {/* 營養素輸入 */}
        <ThemedView style={styles.card}>
            <ThemedText type="defaultSemiBold" style={{marginBottom: 12}}>每 100g 基準營養素</ThemedText>
            <NutrientRow label="熱量 (kcal)" val={baseNutrients.calories} k="calories" update={updateNutrient} isMain/>
            <View style={styles.divider}/>
            <NutrientRow label="蛋白質 (g)" val={baseNutrients.protein} k="protein" update={updateNutrient} isMain/>
            <View style={styles.divider}/>
            <NutrientRow label="總脂肪 (g)" val={baseNutrients.fat} k="fat" update={updateNutrient} isMain/>
            <View style={{paddingLeft: 16}}>
                <NutrientRow label="飽和脂肪 (g)" val={baseNutrients.saturatedFat} k="saturatedFat" update={updateNutrient}/>
                <NutrientRow label="反式脂肪 (g)" val={baseNutrients.transFat} k="transFat" update={updateNutrient}/>
                <NutrientRow label="膽固醇 (mg)" val={baseNutrients.cholesterol} k="cholesterol" update={updateNutrient}/>
            </View>
            <View style={styles.divider}/>
            <NutrientRow label="碳水化合物 (g)" val={baseNutrients.carbs} k="carbs" update={updateNutrient} isMain/>
            <View style={{paddingLeft: 16}}>
                <NutrientRow label="糖 (g)" val={baseNutrients.sugar} k="sugar" update={updateNutrient}/>
                <NutrientRow label="膳食纖維 (g)" val={baseNutrients.fiber} k="fiber" update={updateNutrient}/>
            </View>
            <View style={styles.divider}/>
            <NutrientRow label="鈉 (mg)" val={baseNutrients.sodium} k="sodium" update={updateNutrient} isMain/>
            <View style={{paddingLeft: 16}}>
                <NutrientRow label="鎂 (mg)" val={baseNutrients.magnesium} k="magnesium" update={updateNutrient}/>
                <NutrientRow label="鋅 (mg)" val={baseNutrients.zinc} k="zinc" update={updateNutrient}/>
                <NutrientRow label="鐵 (mg)" val={baseNutrients.iron} k="iron" update={updateNutrient}/>
            </View>
        </ThemedView>
      </ScrollView>
      }
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

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
  imagePreview: { marginBottom: 16 },
  analyzingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', borderRadius: 12 },
  aiBox: { backgroundColor: '#E3F2FD', padding: 10, borderRadius: 8, marginBottom: 16 }
});