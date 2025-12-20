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
import { LANGUAGES, VERSION_LOGS, t } from "@/lib/i18n";

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isAuthenticated, logout } = useAuth();
  
  const [lang, setLang] = useState("zh-TW");
  const [apiKey, setApiKey] = useState("");
  const [selectedModel, setSelectedModel] = useState("gemini-2.5-flash");
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
  // [修正] 移除可能導致崩潰的 borderColor 引用，直接使用顏色碼或 textSecondary

  useEffect(() => {
    async function load() {
      try {
        const s = await getSettings();
        if(s.language) setLang(s.language);
        if(s.apiKey) setApiKey(s.apiKey);
        if(s.model) setSelectedModel(s.model);
        
        const p = await getProfileLocal();
        if(p) {
          setGender(p.gender || "male");
          if(p.birthDate) setBirthYear(new Date(p.birthDate).getFullYear().toString());
          setHeightCm(p.heightCm?.toString() || "");
          setCurrentWeight(p.currentWeightKg?.toString() || "");
          setBodyFat(p.bodyFatPercentage?.toString() || "");
          setTargetWeight(p.targetWeightKg?.toString() || "");
          setActivityLevel(p.activityLevel || "sedentary");
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    if(isAuthenticated) load();
  }, [isAuthenticated]);

  const handleSave = async () => {
    await saveSettings({ apiKey, model: selectedModel, language: lang });
    await saveProfileLocal({
      gender,
      birthDate: birthYear ? new Date(parseInt(birthYear), 0, 1).toISOString() : undefined,
      heightCm: parseInt(heightCm),
      currentWeightKg: parseFloat(currentWeight),
      bodyFatPercentage: parseFloat(bodyFat),
      targetWeightKg: parseFloat(targetWeight),
      activityLevel,
      dailyCalorieTarget: 2000 
    });
    Alert.alert(t('save_settings', lang), "OK");
  };

  const handleTestKey = async () => {
    if (!apiKey) return Alert.alert("請輸入 API Key");
    setTestingKey(true);
    const res = await validateApiKey(apiKey);
    setTestingKey(false);
    
    if (res.valid && res.models) {
      setModelList(res.models);
      const recommended = ['gemini-2.5-flash', 'gemini-flash-latest', 'gemini-2.0-flash'];
      const bestMatch = recommended.find(m => res.models.includes(m)) || res.models[0];
      if (bestMatch) setSelectedModel(bestMatch);
      Alert.alert("測試成功", `金鑰有效！已為您預選 ${bestMatch}`);
    } else {
      Alert.alert("測試失敗", res.error || "無法連線");
    }
  };

  if (!isAuthenticated) return <View/>;

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 20) }]}>
        <ThemedText type="title">個人設定</ThemedText>
        <Pressable onPress={() => setShowLangPicker(true)} style={[styles.langBtn, {borderColor: '#ccc'}]}>
           <ThemedText>{LANGUAGES.find(l=>l.code===lang)?.label}</ThemedText>
           <Ionicons name="chevron-down" size={16} color={textColor} style={{marginLeft:4}}/>
        </Pressable>
      </View>

      <ScrollView style={{paddingHorizontal: 16}}>
         {/* AI 設定 */}
         <View style={[styles.card, {backgroundColor: cardBackground}]}>
            <ThemedText type="subtitle">{t('ai_settings', lang)}</ThemedText>
            
            <View style={{marginTop:12}}>
              <ThemedText style={{fontSize:12, color:textSecondary, marginBottom:4}}>Gemini API Key</ThemedText>
              <TextInput 
                style={[styles.input, {color: textColor, borderColor: '#ccc'}]} 
                value={apiKey} 
                onChangeText={setApiKey} 
                placeholder={t('api_key_placeholder', lang)} 
                secureTextEntry 
              />
              <ThemedText style={{fontSize: 10, color: textSecondary, marginTop: 4}}>
                 請先登入 Google AI Studio，於左側功能欄點擊 "Get API key" 取得金鑰。
              </ThemedText>
            </View>

            <View style={{flexDirection: 'row', gap: 10, marginTop: 12, alignItems: 'center'}}>
                <Pressable onPress={handleTestKey} disabled={testingKey} style={[styles.testBtn, {backgroundColor: tintColor, opacity: testingKey?0.5:1}]}>
                  {testingKey ? <ActivityIndicator color="white"/> : <ThemedText style={{color: 'white', fontWeight: 'bold'}}>{t('test_key', lang)}</ThemedText>}
                </Pressable>
            </View>

            <View style={{marginTop: 12}}>
                <ThemedText style={{fontSize:12, color:textSecondary, marginBottom:4}}>{t('current_model', lang)}</ThemedText>
                <Pressable onPress={() => modelList.length > 0 && setShowModelPicker(true)} style={[styles.input, {justifyContent:'center', borderColor: '#ccc'}]}>
                   <ThemedText>{selectedModel}</ThemedText>
                </Pressable>
            </View>
         </View>

         {/* 個人資料 */}
         <View style={[styles.card, {backgroundColor: cardBackground, marginTop: 16}]}>
            <ThemedText type="subtitle" style={{marginBottom:12}}>基本資料</ThemedText>
            
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

            <View style={styles.row}>
               <View style={{flex:1}}><ThemedText style={{fontSize:12, color:textSecondary}}>{t('height', lang)}</ThemedText><TextInput style={[styles.input, {color:textColor, borderColor:'#ccc'}]} value={heightCm} onChangeText={setHeightCm} keyboardType="numeric"/></View>
               <View style={{width:10}}/>
               <View style={{flex:1}}><ThemedText style={{fontSize:12, color:textSecondary}}>{t('weight', lang)}</ThemedText><TextInput style={[styles.input, {color:textColor, borderColor:'#ccc'}]} value={currentWeight} onChangeText={setCurrentWeight} keyboardType="numeric"/></View>
            </View>
            <View style={[styles.row, {marginTop:10}]}>
               <View style={{flex:1}}><ThemedText style={{fontSize:12, color:textSecondary}}>{t('body_fat', lang)}</ThemedText><TextInput style={[styles.input, {color:textColor, borderColor:'#ccc'}]} value={bodyFat} onChangeText={setBodyFat} keyboardType="numeric"/></View>
               <View style={{width:10}}/>
               <View style={{flex:1}}><ThemedText style={{fontSize:12, color:textSecondary}}>{t('target_weight', lang)}</ThemedText><TextInput style={[styles.input, {color:textColor, borderColor:'#ccc'}]} value={targetWeight} onChangeText={setTargetWeight} keyboardType="numeric"/></View>
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
            <ThemedText style={{color: textSecondary, textDecorationLine:'underline'}}>{t('version_history', lang)} (v1.0.3)</ThemedText>
         </Pressable>
         
         <View style={{height:50}}/>
      </ScrollView>

      {/* Language Modal */}
      <Modal visible={showLangPicker} transparent animationType="fade">
         <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, {backgroundColor: cardBackground}]}>
               <ThemedText type="subtitle" style={{marginBottom:10}}>選擇語言 / Select Language</ThemedText>
               {LANGUAGES.map(l => (
                 <Pressable key={l.code} onPress={()=>{setLang(l.code); setShowLangPicker(false);}} style={{padding:15, borderBottomWidth:1, borderColor:'#eee'}}>
                    <ThemedText style={{fontWeight: lang===l.code?'bold':'normal', color: lang===l.code?tintColor:textColor}}>{l.label}</ThemedText>
                 </Pressable>
               ))}
               <Pressable onPress={()=>setShowLangPicker(false)} style={{padding:15, alignItems:'center'}}><ThemedText>取消</ThemedText></Pressable>
            </View>
         </View>
      </Modal>

      {/* Model Modal */}
      <Modal visible={showModelPicker} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, {backgroundColor: cardBackground}]}>
            <ThemedText type="subtitle" style={{marginBottom:10}}>選擇模型</ThemedText>
            <ScrollView style={{maxHeight: 300}}>
              {modelList.map(m => (
                <Pressable key={m} onPress={() => {setSelectedModel(m); setShowModelPicker(false);}} style={{padding: 15, borderBottomWidth:1, borderColor:'#eee'}}>
                  <ThemedText style={{color: selectedModel===m?tintColor:textColor, fontWeight: selectedModel===m?'bold':'normal'}}>{m}</ThemedText>
                </Pressable>
              ))}
            </ScrollView>
            <Pressable onPress={() => setShowModelPicker(false)} style={{padding:15, alignItems:'center'}}><ThemedText>取消</ThemedText></Pressable>
          </View>
        </View>
      </Modal>

      {/* Version Modal */}
      <Modal visible={showVersionModal} transparent animationType="slide">
         <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, {backgroundColor: cardBackground}]}>
               <ThemedText type="subtitle" style={{marginBottom:10}}>Version History</ThemedText>
               <ScrollView style={{maxHeight: 400}}>
                  {VERSION_LOGS.map((v, i) => (
                    <View key={i} style={{marginBottom: 15}}>
                       <ThemedText style={{fontWeight:'bold', marginBottom:2}}>{v.version} ({v.date})</ThemedText>
                       <ThemedText style={{fontSize:13, color:textSecondary, lineHeight:18}}>{v.content}</ThemedText>
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