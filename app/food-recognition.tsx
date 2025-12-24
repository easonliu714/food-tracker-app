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
  
  const [quantity, setQuantity] = useState("1");
  const [servingWeight, setServingWeight] = useState("100"); 
  
  // Base Nutrients (per 100g)
  const [baseCal, setBaseCal] = useState("0");
  const [basePro, setBasePro] = useState("0");
  const [baseCarb, setBaseCarb] = useState("0");
  const [baseFat, setBaseFat] = useState("0");
  const [baseSod, setBaseSod] = useState("0");
  // Advanced Nutrients
  const [baseSugar, setBaseSugar] = useState("0");
  const [baseSatFat, setBaseSatFat] = useState("0");
  const [baseTransFat, setBaseTransFat] = useState("0");
  const [baseChol, setBaseChol] = useState("0");
  const [baseZinc, setBaseZinc] = useState("0");
  const [baseMag, setBaseMag] = useState("0");
  const [baseIron, setBaseIron] = useState("0");

  const [aiAnalysis, setAiAnalysis] = useState<{composition?: string, suggestion?: string} | null>(null);
  const [originalLog, setOriginalLog] = useState<any>(null); // For Edit Mode comparison

  const backgroundColor = useThemeColor({}, "background");
  const cardBackground = useThemeColor({}, "cardBackground");
  const tintColor = useThemeColor({}, "tint");
  const textSecondary = useThemeColor({}, "textSecondary");

  useEffect(() => {
    let isMounted = true;

    async function process() {
      // Mode: EDIT (Existing Log)
      if (mode === "EDIT" && logId) {
        const log = await getFoodLogById(Number(logId));
        if (log && isMounted) {
          setOriginalLog(log);
          setFoodName(log.foodName);
          // 回推基準值 (假設 log 儲存時有保留 base_nutrients，若無則只能根據總值反推或設為預設)
          // 這裡簡化：若無 product 資料，則無法精確回推每 100g，暫時將總值當作 100g (若無更好參考)
          // 但若該 log 是從 barcode 來的，我們可以查 product
          if (log.barcode) {
             const p = await getProductByBarcode(log.barcode);
             if (p) {
               setBaseCal(p.calories_100g?.toString());
               setBasePro(p.protein_100g?.toString());
               setBaseCarb(p.carbs_100g?.toString());
               setBaseFat(p.fat_100g?.toString());
               // ... load others
             }
          } else {
             // 若無 barcode 關聯，則假設當初輸入的總量就是目前顯示的，反推 100g 有困難，
             // 建議直接顯示總量讓用戶改。但為了 UI 一致性，我們這裡顯示總量，將份數設為 1，每份 100g (虛擬)
             setBaseCal(log.totalCalories?.toString());
             setBasePro(log.totalProteinG?.toString());
             setBaseCarb(log.totalCarbsG?.toString());
             setBaseFat(log.totalFatG?.toString());
             setBaseSod(log.totalSodiumMg?.toString());
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
            setBaseCal(data.calories_100g?.toString() || "0");
            setBasePro(data.protein_100g?.toString() || "0");
            setBaseCarb(data.carbs_100g?.toString() || "0");
            setBaseFat(data.fat_100g?.toString() || "0");
            setBaseSod(data.sodium_100g?.toString() || "0");
            setBaseSugar(data.sugar_100g?.toString() || "0");
            setBaseSatFat(data.saturated_fat_100g?.toString() || "0");
            setBaseChol(data.cholesterol_100g?.toString() || "0");
          }
        } catch(e) { console.error(e); }
        return;
      }

      if (mode === "BARCODE" && barcode) {
        const p = await getProductByBarcode(barcode as string);
        if (p && isMounted) {
          setFoodName(p.foodName);
          setBaseCal(p.calories_100g?.toString() || "0");
          setBasePro(p.protein_100g?.toString() || "0");
          setBaseCarb(p.carbs_100g?.toString() || "0");
          setBaseFat(p.fat_100g?.toString() || "0");
          setBaseSod(p.sodium_100g?.toString() || "0");
          // Load extra fields if they exist
          setBaseSugar(p.sugar_100g?.toString() || "0");
          setBaseSatFat(p.saturated_fat_100g?.toString() || "0");
          setBaseTransFat(p.trans_fat_100g?.toString() || "0");
          setBaseChol(p.cholesterol_100g?.toString() || "0");
          setBaseZinc(p.zinc_100g?.toString() || "0");
          setBaseMag(p.magnesium_100g?.toString() || "0");
          setBaseIron(p.iron_100g?.toString() || "0");
        }
        return;
      }

      if (imageUri || base64 || mode === "AI") {
        setLoading(true);
        try {
          let imageBase64 = base64 as string;
          if (!imageBase64 && imageUri) {
            imageBase64 = await FileSystem.readAsStringAsync(imageUri as string, {
              encoding: FileSystem.EncodingType.Base64,
            });
          }

          if (imageBase64) {
            const profile = await getProfileLocal();
            const result = await analyzeFoodImage(imageBase64, lang, profile);
            if (isMounted) {
              if (result) {
                setFoodName(`${result.foodName} ${result.composition ? `(${result.composition})` : ''}`);
                setBaseCal(result.calories_100g?.toString() || "0");
                setBasePro(result.protein_100g?.toString() || "0");
                setBaseCarb(result.carbs_100g?.toString() || "0");
                setBaseFat(result.fat_100g?.toString() || "0");
                setAiAnalysis({ composition: result.composition, suggestion: result.suggestion });
              } else {
                Alert.alert("辨識失敗", "AI 無法識別，請手動輸入");
              }
            }
          }
        } catch (e) {
          console.error("AI Process Error:", e);
          if (isMounted) Alert.alert("錯誤", "讀取圖片失敗");
        } finally {
          if (isMounted) setLoading(false);
        }
      }
    }
    process();
    return () => { isMounted = false; };
  }, [mode, base64, imageUri, initialData, barcode, logId]);

  const handleSave = async () => {
    if (!foodName) return Alert.alert("請輸入食物名稱");
    
    const qty = parseFloat(quantity) || 1;
    const unitWt = parseFloat(servingWeight) || 100;
    const totalWeight = qty * unitWt;
    const ratio = totalWeight / 100;
    
    // 準備要儲存的產品基準資料 (每 100g)
    const productData = {
      foodName,
      calories_100g: parseFloat(baseCal),
      protein_100g: parseFloat(basePro),
      carbs_100g: parseFloat(baseCarb),
      fat_100g: parseFloat(baseFat),
      sodium_100g: parseFloat(baseSod),
      sugar_100g: parseFloat(baseSugar),
      saturated_fat_100g: parseFloat(baseSatFat),
      trans_fat_100g: parseFloat(baseTransFat),
      cholesterol_100g: parseFloat(baseChol),
      zinc_100g: parseFloat(baseZinc),
      magnesium_100g: parseFloat(baseMag),
      iron_100g: parseFloat(baseIron),
    };

    // 準備這筆紀錄的總值
    const logData = {
      foodName,
      totalCalories: Math.round(productData.calories_100g * ratio),
      totalProteinG: Math.round(productData.protein_100g * ratio),
      totalCarbsG: Math.round(productData.carbs_100g * ratio),
      totalFatG: Math.round(productData.fat_100g * ratio),
      totalSodiumMg: Math.round(productData.sodium_100g * ratio),
      imageUri: imageUri as string,
      barcode: barcode as string, // 保留 barcode 關聯
    };

    // 如果是掃碼模式 (包含失敗轉手動且有帶 barcode)，必定更新本地資料庫
    if (barcode) {
      await saveProductLocal(barcode as string, productData);
    }

    // 編輯模式處理
    if (mode === "EDIT" && originalLog) {
      // 檢查是否需要同步更新產品庫 (若該紀錄有 barcode)
      if (originalLog.barcode) {
         const oldP = await getProductByBarcode(originalLog.barcode);
         if (oldP && JSON.stringify(oldP) !== JSON.stringify(productData)) {
            // 數值有變，詢問用戶
            Alert.alert(
              "營養成分變更", 
              "您修改了基準營養數值，是否要同步更新資料庫？(這將影響所有使用此條碼的紀錄)",
              [
                { 
                  text: "是，全部更新", 
                  onPress: async () => {
                    await saveProductLocal(originalLog.barcode, productData);
                    await updateFoodLogLocal({ ...originalLog, ...logData });
                    router.dismissTo("/");
                  }
                },
                {
                  text: "否，僅更新此筆",
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
      // 新增模式
      await saveFoodLogLocal(logData);
    }
    router.dismissTo("/"); 
  };

  const currentTotalCal = Math.round(parseFloat(baseCal) * ((parseFloat(quantity) * parseFloat(servingWeight)) / 100) || 0);

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={tintColor} />
        <ThemedText style={{marginTop: 20}}>AI 正在分析...</ThemedText>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor }]}>
       <View style={[styles.header, { paddingTop: Math.max(insets.top, 20) }]}>
          <Pressable onPress={() => router.back()}><ThemedText>取消</ThemedText></Pressable>
          <ThemedText type="subtitle">確認食物資訊</ThemedText>
          <Pressable onPress={handleSave}><ThemedText style={{color: tintColor, fontWeight:'bold'}}>{t('confirm_save', lang)}</ThemedText></Pressable>
       </View>
       
       <ScrollView style={{padding: 16}}>
          {imageUri && <Image source={{ uri: imageUri as string }} style={{ width: '100%', height: 200, borderRadius: 12, marginBottom: 16 }} />}
          
          <View style={[styles.card, {backgroundColor: cardBackground}]}>
             <ThemedText style={{marginBottom: 4, fontSize: 12, color: textSecondary}}>📦 {t('food_name', lang)}</ThemedText>
             <TextInput style={[styles.textInput, {color: tintColor}]} value={foodName} onChangeText={setFoodName} placeholder="輸入食物名稱"/>

             <View style={{marginTop: 16, padding: 12, backgroundColor: '#F5F5F5', borderRadius: 8}}>
                <View style={{flexDirection: 'row', gap: 10}}>
                   <View style={{flex: 1}}><NumberInput label={`🍽️ ${t('intake_quantity', lang)}`} value={quantity} onChange={setQuantity} step={0.5} /></View>
                   <View style={{flex: 1}}><NumberInput label={`⚖️ ${t('serving_weight', lang)}`} value={servingWeight} onChange={setServingWeight} step={10} /></View>
                </View>
                <ThemedText style={{textAlign:'center', fontSize: 14, color: tintColor, fontWeight: 'bold', marginTop: 8}}>
                  總攝取熱量: {currentTotalCal} kcal
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
                   <View style={{flex:1}}><NumberInput label="🔥 熱量 (kcal)" value={baseCal} onChange={setBaseCal} step={10} /></View>
                   <View style={{flex:1}}><NumberInput label="🧂 鈉 (mg)" value={baseSod} onChange={setBaseSod} step={50} /></View>
                </View>

                {/* 巨量營養素 */}
                <ThemedText style={styles.sectionTitle}>三大營養素</ThemedText>
                <View style={styles.nutrientRow}>
                   <View style={{flex:1}}><NumberInput label="🥩 蛋白質 (g)" value={basePro} onChange={setBasePro} /></View>
                   <View style={{flex:1}}><NumberInput label="🍚 碳水化合物 (g)" value={baseCarb} onChange={setBaseCarb} /></View>
                   <View style={{flex:1}}><NumberInput label="🥑 脂肪 (g)" value={baseFat} onChange={setBaseFat} /></View>
                </View>

                {/* 詳細脂肪與糖 */}
                <ThemedText style={styles.sectionTitle}>詳細脂肪與糖</ThemedText>
                <View style={styles.nutrientRow}>
                   <View style={{flex:1}}><NumberInput label="🍬 糖 (g)" value={baseSugar} onChange={setBaseSugar} /></View>
                   <View style={{flex:1}}><NumberInput label="🥥 飽和脂肪 (g)" value={baseSatFat} onChange={setBaseSatFat} /></View>
                </View>
                <View style={styles.nutrientRow}>
                   <View style={{flex:1}}><NumberInput label="🍟 反式脂肪 (g)" value={baseTransFat} onChange={setBaseTransFat} /></View>
                   <View style={{flex:1}}><NumberInput label="🥚 膽固醇 (mg)" value={baseChol} onChange={setBaseChol} /></View>
                </View>

                {/* 礦物質 */}
                <ThemedText style={styles.sectionTitle}>礦物質</ThemedText>
                <View style={styles.nutrientRow}>
                   <View style={{flex:1}}><NumberInput label="🔩 鋅 (mg)" value={baseZinc} onChange={setBaseZinc} step={0.1} /></View>
                   <View style={{flex:1}}><NumberInput label="🥬 鎂 (mg)" value={baseMag} onChange={setBaseMag} step={1} /></View>
                   <View style={{flex:1}}><NumberInput label="🩸 鐵 (mg)" value={baseIron} onChange={setBaseIron} step={0.1} /></View>
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
  sectionTitle: { marginTop: 15, marginBottom: 5, fontSize: 12, fontWeight: 'bold', color: '#888' }
});