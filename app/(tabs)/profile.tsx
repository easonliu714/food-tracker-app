import { useRouter } from "expo-router";
import { useState, useEffect } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View, Alert, Modal } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
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
  
  // Profile Data
  const [gender, setGender] = useState<"male"|"female">("male");
  const [birthYear, setBirthYear] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [currentWeight, setCurrentWeight] = useState("");
  const [bodyFat, setBodyFat] = useState(""); // [新增]
  const [targetWeight, setTargetWeight] = useState("");
  const [activityLevel, setActivityLevel] = useState("sedentary");
  
  const [loading, setLoading] = useState(true);
  const [showLangPicker, setShowLangPicker] = useState(false);
  const [showVersionModal, setShowVersionModal] = useState(false);

  const backgroundColor = useThemeColor({}, "background");
  const cardBackground = useThemeColor({}, "cardBackground");
  const tintColor = useThemeColor({}, "tint");
  const textColor = useThemeColor({}, "text");

  useEffect(() => {
    async function load() {
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
      setLoading(false);
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
      dailyCalorieTarget: 2000 // 簡化計算
    });
    Alert.alert(t('save_settings', lang), "OK");
  };

  if (!isAuthenticated) return <View/>;

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 20) }]}>
        <ThemedText type="title">Profile</ThemedText>
        <Pressable onPress={() => setShowLangPicker(true)} style={styles.langBtn}>
           <ThemedText>{LANGUAGES.find(l=>l.code===lang)?.label}</ThemedText>
        </Pressable>
      </View>

      <ScrollView style={{paddingHorizontal: 16}}>
         {/* AI Settings */}
         <View style={[styles.card, {backgroundColor: cardBackground}]}>
            <ThemedText type="subtitle">{t('ai_settings', lang)}</ThemedText>
            <TextInput style={[styles.input, {color: textColor, marginTop:10}]} value={apiKey} onChangeText={setApiKey} placeholder={t('api_key_placeholder', lang)} secureTextEntry />
            <ThemedText style={{marginTop:10}}>{t('current_model', lang)}: {selectedModel}</ThemedText>
         </View>

         {/* Profile */}
         <View style={[styles.card, {backgroundColor: cardBackground, marginTop: 16}]}>
            <View style={styles.row}>
               <View style={{flex:1}}><ThemedText>{t('height', lang)}</ThemedText><TextInput style={[styles.input, {color:textColor}]} value={heightCm} onChangeText={setHeightCm} keyboardType="numeric"/></View>
               <View style={{width:10}}/>
               <View style={{flex:1}}><ThemedText>{t('weight', lang)}</ThemedText><TextInput style={[styles.input, {color:textColor}]} value={currentWeight} onChangeText={setCurrentWeight} keyboardType="numeric"/></View>
            </View>
            <View style={[styles.row, {marginTop:10}]}>
               <View style={{flex:1}}><ThemedText>{t('body_fat', lang)}</ThemedText><TextInput style={[styles.input, {color:textColor}]} value={bodyFat} onChangeText={setBodyFat} keyboardType="numeric"/></View>
               <View style={{width:10}}/>
               <View style={{flex:1}}><ThemedText>{t('target_weight', lang)}</ThemedText><TextInput style={[styles.input, {color:textColor}]} value={targetWeight} onChangeText={setTargetWeight} keyboardType="numeric"/></View>
            </View>
            
            <ThemedText style={{marginTop:10}}>{t('activity_level', lang)}</ThemedText>
            <ScrollView horizontal style={{marginTop:5}}>
               {['sedentary', 'lightly_active', 'moderately_active', 'very_active'].map(a => (
                 <Pressable key={a} onPress={()=>setActivityLevel(a)} style={[styles.chip, activityLevel===a && {backgroundColor:tintColor}]}>
                    <ThemedText style={{color: activityLevel===a?'white':textColor}}>{t(a, lang)}</ThemedText>
                 </Pressable>
               ))}
            </ScrollView>
         </View>

         <Pressable onPress={handleSave} style={[styles.btn, {backgroundColor: tintColor, marginTop: 20}]}>
            <ThemedText style={{color:'white', fontWeight:'bold'}}>{t('save_settings', lang)}</ThemedText>
         </Pressable>

         <Pressable onPress={() => setShowVersionModal(true)} style={{marginTop: 20, alignItems:'center'}}>
            <ThemedText style={{color: textSecondary, textDecorationLine:'underline'}}>{t('version_history', lang)} (v1.0.3)</ThemedText>
         </Pressable>
         
         <View style={{height:50}}/>
      </ScrollView>

      {/* Language Modal */}
      <Modal visible={showLangPicker} transparent animationType="fade">
         <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, {backgroundColor: cardBackground}]}>
               {LANGUAGES.map(l => (
                 <Pressable key={l.code} onPress={()=>{setLang(l.code); setShowLangPicker(false);}} style={{padding:15, borderBottomWidth:1, borderColor:'#eee'}}>
                    <ThemedText>{l.label}</ThemedText>
                 </Pressable>
               ))}
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
                       <ThemedText style={{fontWeight:'bold'}}>{v.version} ({v.date})</ThemedText>
                       <ThemedText style={{fontSize:12, color:textSecondary}}>{v.content}</ThemedText>
                    </View>
                  ))}
               </ScrollView>
               <Pressable onPress={()=>setShowVersionModal(false)} style={[styles.btn, {backgroundColor:tintColor}]}><ThemedText style={{color:'white'}}>Close</ThemedText></Pressable>
            </View>
         </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20 },
  langBtn: { padding: 8, borderWidth: 1, borderRadius: 8, borderColor: '#ccc' },
  card: { padding: 16, borderRadius: 12 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10, backgroundColor: 'white' },
  row: { flexDirection: 'row' },
  chip: { padding: 8, borderWidth: 1, borderColor: '#ddd', borderRadius: 20, marginRight: 8 },
  btn: { padding: 16, borderRadius: 12, alignItems: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 30 },
  modalContent: { padding: 20, borderRadius: 16 }
});