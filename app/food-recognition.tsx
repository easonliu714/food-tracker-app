import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState, useCallback } from "react";
import { View, ScrollView, Image, ActivityIndicator, Pressable, TextInput, Alert, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ThemedText } from "@/components/themed-text";
import { useThemeColor } from "@/hooks/use-theme-color";
import { analyzeFoodImage } from "@/lib/gemini";
import { saveProductLocal, saveFoodLogLocal, getProductByBarcode, getProfileLocal } from "@/lib/storage";
import { NumberInput } from "@/components/NumberInput";
import { t, useLanguage } from "@/lib/i18n";

export default function FoodRecognitionScreen() {
  const { imageUri, base64, mode, barcode, initialData } = useLocalSearchParams();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const lang = useLanguage();
  
  const [loading, setLoading] = useState(false);
  const [foodName, setFoodName] = useState("");
  const [servingWeight, setServingWeight] = useState("100"); // 預設份量 100g
  
  // Base Values (Per 100g)
  const [baseCal, setBaseCal] = useState("0");
  const [basePro, setBasePro] = useState("0");
  const [baseCarb, setBaseCarb] = useState("0");
  const [baseFat, setBaseFat] = useState("0");
  const [baseSod, setBaseSod] = useState("0");

  const [aiAnalysis, setAiAnalysis] = useState<{composition?: string, suggestion?: string} | null>(null);

  const backgroundColor = useThemeColor({}, "background");
  const cardBackground = useThemeColor({}, "cardBackground");
  const tintColor = useThemeColor({}, "tint");
  const textSecondary = useThemeColor({}, "textSecondary");

  useEffect(() => {
    async function process() {
      if (mode === "MANUAL") return;

      if (mode === "EXTERNAL_DB" && initialData) {
        const data = JSON.parse(initialData as string);
        setFoodName(data.foodName);
        setBaseCal(data.calories_100g.toString());
        setBasePro(data.protein_100g.toString());
        setBaseCarb(data.carbs_100g.toString());
        setBaseFat(data.fat_100g.toString());
        setBaseSod(data.sodium_100g.toString());
        return;
      }

      if (mode === "BARCODE" && barcode) {
        const p = await getProductByBarcode(barcode as string);
        if (p) {
          setFoodName(p.foodName);
          setBaseCal(p.calories_100g.toString());
          setBasePro(p.protein_100g.toString());
          setBaseCarb(p.carbs_100g.toString());
          setBaseFat(p.fat_100g.toString());
          setBaseSod(p.sodium_100g.toString());
        }
        return;
      }

      if (base64) {
        setLoading(true);
        const profile = await getProfileLocal();
        const result = await analyzeFoodImage(base64 as string, lang, profile);
        setLoading(false);
        if (result) {
          // AI 分析結果：名稱加上組成
          setFoodName(`${result.foodName} (${result.composition || ''})`);
          setBaseCal(result.calories_100g?.toString() || "0");
          setBasePro(result.protein_100g?.toString() || "0");
          setBaseCarb(result.carbs_100g?.toString() || "0");
          setBaseFat(result.fat_100g?.toString() || "0");
          setAiAnalysis({ composition: result.composition, suggestion: result.suggestion });
        } else {
          Alert.alert("辨識失敗", "請手動輸入");
        }
      }
    }
    process();
  }, []);

  const handleSave = async () => {
    if (!foodName) return Alert.alert("請輸入食物名稱");
    
    // 計算總值 = 基準(100g) * (份量 / 100)
    const ratio = (parseFloat(servingWeight) || 0) / 100;
    
    const finalLog = {
      foodName,
      totalCalories: Math.round(parseFloat(baseCal) * ratio),
      totalProteinG: Math.round(parseFloat(basePro) * ratio),
      totalCarbsG: Math.round(parseFloat(baseCarb) * ratio),
      totalFatG: Math.round(parseFloat(baseFat) * ratio),
      totalSodiumMg: Math.round(parseFloat(baseSod) * ratio),
      imageUri: imageUri as string
    };

    if (barcode) {
      // 儲存產品基準值到本地資料庫
      await saveProductLocal(barcode as string, {
        foodName,
        calories_100g: parseFloat(baseCal),
        protein_100g: parseFloat(basePro),
        carbs_100g: parseFloat(baseCarb),
        fat_100g: parseFloat(baseFat),
        sodium_100g: parseFloat(baseSod),
      });
    }

    await saveFoodLogLocal(finalLog);
    router.dismissTo("/"); 
  };

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
             <ThemedText style={{marginBottom: 4, fontSize: 12, color: textSecondary}}>{t('food_name', lang)}</ThemedText>
             {/* 解決鍵盤消失：TextInput 應獨立或避免過度 re-render。此處使用簡單 View 包覆 */}
             <TextInput 
               style={[styles.textInput, {color: tintColor}]} 
               value={foodName} 
               onChangeText={setFoodName} 
               placeholder="輸入食物名稱"
             />

             {/* 份量輸入區 (獨立) */}
             <View style={{marginTop: 16, padding: 12, backgroundColor: '#F5F5F5', borderRadius: 8}}>
                <NumberInput label={t('serving_weight', lang)} value={servingWeight} onChange={setServingWeight} step={10} />
                <ThemedText style={{textAlign:'center', fontSize: 12, color: '#666', marginTop: 4}}>
                  總熱量: {Math.round(parseFloat(baseCal) * (parseFloat(servingWeight)/100) || 0)} kcal
                </ThemedText>
             </View>

             {/* AI 分析結果區 (僅在有 AI 資料時顯示) */}
             {aiAnalysis && (
               <View style={{marginTop: 16, padding: 12, backgroundColor: '#E3F2FD', borderRadius: 8, borderLeftWidth: 4, borderLeftColor: '#2196F3'}}>
                 <ThemedText style={{fontWeight:'bold', color: '#1565C0', marginBottom: 4}}>🤖 {t('ai_analysis_result', lang)}</ThemedText>
                 <ThemedText style={{fontSize: 13, marginBottom: 4}}>🥘 <ThemedText style={{fontWeight:'bold'}}>{t('composition', lang)}:</ThemedText> {aiAnalysis.composition}</ThemedText>
                 <ThemedText style={{fontSize: 13}}>💡 <ThemedText style={{fontWeight:'bold'}}>{t('intake_advice', lang)}:</ThemedText> {aiAnalysis.suggestion}</ThemedText>
               </View>
             )}

             {/* 基準值區塊 (每 100g) */}
             <View style={{marginTop: 20}}>
                <ThemedText style={{fontWeight: 'bold', marginBottom: 10}}>{t('per_100g_base', lang)}</ThemedText>
                <NumberInput label={t('calories', lang)} value={baseCal} onChange={setBaseCal} step={10} />
                <View style={{flexDirection: 'row', gap: 10, marginTop: 10}}>
                   <View style={{flex:1}}><NumberInput label={t('protein', lang)} value={basePro} onChange={setBasePro} /></View>
                   <View style={{flex:1}}><NumberInput label={t('carbs', lang)} value={baseCarb} onChange={setBaseCarb} /></View>
                </View>
                <View style={{flexDirection: 'row', gap: 10, marginTop: 10}}>
                   <View style={{flex:1}}><NumberInput label={t('fat', lang)} value={baseFat} onChange={setBaseFat} /></View>
                   <View style={{flex:1}}><NumberInput label={t('sodium', lang)} value={baseSod} onChange={setBaseSod} step={100} /></View>
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
  textInput: { fontSize: 18, fontWeight: 'bold', borderBottomWidth: 1, borderColor: '#ddd', paddingVertical: 8 }
});