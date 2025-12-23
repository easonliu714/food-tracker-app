import { useRouter } from "expo-router";
import { useState, useEffect } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View, Alert, Modal } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { ThemedText } from "@/components/themed-text";
import { useAuth } from "@/hooks/use-auth";
import { useThemeColor } from "@/hooks/use-theme-color";
import { saveProfileLocal, getProfileLocal, saveSettings, getSettings } from "@/lib/storage";
import { validateApiKey } from "@/lib/gemini";
import { LANGUAGES, getVersionLogs, t, useLanguage, setAppLanguage } from "@/lib/i18n";

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isAuthenticated, logout } = useAuth();
  const lang = useLanguage();
  const versionLogs = getVersionLogs(lang);

  const [apiKey, setApiKey] = useState("");
  const [selectedModel, setSelectedModel] = useState("gemini-flash-latest");
  const [modelList, setModelList] = useState<string[]>([]);
  
  const [gender, setGender] = useState<"male"|"female">("male");
  const [birthYear, setBirthYear] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [currentWeight, setCurrentWeight] = useState("");
  const [bodyFat, setBodyFat] = useState("");
  const [targetWeight, setTargetWeight] = useState("");
  const [activityLevel, setActivityLevel] = useState("sedentary");
  
  const [loading, setLoading] = useState(true);
  const [testingKey, setTestingKey] = useState(false);
  const [showLangPicker, setShowLangPicker] = useState(false);
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [showVersionModal, setShowVersionModal] = useState(false);

  const backgroundColor = useThemeColor({}, "background");
  const cardBackground = useThemeColor({}, "cardBackground");
  const tintColor = useThemeColor({}, "tint");
  const textColor = useThemeColor({}, "text");
  const textSecondary = useThemeColor({}, "textSecondary");
  const borderColor = useThemeColor({}, "border") || '#ccc';

  useEffect(() => {
    async function load() {
      try {
        const s = await getSettings();
        if(s.apiKey) setApiKey(s.apiKey);
        if(s.model) setSelectedModel(s.model);
        
        const p = await getProfileLocal();
        if(p) {
          setGender(p.gender || "male");
          if(p.birthYear) setBirthYear(p.birthYear.toString());
          else if (p.birthDate) setBirthYear(new Date(p.birthDate).getFullYear().toString());
          
          setHeightCm(p.heightCm?.toString() || "");
          setCurrentWeight(p.currentWeightKg?.toString() || "");
          setBodyFat(p.bodyFatPercentage?.toString() || "");
          setTargetWeight(p.targetWeightKg?.toString() || "");
          setActivityLevel(p.activityLevel || "sedentary");
        }
      } catch (e) {
        console.error("Profile load error:", e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const calculateTDEE = (w: number, h: number, age: number, g: string, act: string) => {
    let bmr = 10 * w + 6.25 * h - 5 * age;
    bmr += g === 'male' ? 5 : -161;
    const multipliers: Record<string, number> = {
      'sedentary': 1.2, 'lightly_active': 1.375, 'moderately_active': 1.55, 'very_active': 1.725, 'extra_active': 1.9
    };
    return Math.round(bmr * (multipliers[act] || 1.2));
  };

  const handleSave = async () => {
    try {
      const cleanKey = apiKey.trim();
      setApiKey(cleanKey);
      setAppLanguage(lang); 
      await saveSettings({ apiKey: cleanKey, model: selectedModel, language: lang });
      
      const weight = parseFloat(currentWeight) || 70;
      const height = parseFloat(heightCm) || 170;
      const bYear = parseInt(birthYear) || 2000;
      const age = new Date().getFullYear() - bYear;
      
      const tdee = calculateTDEE(weight, height, age, gender, activityLevel);
      
      const targetW = parseFloat(targetWeight) || weight;
      let adjustedTarget = tdee;
      if (targetW < weight) adjustedTarget -= 500;
      else if (targetW > weight) adjustedTarget += 300;
      adjustedTarget = Math.max(adjustedTarget, 1200);

      await saveProfileLocal({
        gender,
        birthYear: bYear,
        heightCm: parseInt(heightCm),
        currentWeightKg: weight,
        bodyFatPercentage: parseFloat(bodyFat),
        targetWeightKg: targetW,
        activityLevel,
        dailyCalorieTarget: adjustedTarget
      });
      Alert.alert(t('save_settings', lang), `設定已更新！TDEE: ${tdee}, 每日建議: ${adjustedTarget} kcal`);
    } catch (e) {
      Alert.alert("儲存失敗", "請稍後再試");
    }
  };

  const handleTestKey = async () => {
    const cleanKey = apiKey.trim();
    if (!cleanKey) return Alert.alert("請輸入 API Key");
    setTestingKey(true);
    const res = await validateApiKey(cleanKey);
    setTestingKey(false);
    if (res.valid && res.models) {
      setModelList(res.models);
      // 自動選取 gemini-flash-latest
      if(res.models.includes('gemini-flash-latest')) {
          setSelectedModel('gemini-flash-latest');
      } else if(res.models.length > 0) {
          setSelectedModel(res.models[0]);
      }
      Alert.alert("測試成功", `金鑰有效！已切換至 ${selectedModel}`);
    } else {
      Alert.alert("測試失敗", res.error || "無法連線");
    }
  };

  if (loading) return <View style={[styles.container, {backgroundColor, justifyContent:'center', alignItems:'center'}]}><ActivityIndicator size="large" color={tintColor}/></View>;

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 20) }]}>
        <ThemedText type="title">{t('tab_settings', lang)}</ThemedText>
        <Pressable onPress={() => setShowLangPicker(true)} style={[styles.langBtn, {borderColor}]}>
           <ThemedText>{LANGUAGES.find(l=>l.code===lang)?.label || lang}</ThemedText>
           <Ionicons name="chevron-down" size={16} color={textColor} style={{marginLeft:4}}/>
        </Pressable>
      </View>

      <ScrollView style={{paddingHorizontal: 16}}>
         <View style={[styles.card, {backgroundColor: cardBackground}]}>
            <ThemedText type="subtitle">{t('ai_settings', lang)}</ThemedText>
            <View style={{marginTop:12}}>
              <ThemedText style={{fontSize:12, color:textSecondary, marginBottom:4}}>Gemini API Key</ThemedText>
              <TextInput style={[styles.input, {color: textColor, borderColor}]} value={apiKey} onChangeText={setApiKey} placeholder={t('api_key_placeholder', lang)} />
            </View>
            <View style={{flexDirection: 'row', gap: 10, marginTop: 12, alignItems: 'center'}}>
                <Pressable onPress={handleTestKey} disabled={testingKey} style={[styles.testBtn, {backgroundColor: tintColor, opacity: testingKey?0.5:1}]}>
                  {testingKey ? <ActivityIndicator color="white"/> : <ThemedText style={{color: 'white', fontWeight: 'bold'}}>{t('test_key', lang)}</ThemedText>}
                </Pressable>
            </View>
            <View style={{marginTop: 12}}>
                <ThemedText style={{fontSize:12, color:textSecondary, marginBottom:4}}>{t('current_model', lang)}</ThemedText>
                <Pressable onPress={() => modelList.length > 0 && setShowModelPicker(true)} style={[styles.input, {justifyContent:'center', borderColor}]}><ThemedText>{selectedModel}</ThemedText></Pressable>
            </View>
         </View>

         <View style={[styles.card, {backgroundColor: cardBackground, marginTop: 16}]}>
            <ThemedText type="subtitle" style={{marginBottom:12}}>{t('basic_info', lang)}</ThemedText>
            <View style={{marginBottom: 12}}>
               <ThemedText style={{marginBottom:5}}>{t('gender', lang)}</ThemedText>
               <View style={styles.row}>
                  {["male", "female"].map(g => (
                    <Pressable key={g} onPress={() => setGender(g as any)} style={[styles.option, gender === g && {backgroundColor: tintColor, borderColor: tintColor}]}>
                       <ThemedText style={{color: gender===g?'white':textColor}}>{t(g, lang)}</ThemedText>
                    </Pressable>
                  ))}
               </View>
            </View>
            
            <View style={{marginBottom: 12}}>
               <ThemedText style={{fontSize:12, color:textSecondary, marginBottom:4}}>{t('birth_year', lang) || "出生年份 (Year)"}</ThemedText>
               <TextInput style={[styles.input, {color:textColor, borderColor}]} value={birthYear} onChangeText={setBirthYear} keyboardType="numeric" placeholder="YYYY" />
            </View>

            <View style={styles.row}>
               <View style={{flex:1}}><ThemedText style={{fontSize:12, color:textSecondary}}>{t('height', lang)}</ThemedText><TextInput style={[styles.input, {color:textColor, borderColor}]} value={heightCm} onChangeText={setHeightCm} keyboardType="numeric"/></View>
               <View style={{width:10}}/>
               <View style={{flex:1}}><ThemedText style={{fontSize:12, color:textSecondary}}>{t('weight', lang)}</ThemedText><TextInput style={[styles.input, {color:textColor, borderColor}]} value={currentWeight} onChangeText={setCurrentWeight} keyboardType="numeric"/></View>
            </View>
            <View style={[styles.row, {marginTop:10}]}>
               <View style={{flex:1}}><ThemedText style={{fontSize:12, color:textSecondary}}>{t('body_fat', lang)}</ThemedText><TextInput style={[styles.input, {color:textColor, borderColor}]} value={bodyFat} onChangeText={setBodyFat} keyboardType="numeric"/></View>
               <View style={{width:10}}/>
               <View style={{flex:1}}><ThemedText style={{fontSize:12, color:textSecondary}}>{t('target_weight', lang)}</ThemedText><TextInput style={[styles.input, {color:textColor, borderColor}]} value={targetWeight} onChangeText={setTargetWeight} keyboardType="numeric"/></View>
            </View>
            
            <View style={{marginTop:12}}>
               <ThemedText style={{marginBottom:5}}>{t('activity_level', lang)}</ThemedText>
               <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {['sedentary', 'lightly_active', 'moderately_active', 'very_active'].map(a => (
                    <Pressable key={a} onPress={()=>setActivityLevel(a)} style={[styles.chip, activityLevel===a && {backgroundColor:tintColor, borderColor:tintColor}]}>
                       <ThemedText style={{color: activityLevel===a?'white':textColor}}>{t(a, lang)}</ThemedText>
                    </Pressable>
                  ))}
               </ScrollView>
            </View>
         </View>

         <Pressable onPress={handleSave} style={[styles.btn, {backgroundColor: tintColor, marginTop: 20}]}>
            <ThemedText style={{color:'white', fontWeight:'bold', fontSize:16}}>{t('save_settings', lang)}</ThemedText>
         </Pressable>

         <Pressable onPress={logout} style={[styles.btn, {borderColor: '#FF3B30', borderWidth:1, marginTop: 12}]}>
            <ThemedText style={{color: '#FF3B30'}}>{t('logout', lang)}</ThemedText>
         </Pressable>

         <Pressable onPress={() => setShowVersionModal(true)} style={{marginTop: 20, alignItems:'center', padding:10}}>
            <ThemedText style={{color: textSecondary, textDecorationLine:'underline'}}>{t('version_history', lang)} (v1.0.7)</ThemedText>
         </Pressable>
         <View style={{height:50}}/>
      </ScrollView>

      <Modal visible={showLangPicker} transparent animationType="fade">
         <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, {backgroundColor: cardBackground}]}>
               {LANGUAGES.map(l => (
                 <Pressable key={l.code} onPress={()=>{ setAppLanguage(l.code); setShowLangPicker(false); }} style={{padding:15}}><ThemedText>{l.label}</ThemedText></Pressable>
               ))}
            </View>
         </View>
      </Modal>
      <Modal visible={showModelPicker} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, {backgroundColor: cardBackground}]}>
            <ScrollView style={{maxHeight: 300}}>
              {modelList.map(m => (<Pressable key={m} onPress={() => {setSelectedModel(m); setShowModelPicker(false);}} style={{padding: 15}}><ThemedText>{m}</ThemedText></Pressable>))}
            </ScrollView>
          </View>
        </View>
      </Modal>
      <Modal visible={showVersionModal} transparent animationType="slide">
         <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, {backgroundColor:cardBackground}]}>
               <ScrollView style={{maxHeight:400}}>
                  {versionLogs.map((v, i)=>(
                     <View key={i} style={{marginBottom:15}}>
                        <ThemedText style={{fontWeight:'bold', marginBottom:2}}>{v.version} ({v.date})</ThemedText>
                        <ThemedText style={{fontSize:13, color:textSecondary}}>{v.content}</ThemedText>
                     </View>
                  ))}
               </ScrollView>
               <Pressable onPress={()=>setShowVersionModal(false)} style={[styles.btn, {backgroundColor:tintColor, marginTop:10}]}><ThemedText style={{color:'white'}}>關閉</ThemedText></Pressable>
            </View>
         </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20 },
  langBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderRadius: 20 },
  card: { padding: 20, borderRadius: 16 },
  input: { borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 16, backgroundColor: 'white', height: 48 },
  row: { flexDirection: 'row' },
  option: { flex: 1, padding: 10, borderWidth: 1, borderColor: '#ddd', alignItems: 'center', borderRadius: 8, marginHorizontal: 2 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: '#ddd', borderRadius: 20, marginRight: 8 },
  testBtn: { padding: 12, borderRadius: 10, alignItems: 'center', flex: 1 },
  btn: { padding: 16, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 30 },
  modalContent: { padding: 20, borderRadius: 16 }
});