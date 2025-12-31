// [START OF FILE app/barcode-product.tsx]
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState, useEffect } from "react";
import { View, StyleSheet, Pressable, ScrollView, TextInput, ActivityIndicator, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { ThemedText } from "@/components/themed-text";
import { useThemeColor } from "@/hooks/use-theme-color";
import { saveFoodLogLocal, saveProductLocal, getProductByBarcode } from "@/lib/storage";
import { NumberInput } from "@/components/NumberInput";
import { t, useLanguage } from "@/lib/i18n";

export default function BarcodeProductScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const lang = useLanguage(); 
  
  const [isLoading, setIsLoading] = useState(true);
  const [inputMode, setInputMode] = useState<'serving' | 'gram'>('serving');
  const [amount, setAmount] = useState("1");
  const [gramAmount, setGramAmount] = useState("100");
  
  const MEAL_OPTIONS = [
    { k: 'breakfast', l: t('breakfast', lang) }, 
    { k: 'lunch', l: t('lunch', lang) }, 
    { k: 'snack', l: t('snack', lang) || t('afternoon_tea', lang) },
    { k: 'dinner', l: t('dinner', lang) }, 
    { k: 'late_night', l: t('late_night', lang) }
  ];

  const getMealTypeByTime = () => {
    const h = new Date().getHours();
    if (h >= 6 && h < 11) return 'breakfast';
    if (h >= 11 && h < 14) return 'lunch';
    if (h >= 14 && h < 17) return 'snack';
    if (h >= 17 && h < 21) return 'dinner';
    return 'late_night';
  };

  const [mealType, setMealType] = useState(getMealTypeByTime());

  const [product, setProduct] = useState({
    name: "", brand: "", stdWeight: "100", cal: "0", pro: "0", carb: "0", fat: "0", sod: "0"
  });

  const backgroundColor = useThemeColor({}, "background");
  const cardBackground = useThemeColor({}, "cardBackground");
  const tintColor = useThemeColor({}, "tint");
  const textColor = useThemeColor({}, "text");

  const handleNotFound = () => {
    setIsLoading(false);
    Alert.alert(
      t('product_not_found', lang) || "Product Not Found",
      t('product_not_found_msg', lang) || "Database query failed. How to proceed?",
      [
        { text: t('cancel', lang), style: "cancel", onPress: () => router.back() },
        { 
            text: t('ai_analysis', lang) || "AI Scan", 
            onPress: () => {
                router.replace({ pathname: "/camera", params: { mode: "ai_food" } });
            } 
        },
        { 
            text: t('manual_input', lang) || "Manual Input", 
            onPress: () => {
                router.replace({ pathname: "/food-editor", params: { barcode: params.barcode } });
            } 
        }
      ]
    );
  };

  useEffect(() => {
    async function fetchProduct() {
      const barcodeStr = String(params.barcode);
      if (!barcodeStr) return;

      // 1. Check Local DB
      try {
        const localProd = await getProductByBarcode(barcodeStr);
        if (localProd) {
          // [FIX] 加入防呆機制：確保欄位存在，若不存在則給予預設值
          // 因為舊資料可能沒有 stdWeight，直接 toString() 會導致 Crash
          const safeProduct = {
             name: localProd.name || "",
             brand: localProd.brand || "",
             stdWeight: String(localProd.stdWeight || "100"), // 若為 undefined 預設 "100"
             cal: String(localProd.cal || "0"),
             pro: String(localProd.pro || "0"),
             carb: String(localProd.carb || "0"),
             fat: String(localProd.fat || "0"),
             sod: String(localProd.sod || "0"),
          };
          
          setProduct(safeProduct);
          setGramAmount(safeProduct.stdWeight);
          setIsLoading(false);
          return;
        }
      } catch (e) {
        console.error("Error loading local product:", e);
        // 若本地讀取錯誤，繼續嘗試網路查詢
      }

      // 2. Check OpenFoodFacts
      try {
        const res = await fetch(`https://world.openfoodfacts.org/api/v0/product/${barcodeStr}.json`);
        const data = await res.json();
        
        if (data.status === 1 && data.product) {
           const p = data.product;
           const n = p.nutriments || {};
           let w = 100;
           // 嘗試解析 serving_size (例如 "250 ml" -> 250)
           const match = (p.serving_size || "").match(/(\d+(\.\d+)?)/);
           if (match) w = parseFloat(match[0]);

           setProduct({
             name: p.product_name || t('unknown_product', lang) || "Unknown Product",
             brand: p.brands || "",
             stdWeight: w.toString(),
             cal: (n["energy-kcal_100g"] || 0).toString(),
             pro: (n.proteins_100g || 0).toString(),
             carb: (n.carbohydrates_100g || 0).toString(),
             fat: (n.fat_100g || 0).toString(),
             sod: ((n.sodium_100g || 0) * 1000).toString(), // g -> mg
           });
           setGramAmount(w.toString());
           setIsLoading(false);
        } else {
           handleNotFound();
        }
      } catch (e) {
        handleNotFound();
      }
    }
    fetchProduct();
  }, [params.barcode]);

  // 單向連動 (防止互鎖)
  useEffect(() => {
    const stdW = parseFloat(product.stdWeight) || 100;
    if (inputMode === 'serving') {
      const g = (parseFloat(amount) || 0) * stdW;
      if (Math.abs(g - (parseFloat(gramAmount)||0)) > 0.1) setGramAmount(g.toString());
    }
  }, [amount, inputMode, product.stdWeight]);

  useEffect(() => {
    const stdW = parseFloat(product.stdWeight) || 100;
    if (inputMode === 'gram') {
      const s = (parseFloat(gramAmount) || 0) / stdW;
      if (Math.abs(s - (parseFloat(amount)||0)) > 0.1) setAmount(s.toFixed(1));
    }
  }, [gramAmount, inputMode, product.stdWeight]);

  const getFinalValues = () => {
    const ratio = (parseFloat(gramAmount) || 0) / 100;
    return {
      cal: Math.round((parseFloat(product.cal)||0) * ratio),
      pro: Math.round((parseFloat(product.pro)||0) * ratio),
      carb: Math.round((parseFloat(product.carb)||0) * ratio),
      fat: Math.round((parseFloat(product.fat)||0) * ratio),
      sod: Math.round((parseFloat(product.sod)||0) * ratio),
    };
  };

  const handleSave = async () => {
    const final = getFinalValues();
    await saveProductLocal(String(params.barcode), product);
    await saveFoodLogLocal({
      mealType,
      foodName: product.name,
      totalCalories: final.cal,
      totalProteinG: final.pro,
      totalCarbsG: final.carb,
      totalFatG: final.fat,
      totalSodiumMg: final.sod,
      notes: `${t('barcode', lang) || 'Barcode'}:${params.barcode}`
    });
    router.dismissAll();
    router.back(); 
  };

  if (isLoading) return <View style={[styles.container, {backgroundColor, justifyContent:'center'}]}><ActivityIndicator size="large"/></View>;
  const final = getFinalValues();

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 20), backgroundColor: cardBackground }]}>
         <Pressable onPress={() => router.back()} style={styles.backButton}><Ionicons name="arrow-back" size={24} color={textColor} /></Pressable>
         <ThemedText type="subtitle">{t('product_info', lang) || "Product Info"}</ThemedText>
         <View style={{width: 40}}/>
      </View>

      <ScrollView style={{padding: 16}}>
         <View style={[styles.card, {backgroundColor: cardBackground}]}>
            <ThemedText style={{fontSize: 12, color: '#666'}}>{t('product_name', lang) || "Product Name"}</ThemedText>
            <TextInput style={[styles.input, {color: textColor, backgroundColor: 'white'}]} value={product.name} onChangeText={t => setProduct({...product, name: t})} />
            
            <ThemedText style={{fontSize: 12, color: '#666', marginTop: 10}}>{t('unit_weight', lang) || "Unit Weight"} (g/ml)</ThemedText>
            <NumberInput value={product.stdWeight} onChange={v => setProduct({...product, stdWeight: v})} unit="g" />
         </View>

         <View style={[styles.card, { backgroundColor: cardBackground }]}>
            <View style={{flexDirection: 'row', gap: 8, flexWrap: 'wrap'}}>
              {MEAL_OPTIONS.map(opt => (
                <Pressable key={opt.k} onPress={() => setMealType(opt.k)} style={[styles.chip, mealType === opt.k && {backgroundColor: tintColor}]}>
                  <ThemedText style={{color: mealType === opt.k ? 'white' : textColor}}>{opt.l}</ThemedText>
                </Pressable>
              ))}
            </View>
         </View>

         <View style={[styles.card, {backgroundColor: cardBackground}]}>
            <View style={{flexDirection: 'row', marginBottom: 12, justifyContent:'space-between'}}>
               <Pressable onPress={() => setInputMode('serving')}><ThemedText style={inputMode==='serving'?{color:tintColor}:{color:'#888'}}>{t('input_serving', lang) || "Input Servings"}</ThemedText></Pressable>
               <Pressable onPress={() => setInputMode('gram')}><ThemedText style={inputMode==='gram'?{color:tintColor}:{color:'#888'}}>{t('input_gram', lang) || "Input Grams"}</ThemedText></Pressable>
            </View>
            {inputMode === 'serving' ? (
               <NumberInput label={t('portion_count', lang) || "Count"} value={amount} onChange={setAmount} step={0.5} unit={t('serving_unit', lang) || "srv"} />
            ) : (
               <NumberInput label={t('weight', lang) || "Weight"} value={gramAmount} onChange={setGramAmount} step={10} unit="g" />
            )}
         </View>

         <View style={[styles.card, {backgroundColor: cardBackground}]}>
            <ThemedText style={{marginBottom: 10, fontWeight: 'bold'}}>{t('val_per_100g', lang) || "Per 100g"}</ThemedText>
            <View style={{flexDirection: 'row', gap: 10}}>
               <View style={{flex:1}}><NumberInput label={t('calories', lang)} value={product.cal} onChange={v => setProduct({...product, cal: v})} step={10} /></View>
               <View style={{flex:1}}><NumberInput label={t('protein', lang)} value={product.pro} onChange={v => setProduct({...product, pro: v})} /></View>
            </View>
            <View style={{flexDirection: 'row', gap: 10}}>
               <View style={{flex:1}}><NumberInput label={t('carbs', lang)} value={product.carb} onChange={v => setProduct({...product, carb: v})} /></View>
               <View style={{flex:1}}><NumberInput label={t('fat', lang)} value={product.fat} onChange={v => setProduct({...product, fat: v})} /></View>
            </View>
            <NumberInput label={`${t('sodium', lang)} (mg)`} value={product.sod} onChange={v => setProduct({...product, sod: v})} step={10} />
         </View>

         <View style={{backgroundColor: '#E3F2FD', padding: 16, borderRadius: 12, marginTop: 10}}>
            <ThemedText style={{textAlign: 'center', color: '#1565C0', fontSize: 18, fontWeight: 'bold'}}>{t('intake', lang) || "Intake"}: {final.cal} kcal</ThemedText>
         </View>
      </ScrollView>

      <View style={{padding: 16}}>
         <Pressable onPress={handleSave} style={[styles.btn, {backgroundColor: tintColor}]}><ThemedText style={{color:'white'}}>{t('save', lang)}</ThemedText></Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  backButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  card: { padding: 16, borderRadius: 12, marginBottom: 16 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 8, fontSize: 16, marginTop: 4, backgroundColor: 'white' },
  chip: { padding: 8, borderRadius: 16, borderWidth: 1, borderColor: '#ddd' },
  btn: { padding: 16, borderRadius: 12, alignItems: 'center' }
});
// [END OF FILE app/barcode-product.tsx]