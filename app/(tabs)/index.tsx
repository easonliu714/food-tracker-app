import { useRouter, useFocusEffect } from "expo-router";
import { useState, useCallback, useRef } from "react";
import { View, ScrollView, RefreshControl, StyleSheet, Pressable, Modal, TextInput, Alert, Animated } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Swipeable, GestureHandlerRootView } from 'react-native-gesture-handler'; // 記得安裝

import { ProgressRing } from "@/components/progress-ring";
import { ThemedText } from "@/components/themed-text";
import { useAuth } from "@/hooks/use-auth";
import { useThemeColor } from "@/hooks/use-theme-color";
import { getDailySummaryLocal, getProfileLocal, deleteFoodLogLocal, saveActivityLogLocal, deleteActivityLogLocal } from "@/lib/storage";
import { calculateWorkoutCalories } from "@/lib/gemini";
import { NumberInput } from "@/components/NumberInput";

// 運動選項
const WORKOUT_TYPES = ['快走', '慢走', '慢跑', '快跑', '跑步機', '爬梯', '一般運動'];

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isAuthenticated } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [summary, setSummary] = useState<any>(null);
  const [targetCalories, setTargetCalories] = useState(2000);
  const [profile, setProfile] = useState<any>(null);

  // Modal 狀態
  const [modalVisible, setModalVisible] = useState(false);
  const [actType, setActType] = useState(WORKOUT_TYPES[0]);
  const [duration, setDuration] = useState("30");
  const [steps, setSteps] = useState("0");
  const [dist, setDist] = useState("0");
  const [estCal, setEstCal] = useState(0);

  const backgroundColor = useThemeColor({}, "background");
  const cardBackground = useThemeColor({}, "cardBackground");
  const tintColor = useThemeColor({}, "tint");

  // 載入資料
  const loadData = useCallback(async () => {
    const p = await getProfileLocal();
    setProfile(p);
    if (p?.dailyCalorieTarget) setTargetCalories(p.dailyCalorieTarget);
    const s = await getDailySummaryLocal();
    setSummary(s);
  }, []);

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

  // 儲存運動
  const handleSaveWorkout = async () => {
    await saveActivityLogLocal({
      activityType: actType,
      caloriesBurned: estCal,
      details: `${duration}分 / ${steps}步 / ${dist}km`
    });
    setModalVisible(false);
    loadData();
  };

  // 左滑刪除元件
  const renderRightActions = (progress: any, dragX: any, onDelete: () => void) => {
    const trans = dragX.interpolate({ inputRange: [-100, 0], outputRange: [1, 0] });
    return (
      <Pressable onPress={onDelete} style={styles.deleteBtn}>
        <Ionicons name="trash" size={24} color="white" />
        <ThemedText style={{color:'white', fontSize: 12}}>刪除</ThemedText>
      </Pressable>
    );
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={[styles.container, { backgroundColor }]}>
        <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadData} />}>
          <View style={[styles.header, { paddingTop: Math.max(insets.top, 20) }]}>
             <ThemedText type="title" style={{fontSize: 32}}>今日概覽</ThemedText>
          </View>

          {/* 環狀圖 (維持原樣) */}
          <View style={[styles.progressSection, { backgroundColor: cardBackground }]}>
            <ProgressRing progress={(summary?.totalCaloriesIn - summary?.totalCaloriesOut)/targetCalories} current={summary?.totalCaloriesIn - summary?.totalCaloriesOut} target={targetCalories} size={200} />
          </View>

          {/* 快捷按鈕 */}
          <View style={styles.quickActions}>
            <Pressable onPress={() => router.push("/camera")} style={[styles.btn, {backgroundColor: tintColor, flex:1.5}]}><Ionicons name="camera" size={24} color="white"/><ThemedText style={styles.btnTxt}>拍照</ThemedText></Pressable>
            <Pressable onPress={() => router.push("/barcode-scanner")} style={[styles.btn, {backgroundColor: tintColor, flex:1}]}><Ionicons name="barcode" size={24} color="white"/><ThemedText style={styles.btnTxt}>掃碼</ThemedText></Pressable>
            <Pressable onPress={() => setModalVisible(true)} style={[styles.btn, {backgroundColor: '#FF9800', flex:1}]}><Ionicons name="fitness" size={24} color="white"/><ThemedText style={styles.btnTxt}>運動</ThemedText></Pressable>
          </View>

          {/* 飲食列表 (Swipeable) */}
          <View style={[styles.listSection, { backgroundColor: cardBackground }]}>
            <ThemedText type="subtitle" style={{marginBottom: 10}}>飲食紀錄 (左滑刪除)</ThemedText>
            {summary?.foodLogs?.map((log: any) => (
              <Swipeable key={log.id} renderRightActions={(p, d) => renderRightActions(p, d, async () => { await deleteFoodLogLocal(log.id); loadData(); })}>
                <View style={[styles.listItem, {backgroundColor: cardBackground}]}>
                  <ThemedText>{log.foodName}</ThemedText>
                  <ThemedText style={{color: tintColor, fontWeight: 'bold'}}>{log.totalCalories}</ThemedText>
                </View>
              </Swipeable>
            ))}
          </View>

          {/* 運動列表 (Swipeable) */}
          <View style={[styles.listSection, { backgroundColor: cardBackground, marginTop: 16 }]}>
            <ThemedText type="subtitle" style={{marginBottom: 10}}>運動紀錄</ThemedText>
            {summary?.activityLogs?.map((log: any) => (
              <Swipeable key={log.id} renderRightActions={(p, d) => renderRightActions(p, d, async () => { await deleteActivityLogLocal(log.id); loadData(); })}>
                <View style={[styles.listItem, {backgroundColor: cardBackground}]}>
                  <ThemedText>{log.activityType}</ThemedText>
                  <ThemedText style={{color: '#FF9800', fontWeight: 'bold'}}>-{log.caloriesBurned}</ThemedText>
                </View>
              </Swipeable>
            ))}
          </View>
          
          <View style={{height: 100}}/>
        </ScrollView>

        {/* 運動輸入 Modal */}
        <Modal visible={modalVisible} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: cardBackground }]}>
              <ThemedText type="title">新增運動</ThemedText>
              
              {/* 類型選擇 */}
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
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: 20 },
  progressSection: { alignItems: 'center', padding: 20, margin: 16, borderRadius: 20 },
  quickActions: { flexDirection: 'row', padding: 16, gap: 12 },
  btn: { padding: 16, borderRadius: 12, alignItems: 'center', flexDirection: 'row', gap: 8, justifyContent: 'center' },
  btnTxt: { color: 'white', fontWeight: 'bold' },
  listSection: { marginHorizontal: 16, padding: 16, borderRadius: 16 },
  listItem: { paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#eee', flexDirection: 'row', justifyContent: 'space-between' },
  deleteBtn: { backgroundColor: 'red', justifyContent: 'center', alignItems: 'center', width: 80, height: '100%' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalContent: { padding: 20, borderRadius: 16 },
  typeChip: { padding: 8, borderRadius: 16, borderWidth: 1, borderColor: '#ddd', marginRight: 8 },
  modalBtn: { flex: 1, padding: 12, borderRadius: 8, alignItems: 'center' }
});