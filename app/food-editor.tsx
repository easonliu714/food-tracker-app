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
import { foodItems, foodLogs, userProfiles } from "@/drizzle/schema";
import { eq } from "drizzle-orm";
import { analyzeFoodImage } from "@/lib/gemini";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { t, useLanguage } from "@/lib/i18n";

const MEAL_PERIODS = [
  { id: "breakfast", label: "早餐", start: 5, end: 10 },
  { id: "lunch", label: "午餐", start: 10, end: 14 },
  { id: "afternoon_tea", label: "下午茶", start: 14, end: 16 },
  { id: "dinner", label: "晚餐", start: 16, end: 20 },
  { id: "late_night", label: "宵夜", start: 20, end: 29 }, 
];

const DEFAULT_NUTRIENTS = {
  calories: "0", protein: "0", fat: "0", saturatedFat: "0", transFat: "0",
  carbs: "0", sugar: "0", fiber: "0", sodium: "0", cholesterol: "0", magnesium: "0", zinc: "0", iron: "0"
};

export default function FoodEditorScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const colorScheme = useColorScheme() ?? "light";
  const theme = Colors[colorScheme];
  const lang = useLanguage();

  const [logId, setLogId] = useState<number | null>(null);
  const [recordDate, setRecordDate] = useState(new Date());
  
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiComposition, setAiComposition] = useState("");
  const [aiAdvice, setAiAdvice] = useState("");

  const [selectedMeal, setSelectedMeal] = useState("breakfast");
  const [mealManuallyChanged, setMealManuallyChanged] = useState(false);

  const [foodName, setFoodName] = useState("");
  const [barcode, setBarcode] = useState<string | null>(null);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [dbFoodId, setDbFoodId] = useState<number | null>(null); 
  
  const [inputMode, setInputMode] = useState<"serving" | "weight">("serving");
  const [servings, setServings] = useState("1");
  const [unitWeight, setUnitWeight] = useState("100");
  const [totalWeight, setTotalWeight] = useState("100");

  const [baseNutrients, setBaseNutrients] = useState(DEFAULT_NUTRIENTS);
  const [initialBaseNutrients, setInitialBaseNutrients] = useState<typeof DEFAULT_NUTRIENTS | null>(null);

  const isInitialized = useRef(false);

  useEffect(() => {
    if (isInitialized.current) return;
    isInitialized.current = true;

    async function init() {
      try {
        if (params.logId) {
          const id = parseInt(params.logId as string);
          setLogId(id);
          const logRes = await db.select().from(foodLogs).where(eq(foodLogs.id, id));
          
          if (logRes.length > 0) {
            const log = logRes[0];
            setRecordDate(new Date(log.loggedAt));
            setSelectedMeal(log.mealTimeCategory);
            setMealManuallyChanged(true);
            setFoodName(log.foodName);
            setInputMode(log.servingType as any || 'weight');
            setServings(String(log.servingAmount || "1"));
            setUnitWeight(String(log.unitWeightG || "100"));
            setTotalWeight(String(log.totalWeightG || "100"));
            setDbFoodId(log.foodItemId);
            if (log.imageUrl) setImageUri(log.imageUrl);

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
          const now = new Date();
          setRecordDate(now);
          updateCategoryByTime(now);

          if (params.barcode) {
            setBarcode(params.barcode as string);
            await loadFoodByBarcode(params.barcode as string);
          } else if (params.imageUri) {
             setImageUri(params.imageUri as string);
             if (params.analyze === "true" && params.imageBase64) {
                performAiAnalysis(params.imageBase64 as string);
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

  const performAiAnalysis = async (base64: string) => {
      setIsAnalyzing(true);
      try {
          const pRes = await db.select().from(userProfiles).limit(1);
          const profile = pRes[0] || {};
          const result = await analyzeFoodImage(base64, lang, profile);
          
          if (result) {
              setFoodName(result.foodName || "AI 識別食物");
              setBaseNutrients({
                  ...DEFAULT_NUTRIENTS,
                  calories: String(result.calories_100g || 0),
                  protein: String(result.protein_100g || 0),
                  fat: String(result.fat_100g || 0),
                  carbs: String(result.carbs_100g || 0),
                  sodium: String(result.sodium_100g || 0),
                  sugar: String(result.sugar_100g || 0),
                  fiber: String(result.fiber_100g || 0),
                  saturatedFat: String(result.saturated_fat_100g || 0),
                  transFat: String(result.trans_fat_100g || 0),
                  cholesterol: String(result.cholesterol_100g || 0),
                  zinc: String(result.zinc_100g || 0),
                  magnesium: String(result.magnesium_100g || 0),
                  iron: String(result.iron_100g || 0),
              });
              setAiComposition(result.composition || "");
              setAiAdvice(result.suggestion || "");
              Alert.alert(t('ai_analysis', lang), t('loaded', lang));
          } else {
              Alert.alert(t('error', lang), t('read_failed', lang));
          }
      } catch (e) {
          Alert.alert(t('error', lang), "AI 連線異常");
      } finally {
          setIsAnalyzing(false);
      }
  };

  const updateCategoryByTime = (date: Date) => {
    const h = date.getHours();
    const found = MEAL_PERIODS.find(p => {
        const end = p.end > 24 ? p.end - 24 : p.end;
        if (p.start > p.end) return h >= p.start || h < end;
        return h >= p.start && h < p.end;
    });
    if (found) setSelectedMeal(found.id);
  };

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
        if (!logId && !mealManuallyChanged) updateCategoryByTime(newDate);
    }
  };

  const loadFoodByBarcode = async (code: string) => {
    try {
        const localRes = await db.select().from(foodItems).where(eq(foodItems.barcode, code)).limit(1);
        if (localRes.length > 0) {
            const item = localRes[0];
            setDbFoodId(item.id);
            setFoodName(item.name);
            const nutrients = mapDbToState(item);
            setBaseNutrients(nutrients);
            setInitialBaseNutrients(nutrients);
            Alert.alert(t('local_db', lang), `${t('loaded', lang)}: ${item.name}`);
        } else {
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
                    sodium: String((n.salt_100g || 0) * 400),
                });
                Alert.alert("OpenFoodFacts", t('downloaded', lang));
            } else {
                Alert.alert(
                    t('scan_failed', lang), 
                    t('scan_failed_msg', lang),
                    [
                        { text: t('cancel', lang), style: 'cancel' },
                        { 
                            text: t('scan_ai_option', lang), 
                            onPress: () => router.push({ pathname: "/camera", params: { analyze: "true" } }) 
                        },
                        { text: t('manual_option', lang), style: 'default' }
                    ]
                );
            }
        }
    } catch (e) {
        console.error(e);
        Alert.alert(t('error', lang), t('read_failed', lang));
    }
  };

  const handleSave = async () => {
    if (!foodName || !totalWeight) return Alert.alert("資料不完整", "請輸入名稱與重量");

    let hasBaseChange = false;
    if (dbFoodId && initialBaseNutrients) {
       hasBaseChange = JSON.stringify(baseNutrients) !== JSON.stringify(initialBaseNutrients);
    }

    if (hasBaseChange) {
        Alert.alert(
            "基準變更",
            "您修改了每 100g 的營養成分，是否更新所有歷史紀錄？",
            [
                { text: "取消", style: "cancel" },
                { text: "另存新食物", onPress: () => saveToDb(true) },
                { text: "更新全部", onPress: () => saveToDb(false) },
            ]
        );
    } else {
        saveToDb(false);
    }
  };

  const saveToDb = async (forceNew: boolean) => {
      try {
        let currentFoodId = dbFoodId;
        const pf = (v: string) => parseFloat(v) || 0;
        const itemData = {
            name: foodName, barcode: barcode, baseAmount: 100,
            calories: pf(baseNutrients.calories), proteinG: pf(baseNutrients.protein),
            fatG: pf(baseNutrients.fat), saturatedFatG: pf(baseNutrients.saturatedFat), transFatG: pf(baseNutrients.transFat),
            carbsG: pf(baseNutrients.carbs), sugarG: pf(baseNutrients.sugar), fiberG: pf(baseNutrients.fiber),
            sodiumMg: pf(baseNutrients.sodium), cholesterolMg: pf(baseNutrients.cholesterol),
            magnesiumMg: pf(baseNutrients.magnesium), zincMg: pf(baseNutrients.zinc), ironMg: pf(baseNutrients.iron),
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
            totalSaturatedFatG: pf(baseNutrients.saturatedFat) * ratio,
            totalTransFatG: pf(baseNutrients.transFat) * ratio,
            totalSugarG: pf(baseNutrients.sugar) * ratio,
            totalFiberG: pf(baseNutrients.fiber) * ratio,
            totalCholesterolMg: pf(baseNutrients.cholesterol) * ratio,
            totalMagnesiumMg: pf(baseNutrients.magnesium) * ratio,
            totalZincMg: pf(baseNutrients.zinc) * ratio,
            totalIronMg: pf(baseNutrients.iron) * ratio,
            imageUrl: imageUri,
        };

        if (logId) {
            await db.update(foodLogs).set(logData).where(eq(foodLogs.id, logId));
        } else {
            await db.insert(foodLogs).values(logData);
        }
        Alert.alert(t('save', lang), "OK", [{ text: "OK", onPress: () => router.back() }]);
      } catch(e) { console.error(e); Alert.alert(t('error', lang), "Save Failed"); }
  };

  // ... (NutrientRow, calculatedTotal, updateNutrient 同前)
  const updateNutrient = (key: keyof typeof baseNutrients, val: string) => setBaseNutrients(prev => ({ ...prev, [key]: val }));
  const calculatedTotal = useMemo(() => Math.round((parseFloat(baseNutrients.calories)||0) * (parseFloat(totalWeight)||0)/100), [totalWeight, baseNutrients]);

  const NutrientRow = ({ label, val, k, update, isMain }: any) => (
    <View style={{flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom: 8}}>
        <ThemedText style={{fontSize: isMain?14:13, fontWeight: isMain?'600':'400', color: theme.text}}>{label}</ThemedText>
        <TextInput style={[styles.input, {width: 80, paddingVertical: 4, height: 32, textAlign:'center', color:theme.text, borderColor: theme.icon}]} value={val} onChangeText={(v) => update(k, v)} keyboardType="numeric"/>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{flex:1}}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}><Ionicons name="arrow-back" size={28} color={theme.text} /></TouchableOpacity>
        <ThemedText type="subtitle">{logId ? t('settings', lang) : t('ai_analysis', lang)}</ThemedText>
        <TouchableOpacity onPress={handleSave}><Ionicons name="save" size={28} color={theme.tint} /></TouchableOpacity>
      </View>

      {isLoading ? <ActivityIndicator size="large" style={{marginTop: 50}}/> : 
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.dateTimeRow}>
            <TouchableOpacity onPress={() => setShowDatePicker(true)} style={styles.dateBtn}><Ionicons name="calendar-outline" size={20} color={theme.text} /><ThemedText style={{marginLeft: 8}}>{format(recordDate, "yyyy-MM-dd")}</ThemedText></TouchableOpacity>
            <TouchableOpacity onPress={() => setShowTimePicker(true)} style={styles.dateBtn}><Ionicons name="time-outline" size={20} color={theme.text} /><ThemedText style={{marginLeft: 8}}>{format(recordDate, "HH:mm")}</ThemedText></TouchableOpacity>
        </View>
        {showDatePicker && <DateTimePicker value={recordDate} mode="date" onChange={handleDateChange} />}
        {showTimePicker && <DateTimePicker value={recordDate} mode="time" onChange={handleTimeChange} />}

        {imageUri && (
            <View style={styles.imagePreview}>
                <Image source={{ uri: imageUri }} style={{ width: '100%', height: 200, borderRadius: 12 }} />
                {isAnalyzing && <View style={styles.analyzingOverlay}><ActivityIndicator color="#FFF" /><ThemedText style={{color:'#FFF'}}>{t('analyzing', lang)}</ThemedText></View>}
            </View>
        )}

        {(aiComposition || aiAdvice) && (
            <ThemedView style={[styles.card, {borderColor: theme.tint, borderWidth: 1, backgroundColor: theme.tint + '10'}]}>
                <View style={{flexDirection:'row', alignItems:'center', marginBottom:8}}><Ionicons name="sparkles" size={20} color={theme.tint} /><ThemedText type="defaultSemiBold" style={{marginLeft:8, color:theme.tint}}>{t('ai_analysis', lang)}</ThemedText></View>
                {aiComposition ? <View style={{marginBottom:8}}><ThemedText style={{fontWeight:'bold'}}>{t('composition', lang)}:</ThemedText><ThemedText>{aiComposition}</ThemedText></View> : null}
                {aiAdvice ? <View><ThemedText style={{fontWeight:'bold'}}>{t('suggestion', lang)}:</ThemedText><ThemedText>{aiAdvice}</ThemedText></View> : null}
            </ThemedView>
        )}

        <View style={styles.mealSelector}>
            {MEAL_PERIODS.map((meal) => (
                <TouchableOpacity key={meal.id} style={[styles.mealBtn, selectedMeal === meal.id && { backgroundColor: theme.tint }]} onPress={() => {setSelectedMeal(meal.id); setMealManuallyChanged(true);}}>
                    <ThemedText style={{ color: selectedMeal === meal.id ? '#FFF' : theme.text }}>{t(meal.id as any, lang) || meal.label}</ThemedText>
                </TouchableOpacity>
            ))}
        </View>

        <ThemedView style={styles.card}>
            <ThemedText type="defaultSemiBold" style={{marginBottom: 8}}>{t('food_name', lang)}</ThemedText>
            <TextInput style={[styles.input, { color: theme.text, borderColor: theme.icon }]} value={foodName} onChangeText={setFoodName} placeholder={t('food_name_placeholder', lang)} placeholderTextColor={theme.icon} />
            {barcode && <View style={{flexDirection:'row', marginTop: 8}}><Ionicons name="barcode-outline" size={16} color={theme.icon} /><ThemedText style={{fontSize: 12, color: theme.icon}}>{t('barcode_scanned', lang)} {barcode}</ThemedText></View>}
        </ThemedView>

        <ThemedView style={styles.card}>
            <View style={styles.rowBetween}>
                <ThemedText type="defaultSemiBold">{t('portion', lang)}</ThemedText>
                <TouchableOpacity onPress={() => setInputMode(prev => prev === 'serving' ? 'weight' : 'serving')}><ThemedText style={{color: theme.tint}}>⇄ {inputMode === 'serving' ? 'g' : 'Qty'}</ThemedText></TouchableOpacity>
            </View>
            {inputMode === 'serving' ? (
                <View style={styles.rowInputs}>
                    <View style={{flex: 1}}><ThemedText style={styles.labelSmall}>Qty</ThemedText><TextInput style={[styles.input, {color:theme.text, borderColor:theme.icon}]} value={servings} onChangeText={setServings} keyboardType="numeric"/></View>
                    <ThemedText style={{alignSelf: 'flex-end', marginBottom: 12}}>X</ThemedText>
                    <View style={{flex: 1}}><ThemedText style={styles.labelSmall}>Unit(g)</ThemedText><TextInput style={[styles.input, {color:theme.text, borderColor:theme.icon}]} value={unitWeight} onChangeText={setUnitWeight} keyboardType="numeric"/></View>
                </View>
            ) : (
                <View><ThemedText style={styles.labelSmall}>Total(g)</ThemedText><TextInput style={[styles.input, {color:theme.text, borderColor:theme.icon}]} value={totalWeight} onChangeText={setTotalWeight} keyboardType="numeric"/></View>
            )}
            <View style={styles.totalSummary}><ThemedText type="defaultSemiBold" style={{color: theme.tint}}>Total: {totalWeight} g</ThemedText><ThemedText>{t('calories', lang)}: {calculatedTotal} kcal</ThemedText></View>
        </ThemedView>

        <ThemedView style={styles.card}>
            <ThemedText type="defaultSemiBold" style={{marginBottom: 12}}>Nutrients / 100g</ThemedText>
            <NutrientRow label={t('calories', lang)} val={baseNutrients.calories} k="calories" update={updateNutrient} isMain/>
            <NutrientRow label={t('protein', lang)} val={baseNutrients.protein} k="protein" update={updateNutrient} isMain/>
            <NutrientRow label={t('fat', lang)} val={baseNutrients.fat} k="fat" update={updateNutrient} isMain/>
            <View style={{paddingLeft: 16}}>
                <NutrientRow label={t('saturated_fat', lang)} val={baseNutrients.saturatedFat} k="saturatedFat" update={updateNutrient}/>
                <NutrientRow label={t('trans_fat', lang)} val={baseNutrients.transFat} k="transFat" update={updateNutrient}/>
                <NutrientRow label={t('cholesterol', lang)} val={baseNutrients.cholesterol} k="cholesterol" update={updateNutrient}/>
            </View>
            <NutrientRow label={t('carbs', lang)} val={baseNutrients.carbs} k="carbs" update={updateNutrient} isMain/>
            <View style={{paddingLeft: 16}}>
                <NutrientRow label={t('sugar', lang)} val={baseNutrients.sugar} k="sugar" update={updateNutrient}/>
                <NutrientRow label={t('fiber', lang)} val={baseNutrients.fiber} k="fiber" update={updateNutrient}/>
            </View>
            <NutrientRow label={t('sodium', lang)} val={baseNutrients.sodium} k="sodium" update={updateNutrient} isMain/>
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