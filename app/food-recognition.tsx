import { useLocalSearchParams, useRouter } from "expo-router";
import { useState, useEffect } from "react";
import { View, StyleSheet, Image, Pressable, ScrollView, TextInput, ActivityIndicator, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as ImageManipulator from 'expo-image-manipulator'; // [新增]
import { ThemedText } from "@/components/themed-text";
import { useThemeColor } from "@/hooks/use-theme-color";
import { analyzeFoodImage, analyzeFoodText } from "@/lib/gemini";
import { saveFoodLogLocal, saveProductLocal, getProductByBarcode, getFoodLogsLocal, updateFoodLogLocal } from "@/lib/storage";
import { NumberInput } from "@/components/NumberInput";
import { t, useLanguage } from "@/lib/i18n";

const MEAL_OPTIONS = [
  { k: 'breakfast', l: '早餐' }, { k: 'lunch', l: '午餐' }, 
  { k: 'snack', l: '點心' }, { k: 'dinner', l: '晚餐' }, { k: 'late_night', l: '消夜' }
];

const getMealTypeByTime = () => {
  const h = new Date().getHours();
  if (h < 11) return 'breakfast';
  if (h < 14) return 'lunch';
  if (h < 17) return 'snack';
  if (h < 21) return 'dinner';
  return 'late_night';
};

export default function FoodRecognitionScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const lang = useLanguage();
  
  const originalUri = params.imageUri as string;
  const isEditMode = params.mode === 'EDIT';
  const isBarcodeFallback = params.source === 'barcode_fallback';
  const editId = params.id ? Number(params.id) : null;

  const [imageUri, setImageUri] = useState(originalUri);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [mode, setMode] = useState<'AI' | 'MANUAL'>(params.mode === 'MANUAL' ? 'MANUAL' : 'AI');
  const [mealType, setMealType] = useState(getMealTypeByTime());

  const [stdData, setStdData] = useState({ 
    name: "", cal: "0", pro: "0", carb: "0", fat: "0", sod: "0", stdWeight: "100",
    descSuffix: "", detailedAnalysis: ""
  });
  
  const [inputType, setInputType] = useState<'serving'|'gram'>('serving');
  const [inputAmount, setInputAmount] = useState("1"); 
  const [inputGram, setInputGram] = useState("100");
  const [originalLog, setOriginalLog] = useState<any>(null);

  const backgroundColor = useThemeColor({}, "background");
  const cardBackground = useThemeColor({}, "cardBackground");
  const tintColor = useThemeColor({}, "tint");
  const textColor = useThemeColor({}, "text");
  const textSecondary = useThemeColor({}, "textSecondary");

  // [修正] 初始化：處理圖片壓縮與 AI 分析
  useEffect(() => {
    async function init() {
      // 1. 編輯模式
      if (isEditMode && editId) {
        setMode('MANUAL');
        const logs = await getFoodLogsLocal();
        const log = logs.find((l: any) => l.id === editId);
        if (log) {
          setOriginalLog(log);
          setMealType(log.mealType || getMealTypeByTime());
          
          let name = log.foodName;
          let suffix = "";
          if (name.includes(" (")) {
             const parts = name.split(" (");
             name = parts[0];
             suffix = parts[1].replace(")", "");
          }

          setStdData({
             name: name,
             descSuffix: suffix,
             cal: log.totalCalories.toString(),
             pro: log.totalProteinG.toString(),
             carb: log.totalCarbsG.toString(),
             fat: log.totalFatG.toString(),
             sod: log.totalSodiumMg.toString(),
             stdWeight: "100",
             detailedAnalysis: log.notes
          });
        }
      } 
      // 2. AI 模式：先壓縮圖片再分析
      else if (originalUri && mode === 'AI' && !stdData.name && !isAnalyzing) {
        setIsAnalyzing(true);
        try {
          // 壓縮圖片 (Resize to 800px width, JPEG 0.7 quality)
          // 這能大幅減少 Base64 字串長度，解決 "Request Entity Too Large" 或讀取失敗
          const manipulated = await ImageManipulator.manipulateAsync(
            originalUri,
            [{ resize: { width: 800 } }],
            { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
          );
          setImageUri(manipulated.uri); // 更新為壓縮後的 URI

          const result = await analyzeFoodImage(
            manipulated.uri, // 使用壓縮後的圖片
            lang, 
            isBarcodeFallback ? 'OCR' : 'NORMAL'
          );
          
          if (result && result.foodName) {
            fillStdData(result);
          } else {
            Alert.alert("分析失敗", "無法識別食物，請切換手動輸入");
            setMode('MANUAL');
          }
        } catch(e) {
          console.error(e);
          Alert.alert("錯誤", "圖片處理或連線異常");
          setMode('MANUAL');
        } finally {
          setIsAnalyzing(false);
        }
      }
    }
    init();
  }, [originalUri, isEditMode, editId]);

  const fillStdData = (data: any) => {
    setStdData({
      name: data.foodName || "",
      descSuffix: data.description_suffix || "",
      cal: data.calories?.toString() || "0",
      pro: data.macros?.protein?.toString() || "0",
      carb: data.macros?.carbs?.toString() || "0",
      fat: data.macros?.fat?.toString() || "0",
      sod: data.macros?.sodium?.toString() || "0",
      stdWeight: data.estimated_weight_g?.toString() || "100",
      detailedAnalysis: data.detailed_analysis || ""
    });
    setInputType('serving');
    setInputAmount("1");
    setInputGram(data.estimated_weight_g?.toString() || "100");
  };

  const handleNameBlur = async () => {
    if (!stdData.name || isEditMode) return;
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

  const saveToLog = async () => {
    const final = getFinal();
    const fullName = stdData.descSuffix ? `${stdData.name} (${stdData.descSuffix})` : stdData.name;
    
    const logData = {
      mealType,
      foodName: fullName,
      totalCalories: final.cal,
      totalProteinG: final.pro,
      totalCarbsG: final.carb,
      totalFatG: final.fat,
      totalSodiumMg: final.sod,
      imageUrl: imageUri || originalLog?.imageUrl,
      notes: stdData.detailedAnalysis
    };

    if (isEditMode && editId) {
      await updateFoodLogLocal({ ...originalLog, ...logData });
    } else {
      await saveFoodLogLocal(logData);
    }
    router.push('/(tabs)');
  };

  const handleSave = async () => {
    const dbProduct = await getProductByBarcode(stdData.name);
    let isBaseChanged = false;
    
    if (dbProduct) {
      if (dbProduct.cal != stdData.cal || dbProduct.stdWeight != stdData.stdWeight) {
        isBaseChanged = true;
      }
    }

    if (isBaseChanged) {
      Alert.alert(
        t('update_base_title', lang),
        t('update_base_msg', lang),
        [
          { text: t('no_update_one', lang), onPress: () => saveToLog() },
          { 
            text: t('yes_update_all', lang), 
            onPress: async () => {
              await saveProductLocal(stdData.name, {
                name: stdData.name, brand: "User Input",
                stdWeight: parseFloat(stdData.stdWeight)||100,
                cal: stdData.cal, pro: stdData.pro, carb: stdData.carb, fat: stdData.fat, sod: stdData.sod
              });
              saveToLog();
            }
          }
        ]
      );
    } else {
      if (!dbProduct) {
        await saveProductLocal(stdData.name, {
          name: stdData.name, brand: "User Input",
          stdWeight: parseFloat(stdData.stdWeight)||100,
          cal: stdData.cal, pro: stdData.pro, carb: stdData.carb, fat: stdData.fat, sod: stdData.sod
        });
      }
      saveToLog();
    }
  };

  const final = getFinal();

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 20), backgroundColor: cardBackground }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}><Ionicons name="arrow-back" size={24} color={textColor} /></Pressable>
        <ThemedText type="subtitle">{isEditMode ? t('edit', lang) : t('confirm_save', lang)}</ThemedText>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled">
        {imageUri ? (
          <Image source={{ uri: imageUri }} style={styles.image} resizeMode="contain" />
        ) : (
          <View style={[styles.image, {backgroundColor: '#eee', justifyContent:'center', alignItems:'center'}]}>
             <Ionicons name="fast-food" size={50} color="#ccc"/>
             <ThemedText style={{color:'#999', marginTop:10}}>{t('manual_input', lang)}</ThemedText>
          </View>
        )}

        <View style={{ padding: 16 }}>
          <View style={{flexDirection:'row', justifyContent:'space-between', marginBottom:16}}>
             {isAnalyzing ? (
               <View style={{flexDirection:'row', alignItems:'center'}}>
                 <ActivityIndicator color={tintColor} style={{marginRight:8}}/>
                 <ThemedText style={{color:tintColor}}>{t('ai_analyzing', lang)}</ThemedText>
               </View>
             ) : (
               !isEditMode && <View/>
             )}
             {!isEditMode && !isAnalyzing && (
               <Pressable onPress={() => setMode(m => m==='AI'?'MANUAL':'AI')} style={[styles.modeBtn, {borderColor:tintColor}]}>
                  <ThemedText style={{color:tintColor}}>{mode==='AI' ? t('switch_manual', lang) : t('return_ai', lang)}</ThemedText>
               </Pressable>
             )}
          </View>
          
          {mode === 'MANUAL' && (
             <Pressable onPress={handleTextAnalyze} style={[styles.btn, {backgroundColor: tintColor, marginBottom: 16, minHeight: 48}]}>
               <ThemedText style={{color: 'white', fontWeight:'bold'}}>AI 估算營養</ThemedText>
             </Pressable>
          )}

          <View style={[styles.card, { backgroundColor: cardBackground, marginBottom: 16 }]}>
            <ThemedText style={{fontSize: 14, color: textSecondary, marginBottom: 10}}>{t('meal_time', lang)}</ThemedText>
            <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: 10}}>
              {MEAL_OPTIONS.map(opt => (
                <Pressable key={opt.k} onPress={() => setMealType(opt.k)} style={[styles.chip, mealType===opt.k && {backgroundColor:tintColor, borderColor:tintColor}]}>
                  <ThemedText style={{color: mealType===opt.k?'white':textColor, fontSize: 14}}>{opt.l}</ThemedText>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={[styles.card, { backgroundColor: cardBackground }]}>
            <View style={{marginBottom: 12}}>
              <ThemedText style={{fontSize: 14, color: textSecondary, marginBottom: 6}}>{t('food_name', lang)} {t('input_hint_ai', lang)}</ThemedText>
              <TextInput 
                style={[styles.input, {color: textColor, borderColor: '#ccc', backgroundColor: 'white'}]}
                value={stdData.name}
                onChangeText={(t) => setStdData({...stdData, name: t})}
                onBlur={handleNameBlur}
              />
              {stdData.descSuffix ? <ThemedText style={{fontSize:12, color:textSecondary, marginTop:4}}>({stdData.descSuffix})</ThemedText> : null}
            </View>
            
            <View style={{flexDirection:'row', justifyContent:'space-between', marginBottom:10, marginTop:10}}>
                <Pressable onPress={()=>setInputType('serving')}><ThemedText style={{color:inputType==='serving'?tintColor:'#999', fontWeight:'bold'}}>{t('input_serving', lang)}</ThemedText></Pressable>
                <Pressable onPress={()=>setInputType('gram')}><ThemedText style={{color:inputType==='gram'?tintColor:'#999', fontWeight:'bold'}}>{t('input_gram', lang)}</ThemedText></Pressable>
             </View>
             {inputType === 'serving' ? (
                <NumberInput label={t('input_serving', lang)} value={inputAmount} onChange={setInputAmount} step={0.5} unit="份" />
             ) : (
                <NumberInput label={t('input_gram', lang)} value={inputGram} onChange={setInputGram} step={10} unit="g" />
             )}
             
             <View style={{backgroundColor:'#E3F2FD', padding:10, borderRadius:8, marginTop:10}}>
                <ThemedText style={{textAlign:'center', color:'#1565C0', fontWeight:'bold'}}>{t('calories', lang)}: {final.cal} kcal</ThemedText>
             </View>
          </View>

          {stdData.detailedAnalysis ? (
            <View style={[styles.card, { backgroundColor: cardBackground, marginTop: 16 }]}>
               <ThemedText style={{fontWeight:'bold', marginBottom:8}}>{t('ai_analysis_result', lang)}</ThemedText>
               <ThemedText style={{fontSize:14, color:textSecondary, lineHeight: 20}}>{stdData.detailedAnalysis}</ThemedText>
            </View>
          ) : null}

          <View style={[styles.card, { backgroundColor: cardBackground, marginTop: 16 }]}>
             <ThemedText style={{fontWeight:'bold', marginBottom:10}}>{t('standard_value', lang)}</ThemedText>
             <NumberInput label={t('estimated_weight', lang)} value={stdData.stdWeight} onChange={v => setStdData({...stdData, stdWeight: v})} step={10} />
             
             <View style={{flexDirection:'row', gap:10}}>
                <View style={{flex:1}}><NumberInput label={t('calories', lang)} value={stdData.cal} onChange={v => setStdData({...stdData, cal: v})} step={10}/></View>
                <View style={{flex:1}}><NumberInput label={t('protein', lang)} value={stdData.pro} onChange={v => setStdData({...stdData, pro: v})}/></View>
             </View>
             <View style={{flexDirection:'row', gap:10}}>
                <View style={{flex:1}}><NumberInput label={t('carbs', lang)} value={stdData.carb} onChange={v => setStdData({...stdData, carb: v})}/></View>
                <View style={{flex:1}}><NumberInput label={t('fat', lang)} value={stdData.fat} onChange={v => setStdData({...stdData, fat: v})}/></View>
             </View>
             <NumberInput label={`${t('sodium', lang)} (mg)`} value={stdData.sod} onChange={v => setStdData({...stdData, sod: v})} step={10}/>
          </View>
        </View>
      </ScrollView>

      <View style={{ padding: 16, backgroundColor: cardBackground }}>
        <Pressable onPress={handleSave} style={[styles.btn, { backgroundColor: tintColor }]}>
          <ThemedText style={{ color: 'white', fontWeight: 'bold', fontSize: 18 }}>{t('confirm_save_btn', lang)}</ThemedText>
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