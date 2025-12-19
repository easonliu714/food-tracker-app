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
  { k: 'breakfast', l: '早餐' }, 
  { k: 'lunch', l: '午餐' }, 
  { k: 'snack', l: '點心' },
  { k: 'dinner', l: '晚餐' }, 
  { k: 'late_night', l: '消夜' }
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
    sod: "0",
    weight: "100",
    suggestion: "",
    detectedObject: ""
  });

  const backgroundColor = useThemeColor({}, "background");
  const cardBackground = useThemeColor({}, "cardBackground");
  const tintColor = useThemeColor({}, "tint");
  const textColor = useThemeColor({}, "text");
  const textSecondary = useThemeColor({}, "textSecondary");

  // 1. 自動圖片分析
  useEffect(() => {
    async function analyze() {
      if (!imageUri) return;
      try {
        setIsAnalyzing(true);
        const result = await analyzeFoodImage(imageUri);
        processResult(result);
      } catch (e) {
        Alert.alert("錯誤", "圖片分析失敗，請檢查網路或 API Key 設定");
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
        sod: result.macros?.sodium?.toString() || "0",
        weight: result.estimated_weight_g?.toString() || "100",
        suggestion: result.suggestion || "",
        detectedObject: result.detectedObject || "文字輸入"
      });
    } else {
      Alert.alert("分析失敗", "無法識別內容，請手動輸入");
      setMode('MANUAL');
    }
  };

  const handleSave = async () => {
    if (!formData.foodName) {
      return Alert.alert("請輸入食物名稱");
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
        totalSodiumMg: parseFloat(formData.sod) || 0,
        imageUrl: imageUri,
        notes: `AI識別(${formData.weight}g): ${formData.detectedObject}`
      });
      router.push('/(tabs)');
    } catch (error) {
      Alert.alert("儲存失敗");
    } finally {
      setIsSaving(false);
    }
  };

  // 輸入框組件
  const InputField = ({ label, value, onChange }: any) => (
    <View style={{marginBottom: 12}}>
      <ThemedText style={{fontSize: 14, color: textSecondary, marginBottom: 6}}>{label}</ThemedText>
      <TextInput 
        style={[styles.input, {color: textColor, borderColor: '#ccc', backgroundColor: 'white'}]}
        value={value}
        onChangeText={onChange}
        placeholder="請輸入"
        placeholderTextColor="#999"
      />
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 20), backgroundColor: cardBackground }]}>
        <Pressable onPress={() => router.back()} style={styles.backButton}><Ionicons name="arrow-back" size={24} color={textColor} /></Pressable>
        <ThemedText type="subtitle">食物確認</ThemedText>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={{ flex: 1 }}>
        {imageUri ? (
          <Image source={{ uri: imageUri }} style={styles.image} resizeMode="cover" />
        ) : (
          <View style={[styles.image, {backgroundColor: '#eee', justifyContent: 'center', alignItems: 'center'}]}>
            <ThemedText style={{color: '#999'}}>無圖片</ThemedText>
          </View>
        )}

        <View style={{ padding: 16 }}>
          {/* 模式切換與狀態 */}
          <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16}}>
             {isAnalyzing ? (
               <View style={{flexDirection: 'row', alignItems: 'center'}}><ActivityIndicator size="small" color={tintColor}/><ThemedText style={{marginLeft: 8}}>AI 分析中...</ThemedText></View>
             ) : (
               <View>
                 <ThemedText type="subtitle">{mode === 'AI' ? 'AI 分析結果' : '手動輸入模式'}</ThemedText>
                 {mode === 'AI' && formData.detectedObject && <Text style={{fontSize: 12, color: '#888', marginTop: 4}}>偵測到: {formData.detectedObject}</Text>}
               </View>
             )}
             <Pressable onPress={() => setMode(m => m === 'AI' ? 'MANUAL' : 'AI')} style={[styles.modeBtn, {borderColor: tintColor}]}>
               <ThemedText style={{color: tintColor, fontSize: 14, fontWeight: '600'}}>{mode === 'AI' ? '切換手動' : '返回 AI'}</ThemedText>
             </Pressable>
          </View>

          {/* 手動模式下的 AI 文字分析按鈕 (加大) */}
          {mode === 'MANUAL' && (
             <Pressable onPress={handleTextAnalyze} style={[styles.btn, {backgroundColor: tintColor, marginBottom: 20, minHeight: 50}]}>
               <ThemedText style={{color: 'white', fontSize: 16, fontWeight: 'bold'}}>以「食物名稱」讓 AI 估算</ThemedText>
             </Pressable>
          )}

          {/* 餐別選擇 */}
          <View style={[styles.card, { backgroundColor: cardBackground, marginBottom: 16 }]}>
            <ThemedText style={{fontSize: 14, color: textSecondary, marginBottom: 10}}>用餐時段</ThemedText>
            <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: 10}}>
              {MEAL_OPTIONS.map(opt => (
                <Pressable key={opt.k} onPress={() => setMealType(opt.k)} style={[styles.chip, mealType === opt.k && {backgroundColor: tintColor, borderColor: tintColor}]}>
                  <ThemedText style={{color: mealType === opt.k ? 'white' : textColor, fontSize: 14}}>{opt.l}</ThemedText>
                </Pressable>
              ))}
            </View>
          </View>

          {/* 資料表單 */}
          <View style={[styles.card, { backgroundColor: cardBackground }]}>
            <InputField label="食物名稱" value={formData.foodName} onChange={(t:string) => setFormData({...formData, foodName: t})} />
            
            <NumberInput label="估計重量 (g)" value={formData.weight} onChange={(t) => setFormData({...formData, weight: t})} step={10} />

            <View style={{flexDirection: 'row', gap: 16}}>
              <View style={{flex: 1}}><NumberInput label="熱量 (kcal)" value={formData.calories} onChange={(t) => setFormData({...formData, calories: t})} step={10} /></View>
              <View style={{flex: 1}}><NumberInput label="蛋白質 (g)" value={formData.protein} onChange={(t) => setFormData({...formData, protein: t})} /></View>
            </View>
            <View style={{flexDirection: 'row', gap: 16}}>
              <View style={{flex: 1}}><NumberInput label="碳水 (g)" value={formData.carbs} onChange={(t) => setFormData({...formData, carbs: t})} /></View>
              <View style={{flex: 1}}><NumberInput label="脂肪 (g)" value={formData.fat} onChange={(t) => setFormData({...formData, fat: t})} /></View>
            </View>
            <NumberInput label="鈉 (mg)" value={formData.sod} onChange={(t) => setFormData({...formData, sod: t})} step={10} />
            
            {formData.suggestion ? (
              <View style={{marginTop: 12, padding: 12, backgroundColor: '#E8F5E9', borderRadius: 8}}>
                <ThemedText style={{color: '#2E7D32', fontSize: 14, lineHeight: 20}}>💡 {formData.suggestion}</ThemedText>
              </View>
            ) : null}
          </View>
        </View>
      </ScrollView>

      {/* 底部儲存按鈕 (加大) */}
      <View style={{ padding: 16, backgroundColor: cardBackground, borderTopWidth: 1, borderTopColor: '#eee' }}>
        <Pressable onPress={handleSave} style={[styles.btn, { backgroundColor: tintColor }]} disabled={isSaving}>
          {isSaving ? <ActivityIndicator color="white" /> : <ThemedText style={{ color: 'white', fontWeight: 'bold', fontSize: 18 }}>確認並儲存</ThemedText>}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', padding: 16, alignItems: 'center' },
  backButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  image: { width: '100%', height: 220 },
  card: { padding: 16, borderRadius: 16 },
  modeBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  chip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#ddd' },
  input: { borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 16, height: 50 },
  btn: { padding: 16, borderRadius: 16, alignItems: 'center', justifyContent: 'center', minHeight: 56 },
  btnSmall: { padding: 12, borderRadius: 10, borderWidth: 1, minWidth: 100, alignItems: 'center' }
});