import { useRouter, useFocusEffect } from "expo-router";
import { useState, useCallback } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  Alert,
  Modal,
  TextInput
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { ProgressRing } from "@/components/progress-ring";
import { ThemedText } from "@/components/themed-text";
import { useAuth } from "@/hooks/use-auth";
import { useThemeColor } from "@/hooks/use-theme-color";
import { 
  getDailySummaryLocal, 
  getProfileLocal, 
  deleteFoodLogLocal, 
  getFrequentFoodItems,
  saveFoodLogLocal,
  saveActivityLogLocal,
  deleteActivityLogLocal
} from "@/lib/storage";

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isAuthenticated } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  
  // Data State
  const [summary, setSummary] = useState<any>(null);
  const [targetCalories, setTargetCalories] = useState(2000);
  const [frequentItems, setFrequentItems] = useState<any[]>([]);

  // Modal State
  const [workoutModalVisible, setWorkoutModalVisible] = useState(false);
  const [workoutName, setWorkoutName] = useState("");
  const [workoutCal, setWorkoutCal] = useState("");

  const backgroundColor = useThemeColor({}, "background");
  const cardBackground = useThemeColor({}, "cardBackground");
  const tintColor = useThemeColor({}, "tint");
  const textColor = useThemeColor({}, "text");
  const textSecondary = useThemeColor({}, "textSecondary");

  const loadData = async () => {
    try {
      const profile = await getProfileLocal();
      if (profile?.dailyCalorieTarget) setTargetCalories(profile.dailyCalorieTarget);
      
      const dailySum = await getDailySummaryLocal();
      setSummary(dailySum);

      const frequent = await getFrequentFoodItems();
      setFrequentItems(frequent);
    } catch (e) {
      console.error(e);
    }
  };

  useFocusEffect(useCallback(() => { if (isAuthenticated) loadData(); }, [isAuthenticated]));

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  // 刪除飲食紀錄
  const handleDeleteFood = (id: number) => {
    Alert.alert("刪除紀錄", "確定要刪除這筆飲食紀錄嗎？", [
      { text: "取消", style: "cancel" },
      { text: "刪除", style: "destructive", onPress: async () => {
          await deleteFoodLogLocal(id);
          loadData();
        } 
      }
    ]);
  };

  // 刪除運動紀錄
  const handleDeleteActivity = (id: number) => {
    Alert.alert("刪除紀錄", "確定要刪除這筆運動紀錄嗎？", [
      { text: "取消", style: "cancel" },
      { text: "刪除", style: "destructive", onPress: async () => {
          await deleteActivityLogLocal(id);
          loadData();
        } 
      }
    ]);
  };

  // 快速加入常用項目
  const handleQuickAdd = async (item: any) => {
    Alert.alert("快速紀錄", `要再吃一次「${item.foodName}」嗎？`, [
      { text: "取消", style: "cancel" },
      { text: "確定", onPress: async () => {
          await saveFoodLogLocal({
             mealType: "snack", // 預設，或可依時間判斷
             foodName: item.foodName,
             totalCalories: item.totalCalories,
             totalProteinG: item.totalProteinG,
             totalCarbsG: item.totalCarbsG,
             totalFatG: item.totalFatG
          });
          loadData();
        } 
      }
    ]);
  };

  // 新增運動紀錄
  const handleAddWorkout = async () => {
    if (!workoutName || !workoutCal) return;
    await saveActivityLogLocal({
      activityType: workoutName,
      caloriesBurned: parseInt(workoutCal) || 0,
    });
    setWorkoutModalVisible(false);
    setWorkoutName("");
    setWorkoutCal("");
    loadData();
  };

  // 計算數值
  const caloriesIn = summary?.totalCaloriesIn || 0;
  const caloriesOut = summary?.totalCaloriesOut || 0;
  const netCalories = caloriesIn - caloriesOut;
  const progress = targetCalories > 0 ? netCalories / targetCalories : 0;
  const remaining = targetCalories - netCalories;

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        <View style={[styles.header, { paddingTop: Math.max(insets.top, 20) }]}>
           <ThemedText type="title" style={{ fontSize: 32 }}>今日概覽</ThemedText>
        </View>

        {/* 1. 環狀圖 (顯示淨攝取) */}
        <View style={[styles.progressSection, { backgroundColor: cardBackground }]}>
          <ProgressRing progress={progress} current={netCalories} target={targetCalories} size={200} strokeWidth={16} />
          <View style={{flexDirection: 'row', gap: 20, marginTop: 16}}>
             <View style={{alignItems: 'center'}}>
               <ThemedText style={{fontSize: 12, color: textSecondary}}>攝取</ThemedText>
               <ThemedText style={{fontWeight: 'bold', color: '#4CAF50'}}>{caloriesIn}</ThemedText>
             </View>
             <View style={{alignItems: 'center'}}>
               <ThemedText style={{fontSize: 12, color: textSecondary}}>消耗</ThemedText>
               <ThemedText style={{fontWeight: 'bold', color: '#FF9800'}}>{caloriesOut}</ThemedText>
             </View>
             <View style={{alignItems: 'center'}}>
               <ThemedText style={{fontSize: 12, color: textSecondary}}>剩餘</ThemedText>
               <ThemedText style={{fontWeight: 'bold'}}>{remaining}</ThemedText>
             </View>
          </View>
        </View>

        {/* 2. 常用項目 (快速輸入) */}
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

        {/* 3. 快捷按鈕 */}
        <View style={styles.quickActions}>
          <Pressable onPress={() => router.push("/camera")} style={[styles.actionButton, { backgroundColor: tintColor, flex: 1.5 }]}>
            <Ionicons name="camera" size={24} color="#FFFFFF" />
            <ThemedText style={styles.btnText}>拍照</ThemedText>
          </Pressable>
          <Pressable onPress={() => router.push("/barcode-scanner")} style={[styles.actionButton, { backgroundColor: tintColor, flex: 1 }]}>
            <Ionicons name="barcode" size={24} color="#FFFFFF" />
            <ThemedText style={styles.btnText}>掃碼</ThemedText>
          </Pressable>
           <Pressable onPress={() => setWorkoutModalVisible(true)} style={[styles.actionButton, { backgroundColor: '#FF9800', flex: 1 }]}>
            <Ionicons name="fitness" size={24} color="#FFFFFF" />
            <ThemedText style={styles.btnText}>運動</ThemedText>
          </Pressable>
        </View>

        {/* 4. 飲食紀錄 (可刪除) */}
        <View style={[styles.logSection, { backgroundColor: cardBackground }]}>
          <ThemedText type="subtitle" style={styles.cardTitle}>飲食紀錄</ThemedText>
          {summary?.foodLogs?.length === 0 ? (
             <ThemedText style={{color: textSecondary, textAlign: 'center', padding: 20}}>尚無紀錄</ThemedText>
          ) : (
             summary?.foodLogs?.map((log: any) => (
               <Pressable key={log.id} onLongPress={() => handleDeleteFood(log.id)} style={styles.logItem}>
                  <View style={{flex: 1}}>
                    <ThemedText style={{fontSize: 12, color: textSecondary}}>{log.mealType === 'breakfast' ? '早餐' : log.mealType === 'lunch' ? '午餐' : log.mealType === 'dinner' ? '晚餐' : log.mealType === 'late_night' ? '消夜' : '點心'}</ThemedText>
                    <ThemedText style={{fontWeight: '500'}}>{log.foodName}</ThemedText>
                  </View>
                  <ThemedText style={{fontWeight: 'bold', color: tintColor}}>{log.totalCalories}</ThemedText>
               </Pressable>
             ))
          )}
        </View>

        {/* 5. 運動紀錄 (可刪除) */}
        <View style={[styles.logSection, { backgroundColor: cardBackground, marginTop: 16 }]}>
          <ThemedText type="subtitle" style={styles.cardTitle}>運動紀錄</ThemedText>
          {summary?.activityLogs?.length === 0 ? (
             <ThemedText style={{color: textSecondary, textAlign: 'center', padding: 20}}>尚無紀錄</ThemedText>
          ) : (
             summary?.activityLogs?.map((log: any) => (
               <Pressable key={log.id} onLongPress={() => handleDeleteActivity(log.id)} style={styles.logItem}>
                  <View style={{flex: 1}}>
                    <ThemedText style={{fontWeight: '500'}}>{log.activityType}</ThemedText>
                  </View>
                  <ThemedText style={{fontWeight: 'bold', color: '#FF9800'}}>-{log.caloriesBurned}</ThemedText>
               </Pressable>
             ))
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* 運動輸入 Modal */}
      <Modal visible={workoutModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: cardBackground }]}>
            <ThemedText type="title" style={{marginBottom: 16}}>新增運動</ThemedText>
            <TextInput placeholder="運動項目 (如: 慢跑)" style={[styles.input, {color: textColor, borderColor: textSecondary}]} value={workoutName} onChangeText={setWorkoutName} placeholderTextColor={textSecondary} />
            <TextInput placeholder="消耗卡路里 (kcal)" keyboardType="numeric" style={[styles.input, {color: textColor, borderColor: textSecondary}]} value={workoutCal} onChangeText={setWorkoutCal} placeholderTextColor={textSecondary} />
            <View style={{flexDirection: 'row', gap: 10, marginTop: 20}}>
               <Pressable onPress={() => setWorkoutModalVisible(false)} style={[styles.modalBtn, {borderWidth: 1, borderColor: textSecondary}]}><ThemedText>取消</ThemedText></Pressable>
               <Pressable onPress={handleAddWorkout} style={[styles.modalBtn, {backgroundColor: tintColor}]}><ThemedText style={{color: 'white'}}>新增</ThemedText></Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollView: { flex: 1 },
  header: { padding: 20 },
  progressSection: { alignItems: "center", padding: 20, margin: 16, borderRadius: 20 },
  quickActions: { flexDirection: "row", padding: 16, gap: 12 },
  actionButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", padding: 16, borderRadius: 12, gap: 8 },
  btnText: { color: "white", fontWeight: "600" },
  logSection: { marginHorizontal: 16, padding: 16, borderRadius: 16 },
  cardTitle: { marginBottom: 12 },
  logItem: { flexDirection: "row", alignItems: "center", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#eee' },
  quickChip: { padding: 10, borderRadius: 10, alignItems: 'center', minWidth: 80 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalContent: { padding: 20, borderRadius: 16 },
  input: { borderWidth: 1, borderRadius: 8, padding: 12, marginBottom: 10 },
  modalBtn: { flex: 1, padding: 14, borderRadius: 8, alignItems: 'center' }
});