import { useRouter, useFocusEffect } from "expo-router";
import { useState, useCallback, useEffect } from "react";
import { View, ScrollView, RefreshControl, StyleSheet, Pressable, Modal, TextInput, Alert, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Swipeable, GestureHandlerRootView } from 'react-native-gesture-handler';
import DateTimePicker from '@react-native-community/datetimepicker';

import { ProgressRing } from "@/components/progress-ring";
import { ThemedText } from "@/components/themed-text";
import { useAuth } from "@/hooks/use-auth";
import { useThemeColor } from "@/hooks/use-theme-color";
import { 
  getDailySummaryLocal, getProfileLocal, 
  deleteFoodLogLocal, saveActivityLogLocal, 
  deleteActivityLogLocal, updateActivityLogLocal,
  getSettings, saveSettings 
} from "@/lib/storage";
import { calculateWorkoutCalories, identifyWorkoutType, validateApiKey } from "@/lib/gemini"; 
import { NumberInput } from "@/components/NumberInput";
import { t, useLanguage } from "@/lib/i18n";

const STANDARD_WORKOUTS = [
  'running', 'walking', 'cycling', 'swimming', 'yoga', 'weight_lifting', 'hiit', 
  'basketball', 'soccer', 'tennis', 'hiking', 'stair_climbing', 'cleaning'
];

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isAuthenticated } = useAuth();
  const lang = useLanguage();

  const [refreshing, setRefreshing] = useState(false);
  const [summary, setSummary] = useState<any>(null);
  const [targetCalories, setTargetCalories] = useState(2000);
  const [profile, setProfile] = useState<any>(null);
  
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);

  const [modalVisible, setModalVisible] = useState(false);
  const [editingWorkout, setEditingWorkout] = useState<any>(null);
  const [actType, setActType] = useState("running");
  const [customInput, setCustomInput] = useState(""); 
  const [isCustomAct, setIsCustomAct] = useState(false);
  const [identifying, setIdentifying] = useState(false);

  const [duration, setDuration] = useState("");
  const [steps, setSteps] = useState("");
  const [dist, setDist] = useState("");
  const [floors, setFloors] = useState("");
  const [estCal, setEstCal] = useState(0);

  const backgroundColor = useThemeColor({}, "background");
  const cardBackground = useThemeColor({}, "cardBackground");
  const tintColor = useThemeColor({}, "tint");
  const textSecondary = useThemeColor({}, "textSecondary");

  const toLocalISO = (d: Date) => {
    const offset = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - offset).toISOString().split('T')[0];
  };

  const loadData = useCallback(async () => {
    const p = await getProfileLocal();
    setProfile(p);
    if (p?.dailyCalorieTarget) setTargetCalories(p.dailyCalorieTarget);
    const sum = await getDailySummaryLocal(selectedDate);
    setSummary(sum);
  }, [selectedDate]);

  const checkApiKeyStatus = async () => {
    const settings = await getSettings();
    if (!settings.apiKey) {
      Alert.alert(t('tab_settings', lang), "請先設定 Gemini API Key", [{ text: "設定", onPress: () => router.push("/profile") }]);
    }
  };

  useFocusEffect(useCallback(() => { 
    if (isAuthenticated) {
      loadData();
      checkApiKeyStatus();
    }
  }, [isAuthenticated, loadData]));

  // [修正] 確保即時計算，並加入 Log 驗證
  useEffect(() => {
    if (modalVisible && !identifying) {
      const dur = parseFloat(duration) || 0;
      const w = profile?.currentWeightKg || 70; 
      
      // 即使 duration 為 0，也要能重置為 0
      if (actType) {
        console.log(`[Home] Calc: ${actType} ${dur}min ${w}kg`);
        const cal = calculateWorkoutCalories(actType, dur, w, parseFloat(dist)||0, parseFloat(steps)||0);
        const fCal = (parseFloat(floors)||0) * 0.5;
        setEstCal(Math.round(cal + fCal));
      }
    }
  }, [actType, duration, steps, dist, floors, modalVisible, profile, identifying]);

  const handleIdentify = async () => {
    if (!customInput) return;
    setIdentifying(true);
    const res = await identifyWorkoutType(customInput);
    setIdentifying(false);
    if (res && res.key !== 'custom') {
      setActType(res.key);
      Alert.alert(t('ai_identified_as', lang), `${t(res.key, lang)}`);
    } else {
      setActType('custom');
    }
  };

  const handleSaveWorkout = async () => {
    if (!actType) return;
    let detailsParts = [];
    if(duration) detailsParts.push(`${duration} min`);
    if(steps) detailsParts.push(`${steps} steps`);
    if(dist) detailsParts.push(`${dist} km`);
    if(floors) detailsParts.push(`${floors} floors`);

    const logData = {
      activityType: actType === 'custom' ? customInput : actType,
      caloriesBurned: estCal,
      details: detailsParts.join(' / '),
      loggedAt: selectedDate.toISOString()
    };
    
    if (editingWorkout) {
      await updateActivityLogLocal({ ...logData, id: editingWorkout.id });
    } else {
      await saveActivityLogLocal(logData);
    }
    setModalVisible(false);
    loadData();
  };

  const handleEditWorkoutLocal = (log: any) => {
    setEditingWorkout(log);
    const isStandard = STANDARD_WORKOUTS.includes(log.activityType);
    if (isStandard) {
      setActType(log.activityType);
      setIsCustomAct(false);
    } else {
      setActType('custom');
      setCustomInput(log.activityType);
      setIsCustomAct(true);
    }
    const getVal = (suffix: string) => {
      const match = (log.details||"").match(new RegExp(`([\\d\\.]+)\\s${suffix}`));
      return match ? match[1] : "";
    };
    setDuration(getVal("min"));
    setSteps(getVal("steps"));
    setDist(getVal("km"));
    setFloors(getVal("floors"));
    setEstCal(log.caloriesBurned); 
    setModalVisible(true);
  };

  const resetModal = () => {
    setEditingWorkout(null);
    setActType('running'); 
    setIsCustomAct(false);
    setCustomInput("");
    setDuration(""); setSteps(""); setDist(""); setFloors(""); setEstCal(0);
    setModalVisible(true);
  };

  const renderActivityName = (type: string) => t(type, lang) === type && type !== 'custom' ? type : t(type, lang);

  const renderDeleteAction = (id: number, type: 'food'|'activity') => ( 
    <Pressable onPress={async () => { 
        if(type==='food') await deleteFoodLogLocal(id); 
        else await deleteActivityLogLocal(id); 
        loadData(); 
      }} style={styles.deleteBtn}>
      <Ionicons name="trash" size={24} color="white" />
      <ThemedText style={{color:'white', fontSize:12}}>{t('delete', lang)}</ThemedText>
    </Pressable> 
  );

  const renderEditAction = (item: any, type: 'food'|'activity') => ( 
    <Pressable onPress={() => type === 'food' ? router.push({ pathname: '/food-recognition', params: { mode: 'EDIT', id: item.id } }) : handleEditWorkoutLocal(item)} style={styles.editBtn}>
      <Ionicons name="create" size={24} color="white" />
      <ThemedText style={{color:'white', fontSize:12}}>{t('edit', lang)}</ThemedText>
    </Pressable> 
  );

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={[styles.container, { backgroundColor }]}>
        <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadData} />}>
          <View style={[styles.header, { paddingTop: Math.max(insets.top, 20) }]}>
             <ThemedText type="title">{t('today_overview', lang)}</ThemedText>
          </View>
          <View style={[styles.dateNav, {backgroundColor: cardBackground}]}>
             <Pressable onPress={() => setSelectedDate(new Date(selectedDate.getTime() - 86400000))} style={styles.dateBtn}><Ionicons name="chevron-back" size={24} color={tintColor}/></Pressable>
             <Pressable onPress={() => setShowDatePicker(true)}><ThemedText type="subtitle">{toLocalISO(selectedDate)}</ThemedText></Pressable>
             <Pressable onPress={() => setSelectedDate(new Date(selectedDate.getTime() + 86400000))} style={styles.dateBtn}><Ionicons name="chevron-forward" size={24} color={tintColor}/></Pressable>
          </View>
          {showDatePicker && <DateTimePicker value={selectedDate} mode="date" display="default" onChange={(e, d) => { setShowDatePicker(false); if(d) setSelectedDate(d); }} />}

          <View style={[styles.progressSection, { backgroundColor: cardBackground, marginTop: 10 }]}>
            <ProgressRing progress={targetCalories>0?(summary?.totalCaloriesIn - summary?.totalCaloriesOut)/targetCalories:0} current={summary?.totalCaloriesIn - summary?.totalCaloriesOut} target={targetCalories} size={200} />
            <View style={{flexDirection:'row', gap:20, marginTop:10}}>
               <ThemedText style={{fontSize:12, color:textSecondary}}>{t('intake', lang)} {summary?.totalCaloriesIn}</ThemedText>
               <ThemedText style={{fontSize:12, color:textSecondary}}>{t('burned', lang)} {summary?.totalCaloriesOut}</ThemedText>
            </View>
          </View>

          <View style={styles.quickActions}>
            <Pressable onPress={() => router.push("/camera")} style={[styles.btn, {backgroundColor: tintColor, flex:1}]}><Ionicons name="camera" size={24} color="white"/><ThemedText style={styles.btnTxt}>{t('photo', lang)}</ThemedText></Pressable>
            <Pressable onPress={() => router.push("/barcode-scanner")} style={[styles.btn, {backgroundColor: tintColor, flex:1}]}><Ionicons name="barcode" size={24} color="white"/><ThemedText style={styles.btnTxt}>{t('scan', lang)}</ThemedText></Pressable>
            <Pressable onPress={() => router.push("/food-recognition?mode=MANUAL")} style={[styles.btn, {backgroundColor: '#FF9800', flex:1}]}><Ionicons name="create" size={24} color="white"/><ThemedText style={styles.btnTxt}>{t('manual_input', lang)}</ThemedText></Pressable>
            <Pressable onPress={resetModal} style={[styles.btn, {backgroundColor: '#4CAF50', flex:1}]}><Ionicons name="fitness" size={24} color="white"/><ThemedText style={styles.btnTxt}>{t('workout', lang)}</ThemedText></Pressable>
          </View>

          <View style={[styles.listSection, { backgroundColor: cardBackground }]}>
            <View style={{flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:10}}><ThemedText type="subtitle">{t('intake', lang)}</ThemedText><ThemedText style={{fontSize:10, color:textSecondary}}>{t('swipe_hint', lang)}</ThemedText></View>
            {summary?.foodLogs?.map((log: any) => (
              <Swipeable key={log.id} renderRightActions={() => renderDeleteAction(log.id, 'food')} renderLeftActions={() => renderEditAction(log, 'food')}>
                <View style={[styles.listItem, {backgroundColor: cardBackground}]}><ThemedText>{log.foodName}</ThemedText><ThemedText style={{color: tintColor, fontWeight: 'bold'}}>{log.totalCalories}</ThemedText></View>
              </Swipeable>
            ))}
          </View>
          
          <View style={[styles.listSection, { backgroundColor: cardBackground, marginTop: 16 }]}>
            <View style={{flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:10}}><ThemedText type="subtitle">{t('workout', lang)}</ThemedText><ThemedText style={{fontSize:10, color:textSecondary}}>{t('swipe_hint', lang)}</ThemedText></View>
            {summary?.activityLogs?.map((log: any) => (
              <Swipeable key={log.id} renderRightActions={() => renderDeleteAction(log.id, 'activity')} renderLeftActions={() => renderEditAction(log, 'activity')}>
                <View style={[styles.listItem, {backgroundColor: cardBackground}]}><ThemedText>{renderActivityName(log.activityType)}</ThemedText><ThemedText style={{color: '#FF9800', fontWeight: 'bold'}}>-{log.caloriesBurned}</ThemedText></View>
              </Swipeable>
            ))}
          </View>
          <View style={{height: 100}}/>
        </ScrollView>

        <Modal visible={modalVisible} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: cardBackground }]}>
              <View style={{flexDirection:'row', justifyContent:'space-between', alignItems:'center'}}>
                 <ThemedText type="title">{editingWorkout ? t('edit', lang) : t('workout', lang)}</ThemedText>
                 <Pressable onPress={() => setIsCustomAct(!isCustomAct)}><ThemedText style={{color: tintColor}}>{isCustomAct ? t('switch_manual', lang) : t('manual_input', lang)}</ThemedText></Pressable>
              </View>
              {isCustomAct ? (
                 <View>
                   <TextInput style={[styles.input, {color: '#000', backgroundColor: 'white', marginTop:10}]} placeholder={t('manual_input', lang)} value={customInput} onChangeText={setCustomInput} />
                   <Pressable onPress={handleIdentify} style={[styles.modalBtn, {backgroundColor: tintColor, marginTop: 8, flexDirection:'row', justifyContent:'center'}]}>{identifying ? <ActivityIndicator color="white"/> : <ThemedText style={{color:'white'}}>{t('ai_identify_workout', lang)}</ThemedText>}</Pressable>
                 </View>
              ) : (
                 <ScrollView horizontal style={{marginVertical: 10, maxHeight: 50}} showsHorizontalScrollIndicator={false}>{STANDARD_WORKOUTS.map(key => (<Pressable key={key} onPress={() => setActType(key)} style={[styles.typeChip, actType === key && {backgroundColor: tintColor}]}><ThemedText style={{color: actType === key ? 'white' : '#666'}}>{t(key, lang)}</ThemedText></Pressable>))}</ScrollView>
              )}
              <View style={{flexDirection: 'row', gap: 10, marginTop:10}}><View style={{flex:1}}><NumberInput label={t('input_time', lang)} value={duration} onChange={setDuration} step={10} /></View><View style={{flex:1}}><NumberInput label={t('input_dist', lang)} value={dist} onChange={setDist} step={0.5} /></View></View>
              <View style={{flexDirection: 'row', gap: 10}}><View style={{flex:1}}><NumberInput label={t('input_steps', lang)} value={steps} onChange={setSteps} step={100} /></View><View style={{flex:1}}><NumberInput label={t('input_floors', lang)} value={floors} onChange={setFloors} step={1} /></View></View>
              <View style={{backgroundColor: '#FFF3E0', padding: 10, borderRadius: 8, marginVertical: 10}}><ThemedText style={{textAlign: 'center', color: '#E65100', fontWeight: 'bold'}}>{t('est_burned', lang)}: {estCal} kcal</ThemedText></View>
              <View style={{flexDirection: 'row', gap: 10}}><Pressable onPress={() => setModalVisible(false)} style={[styles.modalBtn, {borderWidth: 1}]}><ThemedText>取消</ThemedText></Pressable><Pressable onPress={handleSaveWorkout} style={[styles.modalBtn, {backgroundColor: tintColor}]}><ThemedText style={{color:'white'}}>{editingWorkout ? t('save_settings', lang) : "新增"}</ThemedText></Pressable></View>
            </View>
          </View>
        </Modal>
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: 20 },
  dateNav: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', padding: 12, marginHorizontal: 20, borderRadius: 12 },
  dateBtn: { padding: 10, marginHorizontal: 20 },
  progressSection: { alignItems: 'center', padding: 20, margin: 16, borderRadius: 20 },
  quickActions: { flexDirection: "row", padding: 16, gap: 8 },
  btn: { padding: 12, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  btnTxt: { color: 'white', fontWeight: 'bold', fontSize: 12, marginTop: 4 },
  listSection: { marginHorizontal: 16, padding: 16, borderRadius: 16 },
  listItem: { paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#eee', flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 10 },
  deleteBtn: { backgroundColor: 'red', justifyContent: 'center', alignItems: 'center', width: 80, height: '100%', borderTopRightRadius: 16, borderBottomRightRadius: 16 },
  editBtn: { backgroundColor: '#2196F3', justifyContent: 'center', alignItems: 'center', width: 80, height: '100%', borderTopLeftRadius: 16, borderBottomLeftRadius: 16 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalContent: { padding: 20, borderRadius: 16 },
  typeChip: { padding: 8, borderRadius: 16, borderWidth: 1, borderColor: '#ddd', marginRight: 8 },
  modalBtn: { flex: 1, padding: 12, borderRadius: 8, alignItems: 'center' },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, fontSize: 16 },
  quickChip: { padding: 10, borderRadius: 10, alignItems: 'center', minWidth: 80 }
});