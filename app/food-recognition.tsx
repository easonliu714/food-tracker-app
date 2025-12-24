import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { View, ScrollView, Image, ActivityIndicator, Pressable, TextInput, Alert, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as FileSystem from 'expo-file-system';
import { ThemedText } from "@/components/themed-text";
import { useThemeColor } from "@/hooks/use-theme-color";
import { analyzeFoodImage } from "@/lib/gemini";
import { 
  saveProductLocal, saveFoodLogLocal, getProductByBarcode, 
  getProfileLocal, getFoodLogById, updateFoodLogLocal 
} from "@/lib/storage";
import { NumberInput } from "@/components/NumberInput";
import { t, useLanguage } from "@/lib/i18n";

export default function FoodRecognitionScreen() {
  const { imageUri, base64, mode, barcode, initialData, logId } = useLocalSearchParams();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const lang = useLanguage();
  
  const [loading, setLoading] = useState(false);
  const [foodName, setFoodName] = useState("");
  
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
  const [originalLog, setOriginalLog] = useState<any>(null);
  const [displayBarcode, setDisplayBarcode] = useState<string | null>(null);

  const backgroundColor = useThemeColor({}, "background");
  const cardBackground = useThemeColor({}, "cardBackground");
  const tintColor = useThemeColor({}, "tint");
  const textSecondary = useThemeColor({}, "textSecondary");

  const loadProductData = (p: any) => {
    setBaseCal(p.calories_100g?.toString() || "0");
    setBasePro(p.protein_100g?.toString() || "0");
    setBaseCarb(p.carbs_100g?.toString() || "0");
    setBaseFat(p.fat_100g?.toString() || "0");
    setBaseSod(p.sodium_100g?.toString() || "0");
    setBaseSugar(p.sugar_100g?.toString() || "0");
    setBaseSatFat(p.saturated_fat_100g?.toString() || "0");
    setBaseTransFat(p.trans_fat_100g?.toString() || "0");
    setBaseChol(p.cholesterol_100g?.toString() || "0");
    setBaseZinc(p.zinc_100g?.toString() || "0");
    setBaseMag(p.magnesium_100g?.toString() || "0");
    setBaseIron(p.iron_100g?.toString() || "0");
    
    if (p.aiAnalysis) setAiAnalysis(p.aiAnalysis);
    if (p.servingWeight) setUnitWeight(p.servingWeight.toString());
  };

  useEffect(() => {
    let isMounted = true;
    async function process() {
      if (barcode) setDisplayBarcode(barcode as string);

      if (mode === "EDIT" && logId) {
        const log = await getFoodLogById(Number(logId));
        if (log && isMounted) {
          setOriginalLog(log);
          setFoodName(log.foodName);
          if (log.barcode) {
             setDisplayBarcode(log.barcode);
             const p = await getProductByBarcode(log.barcode);
             if (p) loadProductData(p);
             else setBaseCal(log.totalCalories?.toString() || "0");
          } else {
             setBaseCal(log.totalCalories?.toString() || "0");
          }
        }
        return;
      }

      if (mode === "MANUAL") return;

      if (mode === "EXTERNAL_DB" && initialData) {
        try {
          const data = JSON.parse(initialData as string);
          if (isMounted) {
            setFoodName(data.foodName);
            loadProductData(data);
          }
        } catch(e) {}
        return;
      }

      if (mode === "BARCODE" && barcode) {
        const p = await getProductByBarcode(barcode as string);
        if (p && isMounted) {
          setFoodName(p.foodName);
          loadProductData(p);
        }
        return;
      }

      if (imageUri || base64 || mode === "AI") {
        setLoading(true);
        try {
          let imageBase64 = base64 as string;
          if (!imageBase64 && imageUri) {
            imageBase64 = await FileSystem.readAsStringAsync(imageUri as string, { encoding: FileSystem.EncodingType.Base64 });
          }

          if (imageBase64) {
            const profile = await getProfileLocal();
            const result = await analyzeFoodImage(imageBase64, lang, profile);
            if (isMounted && result) {
              setFoodName(result.foodName);
              loadProductData(result);
              setAiAnalysis({ composition: result.composition, suggestion: result.suggestion });
            }
          }
        } catch (e) {
          console.error(e);
          if (isMounted) Alert.alert(t('error_title', lang), t('ai_failed', lang));
        } finally {
          if (isMounted) setLoading(false);
        }
      }
    }
    process();
    return () => { isMounted = false; };
  }, [mode, base64, imageUri, initialData, barcode, logId]);

  const handleSave = async () => {
    if (!foodName) return Alert.alert(t('food_name_placeholder', lang));
    
    let totalWeight = 0;
    if (inputType === 'SERVING') {
      totalWeight = (parseFloat(inputQty) || 1) * (parseFloat(unitWeight) || 100);
    } else {
      totalWeight = parseFloat(inputQty) || 100;
    }
    const ratio = totalWeight / 100;
    
    const productData = {
      foodName,
      servingWeight: parseFloat(unitWeight),
      aiAnalysis: aiAnalysis,
      calories_100g: parseFloat(baseCal) || 0,
      protein_100g: parseFloat(basePro) || 0,
      carbs_100g: parseFloat(baseCarb) || 0,
      fat_100g: parseFloat(baseFat) || 0,
      sodium_100g: parseFloat(baseSod) || 0,
      sugar_100g: parseFloat(baseSugar) || 0,
      saturated_fat_100g: parseFloat(baseSatFat) || 0,
      trans_fat_100g: parseFloat(baseTransFat) || 0,
      cholesterol_100g: parseFloat(baseChol) || 0,
      zinc_100g: parseFloat(baseZinc) || 0,
      magnesium_100g: parseFloat(baseMag) || 0,
      iron_100g: parseFloat(baseIron) || 0,
    };

    const logData = {
      foodName,
      totalCalories: Math.round(productData.calories_100g * ratio),
      totalProteinG: Math.round(productData.protein_100g * ratio),
      totalCarbsG: Math.round(productData.carbs_100g * ratio),
      totalFatG: Math.round(productData.fat_100g * ratio),
      totalSodiumMg: Math.round(productData.sodium_100g * ratio),
      imageUri: imageUri as string,
      barcode: displayBarcode || undefined, 
    };

    if (displayBarcode) {
      await saveProductLocal(displayBarcode, productData);
    }

    if (mode === "EDIT" && originalLog) {
      if (originalLog.barcode) {
         const oldP = await getProductByBarcode(originalLog.barcode);
         if (oldP && oldP.calories_100g !== productData.calories_100g) {
            Alert.alert(
              t('save_db_confirm_title', lang), 
              t('save_db_confirm_msg', lang),
              [
                { 
                  text: t('yes_update_all', lang), 
                  onPress: async () => {
                    await saveProductLocal(originalLog.barcode, productData);
                    await updateFoodLogLocal({ ...originalLog, ...logData });
                    router.dismissTo("/");
                  }
                },
                {
                  text: t('no_update_current', lang),
                  onPress: async () => {
                    await updateFoodLogLocal({ ...originalLog, ...logData });
                    router.dismissTo("/");
                  }
                }
              ]
            );
            return;
         }
      }
      await updateFoodLogLocal({ ...originalLog, ...logData });
    } else {
      await saveFoodLogLocal(logData);
    }
    router.dismissTo("/"); 
  };

  let liveTotalWeight = 0;
  if (inputType === 'SERVING') {
    liveTotalWeight = (parseFloat(inputQty) || 0) * (parseFloat(unitWeight) || 0);
  } else {
    liveTotalWeight = parseFloat(inputQty) || 0;
  }
  const currentTotalCal = Math.round((parseFloat(baseCal) || 0) * (liveTotalWeight / 100));

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
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
             
             {displayBarcode && (
               <ThemedText style={{fontSize: 10, color: textSecondary, marginTop: 4}}>{t('barcode_label', lang)}: {displayBarcode}</ThemedText>
             )}

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

             {aiAnalysis && (
               <View style={{marginTop: 16, padding: 12, backgroundColor: '#E3F2FD', borderRadius: 8, borderLeftWidth: 4, borderLeftColor: '#2196F3'}}>
                 <ThemedText style={{fontWeight:'bold', color: '#1565C0', marginBottom: 4}}>🤖 {t('ai_analysis_result', lang)}</ThemedText>
                 <ThemedText style={{fontSize: 13, marginBottom: 4}}>🥘 <ThemedText style={{fontWeight:'bold'}}>{t('composition', lang)}:</ThemedText> {aiAnalysis.composition}</ThemedText>
                 <ThemedText style={{fontSize: 13}}>💡 <ThemedText style={{fontWeight:'bold'}}>{t('intake_advice', lang)}:</ThemedText> {aiAnalysis.suggestion}</ThemedText>
               </View>
             )}

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
                <View style={styles.nutrientRow}>
                   <View style={{flex:1}}><NumberInput label={`🥚 ${t('cholesterol', lang)}`} value={baseChol} onChange={setBaseChol} /></View>
                </View>

                <ThemedText style={styles.sectionTitle}>{t('minerals', lang)}</ThemedText>
                <View style={styles.nutrientRow}>
                   <View style={{flex:1}}><NumberInput label={`🔩 ${t('zinc', lang)}`} value={baseZinc} onChange={setBaseZinc} step={0.1} /></View>
                   <View style={{flex:1}}><NumberInput label={`🥬 ${t('magnesium', lang)}`} value={baseMag} onChange={setBaseMag} step={1} /></View>
                </View>
                <View style={styles.nutrientRow}>
                   <View style={{flex:1}}><NumberInput label={`🩸 ${t('iron', lang)}`} value={baseIron} onChange={setBaseIron} step={0.1} /></View>
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