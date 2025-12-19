import { useLocalSearchParams, useRouter } from "expo-router";
import { useState, useEffect } from "react";
import { View, StyleSheet, Image, Pressable, ScrollView, TextInput, ActivityIndicator, Alert, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { ThemedText } from "@/components/themed-text";
import { useThemeColor } from "@/hooks/use-theme-color";
import { analyzeFoodImage } from "@/lib/gemini";
import { saveFoodLogLocal } from "@/lib/storage";

// 餐別選項
const MEAL_OPTIONS = [
  { k: 'breakfast', l: '早餐' }, { k: 'lunch', l: '午餐' }, { k: 'snack', l: '點心' },
  { k: 'dinner', l: '晚餐' }, { k: 'late_night', l: '消夜' }
];

const getMealTypeByTime = () => {
  const h = new Date().getHours();
  if (h >= 6 && h < 11) return 'breakfast';
  if (h >= 11 && h < 14) return 'lunch';
  if (h >= 14 && h < 17) return 'snack';
  if (h >= 17 && h < 21) return 'dinner';
  return 'late_night';
};

export default function FoodRecognitionScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const imageUri = params.imageUri as string;

  const [isAnalyzing, setIsAnalyzing] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  // 模式：AI 分析 或 手動輸入
  const [mode, setMode] = useState<'AI' | 'MANUAL'>('AI');
  const [mealType, setMealType] = useState(getMealTypeByTime());

  // 資料表單狀態
  const [formData, setFormData] = useState({
    foodName: "",
    calories: "",
    protein: "",
    carbs: "",
    fat: "",
    suggestion: "",
    detectedObject: "" // Debug用
  });

  const backgroundColor = useThemeColor({}, "background");
  const cardBackground = useThemeColor({}, "cardBackground");
  const tintColor = useThemeColor({}, "tint");
  const textColor = useThemeColor({}, "text");
  const textSecondary = useThemeColor({}, "textSecondary");

  // 自動執行 AI 分析
  useEffect(() => {
    async function analyze() {
      if (!imageUri) return;
      try {
        setIsAnalyzing(true);
        const result = await analyzeFoodImage(imageUri);
        
        if (result && result.foodName !== "分析失敗") {
          setFormData({
            foodName: result.foodName,
            calories: result.calories.toString(),
            protein: result.macros.protein.toString(),
            carbs: result.macros.carbs.toString(),
            fat: result.macros.fat.toString(),
            suggestion: result.suggestion,
            detectedObject: result.detectedObject
          });
          if (result.foodName === "無法識別為食物") {
            Alert.alert("提示", "AI 認為這張照片不是食物，請確認或切換至手動模式。");
          }
        } else {
          Alert.alert("分析失敗", result?.suggestion || "請檢查網路");
          setMode('MANUAL'); // 自動切換到手動模式
        }
      } catch (e) {
        Alert.alert("錯誤", "發生未知的錯誤");
        setMode('MANUAL');
      } finally {
        setIsAnalyzing(false);
      }
    }
    if (mode === 'AI') analyze();
  }, [imageUri]);

  const handleSave = async () => {
    if (!formData.foodName || !formData.calories) {
      Alert.alert("資料不完整", "請至少輸入食物名稱和熱量");
      return;
    }
    try {
      setIsSaving(true);
      await saveFoodLogLocal({
        mealType,
        foodName: formData.foodName,
        totalCalories: parseInt(formData.calories) || 0,
        totalProteinG: parseFloat(formData.protein) || 0,
        totalCarbsG: parseFloat(formData.carbs) || 0,
        totalFatG: parseFloat(formData.fat) || 0,
        imageUrl: imageUri,
        notes: mode === 'AI' ? `AI識別: ${formData.detectedObject}` : '手動輸入'
      });
      router.push('/(tabs)');
    } catch (error) {
      Alert.alert("儲存失敗");
    } finally {
      setIsSaving(false);
    }
  };

  // 輸入框組件
  const InputField = ({ label, value, onChange, isNum = false }: any) => (
    <View style={{marginBottom: 12}}>
      <ThemedText style={{fontSize: 12, color: textSecondary, marginBottom: 4}}>{label}</ThemedText>
      <TextInput 
        style={[styles.input, {color: textColor, borderColor: '#ccc', backgroundColor: cardBackground}]}
        value={value}
        onChangeText={onChange}
        keyboardType={isNum ? 'numeric' : 'default'}
        editable={mode === 'MANUAL'} // 只有手動模式可以編輯
      />
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 20), backgroundColor: cardBackground }]}>
        <Pressable onPress={() => router.back()}><Ionicons name="arrow-back" size={24} color={textColor} /></Pressable>
        <ThemedText type="subtitle">食物確認</ThemedText>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={{ flex: 1 }}>
        <Image source={{ uri: imageUri }} style={styles.image} resizeMode="cover" />

        <View style={{ padding: 16 }}>
          {/* 模式切換與狀態顯示 */}
          <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16}}>
             {isAnalyzing ? (
               <View style={{flexDirection: 'row', alignItems: 'center'}}><ActivityIndicator size="small" color={tintColor}/><ThemedText style={{marginLeft: 8}}>AI 分析中...</ThemedText></View>
             ) : (
               <View>
                 <ThemedText type="subtitle">{mode === 'AI' ? 'AI 分析結果' : '手動輸入模式'}</ThemedText>
                 {mode === 'AI' && formData.detectedObject && <Text style={{fontSize: 10, color: '#888'}}>偵測到: {formData.detectedObject}</Text>}
               </View>
             )}
             <Pressable onPress={() => setMode(m => m === 'AI' ? 'MANUAL' : 'AI')} style={[styles.modeBtn, {borderColor: tintColor}]}>
               <ThemedText style={{color: tintColor, fontSize: 12}}>{mode === 'AI' ? '切換手動輸入' : '返回 AI 模式'}</ThemedText>
             </Pressable>
          </View>

          {/* 餐別選擇 */}
          <View style={[styles.card, { backgroundColor: cardBackground, marginBottom: 16 }]}>
            <ThemedText style={{marginBottom: 8}}>用餐時段</ThemedText>
            <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: 8}}>
              {MEAL_OPTIONS.map(opt => (
                <Pressable key={opt.k} onPress={() => setMealType(opt.k)} style={[styles.chip, mealType === opt.k && {backgroundColor: tintColor, borderColor: tintColor}]}>
                  <ThemedText style={mealType === opt.k ? {color: 'white'} : {color: textColor}}>{opt.l}</ThemedText>
                </Pressable>
              ))}
            </View>
          </View>

          {/* 資料表單 */}
          <View style={[styles.card, { backgroundColor: cardBackground }]}>
            <InputField label="食物名稱" value={formData.foodName} onChange={(t:string) => setFormData({...formData, foodName: t})} />
            <View style={{flexDirection: 'row', gap: 12}}>
              <View style={{flex: 1}}><InputField label="熱量 (kcal)" value={formData.calories} onChange={(t:string) => setFormData({...formData, calories: t})} isNum /></View>
              <View style={{flex: 1}}><InputField label="蛋白質 (g)" value={formData.protein} onChange={(t:string) => setFormData({...formData, protein: t})} isNum /></View>
            </View>
            <View style={{flexDirection: 'row', gap: 12}}>
              <View style={{flex: 1}}><InputField label="碳水 (g)" value={formData.carbs} onChange={(t:string) => setFormData({...formData, carbs: t})} isNum /></View>
              <View style={{flex: 1}}><InputField label="脂肪 (g)" value={formData.fat} onChange={(t:string) => setFormData({...formData, fat: t})} isNum /></View>
            </View>
            
            {mode === 'AI' && formData.suggestion && (
              <View style={{marginTop: 8, padding: 10, backgroundColor: '#E8F5E9', borderRadius: 8}}>
                <ThemedText style={{color: '#2E7D32', fontSize: 12}}>💡 {formData.suggestion}</ThemedText>
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      {/* Bottom Button */}
      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 20), backgroundColor: cardBackground }]}>
        <Pressable onPress={handleSave} disabled={isSaving || isAnalyzing} style={[styles.btn, { backgroundColor: tintColor }, (isSaving || isAnalyzing) && {opacity: 0.5}]}>
          {isSaving ? <ActivityIndicator color="white" /> : <ThemedText style={{ color: 'white', fontWeight: 'bold' }}>確認並儲存</ThemedText>}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  image: { width: '100%', height: 250 },
  card: { padding: 16, borderRadius: 12 },
  modeBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: '#ddd' },
  input: { borderWidth: 1, borderRadius: 8, padding: 10, fontSize: 16 },
  bottomBar: { padding: 16, borderTopWidth: 1, borderTopColor: '#eee' },
  btn: { padding: 16, borderRadius: 12, alignItems: 'center' }
});