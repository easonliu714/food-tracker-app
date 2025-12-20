import { useRouter, useFocusEffect } from "expo-router";
import { useState, useCallback } from "react";
import { View, ScrollView, RefreshControl, StyleSheet, Pressable, Modal, TextInput, Alert } from "react-native";
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
  deleteActivityLogLocal, updateFoodLogLocal, 
  updateActivityLogLocal, saveFoodLogLocal, getFrequentFoodItems, getFrequentActivityTypes, getSettings
} from "@/lib/storage";
import { calculateWorkoutCalories } from "@/lib/gemini";
import { NumberInput } from "@/components/NumberInput";
import { t } from "@/lib/i18n";

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isAuthenticated } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [summary, setSummary] = useState<any>(null);
  const [targetCalories, setTargetCalories] = useState(2000);
  const [profile, setProfile] = useState<any>(null);
  const [frequentItems, setFrequentItems] = useState<any[]>([]);
  const [workoutTypes, setWorkoutTypes] = useState<string[]>([]);
  
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [lang, setLang] = useState("zh-TW");

  // 運動 Modal
  const [modalVisible, setModalVisible] = useState(false);
  const [editingWorkout, setEditingWorkout] = useState<any>(null);
  const [actType, setActType] = useState("");
  const [customActType, setCustomActType] = useState("");
  const [isCustomAct, setIsCustomAct] = useState(false);
  const [duration, setDuration] = useState("30");
  const [steps, setSteps] = useState("0");
  const [dist, setDist] = useState("0");
  const [floors, setFloors] = useState("0");
  const [estCal, setEstCal] = useState(0);

  // 飲食編輯 Modal
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingLog, setEditingLog] = useState<any>(null);
  const [editName, setEditName] = useState("");
  const [editCal, setEditCal] = useState("");

  const backgroundColor = useThemeColor({}, "background");
  const cardBackground = useThemeColor({}, "cardBackground");
  const tintColor = useThemeColor({}, "tint");
  const textSecondary = useThemeColor({}, "textSecondary");

  const toLocalISO = (d: Date) => {
    const offset = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - offset).toISOString().split('T')[0];
  };

  const loadData = useCallback(async () => {
    const s = await getSettings();
    if(s.language) setLang(s.language);
    
    const p = await getProfileLocal();
    setProfile(p);
    if (p?.dailyCalorieTarget) setTargetCalories(p.dailyCalorieTarget);
    
    const sum = await getDailySummaryLocal(selectedDate);
    setSummary(sum);
    
    const f = await getFrequentFoodItems();
    setFrequentItems(f);
    
    const w = await getFrequentActivityTypes();
    setWorkoutTypes(w);
    if (!actType && w.length > 0) setActType(w[0]);

  }, [selectedDate]);

  useFocusEffect(useCallback(() => { if (isAuthenticated) loadData(); }, [isAuthenticated, loadData]));

  // 自動計算
  useFocusEffect(useCallback(() => {
    if (modalVisible) {
      const type = isCustomAct ? customActType : actType;
      const cal = calculateWorkoutCalories(type, parseFloat(duration)||0, profile?.currentWeightKg||70, parseFloat(dist), parseFloat(steps));
      const fCal = (parseFloat(floors)||0) * 0.5;
      setEstCal(Math.round(cal + fCal));
    }
  }, [actType, customActType, isCustomAct, duration, steps, dist, floors, modalVisible]));

  const handleSaveWorkout = async () => {
    const type = isCustomAct ? customActType : actType;
    if (!type) return Alert.alert("請輸入項目");
    const newLog = {
      activityType: type,
      caloriesBurned: estCal,
      details: `${duration}分 / ${steps}步 / ${dist}km / ${floors}樓`,
      loggedAt: selectedDate.toISOString()
    };
    if (editingWorkout) {
      await updateActivityLogLocal({ ...editingWorkout, ...newLog });
      setEditingWorkout(null);
    } else {
      await saveActivityLogLocal(newLog);
    }
    setModalVisible(false);
    loadData();
  };

  const handleEditWorkout = (log: any) => {
    setEditingWorkout(log);
    setActType(log.activityType);
    setIsCustomAct(false);
    if (!workoutTypes.includes(log.activityType)) {
       setIsCustomAct(true);
       setCustomActType(log.activityType);
    }
    const parts = (log.details || "").split(' / ');
    setDuration(parts[0]?.replace('分','') || "0");
    setSteps(parts[1]?.replace('步','') || "0");
    setDist(parts[2]?.replace('km','') || "0");
    setFloors(parts[3]?.replace('樓','') || "0");
    setModalVisible(true);
  };

  const handleEditFood = (log: any) => { setEditingLog(log); setEditName(log.foodName); setEditCal(log.totalCalories.toString()); setEditModalVisible(true); };
  const handleSaveEditFood = async () => { if (editingLog) { await updateFoodLogLocal({ ...editingLog, foodName: editName, totalCalories: parseInt(editCal) || 0 }); setEditModalVisible(false); setEditingLog(null); loadData(); } };
  const handleQuickAdd = async (item: any) => { Alert.alert("快速紀錄", `再吃一次「${item.foodName}」？`, [{ text: "取消", style: "cancel" }, { text: "確定", onPress: async () => { await saveFoodLogLocal({ ...item, id: undefined, loggedAt: selectedDate.toISOString() }); loadData(); } }]); };
  const renderRightActions = (id: number, type: 'food'|'activity') => ( <Pressable onPress={async () => { if(type==='food') await deleteFoodLogLocal(id); else await deleteActivityLogLocal(id); loadData(); }} style={styles.deleteBtn}><Ionicons name="trash" size={24} color="white" /><ThemedText style={{color:'white', fontSize:12}}>刪除</ThemedText></Pressable> );
  const renderLeftActions = (item: any, type: 'food'|'activity') => ( <Pressable onPress={() => type === 'food' ? handleEditFood(item) : handleEditWorkout(item)} style={styles.editBtn}><Ionicons name="create" size={24} color="white" /><ThemedText style={{color:'white', fontSize:12}}>編輯</ThemedText></Pressable> );

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={[styles.container, { backgroundColor }]}>
        <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadData} />}>
          <View style={[styles.header, { paddingTop: Math.max(insets.top, 20) }]}>
             <ThemedText type="title">{t('today_overview', lang)}</ThemedText>
          </View>

          {/* 日期 */}
          <View style={[styles.dateNav, {backgroundColor: cardBackground}]}>
             <Pressable onPress={() => setSelectedDate(new Date(selectedDate.getTime() - 86400000))} style={styles.dateBtn}><Ionicons name="chevron-back" size={24} color={tintColor}/></Pressable>
             <Pressable onPress={() => setShowDatePicker(true)}><ThemedText type="subtitle">{toLocalISO(selectedDate)}</ThemedText></Pressable>
             <Pressable onPress={() => setSelectedDate(new Date(selectedDate.getTime() + 86400000))} style={styles.dateBtn}><Ionicons name="chevron-forward" size={24} color={tintColor}/></Pressable>
          </View>
          {showDatePicker && <DateTimePicker value={selectedDate} mode="date" onChange={(e, d) => { setShowDatePicker(false); if(d) setSelectedDate(d); }} />}

          {/* 進度環 */}
          <View style={[styles.progressSection, { backgroundColor: cardBackground, marginTop: 10 }]}>
            <ProgressRing progress={targetCalories>0?(summary?.totalCaloriesIn - summary?.totalCaloriesOut)/targetCalories:0} current={summary?.totalCaloriesIn - summary?.totalCaloriesOut} target={targetCalories} size={200} />
            <View style={{flexDirection:'row', gap:20, marginTop:10}}>
               <ThemedText style={{fontSize:12, color:textSecondary}}>{t('intake', lang)} {summary?.totalCaloriesIn}</ThemedText>
               <ThemedText style={{fontSize:12, color:textSecondary}}>{t('burned', lang)} {summary?.totalCaloriesOut}</ThemedText>
            </View>
          </View>

          {/* 常用項目 */}
          {frequentItems.length > 0 && (
            <View style={{marginBottom: 16}}>
              <ThemedText type="subtitle" style={{marginLeft: 16, marginBottom: 8}}>{t('quick_record', lang)}</ThemedText>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{paddingLeft: 16}}>
                {frequentItems.map((item, index) => (
                  <Pressable key={index} onPress={() => handleQuickAdd(item)} style={[styles.quickChip, {backgroundColor: cardBackground, marginRight: 10}]}>
                    <ThemedText>{item.foodName}</ThemedText>
                    <ThemedText style={{fontSize: 10, color: textSecondary}}>{item.totalCalories} kcal</ThemedText>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          )}

          {/* 快捷按鈕 (4顆) */}
          <View style={styles.quickActions}>
            <Pressable onPress={() => router.push("/camera")} style={[styles.btn, {backgroundColor: tintColor, flex:1}]}>
               <Ionicons name="camera" size={24} color="white"/>
               <ThemedText style={styles.btnTxt}>{t('photo', lang)}</ThemedText>
            </Pressable>
            <Pressable onPress={() => router.push("/barcode-scanner")} style={[styles.btn, {backgroundColor: tintColor, flex:1}]}>
               <Ionicons name="barcode" size={24} color="white"/>
               <ThemedText style={styles.btnTxt}>{t('scan', lang)}</ThemedText>
            </Pressable>
            <Pressable onPress={() => router.push("/food-recognition?mode=MANUAL")} style={[styles.btn, {backgroundColor: '#FF9800', flex:1}]}>
               <Ionicons name="create" size={24} color="white"/>
               <ThemedText style={styles.btnTxt}>{t('manual_input', lang)}</ThemedText>
            </Pressable>
            <Pressable onPress={() => {setEditingWorkout(null); setModalVisible(true);}} style={[styles.btn, {backgroundColor: '#4CAF50', flex:1}]}>
               <Ionicons name="fitness" size={24} color="white"/>
               <ThemedText style={styles.btnTxt}>{t('workout', lang)}</ThemedText>
            </Pressable>
          </View>

          {/* 列表 */}
          <View style={[styles.listSection, { backgroundColor: cardBackground }]}>
            <ThemedText type="subtitle" style={{marginBottom: 10}}>飲食</ThemedText>
            {summary?.foodLogs?.length === 0 ? <ThemedText style={{textAlign:'center', color: textSecondary, padding:20}}>{t('no_record', lang)}</ThemedText> :
              summary?.foodLogs?.map((log: any) => (
              <Swipeable key={log.id} renderRightActions={() => renderRightActions(log.id, 'food')} renderLeftActions={() => renderLeftActions(log, 'food')}>
                <View style={[styles.listItem, {backgroundColor: cardBackground}]}>
                  <ThemedText>{log.foodName}</ThemedText>
                  <ThemedText style={{color: tintColor, fontWeight: 'bold'}}>{log.totalCalories}</ThemedText>
                </View>
              </Swipeable>
            ))}
          </View>
          <View style={[styles.listSection, { backgroundColor: cardBackground, marginTop: 16 }]}>
            <ThemedText type="subtitle" style={{marginBottom: 10}}>運動</ThemedText>
            {summary?.activityLogs?.length === 0 ? <ThemedText style={{textAlign:'center', color: textSecondary, padding:20}}>{t('no_record', lang)}</ThemedText> :
              summary?.activityLogs?.map((log: any) => (
              <Swipeable key={log.id} renderRightActions={() => renderRightActions(log.id, 'activity')} renderLeftActions={() => renderLeftActions(log, 'activity')}>
                <View style={[styles.listItem, {backgroundColor: cardBackground}]}>
                  <ThemedText>{log.activityType}</ThemedText>
                  <ThemedText style={{color: '#FF9800', fontWeight: 'bold'}}>-{log.caloriesBurned}</ThemedText>
                </View>
              </Swipeable>
            ))}
          </View>
          <View style={{height: 100}}/>
        </ScrollView>

        <Modal visible={modalVisible} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: cardBackground }]}>
              <View style={{flexDirection:'row', justifyContent:'space-between', alignItems:'center'}}>
                 <ThemedText type="title">{editingWorkout ? "編輯運動" : "新增運動"}</ThemedText>
                 <Pressable onPress={() => setIsCustomAct(!isCustomAct)}><ThemedText style={{color: tintColor}}>{isCustomAct ? "選單" : "手動"}</ThemedText></Pressable>
              </View>
              {isCustomAct ? (
                 <TextInput style={[styles.input, {color: '#000', backgroundColor: 'white', marginTop:10}]} placeholder="輸入名稱" value={customActType} onChangeText={setCustomActType} />
              ) : (
                 <ScrollView horizontal style={{marginVertical: 10, maxHeight: 50}}>
                   {workoutTypes.map(t => (
                     <Pressable key={t} onPress={() => setActType(t)} style={[styles.typeChip, actType === t && {backgroundColor: tintColor}]}>
                       <ThemedText style={{color: actType === t ? 'white' : '#666'}}>{t}</ThemedText>
                     </Pressable>
                   ))}
                 </ScrollView>
              )}
              <View style={{flexDirection: 'row', gap: 10}}>
                <View style={{flex:1}}><NumberInput label="時間 (分)" value={duration} onChange={setDuration} step={10} /></View>
                <View style={{flex:1}}><NumberInput label="距離 (km)" value={dist} onChange={setDist} step={0.5} /></View>
              </View>
              <View style={{flexDirection: 'row', gap: 10}}>
                 <View style={{flex:1}}><NumberInput label="步數" value={steps} onChange={setSteps} step={100} /></View>
                 <View style={{flex:1}}><NumberInput label="樓層" value={floors} onChange={setFloors} step={1} /></View>
              </View>
              <View style={{backgroundColor: '#FFF3E0', padding: 10, borderRadius: 8, marginVertical: 10}}>
                <ThemedText style={{textAlign: 'center', color: '#E65100', fontWeight: 'bold'}}>預估消耗: {estCal} kcal</ThemedText>
              </View>
              <View style={{flexDirection: 'row', gap: 10}}>
                <Pressable onPress={() => setModalVisible(false)} style={[styles.modalBtn, {borderWidth: 1}]}><ThemedText>取消</ThemedText></Pressable>
                <Pressable onPress={handleSaveWorkout} style={[styles.modalBtn, {backgroundColor: tintColor}]}><ThemedText style={{color:'white'}}>儲存</ThemedText></Pressable>
              </View>
            </View>
          </View>
        </Modal>

        {/* 飲食 Modal (保持原樣，僅省略內容) */}
        <Modal visible={editModalVisible} transparent animationType="slide">
           {/* ... 原本的飲食編輯 Modal 內容 ... */}
           <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: cardBackground }]}>
              <ThemedText type="title">編輯飲食</ThemedText>
              <View style={{marginVertical: 20}}>
                <ThemedText style={{marginBottom: 5, color: textSecondary}}>食物名稱</ThemedText>
                <TextInput style={[styles.input, {color: '#000', backgroundColor: 'white'}]} value={editName} onChangeText={setEditName} />
                <View style={{height: 10}}/>
                <NumberInput label="熱量 (kcal)" value={editCal} onChange={setEditCal} step={10} />
              </View>
              <View style={{flexDirection: 'row', gap: 10}}>
                <Pressable onPress={() => setEditModalVisible(false)} style={[styles.modalBtn, {borderWidth: 1}]}><ThemedText>取消</ThemedText></Pressable>
                <Pressable onPress={handleSaveEditFood} style={[styles.modalBtn, {backgroundColor: tintColor}]}><ThemedText style={{color:'white'}}>儲存</ThemedText></Pressable>
              </View>
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