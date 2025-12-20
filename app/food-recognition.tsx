import { useLocalSearchParams, useRouter } from "expo-router";
import { useState, useEffect } from "react";
import { View, StyleSheet, Image, Pressable, ScrollView, TextInput, ActivityIndicator, Alert, Text, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { ThemedText } from "@/components/themed-text";
import { useThemeColor } from "@/hooks/use-theme-color";
import { analyzeFoodImage, analyzeFoodText } from "@/lib/gemini";
import { saveFoodLogLocal, saveProductLocal, getProductByBarcode, getSettings } from "@/lib/storage";
import { NumberInput } from "@/components/NumberInput";

// 餐別選項
const MEAL_OPTIONS = [{ k: 'breakfast', l: '早餐' }, { k: 'lunch', l: '午餐' }, { k: 'snack', l: '點心' }, { k: 'dinner', l: '晚餐' }, { k: 'late_night', l: '消夜' }];
const getMealTypeByTime = () => { const h = new Date().getHours(); if (h < 11) return 'breakfast'; if (h < 14) return 'lunch'; if (h < 17) return 'snack'; if (h < 21) return 'dinner'; return 'late_night'; };

export default function FoodRecognitionScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  
  // 圖片 Uri (可能是裁切過的)
  const [imageUri, setImageUri] = useState<string | null>(params.imageUri as string);
  const initialMode = params.mode === 'MANUAL' ? 'MANUAL' : 'AI';

  const [isAnalyzing, setIsAnalyzing] = useState(false); // 預設不自動跑，等待使用者確認裁切或輸入
  const [isSaving, setIsSaving] = useState(false);
  const [mode, setMode] = useState<'AI' | 'MANUAL'>(initialMode);
  const [mealType, setMealType] = useState(getMealTypeByTime());
  const [lang, setLang] = useState('zh-TW');

  // [修改] 資料結構分離：Input (食用量) vs Standard (標準值)
  // Standard Data (每 100g/ml)
  const [stdData, setStdData] = useState({ 
    name: "", cal: "0", pro: "0", carb: "0", fat: "0", sod: "0", stdWeight: "100" 
  });
  
  // Intake Input
  const [inputType, setInputType] = useState<'serving'|'gram'>('serving');
  const [inputAmount, setInputAmount] = useState("1"); // 1份
  const [inputGram, setInputGram] = useState("100"); // 100g

  const backgroundColor = useThemeColor({}, "background");
  const cardBackground = useThemeColor({}, "cardBackground");
  const tintColor = useThemeColor({}, "tint");
  const textColor = useThemeColor({}, "text");

  useEffect(() => { getSettings().then(s => { if(s.language) setLang(s.language); }); }, []);

  // 1. 自動分析 (僅當有圖片且尚未分析過)
  useEffect(() => {
    async function autoAnalyze() {
      if (imageUri && mode === 'AI' && !stdData.name) {
        setIsAnalyzing(true);
        try {
          const result = await analyzeFoodImage(imageUri, lang);
          if (result && result.foodName !== "分析失敗") {
            fillStdData(result);
          } else {
            Alert.alert("分析失敗", "請嘗試手動輸入");
            setMode('MANUAL');
          }
        } catch(e) {
          setMode('MANUAL');
        } finally {
          setIsAnalyzing(false);
        }
      }
    }
    autoAnalyze();
  }, [imageUri]); // 依賴 imageUri

  // 填入數據 (AI 回傳的是總量預估，我們將其視為 "一份" 的標準值)
  const fillStdData = (data: any) => {
    setStdData({
      name: data.foodName || "",
      cal: data.calories?.toString() || "0",
      pro: data.macros?.protein?.toString() || "0",
      carb: data.macros?.carbs?.toString() || "0",
      fat: data.macros?.fat?.toString() || "0",
      sod: data.macros?.sodium?.toString() || "0",
      stdWeight: data.estimated_weight_g?.toString() || "100" // AI 估計的這份重量
    });
    // 重置輸入為 1 份
    setInputType('serving');
    setInputAmount("1");
    setInputGram(data.estimated_weight_g?.toString() || "100");
  };

  // 名稱模糊查詢 (手輸模式)
  const handleNameBlur = async () => {
    if (!stdData.name) return;
    const saved = await getProductByBarcode(stdData.name);
    if (saved) {
      setStdData({
        ...stdData,
        cal: saved.cal?.toString(),
        pro: saved.pro?.toString(),
        carb: saved.carb?.toString(),
        fat: saved.fat?.toString(),
        sod: saved.sod?.toString() || "0",
        stdWeight: saved.stdWeight?.toString() || "100"
      });
      Alert.alert("已載入", "發現資料庫中有此食物，已自動帶入數值。");
    }
  };

  // AI 文字估算
  const handleTextAnalyze = async () => {
    if (!stdData.name) return Alert.alert("請輸入食物名稱");
    setIsAnalyzing(true);
    try {
      const result = await analyzeFoodText(stdData.name, lang);
      if (result) fillStdData(result);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // 連動計算：份數 <-> 克數
  useEffect(() => {
    const stdW = parseFloat(stdData.stdWeight) || 100;
    if (inputType === 'serving') {
      const g = (parseFloat(inputAmount) || 0) * stdW;
      if (Math.abs(g - (parseFloat(inputGram)||0)) > 0.1) setInputGram(g.toFixed(0));
    } else {
      const s = (parseFloat(inputGram) || 0) / stdW;
      if (Math.abs(s - (parseFloat(inputAmount)||0)) > 0.1) setInputAmount(s.toFixed(1));
    }
  }, [inputAmount, inputGram, inputType, stdData.stdWeight]);

  // 最終計算
  const getFinal = () => {
    // 假設 stdData 是 "每份(stdWeight)" 的數值 (AI 邏輯) 或是 "每100g" 的數值 (掃碼邏輯)
    // 這裡統一邏輯：stdData 顯示的是 "一份" (User defined standard portion) 的數值
    // 使用者輸入幾份，就乘幾倍。
    // 如果使用者改克數，則 ratio = 輸入克數 / 標準份量克數
    const ratio = (parseFloat(inputAmount) || 0); 
    
    // 備註：如果 stdData 的 cal 是 per 100g，那這裡邏輯要改。
    // 根據需求 2，希望像掃碼一樣。掃碼通常是：下方顯示 "每 100g 數值"，上方輸入 "克數"。
    // 但 AI 估算通常給的是 "這一碗 (300g) 多少卡"。
    // 折衷：我們把 stdData 當作 "基準單位資料"。
    // 為了符合需求 2，我們將介面顯示為 "基準值 (可編輯為 100g 或 1份)"。
    
    return {
      cal: Math.round((parseFloat(stdData.cal)||0) * ratio),
      pro: Math.round((parseFloat(stdData.pro)||0) * ratio),
      carb: Math.round((parseFloat(stdData.carb)||0) * ratio),
      fat: Math.round((parseFloat(stdData.fat)||0) * ratio),
      sod: Math.round((parseFloat(stdData.sod)||0) * ratio),
    };
  };

  const handleSave = async () => {
    const final = getFinal();
    await saveProductLocal(stdData.name, {
      name: stdData.name,
      brand: "User Input",
      stdWeight: parseFloat(stdData.stdWeight)||100,
      cal: stdData.cal, pro: stdData.pro, carb: stdData.carb, fat: stdData.fat, sod: stdData.sod
    });

    await saveFoodLogLocal({
      mealType,
      foodName: stdData.name,
      totalCalories: final.cal,
      totalProteinG: final.pro,
      totalCarbsG: final.carb,
      totalFatG: final.fat,
      totalSodiumMg: final.sod,
      imageUrl: imageUri,
      notes: `手輸/AI: ${inputGram}g`
    });
    router.push('/(tabs)');
  };

  const final = getFinal();

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 20), backgroundColor: cardBackground }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}><Ionicons name="arrow-back" size={24} color={textColor} /></Pressable>
        <ThemedText type="subtitle">食物確認</ThemedText>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={{ flex: 1 }}>
        {imageUri ? (
          <Image source={{ uri: imageUri }} style={styles.image} resizeMode="contain" />
        ) : (
          <View style={[styles.image, {backgroundColor: '#eee', justifyContent:'center', alignItems:'center'}]}>
             <Ionicons name="fast-food" size={50} color="#ccc"/>
             <ThemedText style={{color:'#999'}}>無圖片</ThemedText>
          </View>
        )}

        <View style={{ padding: 16 }}>
          {/* 模式與 AI 狀態 */}
          <View style={{flexDirection:'row', justifyContent:'space-between', marginBottom:16}}>
             {isAnalyzing && <ActivityIndicator color={tintColor} />}
             <Pressable onPress={() => setMode(m => m==='AI'?'MANUAL':'AI')} style={[styles.modeBtn, {borderColor:tintColor}]}>
                <ThemedText style={{color:tintColor}}>{mode==='AI'?'切換手動':'返回 AI'}</ThemedText>
             </Pressable>
          </View>
          
          {mode === 'MANUAL' && (
             <Pressable onPress={handleTextAnalyze} style={[styles.btn, {backgroundColor: tintColor, marginBottom: 16, minHeight: 48}]}>
               <ThemedText style={{color: 'white', fontWeight:'bold'}}>AI 估算營養</ThemedText>
             </Pressable>
          )}

          {/* 1. 名稱與餐別 */}
          <View style={[styles.card, { backgroundColor: cardBackground }]}>
            <ThemedText style={{fontSize: 12, color: '#666'}}>食物名稱 (輸入後自動查詢)</ThemedText>
            <TextInput 
               style={[styles.input, {color: textColor, backgroundColor: 'white'}]} 
               value={stdData.name} 
               onChangeText={t => setStdData({...stdData, name: t})} 
               onBlur={handleNameBlur}
               placeholder="例如: 牛肉麵"
            />
            <View style={{flexDirection: 'row', gap: 8, marginTop: 10, flexWrap:'wrap'}}>
              {MEAL_OPTIONS.map(opt => (
                <Pressable key={opt.k} onPress={() => setMealType(opt.k)} style={[styles.chip, mealType===opt.k && {backgroundColor:tintColor}]}>
                  <ThemedText style={{color: mealType===opt.k?'white':textColor}}>{opt.l}</ThemedText>
                </Pressable>
              ))}
            </View>
          </View>

          {/* 2. 份量輸入區 (對齊 Barcode 介面) */}
          <View style={[styles.card, { backgroundColor: cardBackground, marginTop: 16 }]}>
             <View style={{flexDirection:'row', justifyContent:'space-between', marginBottom:10}}>
                <Pressable onPress={()=>setInputType('serving')}><ThemedText style={{color:inputType==='serving'?tintColor:'#999', fontWeight:'bold'}}>輸入份數</ThemedText></Pressable>
                <Pressable onPress={()=>setInputType('gram')}><ThemedText style={{color:inputType==='gram'?tintColor:'#999', fontWeight:'bold'}}>輸入克數</ThemedText></Pressable>
             </View>
             {inputType === 'serving' ? (
                <NumberInput label="份數" value={inputAmount} onChange={setInputAmount} step={0.5} unit="份" />
             ) : (
                <NumberInput label="克數 (g)" value={inputGram} onChange={setInputGram} step={10} unit="g" />
             )}
             
             <View style={{backgroundColor:'#E3F2FD', padding:10, borderRadius:8, marginTop:10}}>
                <ThemedText style={{textAlign:'center', color:'#1565C0', fontWeight:'bold'}}>
                   總計: {final.cal} kcal
                </ThemedText>
             </View>
          </View>

          {/* 3. 標準值設定 (基準) */}
          <View style={[styles.card, { backgroundColor: cardBackground, marginTop: 16 }]}>
             <ThemedText style={{fontWeight:'bold', marginBottom:10}}>基準數值 (每 1 份)</ThemedText>
             <NumberInput label="一份重量 (g)" value={stdData.stdWeight} onChange={v => setStdData({...stdData, stdWeight: v})} step={10} />
             
             <View style={{flexDirection:'row', gap:10}}>
                <View style={{flex:1}}><NumberInput label="熱量" value={stdData.cal} onChange={v => setStdData({...stdData, cal: v})} step={10}/></View>
                <View style={{flex:1}}><NumberInput label="蛋白質" value={stdData.pro} onChange={v => setStdData({...stdData, pro: v})}/></View>
             </View>
             <View style={{flexDirection:'row', gap:10}}>
                <View style={{flex:1}}><NumberInput label="碳水" value={stdData.carb} onChange={v => setStdData({...stdData, carb: v})}/></View>
                <View style={{flex:1}}><NumberInput label="脂肪" value={stdData.fat} onChange={v => setStdData({...stdData, fat: v})}/></View>
             </View>
             <NumberInput label="鈉 (mg)" value={stdData.sod} onChange={v => setStdData({...stdData, sod: v})} step={10}/>
          </View>

        </View>
      </ScrollView>

      <View style={{ padding: 16, backgroundColor: cardBackground }}>
        <Pressable onPress={handleSave} style={[styles.btn, { backgroundColor: tintColor }]}>
          <ThemedText style={{ color: 'white', fontWeight: 'bold', fontSize: 18 }}>確認並儲存</ThemedText>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16 },
  backBtn: { padding: 8 },
  image: { width: '100%', height: 250 },
  card: { padding: 16, borderRadius: 16 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10, marginTop: 4, fontSize: 16 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: '#ddd' },
  modeBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1 },
  btn: { padding: 16, borderRadius: 16, alignItems: 'center', justifyContent: 'center' }
});