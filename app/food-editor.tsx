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
  Image,
  Dimensions
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { format } from "date-fns";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { db } from "@/lib/db";
import { foodItems, foodLogs, userProfiles } from "@/drizzle/schema";
import { eq } from "drizzle-orm";
import { analyzeFoodImage, analyzeFoodText } from "@/lib/gemini";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { t, useLanguage } from "@/lib/i18n";

const SCREEN_WIDTH = Dimensions.get('window').width;
const MEAL_PERIODS = [
  { id: "breakfast", start: 5, end: 10 },
  { id: "lunch", start: 10, end: 14 },
  { id: "afternoon_tea", start: 14, end: 16 },
  { id: "dinner", start: 16, end: 20 },
  { id: "late_night", start: 20, end: 29 }, 
];
const DEFAULT_NUTRIENTS = {
  calories: "0", protein: "0", fat: "0", saturatedFat: "0", transFat: "0",
  carbs: "0", sugar: "0", fiber: "0", sodium: "0", cholesterol: "0", magnesium: "0", zinc: "0", iron: "0"
};

// [UI] 帶有 Emoji 的營養素輸入列
interface NutrientRowProps {
    label: string;
    emoji: string;
    val: string;
    k: string;
    update: (k: any, v: string) => void;
    isMain?: boolean;
    unit?: string;
    theme: any;
}

const NutrientRow = ({ label, emoji, val, k, update, isMain, unit='g', theme }: NutrientRowProps) => (
    <View style={{flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom: 12}}>
        <View style={{flexDirection:'row', alignItems:'center'}}>
            <ThemedText style={{marginRight: 6, fontSize: isMain?16:14}}>{emoji}</ThemedText>
            <ThemedText style={{fontSize: isMain?14:13, fontWeight: isMain?'600':'400', color: theme.text}}>
                {label} <ThemedText style={{fontSize:10, color:'#888'}}>({unit})</ThemedText>
            </ThemedText>
        </View>
        <TextInput
            style={[styles.input, {width: 90, paddingVertical: 6, textAlign:'center', color:theme.text, borderColor: theme.icon}]}
            value={val}
            onChangeText={(v) => update(k, v)}
            keyboardType="numeric"
            placeholder="0"
            placeholderTextColor="#999"
        />
    </View>
);

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
  
  const mealScrollRef = useRef<ScrollView>(null);

  const [foodName, setFoodName] = useState("");
  const [brand, setBrand] = useState(""); 
  const [barcode, setBarcode] = useState<string | null>(null);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [dbFoodId, setDbFoodId] = useState<number | null>(null); 
  
  const [inputMode, setInputMode] = useState<"serving" | "weight">("serving");
  const [servings, setServings] = useState("1");
  const [unitWeight, setUnitWeight] = useState("100"); 
  const [totalWeight, setTotalWeight] = useState("100");

  const [baseNutrients, setBaseNutrients] = useState(DEFAULT_NUTRIENTS);
  const [initialBaseNutrients, setInitialBaseNutrients] = useState<typeof DEFAULT_NUTRIENTS | null>(null);
  const [initialUnitWeight, setInitialUnitWeight] = useState("100");

  // [修改 1] 移除 isInitialized Ref，確保每次 params 變更時都能重新讀取數據
  // const isInitialized = useRef(false);

  useEffect(() => {
      if (mealScrollRef.current) {
          const index = MEAL_PERIODS.findIndex(m => m.id === selectedMeal);
          if (index !== -1) {
              const buttonWidth = 100; 
              const centerOffset = (SCREEN_WIDTH / 2) - (buttonWidth / 2) - 16;
              const x = index * buttonWidth - centerOffset;
              mealScrollRef.current.scrollTo({ x: Math.max(0, x), animated: true });
          }
      }
  }, [selectedMeal]);

  useEffect(() => {
    if (inputMode === "serving") {
      const s = parseFloat(servings) || 0;
      const u = parseFloat(unitWeight) || 0;
      const total = s * u;
      setTotalWeight(String(Number(total.toFixed(2))));
    }
  }, [servings, unitWeight, inputMode]);

  const calculatedTotal = useMemo(() => {
    const w = parseFloat(totalWeight) || 0;
    const ratio = w / 100; 
    return Math.round((parseFloat(baseNutrients.calories) || 0) * ratio);
  }, [totalWeight, baseNutrients.calories]);

  const safeStr = (val: any) => (val === null || val === undefined || isNaN(val)) ? "0" : String(val);
  const mapDbToState = (item: any) => ({
      calories: safeStr(item.calories), protein: safeStr(item.proteinG), fat: safeStr(item.fatG),
      saturatedFat: safeStr(item.saturatedFatG), transFat: safeStr(item.transFatG),
      carbs: safeStr(item.carbsG), sugar: safeStr(item.sugarG), fiber: safeStr(item.fiberG),
      sodium: safeStr(item.sodiumMg), cholesterol: safeStr(item.cholesterolMg),
      magnesium: safeStr(item.magnesiumMg), zinc: safeStr(item.zincMg), iron: safeStr(item.ironMg)
  });

  // [修改 2] 將 params 加入依賴陣列，並加入除錯訊息
  useEffect(() => {
    // if (isInitialized.current) return;
    // isInitialized.current = true;
    
    async function init() {
        console.log("[FoodEditor] Initializing with params:", JSON.stringify(params, null, 2));
        
        try {
            if (params.logId) {
                const id = parseInt(params.logId as string);
                const isClone = params.clone === "true"; 
                if (!isClone) setLogId(id);

                const logRes = await db.select().from(foodLogs).where(eq(foodLogs.id, id));
                if (logRes.length > 0) {
                    const log = logRes[0];
                    const targetDate = isClone ? new Date() : new Date(log.loggedAt);
                    setRecordDate(targetDate);
                    
                    if (isClone) { updateCategoryByTime(targetDate); setMealManuallyChanged(false); }
                    else { setSelectedMeal(log.mealTimeCategory); setMealManuallyChanged(true); }
                    
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
                            setBrand(item.brand || "");
                            setBarcode(item.barcode); 
                            setUnitWeight(String(item.baseAmount || "100")); 
                            setInitialUnitWeight(String(item.baseAmount || "100"));

                            if (item.aiSummary) {
                                try {
                                    const parsed = JSON.parse(item.aiSummary);
                                    setAiComposition(parsed.composition || "");
                                    setAiAdvice(parsed.suggestion || "");
                                } catch(e){}
                            }
                            const nutrients = mapDbToState(item);
                            setBaseNutrients(nutrients);
                            setInitialBaseNutrients(nutrients);
                        }
                    }
                }
            } 
            else {
                const now = new Date();
                setRecordDate(now);
                updateCategoryByTime(now);

                if (params.barcode) setBarcode(params.barcode as string);

                if (params.productData) {
                    try {
                        const prod = JSON.parse(params.productData as string);
                        console.log("[FoodEditor] Product Data Source:", prod.source); // [除錯] 確認來源
                        console.log("[FoodEditor] Product Name:", prod.name); // [除錯] 確認名稱

                        setFoodName(prod.name || "");
                        setBrand(prod.brand || "");
                        if (prod.stdWeight) {
                            setUnitWeight(String(prod.stdWeight));
                            setInitialUnitWeight(String(prod.stdWeight));
                        }
                        if (prod.aiSummary) {
                            try {
                                const parsed = JSON.parse(prod.aiSummary);
                                setAiComposition(parsed.composition || "");
                                setAiAdvice(parsed.suggestion || "");
                            } catch(e){}
                        }
                        const nutrients = {
                            ...DEFAULT_NUTRIENTS,
                            calories: safeStr(prod.cal), protein: safeStr(prod.pro), fat: safeStr(prod.fat),
                            carbs: safeStr(prod.carb), sodium: safeStr(prod.sod), sugar: safeStr(prod.sugar),
                            fiber: safeStr(prod.fiber), saturatedFat: safeStr(prod.saturatedFat), transFat: safeStr(prod.transFat),
                        };
                        setBaseNutrients(nutrients);
                        
                        // [關鍵] 如果來源是 local，設定 ID 以便後續進行 Update 而不是 Insert
                        if (prod.source === 'local' && prod.id) {
                             setDbFoodId(prod.id);
                             setInitialBaseNutrients(nutrients);
                             console.log("[FoodEditor] Linked to Local DB ID:", prod.id);
                        } else {
                             console.log("[FoodEditor] Using API Data or New Entry");
                        }
                    } catch (e) { console.error(e); }
                }

                if (params.imageUri) {
                    setImageUri(params.imageUri as string);
                    if (params.analyze === "true" && params.imageBase64) {
                        performAiAnalysis(params.imageBase64 as string, 'image');
                    }
                }
            }
        } catch (e) { console.error(e); } finally { setIsLoading(false); }
    }
    init();
  }, [params]); // [重要] 依賴 params 變更來重新執行 init

  const performAiAnalysis = async (input: string, type: 'image' | 'text') => {
      if (!input) return;
      setIsAnalyzing(true);
      try {
          const pRes = await db.select().from(userProfiles).limit(1);
          const profile = pRes[0] || {};
          let result;
          
          if (type === 'image') {
              result = await analyzeFoodImage(input, lang, profile);
          } else {
              result = await analyzeFoodText(input, lang, profile);
          }
          
          if (result) {
              if (type === 'text') setFoodName(result.foodName || input);
              else setFoodName(result.foodName || t('ai_analysis', lang));

              if (result.estimated_weight_g) {
                  setUnitWeight(String(result.estimated_weight_g));
                  setInputMode('serving');
                  setServings('1');
              }

              const w = result.estimated_weight_g || 100;
              const factor = (w > 0 && w !== 100) ? (100 / w) : 1;
              
              setBaseNutrients({
                  calories: (parseFloat(safeStr(result.calories)) * factor).toFixed(1),
                  protein: (parseFloat(safeStr(result.protein)) * factor).toFixed(1),
                  fat: (parseFloat(safeStr(result.fat)) * factor).toFixed(1),
                  carbs: (parseFloat(safeStr(result.carbs)) * factor).toFixed(1),
                  sodium: (parseFloat(safeStr(result.sodium)) * factor).toFixed(1),
                  sugar: (parseFloat(safeStr(result.sugar)) * factor).toFixed(1),
                  fiber: (parseFloat(safeStr(result.fiber)) * factor).toFixed(1),
                  saturatedFat: (parseFloat(safeStr(result.saturated_fat)) * factor).toFixed(1),
                  transFat: (parseFloat(safeStr(result.trans_fat)) * factor).toFixed(1),
                  cholesterol: (parseFloat(safeStr(result.cholesterol)) * factor).toFixed(1),
                  zinc: (parseFloat(safeStr(result.zinc)) * factor).toFixed(1),
                  magnesium: (parseFloat(safeStr(result.magnesium)) * factor).toFixed(1),
                  iron: (parseFloat(safeStr(result.iron)) * factor).toFixed(1),
              });

              setAiComposition(result.composition || "");
              setAiAdvice(result.suggestion || "");
          } else {
              Alert.alert(t('error', lang), t('read_failed', lang));
          }
      } catch (e) {
          Alert.alert(t('error', lang), "AI Error");
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
  
  const handleSave = async () => {
    if (!foodName || !totalWeight) return Alert.alert(t('error', lang), t('data_incomplete', lang));
    
    let isModified = false;
    if (initialBaseNutrients && dbFoodId) {
        const nutrientChanged = JSON.stringify(baseNutrients) !== JSON.stringify(initialBaseNutrients);
        const weightChanged = unitWeight !== initialUnitWeight;
        if (nutrientChanged || weightChanged) isModified = true;
    }
    
    if (dbFoodId && isModified) {
        Alert.alert(
            t('tip', lang),
            t('food_modified_msg', lang) || "Product details changed. Update original database item?",
            [
                { text: t('save_as_new', lang) || "Create New", onPress: () => saveToDb(true) },
                { text: t('update_original', lang) || "Overwrite", onPress: () => saveToDb(false) }
            ]
        );
    } else {
        saveToDb(false);
    }
  };

  const saveToDb = async (forceNewItem: boolean) => {
      try {
          const w = parseFloat(totalWeight) || 0;
          const ratio = w / 100;
          
          let foodId = dbFoodId;

          const itemData = {
              name: foodName,
              brand: brand,
              barcode: barcode,
              baseAmount: parseFloat(unitWeight) || 100,
              aiSummary: JSON.stringify({composition: aiComposition, suggestion: aiAdvice}),
              
              calories: parseFloat(baseNutrients.calories) || 0,
              proteinG: parseFloat(baseNutrients.protein) || 0,
              fatG: parseFloat(baseNutrients.fat) || 0,
              carbsG: parseFloat(baseNutrients.carbs) || 0,
              sodiumMg: parseFloat(baseNutrients.sodium) || 0,
              sugarG: parseFloat(baseNutrients.sugar) || 0,
              fiberG: parseFloat(baseNutrients.fiber) || 0,
              saturatedFatG: parseFloat(baseNutrients.saturatedFat) || 0,
              transFatG: parseFloat(baseNutrients.transFat) || 0,
              cholesterolMg: parseFloat(baseNutrients.cholesterol) || 0,
              magnesiumMg: parseFloat(baseNutrients.magnesium) || 0,
              zincMg: parseFloat(baseNutrients.zinc) || 0,
              ironMg: parseFloat(baseNutrients.iron) || 0,
              
              // [修正 3] 確保更新時間被寫入，讓 Barcode Scanner 排序能抓到最新
              updatedAt: new Date() 
          };

          console.log(`[FoodEditor] Saving Item. ForceNew: ${forceNewItem}, ID: ${foodId}`);
          
          if (forceNewItem || !foodId) {
              const res = await db.insert(foodItems).values(itemData).returning({insertedId: foodItems.id});
              foodId = res[0].insertedId;
              console.log(`[FoodEditor] Created new item ID: ${foodId}`);
          } else {
              await db.update(foodItems).set(itemData).where(eq(foodItems.id, foodId));
              console.log(`[FoodEditor] Updated item ID: ${foodId}`);
          }
          
          const logData = {
              date: format(recordDate, "yyyy-MM-dd"),
              mealTimeCategory: selectedMeal,
              loggedAt: recordDate,
              foodItemId: foodId,
              foodName: foodName,
              servingType: inputMode,
              servingAmount: parseFloat(servings),
              unitWeightG: parseFloat(unitWeight),
              totalWeightG: w,
              
              totalCalories: itemData.calories * ratio,
              totalProteinG: itemData.proteinG * ratio,
              totalFatG: itemData.fatG * ratio,
              totalCarbsG: itemData.carbsG * ratio,
              totalSodiumMg: itemData.sodiumMg * ratio,
              totalSugarG: itemData.sugarG * ratio,
              totalFiberG: itemData.fiberG * ratio,
              totalSaturatedFatG: itemData.saturatedFatG * ratio,
              totalTransFatG: itemData.transFatG * ratio,
              totalCholesterolMg: itemData.cholesterolMg * ratio,
              totalMagnesiumMg: itemData.magnesiumMg * ratio,
              totalZincMg: itemData.zincMg * ratio,
              totalIronMg: itemData.ironMg * ratio,
              
              imageUrl: imageUri,
              aiAnalysisLog: itemData.aiSummary
          };

          if (logId) await db.update(foodLogs).set(logData).where(eq(foodLogs.id, logId));
          else await db.insert(foodLogs).values(logData);
          
          Alert.alert(t('success', lang), t('save_success', lang), [{ text: "OK", onPress: () => {
             if (router.canDismiss()) router.dismissAll();
             router.replace("/(tabs)");
          }}]);
      } catch (e) { 
          console.error("[Save Error]", e); 
          Alert.alert(t('error', lang), "Save Failed"); 
      }
  };

  const updateNutrient = (key: keyof typeof baseNutrients, val: string) => { setBaseNutrients(prev => ({ ...prev, [key]: val })); };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{flex:1}}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}><Ionicons name="arrow-back" size={28} color={theme.text} /></TouchableOpacity>
        <ThemedText type="subtitle">{logId ? t('edit', lang) : (barcode ? t('product_info', lang) : t('ai_analysis', lang))}</ThemedText>
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
                {isAnalyzing && <View style={styles.analyzingOverlay}><ActivityIndicator color="#FFF" /><ThemedText style={{color:'#FFF', marginTop:8}}>{t('analyzing', lang)}</ThemedText></View>}
            </View>
        )}

        {(aiComposition || aiAdvice) && (
            <ThemedView style={[styles.card, {borderColor: theme.tint, borderWidth: 1, backgroundColor: theme.tint + '10'}]}>
                <View style={{flexDirection:'row', alignItems:'center', marginBottom:8}}><Ionicons name="sparkles" size={20} color={theme.tint} /><ThemedText type="defaultSemiBold" style={{marginLeft:8, color:theme.tint}}>{t('ai_analysis', lang)}</ThemedText></View>
                {aiComposition ? <View style={{marginBottom:8}}><ThemedText style={{fontWeight:'bold'}}>{t('composition', lang)}:</ThemedText><ThemedText>{aiComposition}</ThemedText></View> : null}
                {aiAdvice ? <View><ThemedText style={{fontWeight:'bold'}}>{t('suggestion', lang)}:</ThemedText><ThemedText>{aiAdvice}</ThemedText></View> : null}
            </ThemedView>
        )}

        <View style={{marginBottom: 16}}>
            <ScrollView ref={mealScrollRef} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap: 8, paddingHorizontal: 4}}>
                {MEAL_PERIODS.map((meal) => (
                    <TouchableOpacity key={meal.id} style={[styles.mealBtn, selectedMeal === meal.id && { backgroundColor: theme.tint, borderColor: theme.tint }]} onPress={() => {setSelectedMeal(meal.id); setMealManuallyChanged(true);}}>
                        <ThemedText style={{ color: selectedMeal === meal.id ? '#FFF' : theme.text, fontWeight: selectedMeal===meal.id?'bold':'normal' }}>{t(meal.id as any, lang) || meal.label}</ThemedText>
                    </TouchableOpacity>
                ))}
            </ScrollView>
        </View>

        <ThemedView style={styles.card}>
            <ThemedText type="defaultSemiBold" style={{marginBottom: 8}}>📦 {t('food_name', lang)}</ThemedText>
            <View style={{flexDirection:'row', alignItems:'center'}}>
                <TextInput style={[styles.input, { color: theme.text, borderColor: theme.icon, flex: 1 }]} value={foodName} onChangeText={setFoodName} placeholder={t('food_name_placeholder', lang)} placeholderTextColor={theme.icon} />
                <TouchableOpacity onPress={() => performAiAnalysis(foodName, 'text')} disabled={isAnalyzing || !foodName} style={{marginLeft: 8, padding: 8, backgroundColor: (isAnalyzing || !foodName)?'#ccc':theme.tint, borderRadius: 8}}>
                    {isAnalyzing ? <ActivityIndicator color="#FFF" size="small"/> : <Ionicons name="sparkles" size={20} color="#FFF" />}
                </TouchableOpacity>
            </View>

            <View style={{marginTop: 12}}>
                <ThemedText style={{fontSize: 12, color: '#888', marginBottom: 4}}>{t('brand', lang) || "Brand (Optional)"}</ThemedText>
                <TextInput 
                    style={[styles.input, { color: theme.text, borderColor: theme.icon }]} 
                    value={brand} 
                    onChangeText={setBrand} 
                    placeholder={t('brand_placeholder', lang) || "e.g. 統一, 義美"} 
                    placeholderTextColor={theme.icon} 
                />
            </View>

            {barcode && <View style={{flexDirection:'row', marginTop: 8}}><Ionicons name="barcode-outline" size={16} color={theme.icon} /><ThemedText style={{fontSize: 12, color: theme.icon}}>{t('barcode_scanned', lang)} {barcode}</ThemedText></View>}
        </ThemedView>
        
        <ThemedView style={styles.card}>
            <View style={styles.rowBetween}>
                <ThemedText type="defaultSemiBold">⚖️ {t('portion', lang)}</ThemedText>
                <TouchableOpacity onPress={() => setInputMode(prev => prev === 'serving' ? 'weight' : 'serving')}>
                    <ThemedText style={{color: theme.tint, fontSize: 14}}>⇄ {inputMode === 'serving' ? t('switch_to_weight', lang) : t('switch_to_serving', lang)}</ThemedText>
                </TouchableOpacity>
            </View>
            {inputMode === 'serving' ? (
                <View style={styles.rowInputs}>
                    <View style={{flex: 1}}><ThemedText style={styles.labelSmall}>{t('portion_count', lang)}</ThemedText><TextInput style={[styles.input, {color:theme.text, borderColor:theme.icon}]} value={servings} onChangeText={setServings} keyboardType="numeric"/></View>
                    <ThemedText style={{alignSelf: 'flex-end', marginBottom: 12, marginHorizontal: 8}}>X</ThemedText>
                    <View style={{flex: 1}}><ThemedText style={styles.labelSmall}>{t('unit_weight', lang)}(g)</ThemedText><TextInput style={[styles.input, {color:theme.text, borderColor:theme.icon}]} value={unitWeight} onChangeText={setUnitWeight} keyboardType="numeric"/></View>
                </View>
            ) : (
                <View><ThemedText style={styles.labelSmall}>{t('total_weight_input', lang)}(g)</ThemedText><TextInput style={[styles.input, {color:theme.text, borderColor:theme.icon}]} value={totalWeight} onChangeText={setTotalWeight} keyboardType="numeric"/></View>
            )}
            <View style={styles.totalSummary}><ThemedText type="defaultSemiBold" style={{color: theme.tint}}>{t('total_label', lang)}: {totalWeight} g</ThemedText><ThemedText>{t('calories', lang)}: {calculatedTotal} kcal</ThemedText></View>
        </ThemedView>

        <ThemedView style={styles.card}>
            <ThemedText type="defaultSemiBold" style={{marginBottom: 12}}>📊 {t('val_per_100g', lang)}</ThemedText>
            <NutrientRow label={t('calories', lang)} emoji="🔥" val={baseNutrients.calories} k="calories" update={updateNutrient} isMain unit="kcal" theme={theme}/>
            <View style={styles.divider}/>
            <NutrientRow label={t('protein', lang)} emoji="🥩" val={baseNutrients.protein} k="protein" update={updateNutrient} isMain theme={theme}/>
            <View style={styles.divider}/>
            <NutrientRow label={t('fat', lang)} emoji="🥑" val={baseNutrients.fat} k="fat" update={updateNutrient} isMain theme={theme}/>
            <View style={{paddingLeft: 16}}>
                <NutrientRow label={t('saturated_fat', lang)} emoji="🥥" val={baseNutrients.saturatedFat} k="saturatedFat" update={updateNutrient} theme={theme}/>
                <NutrientRow label={t('trans_fat', lang)} emoji="🍟" val={baseNutrients.transFat} k="transFat" update={updateNutrient} theme={theme}/>
                <NutrientRow label={t('cholesterol', lang)} emoji="🥚" val={baseNutrients.cholesterol} k="cholesterol" update={updateNutrient} unit="mg" theme={theme}/>
            </View>
            <View style={styles.divider}/>
            <NutrientRow label={t('carbs', lang)} emoji="🍚" val={baseNutrients.carbs} k="carbs" update={updateNutrient} isMain theme={theme}/>
            <View style={{paddingLeft: 16}}>
                <NutrientRow label={t('sugar', lang)} emoji="🍬" val={baseNutrients.sugar} k="sugar" update={updateNutrient} theme={theme}/>
                <NutrientRow label={t('fiber', lang)} emoji="🥦" val={baseNutrients.fiber} k="fiber" update={updateNutrient} theme={theme}/>
            </View>
            <View style={styles.divider}/>
            <NutrientRow label={t('sodium', lang)} emoji="🧂" val={baseNutrients.sodium} k="sodium" update={updateNutrient} isMain unit="mg" theme={theme}/>
            <View style={{paddingLeft: 16}}>
                <NutrientRow label={t('zinc', lang)} emoji="🔩" val={baseNutrients.zinc} k="zinc" update={updateNutrient} unit="mg" theme={theme}/>
                <NutrientRow label={t('magnesium', lang)} emoji="🥬" val={baseNutrients.magnesium} k="magnesium" update={updateNutrient} unit="mg" theme={theme}/>
                <NutrientRow label={t('iron', lang)} emoji="🩸" val={baseNutrients.iron} k="iron" update={updateNutrient} unit="mg" theme={theme}/>
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
  mealBtn: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20, backgroundColor: 'rgba(120,120,120,0.1)', borderWidth:1, borderColor:'transparent', minWidth: 80, alignItems:'center' }, 
  card: { padding: 16, borderRadius: 12, marginBottom: 16, backgroundColor: 'rgba(120,120,120,0.05)' },
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, fontSize: 16, paddingVertical: 8 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  rowInputs: { flexDirection: 'row', alignItems: 'flex-end' },
  labelSmall: { fontSize: 12, color: '#888', marginBottom: 4 },
  totalSummary: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#eee', flexDirection: 'row', justifyContent: 'space-between' },
  divider: { height: 1, backgroundColor: '#eee', marginVertical: 8 },
  imagePreview: { marginBottom: 16 },
  analyzingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', borderRadius: 12 }
});