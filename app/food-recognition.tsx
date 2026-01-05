import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { View, ScrollView, Image, ActivityIndicator, Pressable, TextInput, Alert, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as FileSystem from 'expo-file-system';
import { ThemedText } from "@/components/themed-text";
import { useThemeColor } from "@/hooks/use-theme-color";
import { analyzeFoodImage } from "@/lib/gemini";
import { db, createFoodLog } from "@/lib/db"; 
import { foodItems } from "@/drizzle/schema";
import { NumberInput } from "@/components/NumberInput";
import { t, useLanguage } from "@/lib/i18n";
import { eq } from "drizzle-orm";

export default function FoodRecognitionScreen() {
  const { imageUri, base64, mode, barcode } = useLocalSearchParams(); // 接收 barcode
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const lang = useLanguage();
  
  const [loading, setLoading] = useState(false);
  const [foodName, setFoodName] = useState("");
  const [displayBarcode, setDisplayBarcode] = useState<string | null>(null);
  
  // 營養素狀態
  const [inputType, setInputType] = useState<'SERVING' | 'GRAM'>('SERVING');
  const [inputQty, setInputQty] = useState("1");
  const [unitWeight, setUnitWeight] = useState("100"); 
  
  const [baseCal, setBaseCal] = useState("0");
  const [basePro, setBasePro] = useState("0");
  const [baseCarb, setBaseCarb] = useState("0");
  const [baseFat, setBaseFat] = useState("0");
  const [baseSod, setBaseSod] = useState("0");
  const [baseSugar, setBaseSugar] = useState("0");
  const [baseSatFat, setBaseSatFat] = useState("0");
  const [baseTransFat, setBaseTransFat] = useState("0");
  const [baseChol, setBaseChol] = useState("0");
  const [baseZinc, setBaseZinc] = useState("0");
  const [baseMag, setBaseMag] = useState("0");
  const [baseIron, setBaseIron] = useState("0");

  const [aiAnalysis, setAiAnalysis] = useState<{composition?: string, suggestion?: string} | null>(null);

  const backgroundColor = useThemeColor({}, "background");
  const cardBackground = useThemeColor({}, "cardBackground");
  const tintColor = useThemeColor({}, "tint");
  const textSecondary = useThemeColor({}, "textSecondary");

  // 載入 AI 分析或 DB 查到的數據
  const loadProductData = (p: any) => {
    setBaseCal(String(p.calories || p.calories_100g || 0));
    setBasePro(String(p.protein || p.protein_100g || 0));
    setBaseCarb(String(p.carbs || p.carbs_100g || 0));
    setBaseFat(String(p.fat || p.fat_100g || 0));
    setBaseSod(String(p.sodium || p.sodium_100g || 0));
    setBaseSugar(String(p.sugar || p.sugar_100g || 0));
    setBaseSatFat(String(p.saturated_fat || p.saturated_fat_100g || 0));
    setBaseTransFat(String(p.trans_fat || p.trans_fat_100g || 0));
    setBaseChol(String(p.cholesterol || p.cholesterol_100g || 0));
    setBaseZinc(String(p.zinc || p.zinc_100g || 0));
    setBaseMag(String(p.magnesium || p.magnesium_100g || 0));
    setBaseIron(String(p.iron || p.iron_100g || 0));
    
    // 若 AI 有估算重量
    if (p.estimated_weight_g) {
        setUnitWeight(String(p.estimated_weight_g));
        setInputType('SERVING');
        setInputQty('1');
    }
    // 儲存 AI 分析文字
    if (p.composition || p.suggestion) {
        setAiAnalysis({ composition: p.composition, suggestion: p.suggestion });
    }
  };

  useEffect(() => {
    let isMounted = true;
    async function process() {
      // 1. 設定 Barcode
      if (barcode) setDisplayBarcode(barcode as string);

      // 2. 執行 AI 分析 (若有圖片)
      if (imageUri || base64) {
        setLoading(true);
        try {
          let imageBase64 = base64 as string;
          if (!imageBase64 && imageUri) {
            imageBase64 = await FileSystem.readAsStringAsync(imageUri as string, { encoding: FileSystem.EncodingType.Base64 });
          }

          if (imageBase64) {
            // 呼叫 Gemini
            // 注意：這裡需 import getUserProfile，但為了簡化，若您沒有該函式可傳 null 或 {}
            // const profile = await getUserProfile(); 
            const result = await analyzeFoodImage(imageBase64, lang, {}); 
            if (isMounted && result) {
              setFoodName(result.foodName);
              loadProductData(result);
            }
          }
        } catch (e) {
          console.error(e);
          if (isMounted) Alert.alert(t('error', lang), t('ai_failed', lang) || "AI Analysis Failed");
        } finally {
          if (isMounted) setLoading(false);
        }
      }
    }
    process();
    return () => { isMounted = false; };
  }, [base64, imageUri, barcode]);

  const handleSave = async () => {
    if (!foodName) return Alert.alert(t('food_name_placeholder', lang));
    
    // 計算總重
    let totalWeight = 0;
    if (inputType === 'SERVING') {
      totalWeight = (parseFloat(inputQty) || 1) * (parseFloat(unitWeight) || 100);
    } else {
      totalWeight = parseFloat(inputQty) || 100;
    }
    const ratio = totalWeight / 100;
    
    // 1. 準備商品資料
    const itemData = {
      name: foodName,
      barcode: displayBarcode, // [重要] 儲存條碼
      baseAmount: parseFloat(unitWeight) || 100,
      aiSummary: aiAnalysis ? JSON.stringify(aiAnalysis) : null,
      
      calories: parseFloat(baseCal) || 0,
      proteinG: parseFloat(basePro) || 0,
      fatG: parseFloat(baseFat) || 0,
      carbsG: parseFloat(baseCarb) || 0,
      sodiumMg: parseFloat(baseSod) || 0,
      sugarG: parseFloat(baseSugar) || 0,
      saturatedFatG: parseFloat(baseSatFat) || 0,
      transFatG: parseFloat(baseTransFat) || 0,
      cholesterolMg: parseFloat(baseChol) || 0,
      zincMg: parseFloat(baseZinc) || 0,
      magnesiumMg: parseFloat(baseMag) || 0,
      ironMg: parseFloat(baseIron) || 0,
      updatedAt: new Date()
    };

    try {
        let foodId: number;
        // 檢查是否已存在該 Barcode 的商品
        if (displayBarcode) {
            const existing = await db.select().from(foodItems).where(eq(foodItems.barcode, displayBarcode)).limit(1);
            if (existing.length > 0) {
                // 更新既有商品 (AI 分析可能比較準或新)
                await db.update(foodItems).set(itemData).where(eq(foodItems.id, existing[0].id));
                foodId = existing[0].id;
            } else {
                // 新增商品
                const res = await db.insert(foodItems).values(itemData).returning({insertedId: foodItems.id});
                foodId = res[0].insertedId;
            }
        } else {
            // 無 Barcode，直接新增
            const res = await db.insert(foodItems).values(itemData).returning({insertedId: foodItems.id});
            foodId = res[0].insertedId;
        }

        // 2. 寫入飲食紀錄 (Log)
        const now = new Date();
        const h = now.getHours();
        let meal = 'breakfast';
        if(h>=10) meal='lunch';
        if(h>=14) meal='afternoon_tea';
        if(h>=17) meal='dinner';
        if(h>=21) meal='late_night';

        await createFoodLog({
            date: now.toISOString().split('T')[0],
            mealTimeCategory: meal,
            loggedAt: now,
            foodItemId: foodId,
            foodName: foodName,
            servingType: inputType === 'SERVING' ? 'serving' : 'weight',
            servingAmount: parseFloat(inputQty),
            unitWeightG: parseFloat(unitWeight),
            totalWeightG: totalWeight,
            
            // 營養素計算 (每100g數值 * 比例)
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
            
            imageUrl: imageUri as string,
            aiAnalysisLog: itemData.aiSummary
        });

        Alert.alert(t('success', lang), t('save_success', lang), [{ 
            text: "OK", 
            onPress: () => {
                if (router.canDismiss()) router.dismissAll();
                router.replace("/(tabs)");
            }
        }]);

    } catch (e) {
        console.error("Save Error:", e);
        Alert.alert(t('error', lang), "Save failed");
    }
  };

  // 即時計算總熱量
  let liveTotalWeight = 0;
  if (inputType === 'SERVING') {
    liveTotalWeight = (parseFloat(inputQty) || 0) * (parseFloat(unitWeight) || 0);
  } else {
    liveTotalWeight = parseFloat(inputQty) || 0;
  }
  const currentTotalCal = Math.round((parseFloat(baseCal) || 0) * (liveTotalWeight / 100));

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center', backgroundColor }]}>
        <ActivityIndicator size="large" color={tintColor} />
        <ThemedText style={{marginTop: 20}}>{t('processing', lang)}</ThemedText>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor }]}>
       <View style={[styles.header, { paddingTop: Math.max(insets.top, 20) }]}>
          <Pressable onPress={() => router.back()}><ThemedText>{t('cancel', lang)}</ThemedText></Pressable>
          <ThemedText type="subtitle">{foodName || t('food_name', lang)}</ThemedText>
          <Pressable onPress={handleSave}><ThemedText style={{color: tintColor, fontWeight:'bold'}}>{t('confirm_save', lang)}</ThemedText></Pressable>
       </View>
       
       <ScrollView style={{padding: 16}}>
          {imageUri && <Image source={{ uri: imageUri as string }} style={{ width: '100%', height: 200, borderRadius: 12, marginBottom: 16 }} />}
          
          <View style={[styles.card, {backgroundColor: cardBackground}]}>
             <ThemedText style={{marginBottom: 4, fontSize: 12, color: textSecondary}}>📦 {t('food_name', lang)}</ThemedText>
             <TextInput style={[styles.textInput, {color: tintColor}]} value={foodName} onChangeText={setFoodName} placeholder={t('food_name_placeholder', lang)}/>
             
             {/* [UI 確認] 顯示 Barcode */}
             {displayBarcode && (
               <View style={{flexDirection:'row', alignItems:'center', marginTop: 4}}>
                  <ThemedText style={{fontSize: 10, color: textSecondary}}>{t('barcode_label', lang) || "Barcode"}: </ThemedText>
                  <ThemedText style={{fontSize: 12, color: tintColor, fontWeight:'bold'}}>{displayBarcode}</ThemedText>
               </View>
             )}

             {/* Input Qty Section */}
             <View style={{marginTop: 16, padding: 12, backgroundColor: '#F5F5F5', borderRadius: 8}}>
                <View style={{flexDirection: 'row', marginBottom: 10, justifyContent: 'center', gap: 10}}>
                   <Pressable onPress={() => setInputType('SERVING')} style={[styles.modeBtn, inputType==='SERVING' && {backgroundColor: tintColor}]}>
                      <ThemedText style={{color: inputType==='SERVING'?'white':textSecondary, fontSize: 12}}>{t('input_serving_mode', lang)}</ThemedText>
                   </Pressable>
                   <Pressable onPress={() => setInputType('GRAM')} style={[styles.modeBtn, inputType==='GRAM' && {backgroundColor: tintColor}]}>
                      <ThemedText style={{color: inputType==='GRAM'?'white':textSecondary, fontSize: 12}}>{t('input_gram_mode', lang)}</ThemedText>
                   </Pressable>
                </View>

                <View style={{flexDirection: 'row', gap: 10}}>
                   <View style={{flex: 1}}>
                      <NumberInput 
                        label={inputType==='SERVING' ? t('intake_quantity', lang) : t('total_intake_gram', lang)} 
                        value={inputQty} 
                        onChange={setInputQty} 
                        step={inputType==='SERVING' ? 0.5 : 10} 
                      />
                   </View>
                   {inputType === 'SERVING' && (
                     <View style={{flex: 1}}>
                        <NumberInput label={t('serving_weight', lang)} value={unitWeight} onChange={setUnitWeight} step={10} />
                     </View>
                   )}
                </View>
                <ThemedText style={{textAlign:'center', fontSize: 14, color: tintColor, fontWeight: 'bold', marginTop: 8}}>
                  {t('total_calories_display', lang)}: {currentTotalCal} kcal
                </ThemedText>
             </View>

             {/* AI Analysis Result */}
             {aiAnalysis && (
               <View style={{marginTop: 16, padding: 12, backgroundColor: '#E3F2FD', borderRadius: 8, borderLeftWidth: 4, borderLeftColor: '#2196F3'}}>
                 <ThemedText style={{fontWeight:'bold', color: '#1565C0', marginBottom: 4}}>🤖 {t('ai_analysis_result', lang)}</ThemedText>
                 {aiAnalysis.composition ? <ThemedText style={{fontSize: 13, marginBottom: 4}}>🥘 {aiAnalysis.composition}</ThemedText> : null}
                 {aiAnalysis.suggestion ? <ThemedText style={{fontSize: 13}}>💡 {aiAnalysis.suggestion}</ThemedText> : null}
               </View>
             )}

             {/* Nutrition Inputs */}
             <View style={{marginTop: 20}}>
                <ThemedText style={{fontWeight: 'bold', marginBottom: 10}}>{t('per_100g_base', lang)}</ThemedText>
                
                <View style={styles.nutrientRow}>
                   <View style={{flex:1}}><NumberInput label={`🔥 ${t('calories', lang)}`} value={baseCal} onChange={setBaseCal} step={10} /></View>
                   <View style={{flex:1}}><NumberInput label={`🧂 ${t('sodium_mg', lang)}`} value={baseSod} onChange={setBaseSod} step={50} /></View>
                </View>

                <ThemedText style={styles.sectionTitle}>{t('macro_nutrients', lang)}</ThemedText>
                <View style={styles.nutrientRow}>
                   <View style={{flex:1}}><NumberInput label={`🥩 ${t('protein_g', lang)}`} value={basePro} onChange={setBasePro} /></View>
                   <View style={{flex:1}}><NumberInput label={`🍚 ${t('carbs_g', lang)}`} value={baseCarb} onChange={setBaseCarb} /></View>
                </View>
                <View style={styles.nutrientRow}>
                   <View style={{flex:1}}><NumberInput label={`🥑 ${t('fat_g', lang)}`} value={baseFat} onChange={setBaseFat} /></View>
                   <View style={{flex:1}}><NumberInput label={`🍬 ${t('sugar', lang)}`} value={baseSugar} onChange={setBaseSugar} /></View>
                </View>

                <ThemedText style={styles.sectionTitle}>{t('detailed_fats', lang)}</ThemedText>
                <View style={styles.nutrientRow}>
                   <View style={{flex:1}}><NumberInput label={`🥥 ${t('sat_fat', lang)}`} value={baseSatFat} onChange={setBaseSatFat} /></View>
                   <View style={{flex:1}}><NumberInput label={`🍟 ${t('trans_fat', lang)}`} value={baseTransFat} onChange={setBaseTransFat} /></View>
                </View>
             </View>
          </View>
          <View style={{height: 50}}/>
       </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', padding: 16, alignItems: 'center' },
  card: { padding: 16, borderRadius: 16 },
  textInput: { fontSize: 18, fontWeight: 'bold', borderBottomWidth: 1, borderColor: '#ddd', paddingVertical: 8 },
  nutrientRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  sectionTitle: { marginTop: 15, marginBottom: 5, fontSize: 12, fontWeight: 'bold', color: '#888' },
  modeBtn: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 16, borderWidth: 1, borderColor: '#ccc' }
});