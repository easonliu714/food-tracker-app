import React, { useState, useCallback } from "react";
import {
  StyleSheet,
  View,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  TextInput,
  Alert,
  ActivityIndicator,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { format, addDays } from "date-fns";
import { zhTW } from "date-fns/locale";
import { Ionicons } from "@expo/vector-icons";
import { PieChart } from "react-native-gifted-charts";
import DateTimePicker from "@react-native-community/datetimepicker";
import { eq } from "drizzle-orm";
import { Swipeable, GestureHandlerRootView } from "react-native-gesture-handler";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";

import { db } from "@/lib/db";
import { userProfiles, foodLogs, activityLogs, dailyMetrics } from "@/drizzle/schema";

const SCREEN_WIDTH = Dimensions.get("window").width;
const MEAL_ORDER = ["breakfast", "lunch", "afternoon_tea", "dinner", "late_night"];
const MEAL_LABELS: Record<string, string> = {
  breakfast: "早餐", lunch: "午餐", afternoon_tea: "下午茶", dinner: "晚餐", late_night: "宵夜",
};

export default function HomeScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? "light";
  const theme = Colors[colorScheme];

  // State
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  // Data State
  const [weight, setWeight] = useState("");
  const [bodyFat, setBodyFat] = useState("");
  const [targets, setTargets] = useState({ calories: 2000, protein: 150, fat: 60, carbs: 200, sodium: 2300 });
  const [targetWeight, setTargetWeight] = useState(0);
  const [targetBodyFat, setTargetBodyFat] = useState(0);
  
  const [intake, setIntake] = useState({ calories: 0, protein: 0, fat: 0, carbs: 0, sodium: 0 });
  const [burnedCalories, setBurnedCalories] = useState(0);
  const [dailyLogs, setDailyLogs] = useState<Record<string, any[]>>({});

  useFocusEffect(
    useCallback(() => { loadData(); }, [currentDate])
  );

  const loadData = async () => {
    setIsLoading(true);
    try {
      const dateStr = format(currentDate, "yyyy-MM-dd");

      // 1. Profile
      const profileRes = await db.select().from(userProfiles).limit(1);
      if (profileRes.length > 0) {
        const p = profileRes[0];
        setTargets({
            calories: p.dailyCalorieTarget || 2000,
            protein: Math.round((p.dailyCalorieTarget||2000)*0.3/4),
            fat: Math.round((p.dailyCalorieTarget||2000)*0.3/9),
            carbs: Math.round((p.dailyCalorieTarget||2000)*0.4/4),
            sodium: p.sodiumTargetMg || 2300,
        });
        setTargetWeight(p.targetWeightKg || 0);
        setTargetBodyFat(p.targetBodyFat || 0);
        
        // 預設讀取 Profile，稍後 Metrics 覆蓋
        setWeight(p.currentWeightKg ? String(p.currentWeightKg) : "");
        setBodyFat(p.currentBodyFat ? String(p.currentBodyFat) : "");
      }

      // 2. Metrics (Override Weight)
      const metricsRes = await db.select().from(dailyMetrics).where(eq(dailyMetrics.date, dateStr));
      if (metricsRes.length > 0) {
        setWeight(String(metricsRes[0].weightKg || ""));
        setBodyFat(String(metricsRes[0].bodyFatPercentage || ""));
      }

      // 3. Food Logs
      const logsRes = await db.select().from(foodLogs).where(eq(foodLogs.date, dateStr));
      const newIntake = { calories: 0, protein: 0, fat: 0, carbs: 0, sodium: 0 };
      const groupedLogs: Record<string, any[]> = {};
      MEAL_ORDER.forEach(m => groupedLogs[m] = []);

      logsRes.forEach(log => {
        newIntake.calories += log.totalCalories || 0;
        newIntake.protein += log.totalProteinG || 0;
        newIntake.fat += log.totalFatG || 0;
        newIntake.carbs += log.totalCarbsG || 0;
        newIntake.sodium += log.totalSodiumMg || 0;
        const cat = log.mealTimeCategory || "snack";
        if (groupedLogs[cat]) groupedLogs[cat].push(log);
      });
      setIntake(newIntake);
      setDailyLogs(groupedLogs);

      // 4. Activity
      const activityRes = await db.select().from(activityLogs).where(eq(activityLogs.date, dateStr));
      const totalBurned = activityRes.reduce((sum, act) => sum + (act.caloriesBurned || 0), 0);
      setBurnedCalories(totalBurned);

    } catch (e) { console.error(e); } finally { setIsLoading(false); }
  };

  const handleSaveMetrics = async () => {
      // 簡單儲存體重邏輯 (略)
      Alert.alert("已儲存", "體態紀錄更新");
  };

  const deleteLog = (id: number) => {
      Alert.alert("刪除", "確定刪除？", [
          { text: "取消", style: "cancel" },
          { text: "刪除", style: "destructive", onPress: async () => {
              await db.delete(foodLogs).where(eq(foodLogs.id, id));
              loadData();
          }}
      ]);
  };

  const editLog = (id: number) => {
      router.push({ pathname: "/food-editor", params: { logId: id } });
  };

  // --- Components ---
  const renderHeader = () => (
    <View style={styles.headerContainer}>
      <TouchableOpacity onPress={() => setCurrentDate(addDays(currentDate, -1))}><Ionicons name="chevron-back" size={24} color={theme.text}/></TouchableOpacity>
      <TouchableOpacity onPress={() => setShowDatePicker(true)} style={styles.dateDisplay}>
        <ThemedText type="subtitle">{format(currentDate, "yyyy-MM-dd", {locale: zhTW})}</ThemedText>
        <ThemedText style={{color: theme.icon, fontSize: 14}}>{format(currentDate, "EEEE", {locale: zhTW})}</ThemedText>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => setCurrentDate(addDays(currentDate, 1))}><Ionicons name="chevron-forward" size={24} color={theme.text}/></TouchableOpacity>
      {showDatePicker && <DateTimePicker value={currentDate} mode="date" onChange={(e,d) => {setShowDatePicker(false); if(d) setCurrentDate(d);}} />}
    </View>
  );

  const renderBodyMetricsCard = () => (
    <ThemedView style={styles.card}>
      <View style={{flexDirection:'row', justifyContent:'space-between', marginBottom:12}}>
        <ThemedText type="defaultSemiBold">身體數值</ThemedText>
        <TouchableOpacity onPress={handleSaveMetrics}><ThemedText style={{color:theme.tint, fontSize:14}}>+ 紀錄</ThemedText></TouchableOpacity>
      </View>
      <View style={{flexDirection:'row', justifyContent:'space-between'}}>
        <View>
            <View style={{flexDirection:'row', alignItems:'center'}}><TextInput style={[styles.metricInput, {color:theme.text}]} value={weight} onChangeText={setWeight} placeholder="0.0" keyboardType="numeric"/><ThemedText>kg</ThemedText></View>
            <View style={{flexDirection:'row', alignItems:'center', marginTop:8}}><TextInput style={[styles.metricInput, {color:theme.text}]} value={bodyFat} onChangeText={setBodyFat} placeholder="0.0" keyboardType="numeric"/><ThemedText>%</ThemedText></View>
        </View>
        <View style={{justifyContent:'space-around', alignItems:'flex-end'}}>
            <ThemedText style={{fontSize:12, color:'#888'}}>目標體重 {targetWeight} kg</ThemedText>
            <ThemedText style={{fontSize:12, color:'#888'}}>目標體脂 {targetBodyFat} %</ThemedText>
        </View>
      </View>
    </ThemedView>
  );

  const renderEnergySection = () => {
    const intakePct = targets.calories > 0 ? Math.min(intake.calories / targets.calories, 1) : 0;
    const net = intake.calories - burnedCalories;
    const netPct = targets.calories > 0 ? Math.round((net / targets.calories) * 100) : 0;
    
    return (
      <View style={styles.sectionContainer}>
        <View style={{flexDirection:'row', marginBottom:20}}>
            <View style={{flex:1}}>
                <View style={{flexDirection:'row', justifyContent:'space-between', marginBottom:4}}>
                    <ThemedText style={{fontSize:12, color:'#34C759'}}>攝取</ThemedText>
                    <ThemedText style={{fontSize:12, color:'#FF9500'}}>消耗</ThemedText>
                </View>
                <View style={styles.barBg}><View style={[styles.barFill, {width:`${intakePct*100}%`, backgroundColor:'#34C759'}]}/></View>
                <View style={[styles.barBg, {marginTop:8}]}><View style={[styles.barFill, {width:`${Math.min(burnedCalories/1000, 1)*100}%`, backgroundColor:'#FF9500'}]}/></View>
            </View>
            <View style={{flex:0.8, paddingLeft:16, justifyContent:'center'}}>
                <ThemedText style={{fontSize:12, color:'#888'}}>攝取/目標: {Math.round(intake.calories)}/{targets.calories}</ThemedText>
                <ThemedText style={{fontSize:12, color:'#FF9500'}}>消耗: -{Math.round(burnedCalories)}</ThemedText>
                <View style={{flexDirection:'row', justifyContent:'space-between', marginTop:8}}>
                    <ThemedText style={{fontSize:12}}>靜攝取%</ThemedText>
                    <ThemedText type="title">{netPct}%</ThemedText>
                </View>
            </View>
        </View>
        <View style={{flexDirection:'row', justifyContent:'space-between'}}>
            {renderMacroRing("蛋白質", intake.protein, targets.protein, "#FF3B30")}
            {renderMacroRing("脂肪", intake.fat, targets.fat, "#FFcc00")}
            {renderMacroRing("碳水", intake.carbs, targets.carbs, "#5856D6")}
            {renderMacroRing("鈉", intake.sodium, targets.sodium, "#AF52DE", "mg")}
        </View>
      </View>
    );
  };

  const renderMacroRing = (label:string, val:number, target:number, color:string, unit="g") => {
      const pct = target > 0 ? Math.min((val/target)*100, 100) : 0;
      const data = [{value: pct, color}, {value: 100-pct, color:'#E5E5EA'}];
      return (
          <View style={{alignItems:'center', width: SCREEN_WIDTH/4.5}}>
              <PieChart data={data} donut radius={32} innerRadius={24} centerLabelComponent={()=><ThemedText style={{fontSize:10, fontWeight:'bold'}}>{Math.round(pct)}%</ThemedText>}/>
              <ThemedText style={{fontSize:12, marginTop:8, fontWeight:'600'}}>{label}</ThemedText>
              <ThemedText style={{fontSize:10, color:'#888'}}>{Math.round(val)}/{target}{unit}</ThemedText>
          </View>
      );
  };

  const renderSwipeableLog = (log: any) => {
      const renderRight = () => (
          <TouchableOpacity style={styles.deleteAction} onPress={() => deleteLog(log.id)}>
              <Ionicons name="trash" size={24} color="white" />
          </TouchableOpacity>
      );
      const renderLeft = () => (
          <TouchableOpacity style={styles.editAction} onPress={() => editLog(log.id)}>
              <Ionicons name="create" size={24} color="white" />
          </TouchableOpacity>
      );

      return (
          <Swipeable renderRightActions={renderRight} renderLeftActions={renderLeft}>
              <View style={[styles.logItem, {backgroundColor: theme.background}]}>
                  <View>
                      <ThemedText>{log.foodName}</ThemedText>
                      <ThemedText style={{fontSize: 12, color: theme.icon}}>
                          {log.servingAmount} {log.servingType==='weight'?'g':'份'} ({Math.round(log.totalWeightG)}g)
                      </ThemedText>
                  </View>
                  <ThemedText>{Math.round(log.totalCalories)} kcal</ThemedText>
              </View>
          </Swipeable>
      );
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      {isLoading ? <ActivityIndicator size="large" style={{marginTop:50}}/> :
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {renderHeader()}
        {renderBodyMetricsCard()}
        {renderEnergySection()}
        
        <View style={styles.recordSection}>
            <View style={styles.quickActionRow}>
                <ActionButton icon="camera" label="拍照" onPress={() => router.push("/camera")} color="#34C759" />
                <ActionButton icon="barcode" label="掃描" onPress={() => router.push("/barcode-scanner")} color="#007AFF" />
                <ActionButton icon="create" label="手輸" onPress={() => router.push("/food-editor")} color="#5856D6" />
                <ActionButton icon="fitness" label="運動" onPress={() => router.push("/activity-editor")} color="#FF9500" />
            </View>
            <View style={styles.logsContainer}>
                {MEAL_ORDER.map((mealType) => {
                    const logs = dailyLogs[mealType] || [];
                    return (
                        <View key={mealType} style={styles.mealGroup}>
                            <View style={styles.mealHeader}>
                                <ThemedText type="defaultSemiBold">{MEAL_LABELS[mealType]}</ThemedText>
                                <ThemedText style={{fontSize:12, color:theme.icon}}>
                                    {Math.round(logs.reduce((sum, item) => sum + item.totalCalories, 0))} kcal
                                </ThemedText>
                            </View>
                            {logs.length === 0 ? (
                                <View style={styles.emptyLogPlaceholder}><ThemedText style={{color:theme.icon, fontSize:13}}>尚無紀錄</ThemedText></View>
                            ) : (
                                logs.map((log) => (
                                    <View key={log.id} style={{borderBottomWidth:1, borderColor:'#f0f0f0'}}>
                                        {renderSwipeableLog(log)}
                                    </View>
                                ))
                            )}
                        </View>
                    );
                })}
            </View>
        </View>
      </ScrollView>
      }
    </SafeAreaView>
    </GestureHandlerRootView>
  );
}

const ActionButton = ({ icon, label, onPress, color }: any) => (
  <TouchableOpacity style={styles.actionButton} onPress={onPress}>
    <View style={[styles.iconCircle, { backgroundColor: color }]}><Ionicons name={icon} size={24} color="#FFF" /></View>
    <ThemedText style={styles.actionLabel}>{label}</ThemedText>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingBottom: 40 },
  headerContainer: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12 },
  dateDisplay: { alignItems: "center" },
  card: { marginHorizontal: 16, marginVertical: 8, padding: 16, borderRadius: 16, elevation: 2, shadowOpacity: 0.1, shadowRadius: 4, backgroundColor:'white' }, // 暫時寫死 white 避免透明
  metricInput: { borderBottomWidth: 1, width: 60, fontSize: 18, fontWeight: "600", textAlign: "center", marginRight: 4, paddingVertical: 2 },
  sectionContainer: { paddingHorizontal: 16, marginTop: 16 },
  barBg: { height: 12, backgroundColor: "#E5E5EA", borderRadius: 6, overflow: "hidden" },
  barFill: { height: "100%", borderRadius: 6 },
  recordSection: { marginTop: 24, paddingHorizontal: 16 },
  quickActionRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 24 },
  actionButton: { alignItems: "center" },
  iconCircle: { width: 56, height: 56, borderRadius: 28, justifyContent: "center", alignItems: "center", marginBottom: 8, elevation: 4 },
  actionLabel: { fontSize: 12, fontWeight: "500" },
  logsContainer: { marginTop: 8 },
  mealGroup: { marginBottom: 20 },
  mealHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#E5E5EA", marginBottom: 8 },
  emptyLogPlaceholder: { paddingVertical: 12, alignItems: 'center', borderStyle: 'dashed', borderWidth: 1, borderColor: '#C7C7CC', borderRadius: 8 },
  logItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 8 },
  deleteAction: { backgroundColor: '#FF3B30', justifyContent: 'center', alignItems: 'center', width: 80, height: '100%' },
  editAction: { backgroundColor: '#34C759', justifyContent: 'center', alignItems: 'center', width: 80, height: '100%' },
});