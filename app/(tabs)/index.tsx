import { useRouter, useFocusEffect } from "expo-router";
import { useState, useCallback } from "react";
import { View, ScrollView, RefreshControl, StyleSheet, Pressable, Modal, TextInput, Alert, Platform } from "react-native";
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
  updateActivityLogLocal, saveFoodLogLocal, getFrequentFoodItems
} from "@/lib/storage";
import { calculateWorkoutCalories } from "@/lib/gemini";
import { NumberInput } from "@/components/NumberInput";

const WORKOUT_TYPES = ['快走', '慢走', '慢跑', '快跑', '跑步機', '爬梯', '一般運動'];

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isAuthenticated } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [summary, setSummary] = useState<any>(null);
  const [targetCalories, setTargetCalories] = useState(2000);
  const [profile, setProfile] = useState<any>(null);
  const [frequentItems, setFrequentItems] = useState<any[]>([]);

  // 日期狀態
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);

  // 運動 Modal 狀態
  const [modalVisible, setModalVisible] = useState(false);
  const [editingWorkout, setEditingWorkout] = useState<any>(null);
  const [actType, setActType] = useState(WORKOUT_TYPES[0]);
  const [duration, setDuration] = useState("30");
  const [steps, setSteps] = useState("0");
  const [dist, setDist] = useState("0");
  const [estCal, setEstCal] = useState(0);

  // 飲食編輯 Modal 狀態
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingLog, setEditingLog] = useState<any>(null);
  const [editName, setEditName] = useState("");
  const [editCal, setEditCal] = useState("");

  const backgroundColor = useThemeColor({}, "background");
  const cardBackground = useThemeColor({}, "cardBackground");
  const tintColor = useThemeColor({}, "tint");
  const textSecondary = useThemeColor({}, "textSecondary");

  const loadData = useCallback(async () => {
    const p = await getProfileLocal();
    setProfile(p);
    if (p?.dailyCalorieTarget) setTargetCalories(p.dailyCalorieTarget);
    // 傳入選擇的日期
    const s = await getDailySummaryLocal(selectedDate);
    setSummary(s);
    const f = await getFrequentFoodItems();
    setFrequentItems(f);
  }, [selectedDate]);

  useFocusEffect(useCallback(() => { if (isAuthenticated) loadData(); }, [isAuthenticated, loadData]));

  // 自動計算運動熱量
  useFocusEffect(useCallback(() => {
    if (modalVisible) {
      const cal = calculateWorkoutCalories(
        actType, 
        parseFloat(duration) || 0, 
        profile?.currentWeightKg || 70,
        parseFloat(dist),
        parseFloat(steps)
      );
      setEstCal(cal);
    }
  }, [actType, duration, steps, dist, modalVisible]));

  // 日期操作
  const handleDateChange = (event: any, date?: Date) => {
    setShowDatePicker(false);
    if (date) setSelectedDate(date);
  };
  const changeDate = (days: number) => {
    const newDate = new Date(selectedDate);
    newDate.setDate(selectedDate.getDate() + days);
    setSelectedDate(newDate);
  };

  // 儲存/更新運動
  const handleSaveWorkout = async () => {
    const newLog = {
      activityType: actType,
      caloriesBurned: estCal,
      details: `${duration}分 / ${steps}步 / ${dist}km`,
      loggedAt: selectedDate.toISOString() // 儲存至當前選擇日期
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

  // 開啟運動編輯
  const handleEditWorkout = (log: any) => {
    setEditingWorkout(log);
    setActType(log.activityType);
    const parts = (log.details || "").split(' / ');
    setDuration(parts[0]?.replace('分','') || "0");
    setSteps(parts[1]?.replace('步','') || "0");
    setDist(parts[2]?.replace('km','') || "0");
    setModalVisible(true);
  };

  // 開啟飲食編輯
  const handleEditFood = (log: any) => {
    setEditingLog(log);
    setEditName(log.foodName);
    setEditCal(log.totalCalories.toString());
    setEditModalVisible(true);
  };

  const handleSaveEditFood = async () => {
    if (editingLog) {
      await updateFoodLogLocal({ ...editingLog, foodName: editName, totalCalories: parseInt(editCal) || 0 });
      setEditModalVisible(false);
      setEditingLog(null);
      loadData();
    }
  };

  const handleQuickAdd = async (item: any) => {
    Alert.alert("快速紀錄", `再吃一次「${item.foodName}」？`, [
      { text: "取消", style: "cancel" },
      { text: "確定", onPress: async () => {
          await saveFoodLogLocal({ ...item, id: undefined, loggedAt: selectedDate.toISOString() });
          loadData();
        } 
      }
    ]);
  };

  // Swipeable 按鈕元件
  const renderRightActions = (id: number, type: 'food'|'activity') => (
    <Pressable onPress={async () => { 
        if(type==='food') await deleteFoodLogLocal(id); 
        else await deleteActivityLogLocal(id); 
        loadData(); 
      }} 
      style={styles.deleteBtn}>
      <Ionicons name="trash" size={24} color="white" />
      <ThemedText style={{color:'white', fontSize:12}}>刪除</ThemedText>
    </Pressable>
  );

  const renderLeftActions = (item: any, type: 'food'|'activity') => (
    <Pressable onPress={() => type === 'food' ? handleEditFood(item) : handleEditWorkout(item)} style={styles.editBtn}>
      <Ionicons name="create" size={24} color="white" />
      <ThemedText style={{color:'white', fontSize:12}}>編輯</ThemedText>
    </Pressable>
  );

  const net = (summary?.totalCaloriesIn || 0) - (summary?.totalCaloriesOut || 0);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={[styles.container, { backgroundColor }]}>
        <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadData} />}>
          <View style={[styles.header, { paddingTop: Math.max(insets.top, 20) }]}>
             <ThemedText type="title" style={{fontSize: 32}}>今日概覽</ThemedText>
          </View>

          {/* 日期導航欄 */}
          <View style={[styles.dateNav, {backgroundColor: cardBackground}]}>
             <Pressable onPress={() => changeDate(-1)} style={styles.dateBtn}><Ionicons name="chevron-back" size={24} color={tintColor}/></Pressable>
             <Pressable onPress={() => setShowDatePicker(true)}>
               <ThemedText type="subtitle">{selectedDate.toISOString().split('T')[0]}</ThemedText>
             </Pressable>
             <Pressable onPress={() => changeDate(1)} style={styles.dateBtn}><Ionicons name="chevron-forward" size={24} color={tintColor}/></Pressable>
          </View>
          {showDatePicker && (
            <DateTimePicker value={selectedDate} mode="date" display="default" onChange={handleDateChange} />
          )}

          <View style={[styles.progressSection, { backgroundColor: cardBackground, marginTop: 10 }]}>
            <ProgressRing progress={targetCalories>0?net/targetCalories:0} current={net} target={targetCalories} size={200} />
            <View style={{flexDirection:'row', gap:20, marginTop:10}}>
               <ThemedText style={{fontSize:12, color:textSecondary}}>攝取 {summary?.totalCaloriesIn}</ThemedText>
               <ThemedText style={{fontSize:12, color:textSecondary}}>消耗 {summary?.totalCaloriesOut}</ThemedText>
            </View>
          </View>

          {/* 常用項目 */}
          {frequentItems.length > 0 && (
            <View style={{marginBottom: 16}}>
              <ThemedText type="subtitle" style={{marginLeft: 16, marginBottom: 8}}>常用項目</ThemedText>
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

          <View style={styles.quickActions}>
            <Pressable onPress={() => router.push("/camera")} style={[styles.btn, {backgroundColor: tintColor, flex:1}]}><Ionicons name="camera" size={24} color="white"/><ThemedText style={styles.btnTxt}>拍照</ThemedText></Pressable>
            <Pressable onPress={() => router.push("/barcode-scanner")} style={[styles.btn, {backgroundColor: tintColor, flex:1}]}><Ionicons name="barcode" size={24} color="white"/><ThemedText style={styles.btnTxt}>掃碼</ThemedText></Pressable>
            <Pressable onPress={() => {setEditingWorkout(null); setModalVisible(true);}} style={[styles.btn, {backgroundColor: '#FF9800', flex:1}]}><Ionicons name="fitness" size={24} color="white"/><ThemedText style={styles.btnTxt}>運動</ThemedText></Pressable>
          </View>

          {/* 飲食列表 */}
          <View style={[styles.listSection, { backgroundColor: cardBackground }]}>
            <ThemedText type="subtitle" style={{marginBottom: 10}}>飲食 (右滑編輯 / 左滑刪除)</ThemedText>
            {summary?.foodLogs?.length === 0 ? <ThemedText style={{textAlign:'center', color: textSecondary, padding:20}}>尚無紀錄</ThemedText> :
              summary?.foodLogs?.map((log: any) => (
              <Swipeable key={log.id} renderRightActions={() => renderRightActions(log.id, 'food')} renderLeftActions={() => renderLeftActions(log, 'food')}>
                <View style={[styles.listItem, {backgroundColor: cardBackground}]}>
                  <ThemedText>{log.foodName}</ThemedText>
                  <ThemedText style={{color: tintColor, fontWeight: 'bold'}}>{log.totalCalories}</ThemedText>
                </View>
              </Swipeable>
            ))}
          </View>

          {/* 運動列表 */}
          <View style={[styles.listSection, { backgroundColor: cardBackground, marginTop: 16 }]}>
            <ThemedText type="subtitle" style={{marginBottom: 10}}>運動 (右滑編輯 / 左滑刪除)</ThemedText>
            {summary?.activityLogs?.length === 0 ? <ThemedText style={{textAlign:'center', color: textSecondary, padding:20}}>尚無紀錄</ThemedText> :
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

        {/* 運動 Modal */}
        <Modal visible={modalVisible} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: cardBackground }]}>
              <ThemedText type="title">{editingWorkout ? "編輯運動" : "新增運動"}</ThemedText>
              <ScrollView horizontal style={{marginVertical: 10, maxHeight: 50}}>
                {WORKOUT_TYPES.map(t => (
                  <Pressable key={t} onPress={() => setActType(t)} style={[styles.typeChip, actType === t && {backgroundColor: tintColor}]}>
                    <ThemedText style={{color: actType === t ? 'white' : '#666'}}>{t}</ThemedText>
                  </Pressable>
                ))}
              </ScrollView>
              <View style={{flexDirection: 'row', gap: 10}}>
                <View style={{flex:1}}><NumberInput label="時間 (分)" value={duration} onChange={setDuration} step={10} /></View>
                <View style={{flex:1}}><NumberInput label="距離 (km)" value={dist} onChange={setDist} step={0.5} /></View>
              </View>
              <NumberInput label="步數" value={steps} onChange={setSteps} step={100} />
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

        {/* 飲食編輯 Modal */}
        <Modal visible={editModalVisible} transparent animationType="slide">
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
  quickActions: { flexDirection: "row", padding: 16, gap: 12 },
  btn: { padding: 16, borderRadius: 12, alignItems: 'center', flexDirection: 'row', gap: 8, justifyContent: 'center' },
  btnTxt: { color: 'white', fontWeight: 'bold' },
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