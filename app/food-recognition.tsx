import { useLocalSearchParams, useRouter } from "expo-router";
import { useState, useEffect } from "react";
import { View, StyleSheet, Image, Pressable, ScrollView, TextInput, ActivityIndicator, Alert, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { ThemedText } from "@/components/themed-text";
import { useThemeColor } from "@/hooks/use-theme-color";
import { analyzeFoodImage, analyzeFoodText } from "@/lib/gemini";
import { saveFoodLogLocal, saveProductLocal, getProductByBarcode, getSettings } from "@/lib/storage";
import { NumberInput } from "@/components/NumberInput";

const MEAL_OPTIONS = [{ k: 'breakfast', l: '早餐' }, { k: 'lunch', l: '午餐' }, { k: 'snack', l: '點心' }, { k: 'dinner', l: '晚餐' }, { k: 'late_night', l: '消夜' }];
const getMealTypeByTime = () => { const h = new Date().getHours(); if (h < 11) return 'breakfast'; if (h < 14) return 'lunch'; if (h < 17) return 'snack'; if (h < 21) return 'dinner'; return 'late_night'; };

export default function FoodRecognitionScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  
  const imageUri = params.imageUri as string;
  const initialMode = params.mode === 'MANUAL' ? 'MANUAL' : 'AI';

  const [isAnalyzing, setIsAnalyzing] = useState(initialMode === 'AI' && !!imageUri);
  const [isSaving, setIsSaving] = useState(false);
  const [mode, setMode] = useState<'AI' | 'MANUAL'>(initialMode);
  const [mealType, setMealType] = useState(getMealTypeByTime());
  const [lang, setLang] = useState('zh-TW');

  // 標準數據
  const [stdData, setStdData] = useState({ 
    name: "", cal: "0", pro: "0", carb: "0", fat: "0", sod: "0", stdWeight: "100" 
  });
  
  // 使用者輸入
  const [inputType, setInputType] = useState<'serving'|'gram'>('serving');
  const [inputAmount, setInputAmount] = useState("1"); 
  const [inputGram, setInputGram] = useState("100");

  const backgroundColor = useThemeColor({}, "background");
  const cardBackground = useThemeColor({}, "cardBackground");
  const tintColor = useThemeColor({}, "tint");
  const textColor = useThemeColor({}, "text");
  const textSecondary = useThemeColor({}, "textSecondary");

  useEffect(() => { getSettings().then(s => { if(s.language) setLang(s.language); }); }, []);

  // 1. 自動分析圖片
  // [修正] 加入 mode, lang 作為依賴，確保切換時正確觸發
  useEffect(() => {
    async function autoAnalyze() {
      if (imageUri && mode === 'AI' && !stdData.name) {
        setIsAnalyzing(true);
        try {
          const result = await analyzeFoodImage(imageUri, lang);
          if (result && result.foodName !== "分析失敗") {
            fillStdData(result);
          } else {
            Alert.alert("分析失敗", "請手動輸入");
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
  }, [imageUri, mode, lang]); // 修正依賴

  const fillStdData = (data: any) => {
    setStdData({
      name: data.foodName || "",
      cal: data.calories?.toString() || "0",
      pro: data.macros?.protein?.toString() || "0",
      carb: data.macros?.carbs?.toString() || "0",
      fat: data.macros?.fat?.toString() || "0",
      sod: data.macros?.sodium?.toString() || "0",
      stdWeight: data.estimated_weight_g?.toString() || "100"
    });
    setInputType('serving');
    setInputAmount("1");
    setInputGram(data.estimated_weight_g?.toString() || "100");
  };

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
    }
  };

  const handleTextAnalyze = async () => {
    if (!stdData.name) return Alert.alert("請輸入食物名稱");
    setIsAnalyzing(true);
    try {
      const result = await analyzeFoodText(stdData.name, lang);
      if (result) fillStdData(result);
    } catch {
      Alert.alert("AI 無回應");
    } finally {
      setIsAnalyzing(false);
    }
  };

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

  const getFinal = () => {
    const ratio = (parseFloat(inputAmount) || 0); 
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

  const InputField = ({ label, value, onChange, onBlur }: any) => (
    <View style={{marginBottom: 12}}>
      <ThemedText style={{fontSize: 14, color: textSecondary, marginBottom: 6}}>{label}</ThemedText>
      <TextInput 
        style={[styles.input, {color: textColor, borderColor: '#ccc', backgroundColor: 'white'}]}
        value={value}
        onChangeText={onChange}
        onBlur={onBlur}
        placeholder="請輸入"
        placeholderTextColor="#999"
      />
    </View>
  );

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
             <ThemedText style={{color:'#999', marginTop:10}}>手動輸入模式</ThemedText>
          </View>
        )}

        <View style={{ padding: 16 }}>
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

          <View style={[styles.card, { backgroundColor: cardBackground, marginBottom: 16 }]}>
            <ThemedText style={{fontSize: 14, color: textSecondary, marginBottom: 10}}>用餐時段</ThemedText>
            <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: 10}}>
              {MEAL_OPTIONS.map(opt => (
                <Pressable key={opt.k} onPress={() => setMealType(opt.k)} style={[styles.chip, mealType===opt.k && {backgroundColor:tintColor, borderColor:tintColor}]}>
                  <ThemedText style={{color: mealType===opt.k?'white':textColor, fontSize: 14}}>{opt.l}</ThemedText>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={[styles.card, { backgroundColor: cardBackground }]}>
            <InputField label="食物名稱 (輸入後自動查詢)" value={stdData.name} onChange={(t:string) => setStdData({...stdData, name: t})} onBlur={handleNameBlur} />
            
            <View style={{flexDirection:'row', justifyContent:'space-between', marginBottom:10, marginTop:10}}>
                <Pressable onPress={()=>setInputType('serving')}><ThemedText style={{color:inputType==='serving'?tintColor:'#999', fontWeight:'bold'}}>輸入份數</ThemedText></Pressable>
                <Pressable onPress={()=>setInputType('gram')}><ThemedText style={{color:inputType==='gram'?tintColor:'#999', fontWeight:'bold'}}>輸入克數</ThemedText></Pressable>
             </View>
             {inputType === 'serving' ? (
                <NumberInput label="份數" value={inputAmount} onChange={setInputAmount} step={0.5} unit="份" />
             ) : (
                <NumberInput label="克數 (g)" value={inputGram} onChange={setInputGram} step={10} unit="g" />
             )}
             
             <View style={{backgroundColor:'#E3F2FD', padding:10, borderRadius:8, marginTop:10}}>
                <ThemedText style={{textAlign:'center', color:'#1565C0', fontWeight:'bold'}}>總計: {final.cal} kcal</ThemedText>
             </View>
          </View>

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