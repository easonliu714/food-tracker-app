import { useRouter } from "expo-router";
import { useState, useEffect } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View, Alert, Modal, Linking } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { ThemedText } from "@/components/themed-text";
import { useAuth } from "@/hooks/use-auth";
import { useThemeColor } from "@/hooks/use-theme-color";
import { saveSettings, getSettings } from "@/lib/storage";
import { validateApiKey } from "@/lib/gemini";
import { db } from "@/lib/db";
import { userProfiles } from "@/drizzle/schema";
import { eq } from "drizzle-orm";
import { t, useLanguage, setAppLanguage, LANGUAGES } from "@/lib/i18n";

const ACTIVITY_OPTIONS = [
  { id: 'sedentary', label: '久坐少動', desc: '辦公室工作，幾乎不運動' },
  { id: 'lightly_active', label: '輕度活動', desc: '每週運動 1-3 天' },
  { id: 'moderately_active', label: '中度活動', desc: '每週運動 3-5 天' },
  { id: 'very_active', label: '高度活動', desc: '每週運動 6-7 天' },
  { id: 'extra_active', label: '極度活動', desc: '體力工作或每日兩練' },
];

const GOAL_OPTIONS = [
  { id: 'lose_weight', label: '減重', desc: '熱量赤字，專注減脂' },
  { id: 'maintain', label: '維持', desc: '維持目前體重與體態' },
  { id: 'gain_weight', label: '增重', desc: '熱量盈餘，專注增肌' },
  { id: 'recomp', label: '體態重組', desc: '增肌同時減脂(適合新手)' },
  { id: 'blood_sugar', label: '控制血糖', desc: '穩定血糖波動，低 GI 飲食' },
];

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isAuthenticated, logout } = useAuth();
  const lang = useLanguage();
  
  const [apiKey, setApiKey] = useState("");
  const [selectedModel, setSelectedModel] = useState("gemini-flash-latest");
  const [modelList, setModelList] = useState<string[]>([]);
  
  const [profileId, setProfileId] = useState<number | null>(null);
  const [gender, setGender] = useState<"male"|"female">("male");
  const [heightCm, setHeightCm] = useState("");
  const [currentWeight, setCurrentWeight] = useState("");
  const [bodyFat, setBodyFat] = useState("");
  const [targetWeight, setTargetWeight] = useState("");
  const [targetBodyFat, setTargetBodyFat] = useState("");
  const [activityLevel, setActivityLevel] = useState("sedentary");
  const [trainingGoal, setTrainingGoal] = useState("maintain");

  const [loading, setLoading] = useState(true);
  const [testingKey, setTestingKey] = useState(false);
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [showLangPicker, setShowLangPicker] = useState(false);

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
        
        const result = await db.select().from(userProfiles).limit(1);
        if(result.length > 0) {
          const p = result[0];
          setProfileId(p.id);
          setGender((p.gender as "male"|"female") || "male");
          setHeightCm(p.heightCm?.toString() || "");
          setCurrentWeight(p.currentWeightKg?.toString() || "");
          setBodyFat(p.currentBodyFat?.toString() || "");
          setTargetWeight(p.targetWeightKg?.toString() || "");
          setTargetBodyFat(p.targetBodyFat?.toString() || "");
          setActivityLevel(p.activityLevel || "sedentary");
          setTrainingGoal(p.goal || "maintain");
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [isAuthenticated]);

  const handleTestKey = async () => {
    if (!apiKey) return Alert.alert("請輸入 API Key");
    setTestingKey(true);
    const res = await validateApiKey(apiKey);
    setTestingKey(false);
    
    if (res.valid && res.models) {
      setModelList(res.models);
      const bestMatch = res.models.find(m => m.includes('flash')) || res.models[0];
      if (bestMatch) setSelectedModel(bestMatch);
      Alert.alert("測試成功", `金鑰有效！`);
    } else {
      Alert.alert("測試失敗", res.error || "API Key 無效或被停用");
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
        await saveSettings({ apiKey, model: selectedModel, language: lang });
        const w = parseFloat(currentWeight) || 60;
        const h = parseInt(heightCm) || 170;
        const age = 30; 
        
        let bmr = (10 * w) + (6.25 * h) - (5 * age) + (gender === 'male' ? 5 : -161);
        const activityMap: Record<string, number> = {
            'sedentary': 1.2, 'lightly_active': 1.375, 'moderately_active': 1.55,
            'very_active': 1.725, 'extra_active': 1.9
        };
        const tdee = bmr * (activityMap[activityLevel] || 1.2);
        
        let targetCal = tdee;
        if (trainingGoal === 'lose_weight') targetCal -= 500;
        else if (trainingGoal === 'gain_weight') targetCal += 300;

        if (profileId) {
            await db.update(userProfiles).set({
                gender, heightCm: h, currentWeightKg: w, currentBodyFat: parseFloat(bodyFat) || null,
                targetWeightKg: parseFloat(targetWeight) || null, targetBodyFat: parseFloat(targetBodyFat) || null,
                activityLevel, goal: trainingGoal, dailyCalorieTarget: Math.round(targetCal), updatedAt: new Date()
            }).where(eq(userProfiles.id, profileId));
        }
        Alert.alert(t('save_settings', lang), "Updated.");
    } catch (e) { Alert.alert("Error", "Failed"); } 
    finally { setLoading(false); }
  };

  if (loading) return <View style={[styles.container, {backgroundColor, justifyContent:'center', alignItems: 'center'}]}><ActivityIndicator size="large"/></View>;

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 20) }]}>
        <ThemedText type="title">{t('profile', lang)}</ThemedText>
        <Pressable onPress={() => setShowLangPicker(true)} style={styles.langBtn}>
            <Ionicons name="language" size={20} color={tintColor} />
            <ThemedText style={{marginLeft: 4, color: tintColor, fontWeight:'bold'}}>
                {LANGUAGES.find(l => l.code === lang)?.label || 'Language'}
            </ThemedText>
        </Pressable>
      </View>

      <ScrollView style={{paddingHorizontal: 16}}>
         <View style={[styles.card, {backgroundColor: cardBackground}]}>
            <ThemedText type="subtitle">{t('ai_settings', lang)}</ThemedText>
            <View style={{marginTop:12}}>
              <ThemedText style={{fontSize:12, color:textSecondary, marginBottom: 4}}>Gemini API Key</ThemedText>
              <TextInput style={[styles.input, {color: textColor, borderColor}]} value={apiKey} onChangeText={setApiKey} secureTextEntry placeholder="API Key" placeholderTextColor="#999" />
              <Pressable onPress={() => Linking.openURL('https://aistudio.google.com/app/apikey')}>
                  <ThemedText style={{fontSize:11, color: tintColor, marginTop:6, textDecorationLine:'underline'}}>Get API Key from Google AI Studio</ThemedText>
              </Pressable>
            </View>
            <Pressable onPress={handleTestKey} disabled={testingKey || !apiKey} style={[styles.btn, {marginTop:12, padding:10, backgroundColor: (!apiKey || testingKey) ? '#ccc' : tintColor}]}>
                {testingKey ? <ActivityIndicator color="white"/> : <ThemedText style={{color:'white', fontWeight:'600'}}>{t('test_key', lang)}</ThemedText>}
            </Pressable>
            <View style={{marginTop:12}}>
                <ThemedText style={{fontSize:12, color:textSecondary, marginBottom:4}}>{t('current_model', lang)}</ThemedText>
                <Pressable style={[styles.input, {justifyContent:'center', borderColor}]} onPress={() => modelList.length > 0 ? setShowModelPicker(true) : Alert.alert("Tip", "Test Key first")}>
                    <ThemedText style={{color:textColor}}>{selectedModel}</ThemedText>
                    <Ionicons name="chevron-down" size={16} color={textColor} style={{position:'absolute', right:12}}/>
                </Pressable>
            </View>
         </View>

         <View style={[styles.card, {backgroundColor: cardBackground, marginTop: 16}]}>
            <ThemedText type="subtitle" style={{marginBottom:12}}>基本資料</ThemedText>
            <View style={{flexDirection:'row', gap:10, marginBottom: 12}}>
               <View style={{flex:1}}>
                 <ThemedText style={{fontSize:12, color:textSecondary, marginBottom:4}}>{t('gender', lang)}</ThemedText>
                 <View style={styles.row}>
                    {["male", "female"].map(g => (
                      <Pressable key={g} onPress={() => setGender(g as any)} style={[styles.option, gender === g && {backgroundColor: tintColor, borderColor: tintColor}]}>
                         <ThemedText style={{color: gender===g?'white':textColor}}>{g==='male'?t('male', lang):t('female', lang)}</ThemedText>
                      </Pressable>
                    ))}
                 </View>
               </View>
               <View style={{flex:1}}>
                  <ThemedText style={{fontSize:12, color:textSecondary, marginBottom:4}}>{t('height', lang)} (cm)</ThemedText>
                  <TextInput style={[styles.input, {color:textColor, borderColor}]} value={heightCm} onChangeText={setHeightCm} keyboardType="numeric"/>
               </View>
            </View>
            {/* Weight inputs... same structure */}
            <View style={[styles.row, {marginBottom: 12}]}>
               <View style={{flex:1}}><ThemedText style={{fontSize:12, color:textSecondary}}>{t('weight', lang)}</ThemedText><TextInput style={[styles.input, {color:textColor, borderColor}]} value={currentWeight} onChangeText={setCurrentWeight} keyboardType="numeric"/></View>
               <View style={{width:10}}/>
               <View style={{flex:1}}><ThemedText style={{fontSize:12, color:textSecondary}}>{t('body_fat', lang)} %</ThemedText><TextInput style={[styles.input, {color:textColor, borderColor}]} value={bodyFat} onChangeText={setBodyFat} keyboardType="numeric"/></View>
            </View>
            {/* Target inputs... */}
            <View style={[styles.row, {marginBottom: 12}]}>
               <View style={{flex:1}}><ThemedText style={{fontSize:12, color:textSecondary}}>Target Weight</ThemedText><TextInput style={[styles.input, {color:textColor, borderColor}]} value={targetWeight} onChangeText={setTargetWeight} keyboardType="numeric"/></View>
               <View style={{width:10}}/>
               <View style={{flex:1}}><ThemedText style={{fontSize:12, color:textSecondary}}>Target Body Fat</ThemedText><TextInput style={[styles.input, {color:textColor, borderColor}]} value={targetBodyFat} onChangeText={setTargetBodyFat} keyboardType="numeric"/></View>
            </View>
            
            <View style={{marginTop:12}}>
               <ThemedText type="defaultSemiBold" style={{marginBottom:8}}>{t('training_goal', lang)}</ThemedText>
               <View style={{gap: 8}}>
                  {GOAL_OPTIONS.map(g => (
                    <Pressable key={g.id} onPress={()=>setTrainingGoal(g.id)} style={[styles.listOption, trainingGoal===g.id && {borderColor:tintColor, backgroundColor:tintColor+'10'}]}>
                       <View style={{flexDirection:'row', justifyContent:'space-between', alignItems:'center'}}>
                           <View><ThemedText style={{fontWeight:'bold', color: trainingGoal===g.id?tintColor:textColor}}>{g.label}</ThemedText><ThemedText style={{fontSize:12, color:textSecondary}}>{g.desc}</ThemedText></View>
                           {trainingGoal===g.id && <Ionicons name="checkmark-circle" size={20} color={tintColor}/>}
                       </View>
                    </Pressable>
                  ))}
               </View>
            </View>
            <View style={{marginTop:16}}>
               <ThemedText type="defaultSemiBold" style={{marginBottom:8}}>{t('activity_level', lang)}</ThemedText>
               <View style={{gap: 8}}>
                  {ACTIVITY_OPTIONS.map(a => (
                    <Pressable key={a.id} onPress={()=>setActivityLevel(a.id)} style={[styles.listOption, activityLevel===a.id && {borderColor:tintColor, backgroundColor:tintColor+'10'}]}>
                       <View style={{flexDirection:'row', justifyContent:'space-between', alignItems:'center'}}>
                           <View><ThemedText style={{fontWeight:'bold', color: activityLevel===a.id?tintColor:textColor}}>{a.label}</ThemedText><ThemedText style={{fontSize:12, color:textSecondary}}>{a.desc}</ThemedText></View>
                           {activityLevel===a.id && <Ionicons name="checkmark-circle" size={20} color={tintColor}/>}
                       </View>
                    </Pressable>
                  ))}
               </View>
            </View>
         </View>
         <Pressable onPress={handleSave} style={[styles.btn, {backgroundColor: tintColor, marginTop: 20, marginBottom: 40}]}>
            <ThemedText style={{color:'white', fontWeight:'bold', fontSize:16}}>{t('save_settings', lang)}</ThemedText>
         </Pressable>
      </ScrollView>

      {/* Language Modal */}
      <Modal visible={showLangPicker} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, {backgroundColor: cardBackground}]}>
            <ThemedText type="subtitle" style={{marginBottom:10}}>{t('language', lang)}</ThemedText>
            {LANGUAGES.map(l => (
                <Pressable key={l.code} onPress={()=>{ setAppLanguage(l.code); setShowLangPicker(false); }} style={{padding:15, borderBottomWidth:1, borderColor:'#eee'}}>
                    <ThemedText style={{color: lang===l.code?tintColor:textColor, fontWeight: lang===l.code?'bold':'normal'}}>{l.label}</ThemedText>
                </Pressable>
            ))}
            <Pressable onPress={()=>setShowLangPicker(false)} style={{padding:15, alignItems:'center'}}><ThemedText style={{color:textSecondary}}>{t('cancel', lang)}</ThemedText></Pressable>
          </View>
        </View>
      </Modal>

      {/* Model Modal */}
      <Modal visible={showModelPicker} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, {backgroundColor: cardBackground}]}>
            <ThemedText type="subtitle" style={{marginBottom:10}}>Model</ThemedText>
            <ScrollView style={{maxHeight: 300}}>
              {modelList.map(m => (
                <Pressable key={m} onPress={() => {setSelectedModel(m); setShowModelPicker(false);}} style={{padding: 15, borderBottomWidth:1, borderColor:'#eee'}}>
                  <ThemedText style={{color: selectedModel===m?tintColor:textColor, fontWeight: selectedModel===m?'bold':'normal'}}>{m}</ThemedText>
                </Pressable>
              ))}
            </ScrollView>
            <Pressable onPress={() => setShowModelPicker(false)} style={{padding:15, alignItems:'center'}}><ThemedText style={{color: textSecondary}}>{t('cancel', lang)}</ThemedText></Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20 },
  card: { padding: 20, borderRadius: 16 },
  input: { borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 16, backgroundColor: 'white', height: 48, flexDirection:'row', alignItems:'center' },
  row: { flexDirection: 'row' },
  option: { flex: 1, padding: 10, borderWidth: 1, borderColor: '#ddd', alignItems: 'center', borderRadius: 8, marginHorizontal: 2 },
  listOption: { padding: 12, borderWidth: 1, borderColor: '#ddd', borderRadius: 12 },
  btn: { padding: 16, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  langBtn: { flexDirection: 'row', alignItems: 'center', padding: 8, borderWidth: 1, borderColor: '#ddd', borderRadius: 20 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 30 },
  modalContent: { padding: 20, borderRadius: 16 }
});