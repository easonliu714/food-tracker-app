import { useLocalSearchParams, useRouter } from "expo-router";
import { useState, useEffect } from "react";
import { View, StyleSheet, Pressable, ScrollView, TextInput, ActivityIndicator, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { ThemedText } from "@/components/themed-text";
import { useThemeColor } from "@/hooks/use-theme-color";
import { saveFoodLogLocal } from "@/lib/storage";

// 自動判斷餐別
const getMealTypeByTime = () => {
  const h = new Date().getHours();
  if (h >= 6 && h < 11) return 'breakfast';
  if (h >= 11 && h < 14) return 'lunch';
  if (h >= 14 && h < 17) return 'snack';
  if (h >= 17 && h < 21) return 'dinner';
  return 'late_night';
};

const MEAL_OPTIONS = [
  { k: 'breakfast', l: '早餐' }, { k: 'lunch', l: '午餐' }, { k: 'snack', l: '點心' },
  { k: 'dinner', l: '晚餐' }, { k: 'late_night', l: '消夜' }
];

export default function BarcodeProductScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const [isLoading, setIsLoading] = useState(true);
  
  // 單位模式: 'gram' 或 'serving'
  const [inputMode, setInputMode] = useState<'gram' | 'serving'>('gram');
  const [inputValue, setInputValue] = useState("100"); // 輸入框的值
  
  const [mealType, setMealType] = useState(getMealTypeByTime());
  
  const [productData, setProductData] = useState<any>({ name: "載入中...", caloriesPer100g: 0 });

  const backgroundColor = useThemeColor({}, "background");
  const cardBackground = useThemeColor({}, "cardBackground");
  const tintColor = useThemeColor({}, "tint");
  const textColor = useThemeColor({}, "text");

  useEffect(() => {
    async function fetchProduct() {
      try {
        const res = await fetch(`https://world.openfoodfacts.org/api/v0/product/${params.barcode}.json`);
        const data = await res.json();
        if (data.status === 1) {
           const n = data.product.nutriments || {};
           // 嘗試讀取單份重量 (字串解析如 "30g")
           let servingWeight = 100; // 預設
           const servingStr = data.product.serving_size || "";
           const match = servingStr.match(/(\d+(\.\d+)?)/);
           if (match) servingWeight = parseFloat(match[0]);

           setProductData({
             name: data.product.product_name || "未知商品",
             brand: data.product.brands || "",
             servingWeight, // 單份幾克
             servingDesc: data.product.serving_size || "100g",
             caloriesPer100g: n["energy-kcal_100g"] || 0,
             proteinPer100g: n.proteins_100g || 0,
             carbsPer100g: n.carbohydrates_100g || 0,
             fatPer100g: n.fat_100g || 0,
           });
           // 若預設模式是 g，則預設 100；若是份，預設 1
           if (inputMode === 'serving') setInputValue("1");
        } else {
           Alert.alert("查無商品", "請手動輸入");
        }
      } catch (e) {
        Alert.alert("網路錯誤");
      } finally {
        isLoading(false);
      }
    }
    fetchProduct();
  }, [params.barcode]);

  // 計算實際營養素
  const calculateCurrent = () => {
    const val = parseFloat(inputValue) || 0;
    let grams = 0;
    if (inputMode === 'gram') grams = val;
    else grams = val * (productData.servingWeight || 100);

    const ratio = grams / 100;
    return {
      cal: Math.round(productData.caloriesPer100g * ratio),
      pro: Math.round(productData.proteinPer100g * ratio),
      carb: Math.round(productData.carbsPer100g * ratio),
      fat: Math.round(productData.fatPer100g * ratio),
    };
  };

  const current = calculateCurrent();

  const handleSave = async () => {
    await saveFoodLogLocal({
      mealType,
      foodName: productData.name,
      totalCalories: current.cal,
      totalProteinG: current.pro,
      totalCarbsG: current.carb,
      totalFatG: current.fat,
    });
    router.back(); router.back();
  };

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 20), backgroundColor: cardBackground }]}>
         <Pressable onPress={() => router.back()}><Ionicons name="arrow-back" size={24} color={textColor} /></Pressable>
         <ThemedText type="subtitle">產品資訊</ThemedText>
         <View style={{width: 24}}/>
      </View>
      <ScrollView style={{padding: 16}}>
         {/* 1. 商品資訊 */}
         <View style={[styles.card, {backgroundColor: cardBackground}]}>
            <ThemedText type="title">{productData.name}</ThemedText>
            <ThemedText style={{color: '#666'}}>{productData.brand}</ThemedText>
            <ThemedText style={{fontSize: 12, marginTop: 4, color: '#888'}}>每份約: {productData.servingDesc} ({productData.servingWeight}g)</ThemedText>
         </View>

         {/* 2. 餐別選擇 */}
         <View style={[styles.card, {backgroundColor: cardBackground}]}>
            <ThemedText type="subtitle" style={{marginBottom: 8}}>用餐時段</ThemedText>
            <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: 8}}>
               {MEAL_OPTIONS.map(opt => (
                 <Pressable key={opt.k} onPress={() => setMealType(opt.k)} style={[styles.chip, mealType === opt.k && {backgroundColor: tintColor}]}>
                    <ThemedText style={mealType === opt.k ? {color: 'white'} : {color: textColor}}>{opt.l}</ThemedText>
                 </Pressable>
               ))}
            </View>
         </View>

         {/* 3. 份量輸入 */}
         <View style={[styles.card, {backgroundColor: cardBackground}]}>
            <View style={{flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10}}>
               <Pressable onPress={() => setInputMode('gram')}><ThemedText style={inputMode === 'gram' ? {color: tintColor, fontWeight: 'bold'} : {color: '#888'}}>輸入克數(g/ml)</ThemedText></Pressable>
               <Pressable onPress={() => setInputMode('serving')}><ThemedText style={inputMode === 'serving' ? {color: tintColor, fontWeight: 'bold'} : {color: '#888'}}>輸入份數</ThemedText></Pressable>
            </View>
            <View style={{flexDirection: 'row', alignItems: 'center', gap: 10}}>
               <TextInput 
                  style={[styles.input, {color: textColor, borderColor: '#ccc'}]} 
                  value={inputValue} 
                  onChangeText={setInputValue} 
                  keyboardType="numeric" 
               />
               <ThemedText>{inputMode === 'gram' ? 'g' : '份'}</ThemedText>
            </View>
         </View>
         
         {/* 4. 結果預覽 */}
         <View style={[styles.card, {backgroundColor: cardBackground}]}>
            <ThemedText type="subtitle">熱量: {current.cal} kcal</ThemedText>
            <View style={{flexDirection: 'row', gap: 10, marginTop: 4}}>
               <ThemedText style={{fontSize: 12}}>蛋 {current.pro}g</ThemedText>
               <ThemedText style={{fontSize: 12}}>碳 {current.carb}g</ThemedText>
               <ThemedText style={{fontSize: 12}}>油 {current.fat}g</ThemedText>
            </View>
         </View>
      </ScrollView>
      <View style={{padding: 16}}>
         <Pressable onPress={handleSave} style={[styles.btn, {backgroundColor: tintColor}]}><ThemedText style={{color: 'white', fontWeight: 'bold'}}>儲存</ThemedText></Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  card: { padding: 16, borderRadius: 12, marginBottom: 16 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: '#ddd' },
  input: { flex: 1, borderWidth: 1, borderRadius: 8, padding: 10, fontSize: 18, textAlign: 'center' },
  btn: { padding: 16, borderRadius: 12, alignItems: 'center' }
});