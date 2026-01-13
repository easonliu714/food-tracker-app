import { useRouter } from "expo-router";
import { useState, useEffect } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View, Alert, Modal, Linking, Switch, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { ThemedText } from "@/components/themed-text";
import { useAuth } from "@/hooks/use-auth";
import { useThemeColor } from "@/hooks/use-theme-color";
import { saveSettings, getSettings, getAnalysisGrid } from "@/lib/storage";
import { validateApiKey } from "@/lib/gemini";
import { db } from "@/lib/db";
import { userProfiles, foodLogs, dailyMetrics, foodItems, activityLogs, reminderSettings } from "@/drizzle/schema"; 
import { eq } from "drizzle-orm";
import { t, useLanguage, setAppLanguage, LANGUAGES, getVersionLogs } from "@/lib/i18n";
import DateTimePicker from "@react-native-community/datetimepicker";
import { format, isValid, differenceInDays } from "date-fns";
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import * as Notifications from 'expo-notifications'; 
// [修正] 引入 Notification 類型定義
import { SchedulableTriggerInputTypes } from 'expo-notifications';

import { cacheDirectory, writeAsStringAsync, readAsStringAsync } from 'expo-file-system/legacy';

const ACTIVITY_IDS = ['sedentary', 'lightly_active', 'moderately_active', 'very_active', 'extra_active'];
const GOAL_IDS = ['lose_weight', 'maintain', 'gain_weight', 'recomp', 'blood_sugar'];

// 設定通知行為，確保在前景時也能顯示通知
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

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

  // 提醒設定狀態：包含新的 Start/End Time
  const defaultTime = (h: number) => new Date(new Date().setHours(h, 0, 0, 0));
  const [reminders, setReminders] = useState({
      breakfast: { enabled: false, time: defaultTime(8) },
      lunch: { enabled: false, time: defaultTime(12) },
      dinner: { enabled: false, time: defaultTime(18) },
      water: { 
          enabled: false, 
          startTime: defaultTime(9), // 預設 09:00
          endTime: defaultTime(21),  // 預設 21:00
          interval: 60 
      }
  });
  const [showTimePicker, setShowTimePicker] = useState<string | null>(null);

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

  // [修正] 初始化通知頻道 (Android 必須)
  useEffect(() => {
    async function initNotifications() {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') {
        console.log('Notification permissions denied');
      }

      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'default',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FF231F7C',
        });
      }
    }
    initNotifications();
  }, []);

  const handleBackup = async () => {
      setLoading(true);
      try {
          const users = await db.select().from(userProfiles);
          const foods = await db.select().from(foodItems);
          const logs = await db.select().from(foodLogs);
          const metrics = await db.select().from(dailyMetrics);
          const activities = await db.select().from(activityLogs);
          const gridLayout = await getAnalysisGrid();
          const reminders = await db.select().from(reminderSettings);
        
          const backupData = {
              version: 1,
              timestamp: new Date().toISOString(),
              data: { users, foods, logs, metrics, activities, gridLayout, reminders }
          };

          const fileUri = cacheDirectory + `food_tracker_backup_${Date.now()}.json`;
          await writeAsStringAsync(fileUri, JSON.stringify(backupData));

          if (await Sharing.isAvailableAsync()) {
              await Sharing.shareAsync(fileUri, {
                  mimeType: 'application/json',
                  dialogTitle: t('backup_db', lang)
              });
          } else {
              Alert.alert(t('error', lang), "Sharing not available");
          }
      } catch (e: any) {
          console.error("Backup Error:", e);
          Alert.alert(t('error', lang), "Backup failed: " + e.message);
      } finally {
          setLoading(false);
      }
  };

  const handleRestore = async () => {
      try {
          const result = await DocumentPicker.getDocumentAsync({ type: "application/json" });
          if (result.canceled) return;
          const file = result.assets[0];
          setLoading(true);
          const content = await readAsStringAsync(file.uri);
          const backup = JSON.parse(content);
          
          if (!backup.data) throw new Error("Invalid backup format");

          Alert.alert(
            t('restore_confirm_title', lang), 
            t('restore_confirm_msg', lang),
            [
              { text: t('cancel', lang), style: "cancel" },
              { text: t('restore_db', lang), style: "destructive", onPress: async () => {
                  try {
                      await db.delete(foodLogs);
                      await db.delete(foodItems);
                      await db.delete(dailyMetrics);
                      await db.delete(activityLogs);
                      
                      if (backup.data.foods?.length) await db.insert(foodItems).values(backup.data.foods.map((f:any)=>({...f, updatedAt: new Date(f.updatedAt)})));
                      if (backup.data.logs?.length) await db.insert(foodLogs).values(backup.data.logs.map((l:any)=>({...l, loggedAt: new Date(l.loggedAt)})));
                      if (backup.data.metrics?.length) await db.insert(dailyMetrics).values(backup.data.metrics.map((m:any)=>({...m, createdAt: new Date(m.createdAt)})));
                      if (backup.data.activities?.length) await db.insert(activityLogs).values(backup.data.activities.map((a:any)=>({...a, loggedAt: new Date(a.loggedAt)})));
                      
                      if (backup.data.users?.length && profileId) {
                          const u = backup.data.users[0];
                          const { id, createdAt, updatedAt, ...userData } = u;
                          await db.update(userProfiles).set({ ...userData, createdAt: new Date(createdAt), updatedAt: new Date() }).where(eq(userProfiles.id, profileId));
                      }
                      
                      // 移除 saveAnalysisGrid 恢復，因可能是舊版不相容
                      // if (backup.data.gridLayout) await saveAnalysisGrid(backup.data.gridLayout);
                      
                      if (backup.data.reminders?.length) {
                         await db.delete(reminderSettings);
                         await db.insert(reminderSettings).values(backup.data.reminders);
                      }

                      Alert.alert(t('success', lang), t('restore_success_msg', lang));
                  } catch(e) { console.error(e); Alert.alert("Restore Error", String(e)); } finally { setLoading(false); }
              }}
            ]
          );

      } catch (e: any) { console.error("Restore Error:", e); Alert.alert(t('error', lang), "Restore failed"); setLoading(false); }
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
          if (p.birthDate && isValid(new Date(p.birthDate))) setBirthDate(new Date(p.birthDate));
          if (p.targetDate && isValid(new Date(p.targetDate))) setTargetDate(new Date(p.targetDate));
          
          setHeightCm(p.heightCm?.toString() || "");
          setCurrentWeight(p.currentWeightKg?.toString() || "");
          setBodyFat(p.currentBodyFat?.toString() || "");
          setTargetWeight(p.targetWeightKg?.toString() || "");
          setTargetBodyFat(p.targetBodyFat?.toString() || "");
          setActivityLevel(p.activityLevel || "sedentary");
          setTrainingGoal(p.goal || "maintain");
        }

        const reminderRes = await db.select().from(reminderSettings).limit(1);
        if (reminderRes.length > 0) {
            const r = reminderRes[0];
            const parseTime = (tStr: string | null, defaultH: number) => {
               const d = new Date();
               if(tStr) { const [h,m] = tStr.split(':'); d.setHours(parseInt(h), parseInt(m), 0, 0); }
               else { d.setHours(defaultH, 0, 0, 0); }
               return d;
            };
            setReminders({
                breakfast: { enabled: !!r.breakfastReminderEnabled, time: parseTime(r.breakfastReminderTime, 8) },
                lunch: { enabled: !!r.lunchReminderEnabled, time: parseTime(r.lunchReminderTime, 12) },
                dinner: { enabled: !!r.dinnerReminderEnabled, time: parseTime(r.dinnerReminderTime, 18) },
                water: { 
                    enabled: !!r.waterReminderEnabled, 
                    startTime: parseTime(r.waterReminderStartTime, 9),
                    endTime: parseTime(r.waterReminderEndTime, 21),
                    interval: r.waterReminderIntervalMinutes || 60 
                }
            });
        }
      } catch (e) { console.error(e); } finally { setLoading(false); }
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
    } else { Alert.alert(t('error', lang), res.error || "Invalid Key"); }
  };

  // [修正] 排程通知函式：支援固定間隔邏輯，並符合 Expo 通知規範
  const scheduleLocalNotifications = async () => {
      // 1. 取消所有舊通知
      await Notifications.cancelAllScheduledNotificationsAsync();
      
      const scheduleDaily = async (title: string, body: string, time: Date) => {
          await Notifications.scheduleNotificationAsync({
              content: { 
                  title, 
                  body,
                  sound: true
              },
              trigger: { 
                  type: SchedulableTriggerInputTypes.DAILY,
                  hour: time.getHours(), 
                  minute: time.getMinutes(), 
                  channelId: 'default' // 必須指定頻道
              },
          });
      };

      // 2. 排程用餐提醒
      if (reminders.breakfast.enabled) await scheduleDaily(t('reminders_breakfast', lang), t('reminders_breakfast_msg', lang), reminders.breakfast.time);
      if (reminders.lunch.enabled) await scheduleDaily(t('reminders_lunch', lang), t('reminders_lunch_msg', lang), reminders.lunch.time);
      if (reminders.dinner.enabled) await scheduleDaily(t('reminders_dinner', lang), t('reminders_dinner_msg', lang), reminders.dinner.time);
      
      // 3. 排程喝水/久坐提醒 (區間內循環)
      if (reminders.water.enabled && reminders.water.interval > 0) {
          const start = reminders.water.startTime;
          const end = reminders.water.endTime;
          const intervalMins = reminders.water.interval;

          // 計算 Start 到 End 的總分鐘數
          let currentMinutes = start.getHours() * 60 + start.getMinutes();
          const endMinutes = end.getHours() * 60 + end.getMinutes();

          // 若結束時間小於開始時間，暫不支援跨日，簡單略過
          if (endMinutes > currentMinutes) {
              // 迴圈排程每一個時間點
              while (currentMinutes <= endMinutes) {
                  const h = Math.floor(currentMinutes / 60);
                  const m = currentMinutes % 60;
                  
                  await Notifications.scheduleNotificationAsync({
                      content: { 
                          title: t('reminders_water_move_title', lang), 
                          body: t('reminders_water_move_msg', lang),
                          sound: true
                      },
                      trigger: { 
                          type: SchedulableTriggerInputTypes.DAILY,
                          hour: h, 
                          minute: m, 
                          channelId: 'default' // 必須指定頻道
                      },
                  });
                  
                  currentMinutes += intervalMins;
              }
          }
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
        if (m < 0 || (m === 0 && today.getDate() < safeBirth.getDate())) age--;
        
        let bmr = (10 * w) + (6.25 * h) - (5 * age) + (gender === 'male' ? 5 : -161);
        const activityMap: Record<string, number> = { 'sedentary': 1.2, 'lightly_active': 1.375, 'moderately_active': 1.55, 'very_active': 1.725, 'extra_active': 1.9 };
        const tdee = bmr * (activityMap[activityLevel] || 1.2);
        
        let targetCal = tdee;
        if (trainingGoal === 'lose_weight') targetCal -= 500;
        else if (trainingGoal === 'gain_weight') targetCal += 300;

        const profileData = {
            gender, birthDate: format(safeBirth, "yyyy-MM-dd"), heightCm: h, currentWeightKg: w, 
            currentBodyFat: parseFloat(bodyFat) || null, targetWeightKg: parseFloat(targetWeight) || null, 
            targetBodyFat: parseFloat(targetBodyFat) || null, targetDate: targetDate ? format(targetDate, "yyyy-MM-dd") : null,
            activityLevel, goal: trainingGoal, dailyCalorieTarget: Math.round(targetCal), updatedAt: new Date()
        };

        if (profileId) await db.update(userProfiles).set(profileData).where(eq(userProfiles.id, profileId));
        else await db.insert(userProfiles).values(profileData);

        // 儲存提醒設定 (含 Start/End Time)
        const fmtTime = (d: Date) => format(d, 'HH:mm');
        const reminderData = {
            breakfastReminderEnabled: reminders.breakfast.enabled,
            breakfastReminderTime: fmtTime(reminders.breakfast.time),
            lunchReminderEnabled: reminders.lunch.enabled,
            lunchReminderTime: fmtTime(reminders.lunch.time),
            dinnerReminderEnabled: reminders.dinner.enabled,
            dinnerReminderTime: fmtTime(reminders.dinner.time),
            waterReminderEnabled: reminders.water.enabled,
            waterReminderStartTime: fmtTime(reminders.water.startTime),
            waterReminderEndTime: fmtTime(reminders.water.endTime),
            waterReminderIntervalMinutes: reminders.water.interval,
        };
        
        await db.delete(reminderSettings);
        await db.insert(reminderSettings).values(reminderData);
        
        await scheduleLocalNotifications();

        Alert.alert(t('save_settings', lang), t('success', lang));
    } catch (e) { console.error(e); Alert.alert(t('error', lang), "Failed"); } 
    finally { setLoading(false); }
  };

  const onBirthDateChange = (event: any, selectedDate?: Date) => { setShowDatePicker(false); if (selectedDate) setBirthDate(selectedDate); };
  const onTargetDateChange = (event: any, selectedDate?: Date) => { setShowTargetDatePicker(false); if (selectedDate) setTargetDate(selectedDate); };
  
  const onTimeChange = (type: 'breakfast'|'lunch'|'dinner'|'waterStart'|'waterEnd', event: any, date?: Date) => {
      setShowTimePicker(null);
      if (date) {
          if (type === 'waterStart') {
              setReminders(prev => ({...prev, water: {...prev.water, startTime: date}}));
          } else if (type === 'waterEnd') {
              setReminders(prev => ({...prev, water: {...prev.water, endTime: date}}));
          } else {
              setReminders(prev => ({...prev, [type]: {...prev[type as 'breakfast'], time: date}}));
          }
      }
  };

  if (loading) return <View style={[styles.container, {backgroundColor, justifyContent:'center', alignItems: 'center'}]}><ActivityIndicator size="large"/></View>;

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 20) }]}>
        <ThemedText type="title">{t('profile', lang)}</ThemedText>
        <Pressable onPress={() => setShowLangPicker(true)} style={styles.langBtn}>
            <Ionicons name="language" size={20} color={tintColor} />
            <ThemedText style={{marginLeft: 4, color: tintColor, fontWeight:'bold'}}>{LANGUAGES.find(l => l.code === lang)?.label || 'Language'}</ThemedText>
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

         {/* Notification Settings */}
         <View style={[styles.card, {backgroundColor: cardBackground, marginTop: 16}]}>
             <ThemedText type="subtitle" style={{marginBottom:12}}>🔔 {t('notifications', lang) || "Notifications"}</ThemedText>
             
             {/* Breakfast */}
             <View style={styles.reminderRow}>
                 <View style={{flexDirection:'row', alignItems:'center'}}>
                     <Switch value={reminders.breakfast.enabled} onValueChange={v => setReminders(p => ({...p, breakfast:{...p.breakfast, enabled:v}}))} trackColor={{true: tintColor}}/>
                     <ThemedText style={{marginLeft:8}}>{t('breakfast', lang)}</ThemedText>
                 </View>
                 <Pressable onPress={()=>setShowTimePicker('breakfast')} disabled={!reminders.breakfast.enabled}>
                     <ThemedText style={{color: reminders.breakfast.enabled ? tintColor : '#999'}}>{format(reminders.breakfast.time, 'HH:mm')}</ThemedText>
                 </Pressable>
             </View>
             {showTimePicker === 'breakfast' && <DateTimePicker value={reminders.breakfast.time} mode="time" display="spinner" onChange={(e,d) => onTimeChange('breakfast', e, d)} />}

             {/* Lunch */}
             <View style={styles.reminderRow}>
                 <View style={{flexDirection:'row', alignItems:'center'}}>
                     <Switch value={reminders.lunch.enabled} onValueChange={v => setReminders(p => ({...p, lunch:{...p.lunch, enabled:v}}))} trackColor={{true: tintColor}}/>
                     <ThemedText style={{marginLeft:8}}>{t('lunch', lang)}</ThemedText>
                 </View>
                 <Pressable onPress={()=>setShowTimePicker('lunch')} disabled={!reminders.lunch.enabled}>
                     <ThemedText style={{color: reminders.lunch.enabled ? tintColor : '#999'}}>{format(reminders.lunch.time, 'HH:mm')}</ThemedText>
                 </Pressable>
             </View>
             {showTimePicker === 'lunch' && <DateTimePicker value={reminders.lunch.time} mode="time" display="spinner" onChange={(e,d) => onTimeChange('lunch', e, d)} />}

             {/* Dinner */}
             <View style={styles.reminderRow}>
                 <View style={{flexDirection:'row', alignItems:'center'}}>
                     <Switch value={reminders.dinner.enabled} onValueChange={v => setReminders(p => ({...p, dinner:{...p.dinner, enabled:v}}))} trackColor={{true: tintColor}}/>
                     <ThemedText style={{marginLeft:8}}>{t('dinner', lang)}</ThemedText>
                 </View>
                 <Pressable onPress={()=>setShowTimePicker('dinner')} disabled={!reminders.dinner.enabled}>
                     <ThemedText style={{color: reminders.dinner.enabled ? tintColor : '#999'}}>{format(reminders.dinner.time, 'HH:mm')}</ThemedText>
                 </Pressable>
             </View>
             {showTimePicker === 'dinner' && <DateTimePicker value={reminders.dinner.time} mode="time" display="spinner" onChange={(e,d) => onTimeChange('dinner', e, d)} />}

             {/* Water / Move (Interval) */}
             <View style={{marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderColor: '#f0f0f0'}}>
                 <View style={{flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginBottom: 12}}>
                     <View style={{flexDirection:'row', alignItems:'center'}}>
                        <Switch value={reminders.water.enabled} onValueChange={v => setReminders(p => ({...p, water:{...p.water, enabled:v}}))} trackColor={{true: tintColor}}/>
                        <ThemedText style={{marginLeft:8}}>💧 {t('water_move', lang) || "Water & Move"}</ThemedText>
                     </View>
                 </View>
                 
                 {reminders.water.enabled && (
                     <View style={{paddingLeft: 10}}>
                         <View style={[styles.rowBetween, {marginBottom:8}]}>
                             <ThemedText style={{fontSize:12, color:textSecondary}}>{t('interval', lang) || "Interval (min)"}</ThemedText>
                             <TextInput 
                                style={{borderBottomWidth:1, borderColor: '#ccc', width: 50, textAlign:'center', color: textColor}} 
                                value={String(reminders.water.interval)} 
                                keyboardType="numeric"
                                onChangeText={t => setReminders(p => ({...p, water:{...p.water, interval: parseInt(t)||60}}))}
                             />
                         </View>
                         <View style={styles.rowBetween}>
                             <ThemedText style={{fontSize:12, color:textSecondary}}>{t('start_time', lang) || "Start Time"}</ThemedText>
                             <Pressable onPress={()=>setShowTimePicker('waterStart')}>
                                <ThemedText style={{color:tintColor}}>{format(reminders.water.startTime, 'HH:mm')}</ThemedText>
                             </Pressable>
                         </View>
                         <View style={[styles.rowBetween, {marginTop: 8}]}>
                             <ThemedText style={{fontSize:12, color:textSecondary}}>{t('end_time', lang) || "End Time"}</ThemedText>
                             <Pressable onPress={()=>setShowTimePicker('waterEnd')}>
                                <ThemedText style={{color:tintColor}}>{format(reminders.water.endTime, 'HH:mm')}</ThemedText>
                             </Pressable>
                         </View>
                     </View>
                 )}
             </View>

             {showTimePicker === 'waterStart' && <DateTimePicker value={reminders.water.startTime} mode="time" display="spinner" onChange={(e,d) => onTimeChange('waterStart', e, d)} />}
             {showTimePicker === 'waterEnd' && <DateTimePicker value={reminders.water.endTime} mode="time" display="spinner" onChange={(e,d) => onTimeChange('waterEnd', e, d)} />}
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
  modalContent: { padding: 20, borderRadius: 16 },
  reminderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderColor: '#f0f0f0' },
  rowBetween: { flexDirection:'row', justifyContent:'space-between', alignItems:'center'}
});