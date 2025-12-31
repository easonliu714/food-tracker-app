// [START OF FILE app/(tabs)/profile.tsx]
import { useRouter } from "expo-router";
import { useState, useEffect } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View, Alert, Modal, Linking, Platform } from "react-native";
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
import { t, useLanguage, setAppLanguage, LANGUAGES, getVersionLogs } from "@/lib/i18n";
import DateTimePicker from "@react-native-community/datetimepicker";
import { format, isValid, differenceInDays } from "date-fns";
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';

const ACTIVITY_IDS = ['sedentary', 'lightly_active', 'moderately_active', 'very_active', 'extra_active'];
const GOAL_IDS = ['lose_weight', 'maintain', 'gain_weight', 'recomp', 'blood_sugar'];

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isAuthenticated } = useAuth();
  const lang = useLanguage();
  
  const [apiKey, setApiKey] = useState("");
  const [selectedModel, setSelectedModel] = useState("gemini-flash-latest");
  const [modelList, setModelList] = useState<string[]>([]);
  
  const [profileId, setProfileId] = useState<number | null>(null);
  const [gender, setGender] = useState<"male"|"female">("male");
  const [birthDate, setBirthDate] = useState<Date>(new Date(1990, 0, 1)); 
  const [showDatePicker, setShowDatePicker] = useState(false);

  const [targetDate, setTargetDate] = useState<Date | null>(null);
  const [showTargetDatePicker, setShowTargetDatePicker] = useState(false);

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
  const [showVersionModal, setShowVersionModal] = useState(false);
  const [showApiHelpModal, setShowApiHelpModal] = useState(false);

  const backgroundColor = useThemeColor({}, "background");
  const cardBackground = useThemeColor({}, "cardBackground");
  const tintColor = useThemeColor({}, "tint");
  const textColor = useThemeColor({}, "text");
  const textSecondary = useThemeColor({}, "textSecondary");
  const borderColor = useThemeColor({}, "border") || '#ccc';

  // [DEBUG] 檢查路徑狀態
  useEffect(() => {
    if (Platform.OS !== 'web') {
        // 嘗試讀取，若 undefined 代表模組載入異常
        console.log("[Profile] DocDir Check:", FileSystem.documentDirectory); 
    }
  }, []);

  const handleBackup = async () => {
      // 1. 環境檢查
      if (Platform.OS === 'web') {
          return Alert.alert(t('error', lang), "Backup feature is not available on Web.");
      }
      
      const docDir = FileSystem.documentDirectory;
      const cacheDir = FileSystem.cacheDirectory;

      if (!docDir || !cacheDir) {
          console.error("FileSystem Paths missing:", { docDir, cacheDir });
          return Alert.alert(t('error', lang), `FileSystem not ready. (docDir=${docDir})`);
      }

      const dbPath = docDir + 'SQLite/food_tracker.db';
      const backupPath = cacheDir + 'food_tracker_backup.db';

      try {
          const fileInfo = await FileSystem.getInfoAsync(dbPath);
          if (!fileInfo.exists) {
              Alert.alert(t('error', lang), "Database file not found. Please add some data first.");
              return;
          }

          // 複製到暫存區
          await FileSystem.copyAsync({ from: dbPath, to: backupPath });

          // 分享
          if (!(await Sharing.isAvailableAsync())) {
              return Alert.alert(t('error', lang), "Sharing is not available on this device");
          }

          await Sharing.shareAsync(backupPath, {
              mimeType: 'application/x-sqlite3',
              dialogTitle: t('backup_db', lang),
              UTI: 'public.database'
          });
      } catch (e: any) {
          console.error("Backup Error:", e);
          Alert.alert(t('error', lang), "Backup failed: " + e.message);
      }
  };

  const handleRestore = async () => {
      if (Platform.OS === 'web') return Alert.alert("Error", "Not supported on Web");

      const docDir = FileSystem.documentDirectory;
      if (!docDir) {
          return Alert.alert(t('error', lang), "FileSystem.documentDirectory is null/undefined");
      }

      const dbPath = docDir + 'SQLite/food_tracker.db';
      const dbFolder = docDir + 'SQLite';

      Alert.alert(
          t('restore_confirm_title', lang),
          t('restore_confirm_msg', lang),
          [
              { text: t('cancel', lang), style: "cancel" },
              { 
                  text: t('restore_db', lang), 
                  style: "destructive",
                  onPress: async () => {
                      try {
                          const result = await DocumentPicker.getDocumentAsync({
                              type: '*/*', 
                              copyToCacheDirectory: true
                          });

                          if (result.canceled) return;
                          const sourceUri = result.assets[0].uri;
                          
                          // 確保資料夾存在
                          const folderInfo = await FileSystem.getInfoAsync(dbFolder);
                          if (!folderInfo.exists) {
                              await FileSystem.makeDirectoryAsync(dbFolder, { intermediates: true });
                          }

                          // 複製覆蓋
                          await FileSystem.copyAsync({ from: sourceUri, to: dbPath });

                          Alert.alert(t('success', lang), t('restore_success_msg', lang), [
                              { text: "OK", onPress: () => {
                                  // 建議重啟 App 以重置 DB 連線
                              }}
                          ]);
                      } catch (e: any) {
                          console.error("Restore Error:", e);
                          Alert.alert(t('error', lang), "Restore failed: " + e.message);
                      }
                  }
              }
          ]
      );
  };

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
          
          if (p.birthDate) {
            const d = new Date(p.birthDate);
            if (isValid(d)) setBirthDate(d);
          }

          if (p.targetDate) {
              const td = new Date(p.targetDate);
              if (isValid(td)) setTargetDate(td);
          }
          
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
    if (!apiKey) return Alert.alert(t('error', lang), t('api_key_placeholder', lang));
    setTestingKey(true);
    const res = await validateApiKey(apiKey);
    setTestingKey(false);
    if (res.valid && res.models) {
      setModelList(res.models);
      const bestMatch = res.models.find(m => m.includes('flash')) || res.models[0];
      if (bestMatch) setSelectedModel(bestMatch);
      Alert.alert(t('success', lang), "API Key OK");
    } else {
      Alert.alert(t('error', lang), res.error || "Invalid Key");
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
        await saveSettings({ apiKey, model: selectedModel, language: lang });
        const w = parseFloat(currentWeight) || 60;
        const h = parseInt(heightCm) || 170;
        
        const safeBirth = isValid(birthDate) ? birthDate : new Date(1990, 0, 1);
        const today = new Date();
        let age = today.getFullYear() - safeBirth.getFullYear();
        const m = today.getMonth() - safeBirth.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < safeBirth.getDate())) {
            age--;
        }
        
        let bmr = (10 * w) + (6.25 * h) - (5 * age) + (gender === 'male' ? 5 : -161);
        const activityMap: Record<string, number> = {
            'sedentary': 1.2, 'lightly_active': 1.375, 'moderately_active': 1.55,
            'very_active': 1.725, 'extra_active': 1.9
        };
        const tdee = bmr * (activityMap[activityLevel] || 1.2);
        
        let targetCal = tdee;
        if (trainingGoal === 'lose_weight') targetCal -= 500;
        else if (trainingGoal === 'gain_weight') targetCal += 300;

        const profileData = {
            gender, 
            birthDate: format(safeBirth, "yyyy-MM-dd"),
            heightCm: h, 
            currentWeightKg: w, 
            currentBodyFat: parseFloat(bodyFat) || null,
            targetWeightKg: parseFloat(targetWeight) || null, 
            targetBodyFat: parseFloat(targetBodyFat) || null,
            targetDate: targetDate ? format(targetDate, "yyyy-MM-dd") : null,
            activityLevel, 
            goal: trainingGoal, 
            dailyCalorieTarget: Math.round(targetCal), 
            updatedAt: new Date()
        };

        if (profileId) {
            await db.update(userProfiles).set(profileData).where(eq(userProfiles.id, profileId));
        } else {
            await db.insert(userProfiles).values(profileData);
        }
        Alert.alert(t('save_settings', lang), t('success', lang));
    } catch (e) { console.error(e); Alert.alert(t('error', lang), "Failed"); } 
    finally { setLoading(false); }
  };

  const onBirthDateChange = (event: any, selectedDate?: Date) => {
      setShowDatePicker(false);
      if (selectedDate) setBirthDate(selectedDate);
  };

  const onTargetDateChange = (event: any, selectedDate?: Date) => {
      setShowTargetDatePicker(false);
      if (selectedDate) setTargetDate(selectedDate);
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
         {/* AI Settings */}
         <View style={[styles.card, {backgroundColor: cardBackground}]}>
            <ThemedText type="subtitle">{t('ai_settings', lang)}</ThemedText>
            <View style={{marginTop:12}}>
              <ThemedText style={{fontSize:12, color:textSecondary, marginBottom: 4}}>{t('api_key_placeholder', lang)}</ThemedText>
              <TextInput style={[styles.input, {color: textColor, borderColor}]} value={apiKey} onChangeText={setApiKey} secureTextEntry placeholder="AI Studio Key..." placeholderTextColor="#999" />
              <Pressable onPress={() => setShowApiHelpModal(true)} style={{alignSelf: 'flex-end', marginTop: 8}}>
                  <ThemedText style={{fontSize:12, color: tintColor, textDecorationLine:'underline'}}>{t('how_to_get_key', lang)}</ThemedText>
              </Pressable>
            </View>
            <Pressable onPress={handleTestKey} disabled={testingKey || !apiKey} style={[styles.btn, {marginTop:12, padding:10, backgroundColor: (!apiKey || testingKey) ? '#ccc' : tintColor}]}>
                {testingKey ? <ActivityIndicator color="white"/> : <ThemedText style={{color:'white', fontWeight:'600'}}>{t('test_key', lang)}</ThemedText>}
            </Pressable>
            <View style={{marginTop:12}}>
                <ThemedText style={{fontSize:12, color:textSecondary, marginBottom:4}}>{t('current_model', lang)}</ThemedText>
                <Pressable style={[styles.input, {justifyContent:'center', borderColor}]} onPress={() => modelList.length > 0 ? setShowModelPicker(true) : Alert.alert(t('tip', lang), t('test_key_first', lang) || "Test Key First")}>
                    <ThemedText style={{color:textColor}}>{selectedModel}</ThemedText>
                    <Ionicons name="chevron-down" size={16} color={textColor} style={{position:'absolute', right:12}}/>
                </Pressable>
            </View>
         </View>

         {/* Backup & Restore Section */}
         <View style={[styles.card, {backgroundColor: cardBackground, marginTop: 16}]}>
             <ThemedText type="subtitle" style={{marginBottom:8}}>{t('data_backup', lang)}</ThemedText>
             <ThemedText style={{fontSize:12, color:textSecondary, marginBottom:12}}>{t('backup_desc', lang)}</ThemedText>
             <View style={{flexDirection:'row', gap:10}}>
                 <Pressable onPress={handleBackup} style={[styles.btn, {flex:1, backgroundColor: '#007AFF', padding:12}]}>
                     <Ionicons name="cloud-upload-outline" size={20} color="white" style={{marginBottom:4}}/>
                     <ThemedText style={{color:'white', fontSize:12, fontWeight:'600'}}>{t('backup_db', lang)}</ThemedText>
                 </Pressable>
                 <Pressable onPress={handleRestore} style={[styles.btn, {flex:1, backgroundColor: '#FF9500', padding:12}]}>
                     <Ionicons name="cloud-download-outline" size={20} color="white" style={{marginBottom:4}}/>
                     <ThemedText style={{color:'white', fontSize:12, fontWeight:'600'}}>{t('restore_db', lang)}</ThemedText>
                 </Pressable>
             </View>
         </View>

         {/* Basic Info */}
         <View style={[styles.card, {backgroundColor: cardBackground, marginTop: 16}]}>
            <ThemedText type="subtitle" style={{marginBottom:12}}>{t('basic_info', lang)}</ThemedText>
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
                  <ThemedText style={{fontSize:12, color:textSecondary, marginBottom:4}}>{t('birth_date', lang)}</ThemedText>
                  <Pressable onPress={()=>setShowDatePicker(true)} style={[styles.input, {justifyContent:'center', borderColor}]}>
                      <ThemedText style={{color:textColor}}>
                          {isValid(birthDate) ? format(birthDate, 'yyyy-MM-dd') : "YYYY-MM-DD"}
                      </ThemedText>
                  </Pressable>
                  {showDatePicker && (
                    <DateTimePicker 
                        value={isValid(birthDate) ? birthDate : new Date()} 
                        mode="date" 
                        onChange={onBirthDateChange} 
                        maximumDate={new Date()} 
                    />
                  )}
               </View>
            </View>

            <View style={[styles.row, {marginBottom: 12}]}>
               <View style={{flex:1}}><ThemedText style={{fontSize:12, color:textSecondary}}>{t('height', lang)} (cm)</ThemedText><TextInput style={[styles.input, {color:textColor, borderColor}]} value={heightCm} onChangeText={setHeightCm} keyboardType="numeric"/></View>
               <View style={{width:10}}/>
               <View style={{flex:1}}><ThemedText style={{fontSize:12, color:textSecondary}}>{t('weight', lang)} (kg)</ThemedText><TextInput style={[styles.input, {color:textColor, borderColor}]} value={currentWeight} onChangeText={setCurrentWeight} keyboardType="numeric"/></View>
            </View>
             <View style={{marginBottom: 12}}>
                <ThemedText style={{fontSize:12, color:textSecondary}}>{t('body_fat', lang)} %</ThemedText>
                <TextInput style={[styles.input, {color:textColor, borderColor}]} value={bodyFat} onChangeText={setBodyFat} keyboardType="numeric"/>
             </View>

            <ThemedText style={{fontSize:14, fontWeight:'bold', marginTop:8, marginBottom:8}}>{t('target_goals', lang)}</ThemedText>
            <View style={[styles.row, {marginBottom: 12}]}>
               <View style={{flex:1}}><ThemedText style={{fontSize:12, color:textSecondary}}>{t('target_weight', lang)} (kg)</ThemedText><TextInput style={[styles.input, {color:textColor, borderColor}]} value={targetWeight} onChangeText={setTargetWeight} keyboardType="numeric"/></View>
               <View style={{width:10}}/>
               <View style={{flex:1}}><ThemedText style={{fontSize:12, color:textSecondary}}>{t('target_body_fat', lang)} %</ThemedText><TextInput style={[styles.input, {color:textColor, borderColor}]} value={targetBodyFat} onChangeText={setTargetBodyFat} keyboardType="numeric"/></View>
            </View>

            <View style={{marginBottom: 12}}>
                <ThemedText style={{fontSize:12, color:textSecondary, marginBottom:4}}>{t('target_date', lang)}</ThemedText>
                <Pressable onPress={()=>setShowTargetDatePicker(true)} style={[styles.input, {justifyContent:'center', borderColor, flexDirection:'row', justifyContent:'space-between'}]}>
                    <ThemedText style={{color: targetDate ? textColor : '#999'}}>
                        {targetDate ? format(targetDate, 'yyyy-MM-dd') : "YYYY-MM-DD"}
                    </ThemedText>
                    {targetDate && (
                        <ThemedText style={{fontSize: 12, color: tintColor}}>
                            {differenceInDays(targetDate, new Date())} {t('days_remaining', lang)}
                        </ThemedText>
                    )}
                </Pressable>
                {showTargetDatePicker && (
                    <DateTimePicker 
                        value={targetDate || new Date()} 
                        mode="date" 
                        minimumDate={new Date()}
                        onChange={onTargetDateChange} 
                    />
                )}
            </View>
            
            <View style={{marginTop:12}}>
               <ThemedText type="defaultSemiBold" style={{marginBottom:8}}>{t('training_goal', lang)}</ThemedText>
               <View style={{gap: 8}}>
                  {GOAL_IDS.map(id => (
                    <Pressable key={id} onPress={()=>setTrainingGoal(id)} style={[styles.listOption, trainingGoal===id && {borderColor:tintColor, backgroundColor:tintColor+'10'}]}>
                       <View style={{flexDirection:'row', justifyContent:'space-between', alignItems:'center'}}>
                           <View>
                               <ThemedText style={{fontWeight:'bold', color: trainingGoal===id?tintColor:textColor}}>{t(id, lang)}</ThemedText>
                               <ThemedText style={{fontSize:12, color:textSecondary}}>{t(`${id}_desc`, lang)}</ThemedText>
                           </View>
                           {trainingGoal===id && <Ionicons name="checkmark-circle" size={20} color={tintColor}/>}
                       </View>
                    </Pressable>
                  ))}
               </View>
            </View>
            <View style={{marginTop:16}}>
               <ThemedText type="defaultSemiBold" style={{marginBottom:8}}>{t('activity_level', lang)}</ThemedText>
               <View style={{gap: 8}}>
                  {ACTIVITY_IDS.map(id => (
                    <Pressable key={id} onPress={()=>setActivityLevel(id)} style={[styles.listOption, activityLevel===id && {borderColor:tintColor, backgroundColor:tintColor+'10'}]}>
                       <View style={{flexDirection:'row', justifyContent:'space-between', alignItems:'center'}}>
                           <View>
                               <ThemedText style={{fontWeight:'bold', color: activityLevel===id?tintColor:textColor}}>{t(id, lang)}</ThemedText>
                               <ThemedText style={{fontSize:12, color:textSecondary}}>{t(`${id}_desc`, lang)}</ThemedText>
                           </View>
                           {activityLevel===id && <Ionicons name="checkmark-circle" size={20} color={tintColor}/>}
                       </View>
                    </Pressable>
                  ))}
               </View>
            </View>
         </View>
         <Pressable onPress={handleSave} style={[styles.btn, {backgroundColor: tintColor, marginTop: 20}]}>
            <ThemedText style={{color:'white', fontWeight:'bold', fontSize:16}}>{t('save_settings', lang)}</ThemedText>
         </Pressable>
         <Pressable onPress={() => setShowVersionModal(true)} style={{padding: 16, alignItems:'center', marginBottom: 40}}>
             <ThemedText style={{color: tintColor, textDecorationLine: 'underline'}}>{t('version_history', lang)}</ThemedText>
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

      {/* API Help Modal */}
      <Modal visible={showApiHelpModal} transparent animationType="slide">
          <View style={styles.modalOverlay}>
              <View style={[styles.modalContent, {backgroundColor: cardBackground, maxHeight: '60%'}]}>
                  <ThemedText type="subtitle" style={{marginBottom: 16}}>{t('api_guide_title', lang)}</ThemedText>
                  <ScrollView>
                      {[1,2,3,4,5].map(step => (
                          <ThemedText key={step} style={{marginBottom: 8, fontSize: 14}}>{t(`api_step_${step}`, lang)}</ThemedText>
                      ))}
                  </ScrollView>
                  <Pressable onPress={() => Linking.openURL('https://aistudio.google.com/app/apikey')} style={[styles.btn, {backgroundColor: tintColor, marginTop: 16}]}>
                      <ThemedText style={{color: 'white'}}>{t('go_to_site', lang)}</ThemedText>
                  </Pressable>
                  <Pressable onPress={() => setShowApiHelpModal(false)} style={{padding:16, alignItems:'center'}}>
                      <ThemedText style={{color: textSecondary}}>{t('close', lang)}</ThemedText>
                  </Pressable>
              </View>
          </View>
      </Modal>

      {/* Version History Modal */}
      <Modal visible={showVersionModal} transparent animationType="slide">
          <View style={styles.modalOverlay}>
              <View style={[styles.modalContent, {backgroundColor: cardBackground, maxHeight: '80%'}]}>
                  <ThemedText type="subtitle" style={{marginBottom: 16}}>{t('version_history', lang)}</ThemedText>
                  <ScrollView>
                      {getVersionLogs(lang).map((log, idx) => (
                          <View key={idx} style={{marginBottom: 16, borderBottomWidth:1, borderColor:'#eee', paddingBottom:8}}>
                              <View style={{flexDirection:'row', justifyContent:'space-between'}}>
                                  <ThemedText type="defaultSemiBold">{log.version}</ThemedText>
                                  <ThemedText style={{color: textSecondary}}>{log.date}</ThemedText>
                              </View>
                              <ThemedText style={{marginTop: 4, lineHeight: 20}}>{log.content}</ThemedText>
                          </View>
                      ))}
                  </ScrollView>
                  <Pressable onPress={() => setShowVersionModal(false)} style={{padding:15, alignItems:'center'}}>
                      <ThemedText style={{color:tintColor}}>{t('close', lang)}</ThemedText>
                  </Pressable>
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
// [END OF FILE app/(tabs)/profile.tsx]