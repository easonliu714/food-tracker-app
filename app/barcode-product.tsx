import { useLocalSearchParams, useRouter } from "expo-router";
import { useState, useEffect } from "react";
import { View, StyleSheet, Pressable, ScrollView, TextInput, ActivityIndicator, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { ThemedText } from "@/components/themed-text";
import { useThemeColor } from "@/hooks/use-theme-color";
import { saveFoodLogLocal, saveProductLocal, getProductByBarcode } from "@/lib/storage";
import { NumberInput } from "@/components/NumberInput";

const MEAL_OPTIONS = [{ k: 'breakfast', l: '早餐' }, { k: 'lunch', l: '午餐' }, { k: 'snack', l: '點心' }, { k: 'dinner', l: '晚餐' }, { k: 'late_night', l: '消夜' }];
const getMealTypeByTime = () => {
  const h = new Date().getHours();
  if (h >= 6 && h < 11) return 'breakfast';
  if (h >= 11 && h < 14) return 'lunch';
  if (h >= 14 && h < 17) return 'snack';
  if (h >= 17 && h < 21) return 'dinner';
  return 'late_night';
};

export default function BarcodeProductScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [inputMode, setInputMode] = useState<'serving' | 'gram'>('serving');
  const [amount, setAmount] = useState("1");
  const [gramAmount, setGramAmount] = useState("100");
  const [mealType, setMealType] = useState(getMealTypeByTime());

  const [product, setProduct] = useState({
    name: "", brand: "", stdWeight: "100", cal: "0", pro: "0", carb: "0", fat: "0", sod: "0"
  });

  const backgroundColor = useThemeColor({}, "background");
  const cardBackground = useThemeColor({}, "cardBackground");
  const tintColor = useThemeColor({}, "tint");
  const textColor = useThemeColor({}, "text");

  useEffect(() => {
    async function fetchProduct() {
      const barcodeStr = String(params.barcode);
      if (!barcodeStr) return;

      const localProd = await getProductByBarcode(barcodeStr);
      if (localProd) {
        setProduct(localProd);
        setGramAmount(localProd.stdWeight.toString());
        setIsLoading(false);
        return;
      }

      try {
        const res = await fetch(`https://world.openfoodfacts.org/api/v0/product/${barcodeStr}.json`);
        const data = await res.json();
        
        if (data.status === 1 && data.product) {
           const p = data.product;
           const n = p.nutriments || {};
           let w = 100;
           const match = (p.serving_size || "").match(/(\d+(\.\d+)?)/);
           if (match) w = parseFloat(match[0]);

           setProduct({
             name: p.product_name || "未知商品",
             brand: p.brands || "",
             stdWeight: w.toString(),
             cal: (n["energy-kcal_100g"] || 0).toString(),
             pro: (n.proteins_100g || 0).toString(),
             carb: (n.carbohydrates_100g || 0).toString(),
             fat: (n.fat_100g || 0).toString(),
             sod: ((n.sodium_100g || 0) * 1000).toString(), // g -> mg
           });
           setGramAmount(w.toString());
        } else {
           setNotFound(true);
           setProduct(prev => ({...prev, name: "查無商品(請輸入)"}));
        }
      } catch (e) {
        setNotFound(true);
      } finally {
        setIsLoading(false);
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
      notes: `條碼:${params.barcode}`
    });
    router.back(); router.back();
  };

  if (isLoading) return <View style={[styles.container, {backgroundColor, justifyContent:'center'}]}><ActivityIndicator size="large"/></View>;
  const final = getFinalValues();

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 20), backgroundColor: cardBackground }]}>
         <Pressable onPress={() => router.back()} style={styles.backButton}><Ionicons name="arrow-back" size={24} color={textColor} /></Pressable>
         <ThemedText type="subtitle">產品資訊</ThemedText>
         <View style={{width: 40}}/>
      </View>

      <ScrollView style={{padding: 16}}>
         <View style={[styles.card, {backgroundColor: cardBackground}]}>
            <ThemedText style={{fontSize: 12, color: '#666'}}>產品名稱</ThemedText>
            <TextInput style={[styles.input, {color: textColor, backgroundColor: 'white'}]} value={product.name} onChangeText={t => setProduct({...product, name: t})} />
            
            <ThemedText style={{fontSize: 12, color: '#666', marginTop: 10}}>一份的重量 (g/ml)</ThemedText>
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
               <Pressable onPress={() => setInputMode('serving')}><ThemedText style={inputMode==='serving'?{color:tintColor}:{color:'#888'}}>輸入份數</ThemedText></Pressable>
               <Pressable onPress={() => setInputMode('gram')}><ThemedText style={inputMode==='gram'?{color:tintColor}:{color:'#888'}}>輸入克數</ThemedText></Pressable>
            </View>
            {inputMode === 'serving' ? (
               <NumberInput label="份數" value={amount} onChange={setAmount} step={0.5} unit="份" />
            ) : (
               <NumberInput label="重量" value={gramAmount} onChange={setGramAmount} step={10} unit="g" />
            )}
         </View>

         <View style={[styles.card, {backgroundColor: cardBackground}]}>
            <ThemedText style={{marginBottom: 10, fontWeight: 'bold'}}>每 100g 營養素 (基準)</ThemedText>
            <View style={{flexDirection: 'row', gap: 10}}>
               <View style={{flex:1}}><NumberInput label="熱量" value={product.cal} onChange={v => setProduct({...product, cal: v})} step={10} /></View>
               <View style={{flex:1}}><NumberInput label="蛋白質" value={product.pro} onChange={v => setProduct({...product, pro: v})} /></View>
            </View>
            <View style={{flexDirection: 'row', gap: 10}}>
               <View style={{flex:1}}><NumberInput label="碳水" value={product.carb} onChange={v => setProduct({...product, carb: v})} /></View>
               <View style={{flex:1}}><NumberInput label="脂肪" value={product.fat} onChange={v => setProduct({...product, fat: v})} /></View>
            </View>
            <NumberInput label="鈉 (mg)" value={product.sod} onChange={v => setProduct({...product, sod: v})} step={10} />
         </View>

         <View style={{backgroundColor: '#E3F2FD', padding: 16, borderRadius: 12, marginTop: 10}}>
            <ThemedText style={{textAlign: 'center', color: '#1565C0', fontSize: 18, fontWeight: 'bold'}}>攝取: {final.cal} kcal</ThemedText>
         </View>
      </ScrollView>

      <View style={{padding: 16}}>
         <Pressable onPress={handleSave} style={[styles.btn, {backgroundColor: tintColor}]}><ThemedText style={{color:'white'}}>儲存</ThemedText></Pressable>
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