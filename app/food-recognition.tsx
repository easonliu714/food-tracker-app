import { useLocalSearchParams, useRouter } from "expo-router";
import { useState, useEffect } from "react";
import { View, StyleSheet, Image, Pressable, ScrollView, TextInput, ActivityIndicator, Alert, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { ThemedText } from "@/components/themed-text";
import { useThemeColor } from "@/hooks/use-theme-color";
import { analyzeFoodImage, analyzeFoodText } from "@/lib/gemini";
import { saveFoodLogLocal } from "@/lib/storage";
import { NumberInput } from "@/components/NumberInput";

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
  const [mode, setMode] = useState<'AI' | 'MANUAL'>('AI');
  const [mealType, setMealType] = useState(getMealTypeByTime());

  // 資料表單狀態
  const [formData, setFormData] = useState({
    foodName: "",
    calories: "0",
    protein: "0",
    carbs: "0",
    fat: "0",
    suggestion: "",
    detectedObject: ""
  });

  const backgroundColor = useThemeColor({}, "background");
  const cardBackground = useThemeColor({}, "cardBackground");
  const tintColor = useThemeColor({}, "tint");
  const textColor = useThemeColor({}, "text");

  // 1. 自動圖片分析
  useEffect(() => {
    async function analyze() {
      if (!imageUri) return;
      try {
        setIsAnalyzing(true);
        const result = await analyzeFoodImage(imageUri);
        processResult(result);
      } catch (e) {
        Alert.alert("錯誤", "圖片分析失敗");
        setMode('MANUAL');
      } finally {
        setIsAnalyzing(false);
      }
    }
    if (mode === 'AI') analyze();
  }, [imageUri]);

  // 2. 文字分析功能
  const handleTextAnalyze = async () => {
    if (!formData.foodName) return Alert.alert("請輸入名稱");
    try {
      setIsAnalyzing(true);
      const result = await analyzeFoodText(formData.foodName);
      processResult(result);
      setMode('AI'); // 切換回 AI 顯示模式
    } catch (e) {
      Alert.alert("分析失敗");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const processResult = (result: any) => {
    if (result && result.foodName !== "分析失敗") {
      setFormData({
        foodName: result.foodName,
        calories: result.calories?.toString() || "0",
        protein: result.macros?.protein?.toString() || "0",
        carbs: result.macros?.carbs?.toString() || "0",
        fat: result.macros?.fat?.toString() || "0",
        suggestion: result.suggestion || "",
        detectedObject: result.detectedObject || "文字輸入"
      });
    } else {
      Alert.alert("分析失敗", "無法識別");
      setMode('MANUAL');
    }
  };

  const handleSave = async () => {
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
        notes: `AI識別: ${formData.detectedObject}`
      });
      router.push('/(tabs)');
    } catch (error) {
      Alert.alert("儲存失敗");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 20), backgroundColor: cardBackground }]}>
        <Pressable onPress={() => router.back()}><Ionicons name="arrow-back" size={24} color={textColor} /></Pressable>
        <ThemedText type="subtitle">食物確認</ThemedText>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={{ flex: 1 }}>
        <Image source={{ uri: imageUri }} style={styles.image} resizeMode="cover" />

        <View style={{ padding: 16 }}>
          {/* 狀態與文字分析按鈕 */}
          <View style={{flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16}}>
             {isAnalyzing ? (
               <ActivityIndicator color={tintColor} />
             ) : (
               <Pressable onPress={() => setMode(m => m === 'AI' ? 'MANUAL' : 'AI')} style={[styles.btnSmall, {borderColor: tintColor}]}>
                 <ThemedText style={{color: tintColor}}>{mode === 'AI' ? '切換手動' : '返回 AI'}</ThemedText>
               </Pressable>
             )}
             {mode === 'MANUAL' && (
               <Pressable onPress={handleTextAnalyze} style={[styles.btnSmall, {backgroundColor: tintColor}]}>
                 <ThemedText style={{color: 'white'}}>AI 估算</ThemedText>
               </Pressable>
             )}
          </View>

          {/* 餐別 */}
          <View style={[styles.card, { backgroundColor: cardBackground }]}>
            <View style={{flexDirection: 'row', gap: 8, flexWrap: 'wrap'}}>
              {MEAL_OPTIONS.map(opt => (
                <Pressable key={opt.k} onPress={() => setMealType(opt.k)} style={[styles.chip, mealType === opt.k && {backgroundColor: tintColor}]}>
                  <ThemedText style={{color: mealType === opt.k ? 'white' : textColor}}>{opt.l}</ThemedText>
                </Pressable>
              ))}
            </View>
          </View>

          {/* 表單 */}
          <View style={[styles.card, { backgroundColor: cardBackground, marginTop: 16 }]}>
            <ThemedText style={styles.label}>食物名稱</ThemedText>
            <TextInput 
              style={[styles.input, {color: textColor, backgroundColor: 'white'}]}
              value={formData.foodName}
              onChangeText={(t) => setFormData({...formData, foodName: t})}
            />
            
            <View style={{flexDirection: 'row', gap: 12, marginTop: 12}}>
              <View style={{flex: 1}}><NumberInput label="熱量 (kcal)" value={formData.calories} onChange={(t) => setFormData({...formData, calories: t})} step={10} /></View>
              <View style={{flex: 1}}><NumberInput label="蛋白質 (g)" value={formData.protein} onChange={(t) => setFormData({...formData, protein: t})} /></View>
            </View>
            <View style={{flexDirection: 'row', gap: 12}}>
              <View style={{flex: 1}}><NumberInput label="碳水 (g)" value={formData.carbs} onChange={(t) => setFormData({...formData, carbs: t})} /></View>
              <View style={{flex: 1}}><NumberInput label="脂肪 (g)" value={formData.fat} onChange={(t) => setFormData({...formData, fat: t})} /></View>
            </View>
            
            {formData.suggestion ? <Text style={{marginTop: 8, color: '#2E7D32'}}>💡 {formData.suggestion}</Text> : null}
          </View>
        </View>
      </ScrollView>

      <View style={{ padding: 16, backgroundColor: cardBackground }}>
        <Pressable onPress={handleSave} style={[styles.btn, { backgroundColor: tintColor }]}>
          <ThemedText style={{ color: 'white', fontWeight: 'bold' }}>儲存</ThemedText>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', padding: 16 },
  image: { width: '100%', height: 200 },
  card: { padding: 16, borderRadius: 12 },
  btnSmall: { padding: 8, borderRadius: 8, borderWidth: 1, minWidth: 80, alignItems: 'center' },
  chip: { padding: 8, borderRadius: 20, borderWidth: 1, borderColor: '#ddd' },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10, fontSize: 16 },
  label: { fontSize: 12, color: '#666', marginBottom: 4 },
  btn: { padding: 16, borderRadius: 12, alignItems: 'center' }
});