import React, { useState, useCallback, useEffect } from "react";
import {
  StyleSheet,
  View,
  ScrollView,
  TouchableOpacity,
  Platform,
  Dimensions,
  TextInput,
  Alert,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { format, addDays } from "date-fns";
import { zhTW } from "date-fns/locale";
import { Ionicons } from "@expo/vector-icons";
import { PieChart } from "react-native-gifted-charts";
import DateTimePicker from "@react-native-community/datetimepicker";
import { eq, and, desc, sql } from "drizzle-orm";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";

// Database
import { db } from "@/lib/db";
import { userProfiles, foodLogs, activityLogs, dailyMetrics } from "@/drizzle/schema";

const SCREEN_WIDTH = Dimensions.get("window").width;

// 定義餐別順序與標籤
type MealCategory = "breakfast" | "lunch" | "afternoon_tea" | "dinner" | "late_night";
const MEAL_ORDER: MealCategory[] = ["breakfast", "lunch", "afternoon_tea", "dinner", "late_night"];
const MEAL_LABELS: Record<string, string> = {
  breakfast: "早餐",
  lunch: "午餐",
  afternoon_tea: "下午茶",
  dinner: "晚餐",
  late_night: "宵夜",
};

// 預設營養目標 (若用戶未設定)
const DEFAULT_TARGETS = {
  calories: 2000,
  protein: 150,
  fat: 60,
  carbs: 200,
  sodium: 2300,
};

export default function HomeScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? "light";
  const theme = Colors[colorScheme];

  // --- State: 日期與 UI ---
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // --- State: 資料庫數據 ---
  const [weight, setWeight] = useState("");
  const [bodyFat, setBodyFat] = useState("");
  
  // 用戶目標 (來自 Profile)
  const [targets, setTargets] = useState(DEFAULT_TARGETS);
  const [targetWeight, setTargetWeight] = useState(0);
  const [targetBodyFat, setTargetBodyFat] = useState(0);

  // 今日統計
  const [intake, setIntake] = useState({
    calories: 0,
    protein: 0,
    fat: 0,
    carbs: 0,
    sodium: 0,
  });
  const [burnedCalories, setBurnedCalories] = useState(0);
  
  // 飲食紀錄列表
  const [dailyLogs, setDailyLogs] = useState<Record<string, any[]>>({});

  // --- Data Loading ---
  
  // 使用 useFocusEffect 確保每次回到首頁時重新讀取資料
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [currentDate]) // 當日期改變時也要重新讀取
  );

  const loadData = async () => {
    setIsLoading(true);
    try {
      const dateStr = format(currentDate, "yyyy-MM-dd");

      // 1. 讀取個人檔案 (Profile) - 獲取目標設定
      const profileRes = await db.select().from(userProfiles).limit(1);
      if (profileRes.length > 0) {
        const p = profileRes[0];
        setTargets({
            calories: p.dailyCalorieTarget || DEFAULT_TARGETS.calories,
            // 這裡簡單用百分比反推克數，或是資料庫欄位若有直接儲存克數則改用之
            // 假設 proteinPercentage 是百分比 (例如 30)，則克數 = (總熱量 * 0.3) / 4
            protein: Math.round((p.dailyCalorieTarget || 2000) * ((p.proteinPercentage || 30) / 100) / 4),
            fat: Math.round((p.dailyCalorieTarget || 2000) * ((p.fatPercentage || 30) / 100) / 9),
            carbs: Math.round((p.dailyCalorieTarget || 2000) * ((p.carbsPercentage || 40) / 100) / 4),
            sodium: p.sodiumTargetMg || DEFAULT_TARGETS.sodium,
        });
        setTargetWeight(p.targetWeightKg || 0);
        setTargetBodyFat(p.targetBodyFat || 0);
        
        // 若當日還沒輸入體重，預設顯示目前檔案中的體重
        setWeight(p.currentWeightKg ? String(p.currentWeightKg) : "");
        setBodyFat(p.currentBodyFat ? String(p.currentBodyFat) : "");
      }

      // 2. 讀取今日體態紀錄 (Daily Metrics) - 覆蓋預設體重
      const metricsRes = await db.select().from(dailyMetrics).where(eq(dailyMetrics.date, dateStr));
      if (metricsRes.length > 0) {
        setWeight(String(metricsRes[0].weightKg || ""));
        setBodyFat(String(metricsRes[0].bodyFatPercentage || ""));
      }

      // 3. 讀取今日飲食紀錄 (Food Logs)
      const logsRes = await db.select().from(foodLogs).where(eq(foodLogs.date, dateStr));
      
      // 計算總攝取
      const newIntake = { calories: 0, protein: 0, fat: 0, carbs: 0, sodium: 0 };
      const groupedLogs: Record<string, any[]> = {};
      
      MEAL_ORDER.forEach(m => groupedLogs[m] = []); // 初始化

      logsRes.forEach(log => {
        newIntake.calories += log.totalCalories || 0;
        newIntake.protein += log.totalProteinG || 0;
        newIntake.fat += log.totalFatG || 0;
        newIntake.carbs += log.totalCarbsG || 0;
        newIntake.sodium += log.totalSodiumMg || 0;

        // 分類
        const category = log.mealTimeCategory || "snack";
        if (!groupedLogs[category]) groupedLogs[category] = [];
        groupedLogs[category].push(log);
      });

      setIntake(newIntake);
      setDailyLogs(groupedLogs);

      // 4. 讀取今日運動紀錄 (Activity Logs)
      const activityRes = await db.select().from(activityLogs).where(eq(activityLogs.date, dateStr));
      const totalBurned = activityRes.reduce((sum, act) => sum + (act.caloriesBurned || 0), 0);
      setBurnedCalories(totalBurned);

    } catch (e) {
      console.error("Load data error:", e);
      Alert.alert("讀取資料失敗", "請檢查資料庫連線");
    } finally {
      setIsLoading(false);
    }
  };

  // --- Actions ---

  const handleDateChange = (days: number) => {
    setCurrentDate((prev) => addDays(prev, days));
  };

  const handleSaveMetrics = async () => {
    const w = parseFloat(weight);
    const bf = parseFloat(bodyFat);
    
    if (isNaN(w)) {
        Alert.alert("格式錯誤", "請輸入有效的體重數字");
        return;
    }

    try {
        const dateStr = format(currentDate, "yyyy-MM-dd");
        
        // 1. 檢查今日是否已有紀錄
        const existing = await db.select().from(dailyMetrics).where(eq(dailyMetrics.date, dateStr));
        
        if (existing.length > 0) {
            // Update
            await db.update(dailyMetrics).set({
                weightKg: w,
                bodyFatPercentage: isNaN(bf) ? null : bf,
            }).where(eq(dailyMetrics.id, existing[0].id));
        } else {
            // Insert
            await db.insert(dailyMetrics).values({
                date: dateStr,
                weightKg: w,
                bodyFatPercentage: isNaN(bf) ? null : bf,
            });
        }

        // 2. 同步更新 UserProfile 的 "當前體重" (如果是紀錄今天或未來的數據)
        const todayStr = format(new Date(), "yyyy-MM-dd");
        if (dateStr >= todayStr) {
            // 這裡假設系統只有一個用戶，若多用戶需加 where id
            // 先取得 profile id (通常是 1)
            const profiles = await db.select().from(userProfiles).limit(1);
            if (profiles.length > 0) {
                 await db.update(userProfiles).set({
                     currentWeightKg: w,
                     currentBodyFat: isNaN(bf) ? null : bf,
                     updatedAt: new Date()
                 }).where(eq(userProfiles.id, profiles[0].id));
            }
        }

        Alert.alert("成功", "體態紀錄已更新");
        loadData(); // 重新讀取確認

    } catch (e) {
        console.error(e);
        Alert.alert("儲存失敗");
    }
  };

  const navigateToRecord = (type: "camera" | "scan" | "manual" | "activity") => {
    switch (type) {
      case "camera":
        // 實際開發可傳遞 mode 參數
        router.push("/camera"); 
        break;
      case "scan":
        router.push("/barcode-scanner");
        break;
      case "manual":
        router.push("/food-editor"); 
        break;
      case "activity":
        router.push("/activity-editor");
        break;
    }
  };

  // --- Render Helpers ---

  const renderMacroRing = (label: string, value: number, target: number, color: string, unit = "g") => {
    // 避免除以 0
    const safeTarget = target > 0 ? target : 1; 
    const percentage = Math.min((value / safeTarget) * 100, 100);
    const data = [
      { value: percentage, color: color },
      { value: 100 - percentage, color: "#E5E5EA" }, // 剩餘灰色
    ];

    return (
      <View style={styles.macroItem}>
        <PieChart
          data={data}
          donut
          radius={32}
          innerRadius={24}
          centerLabelComponent={() => (
             <ThemedText style={{fontSize: 10, fontWeight: 'bold'}}>{Math.round(percentage)}%</ThemedText>
          )}
        />
        <ThemedText style={styles.macroLabel}>{label}</ThemedText>
        <ThemedText style={styles.macroTarget}>{Math.round(value)}/{target}{unit}</ThemedText>
      </View>
    );
  };

  // --- Component Renders ---

  const renderHeader = () => (
    <View style={styles.headerContainer}>
      <TouchableOpacity onPress={() => handleDateChange(-1)}>
        <Ionicons name="chevron-back" size={24} color={theme.text} />
      </TouchableOpacity>
      
      <TouchableOpacity onPress={() => setShowDatePicker(true)} style={styles.dateDisplay}>
        <ThemedText type="subtitle">
          {format(currentDate, "yyyy-MM-dd", { locale: zhTW })}
        </ThemedText>
        <ThemedText style={{ color: theme.icon, fontSize: 14, marginTop: 2 }}>
          {format(currentDate, "EEEE", { locale: zhTW })}
        </ThemedText>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => handleDateChange(1)}>
        <Ionicons name="chevron-forward" size={24} color={theme.text} />
      </TouchableOpacity>

      {/* DateTimePicker 修正版邏輯 */}
      {showDatePicker && (
        <DateTimePicker
          testID="dateTimePicker"
          value={currentDate}
          mode="date"
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          onChange={(event, date) => {
             // Android 需要在這裡關閉，iOS 則可能需要另外的確認按鈕，這裡採用通用簡單模式
             if (Platform.OS === 'android') setShowDatePicker(false); 
             if (date) setCurrentDate(date);
          }}
        />
      )}
      {/* iOS 專用的關閉按鈕 (如果 display 是 inline/spinner) */}
      {Platform.OS === 'ios' && showDatePicker && (
          <TouchableOpacity 
            style={styles.iosDatePickerCloseBtn}
            onPress={() => setShowDatePicker(false)}
          >
            <ThemedText style={{color: '#FFF'}}>完成</ThemedText>
          </TouchableOpacity>
      )}
    </View>
  );

  const renderBodyMetricsCard = () => (
    <ThemedView style={styles.card}>
      <View style={styles.cardHeaderRow}>
        <ThemedText type="defaultSemiBold">身體數值</ThemedText>
        <TouchableOpacity onPress={handleSaveMetrics}>
          <ThemedText style={{ color: theme.tint, fontSize: 14 }}>+ 紀錄/更新</ThemedText>
        </TouchableOpacity>
      </View>
      
      <View style={styles.metricsRow}>
        <View style={styles.metricInputGroup}>
          <View style={styles.inputWrapper}>
            <TextInput
              style={[styles.metricInput, { color: theme.text, borderColor: theme.icon }]}
              placeholder="0.0"
              placeholderTextColor={theme.icon}
              keyboardType="numeric"
              value={weight}
              onChangeText={setWeight}
            />
            <ThemedText style={styles.unitText}>kg</ThemedText>
          </View>
          <View style={[styles.inputWrapper, { marginTop: 8 }]}>
            <TextInput
              style={[styles.metricInput, { color: theme.text, borderColor: theme.icon }]}
              placeholder="0.0"
              placeholderTextColor={theme.icon}
              keyboardType="numeric"
              value={bodyFat}
              onChangeText={setBodyFat}
            />
            <ThemedText style={styles.unitText}>%</ThemedText>
          </View>
        </View>

        <View style={styles.metricTargetGroup}>
          <View style={styles.targetItem}>
            <ThemedText style={styles.targetLabel}>目標體重</ThemedText>
            <ThemedText type="defaultSemiBold">{targetWeight > 0 ? targetWeight : '--'} kg</ThemedText>
          </View>
          <View style={styles.targetItem}>
            <ThemedText style={styles.targetLabel}>目標體脂</ThemedText>
            <ThemedText type="defaultSemiBold">{targetBodyFat > 0 ? targetBodyFat : '--'} %</ThemedText>
          </View>
        </View>
      </View>
    </ThemedView>
  );

  const renderEnergySection = () => {
    const netCalories = intake.calories - burnedCalories;
    // 靜攝取百分比 = (攝取 - 消耗) / 目標
    const netPercentage = targets.calories > 0 ? Math.round((netCalories / targets.calories) * 100) : 0;
    const intakePercentage = targets.calories > 0 ? Math.min(intake.calories / targets.calories, 1) : 0;
    
    return (
      <View style={styles.sectionContainer}>
        {/* 上半部：能量條 */}
        <View style={styles.energyRow}>
          <View style={styles.energyBarContainer}>
            <View style={styles.energyBarLabelRow}>
              <ThemedText style={{fontSize: 12, color: '#34C759'}}>攝取</ThemedText>
              <ThemedText style={{fontSize: 12, color: '#FF9500'}}>消耗</ThemedText>
            </View>
            <View style={styles.barBackground}>
              <View style={[styles.barFill, { width: `${intakePercentage * 100}%`, backgroundColor: '#34C759' }]} />
            </View>
            <View style={[styles.barBackground, { marginTop: 8 }]}>
              {/* 消耗條以目標熱量的 50% 為視覺基準，避免太長或太短 */}
              <View style={[styles.barFill, { width: `${Math.min(burnedCalories / (targets.calories * 0.5), 1) * 100}%`, backgroundColor: '#FF9500' }]} />
            </View>
          </View>

          <View style={styles.energyInfoContainer}>
            <View style={styles.energyTextRow}>
              <ThemedText style={styles.energyLabel}>攝取/目標</ThemedText>
              <ThemedText type="defaultSemiBold">{Math.round(intake.calories)} / {targets.calories}</ThemedText>
            </View>
            <View style={styles.energyTextRow}>
              <ThemedText style={styles.energyLabel}>消耗熱量</ThemedText>
              <ThemedText type="defaultSemiBold" style={{color: '#FF9500'}}>-{Math.round(burnedCalories)}</ThemedText>
            </View>
            <View style={styles.netEnergyRow}>
              <ThemedText style={styles.energyLabel}>靜攝取 %</ThemedText>
              <ThemedText type="title" style={{color: netPercentage > 100 ? 'red' : theme.text}}>
                {netPercentage}%
              </ThemedText>
            </View>
          </View>
        </View>

        {/* 下半部：圓餅圖 */}
        <View style={styles.macroContainer}>
          {renderMacroRing("蛋白質", intake.protein, targets.protein, "#FF3B30")}
          {renderMacroRing("脂肪", intake.fat, targets.fat, "#FFcc00")}
          {renderMacroRing("碳水", intake.carbs, targets.carbs, "#5856D6")}
          {renderMacroRing("鈉", intake.sodium, targets.sodium, "#AF52DE", "mg")}
        </View>
      </View>
    );
  };

  const renderRecordSection = () => (
    <View style={styles.recordSection}>
      <View style={styles.quickActionRow}>
        <ActionButton icon="camera" label="拍照" onPress={() => navigateToRecord('camera')} color="#34C759" />
        <ActionButton icon="barcode" label="掃描" onPress={() => navigateToRecord('scan')} color="#007AFF" />
        <ActionButton icon="create" label="手輸" onPress={() => navigateToRecord('manual')} color="#5856D6" />
        <ActionButton icon="fitness" label="運動" onPress={() => navigateToRecord('activity')} color="#FF9500" />
      </View>

      <View style={styles.logsContainer}>
        {MEAL_ORDER.map((mealType) => {
            const logs = dailyLogs[mealType] || [];
            return (
              <View key={mealType} style={styles.mealGroup}>
                <View style={styles.mealHeader}>
                  <ThemedText type="defaultSemiBold">{MEAL_LABELS[mealType]}</ThemedText>
                  {/* 可在此加入該餐總熱量顯示 */}
                  <ThemedText style={{fontSize:12, color: theme.icon}}>
                    {Math.round(logs.reduce((sum, item) => sum + item.totalCalories, 0))} kcal
                  </ThemedText>
                </View>
                
                {logs.length === 0 ? (
                    <View style={styles.emptyLogPlaceholder}>
                        <ThemedText style={{color: theme.icon, fontSize: 13}}>尚無紀錄</ThemedText>
                    </View>
                ) : (
                    logs.map((log, idx) => (
                        <View key={idx} style={styles.logItem}>
                            <View>
                                <ThemedText>{log.foodName}</ThemedText>
                                <ThemedText style={{fontSize: 12, color: theme.icon}}>
                                    {log.servingAmount} {log.servingType === 'weight' ? 'g' : '份'}
                                </ThemedText>
                            </View>
                            <ThemedText>{log.totalCalories} kcal</ThemedText>
                        </View>
                    ))
                )}
              </View>
            );
        })}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      {isLoading ? (
        <View style={{flex: 1, justifyContent: 'center', alignItems: 'center'}}>
            <ActivityIndicator size="large" color={theme.tint} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent}>
            {renderHeader()}
            {renderBodyMetricsCard()}
            {renderEnergySection()}
            {renderRecordSection()}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

// 子元件：圓形操作按鈕
const ActionButton = ({ icon, label, onPress, color }: { icon: any, label: string, onPress: () => void, color: string }) => (
  <TouchableOpacity style={styles.actionButton} onPress={onPress}>
    <View style={[styles.iconCircle, { backgroundColor: color }]}>
      <Ionicons name={icon} size={24} color="#FFF" />
    </View>
    <ThemedText style={styles.actionLabel}>{label}</ThemedText>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingBottom: 40 },
  headerContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  dateDisplay: { alignItems: "center" },
  iosDatePickerCloseBtn: {
    position: 'absolute',
    bottom: -40,
    right: 20,
    backgroundColor: '#007AFF',
    padding: 8,
    borderRadius: 8,
    zIndex: 99,
  },
  card: {
    marginHorizontal: 16,
    marginVertical: 8,
    padding: 16,
    borderRadius: 16,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  cardHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  metricsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  metricInputGroup: { flex: 1, marginRight: 16 },
  inputWrapper: { flexDirection: "row", alignItems: "center" },
  metricInput: {
    borderBottomWidth: 1,
    width: 60,
    fontSize: 18,
    fontWeight: "600",
    textAlign: "center",
    marginRight: 4,
    paddingVertical: 2,
  },
  unitText: { fontSize: 14, color: "#8E8E93" },
  metricTargetGroup: { flex: 1, justifyContent: "space-around", alignItems: "flex-end" },
  targetItem: { alignItems: "flex-end" },
  targetLabel: { fontSize: 12, color: "#8E8E93" },
  
  sectionContainer: { paddingHorizontal: 16, marginTop: 16 },
  energyRow: { flexDirection: "row", marginBottom: 20 },
  energyBarContainer: { flex: 1, justifyContent: "center" },
  energyBarLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  barBackground: {
    height: 12,
    backgroundColor: "#E5E5EA",
    borderRadius: 6,
    overflow: "hidden",
  },
  barFill: { height: "100%", borderRadius: 6 },
  energyInfoContainer: { flex: 0.8, paddingLeft: 16, justifyContent: "center" },
  energyTextRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  energyLabel: { fontSize: 12, color: "#8E8E93" },
  netEnergyRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 8, alignItems: 'center' },
  
  macroContainer: { flexDirection: "row", justifyContent: "space-between", marginBottom: 16 },
  macroItem: { alignItems: "center", width: SCREEN_WIDTH / 4.5 },
  macroLabel: { fontSize: 12, marginTop: 8, fontWeight: '600' },
  macroTarget: { fontSize: 10, color: "#8E8E93", marginTop: 2 },
  
  recordSection: { marginTop: 24, paddingHorizontal: 16 },
  quickActionRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 24 },
  actionButton: { alignItems: "center" },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 4,
  },
  actionLabel: { fontSize: 12, fontWeight: "500" },
  
  logsContainer: { marginTop: 8 },
  mealGroup: { marginBottom: 20 },
  mealHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5EA",
    marginBottom: 8,
  },
  emptyLogPlaceholder: {
    paddingVertical: 12,
    alignItems: 'center',
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: '#C7C7CC',
    borderRadius: 8,
  },
  logItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: '#f0f0f0'
  }
});