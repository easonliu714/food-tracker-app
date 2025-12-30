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
  FlatList,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { format, addDays, subDays } from "date-fns";
import { zhTW, enUS, ja, ko, fr, ru } from "date-fns/locale"; // Import locales
import { Ionicons } from "@expo/vector-icons";
import { PieChart } from "react-native-gifted-charts";
import DateTimePicker from "@react-native-community/datetimepicker";
import { eq, sql, desc } from "drizzle-orm";
import { Swipeable, GestureHandlerRootView } from "react-native-gesture-handler";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { t, useLanguage } from "@/lib/i18n"; // i18n hooks

import { db } from "@/lib/db";
import { userProfiles, foodLogs, activityLogs, dailyMetrics } from "@/drizzle/schema";

const SCREEN_WIDTH = Dimensions.get("window").width;
const MEAL_ORDER = ["breakfast", "lunch", "afternoon_tea", "dinner", "late_night"];

// Map language code to date-fns locale
const LOCALE_MAP: any = { 'zh-TW': zhTW, 'en': enUS, 'ja': ja, 'ko': ko, 'fr': fr, 'ru': ru };

export default function HomeScreen() {
  const router = useRouter();
  const theme = Colors[useColorScheme() ?? "light"];
  const lang = useLanguage();
  const dateLocale = LOCALE_MAP[lang] || enUS;

  const [currentDate, setCurrentDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  // Data
  const [weight, setWeight] = useState("");
  const [bodyFat, setBodyFat] = useState("");
  const [diffWeight, setDiffWeight] = useState<number | null>(null);
  const [diffFat, setDiffFat] = useState<number | null>(null);
  
  const [targets, setTargets] = useState({ calories: 2000, protein: 150, fat: 60, carbs: 200, sodium: 2300 });
  const [targetWeight, setTargetWeight] = useState(0);
  const [targetBodyFat, setTargetBodyFat] = useState(0);
  
  const [intake, setIntake] = useState({ calories: 0, protein: 0, fat: 0, carbs: 0, sodium: 0 });
  const [burnedCalories, setBurnedCalories] = useState(0);
  const [dailyLogs, setDailyLogs] = useState<Record<string, any[]>>({});
  const [dailyActivities, setDailyActivities] = useState<any[]>([]);
  const [recentFoods, setRecentFoods] = useState<any[]>([]);

  useFocusEffect(
    useCallback(() => { loadData(); }, [currentDate])
  );

  const loadData = async () => {
    setIsLoading(true);
    try {
      const dateStr = format(currentDate, "yyyy-MM-dd");
      const yesterdayStr = format(subDays(currentDate, 1), "yyyy-MM-dd");

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
        setWeight(p.currentWeightKg ? String(p.currentWeightKg) : "");
        setBodyFat(p.currentBodyFat ? String(p.currentBodyFat) : "");
      }

      // 2. Metrics (Today & Yesterday for Comparison)
      const metricsRes = await db.select().from(dailyMetrics).where(eq(dailyMetrics.date, dateStr));
      const yestRes = await db.select().from(dailyMetrics).where(eq(dailyMetrics.date, yesterdayStr));
      
      let curW = 0, curF = 0;
      if (metricsRes.length > 0) {
        curW = metricsRes[0].weightKg || 0;
        curF = metricsRes[0].bodyFatPercentage || 0;
        setWeight(String(curW));
        setBodyFat(String(curF));
      }
      
      if (yestRes.length > 0 && curW > 0) {
          setDiffWeight(parseFloat((curW - (yestRes[0].weightKg || 0)).toFixed(1)));
          setDiffFat(parseFloat((curF - (yestRes[0].bodyFatPercentage || 0)).toFixed(1)));
      } else {
          setDiffWeight(null);
          setDiffFat(null);
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

      // 4. Activity Logs
      const activityRes = await db.select().from(activityLogs).where(eq(activityLogs.date, dateStr));
      const totalBurned = activityRes.reduce((sum, act) => sum + (act.caloriesBurned || 0), 0);
      setBurnedCalories(totalBurned);
      setDailyActivities(activityRes);

      // 5. Recent Foods (Simple Group By Count)
      // Note: This is a simplified query as Drizzle explicit group by support varies. 
      // Using raw SQL for robustness or processing in JS if dataset small.
      // Here using simple limit on latest logs for "Quick Add"
      const recents = await db.select().from(foodLogs).orderBy(desc(foodLogs.loggedAt)).limit(10);
      // Deduplicate by foodName in JS
      const uniqueRecents = Array.from(new Map(recents.map(item => [item.foodName, item])).values()).slice(0, 5);
      setRecentFoods(uniqueRecents);

    } catch (e) { console.error(e); } finally { setIsLoading(false); }
  };

  const handleSaveMetrics = async () => {
      const w = parseFloat(weight);
      const bf = parseFloat(bodyFat);
      if (isNaN(w)) return Alert.alert(t('error', lang), "Invalid Weight");
      
      try {
          const dateStr = format(currentDate, "yyyy-MM-dd");
          const existing = await db.select().from(dailyMetrics).where(eq(dailyMetrics.date, dateStr));
          if(existing.length > 0) {
              await db.update(dailyMetrics).set({ weightKg: w, bodyFatPercentage: isNaN(bf)?null:bf }).where(eq(dailyMetrics.id, existing[0].id));
          } else {
              await db.insert(dailyMetrics).values({ date: dateStr, weightKg: w, bodyFatPercentage: isNaN(bf)?null:bf });
          }
          // Also update profile current weight
          const p = await db.select().from(userProfiles).limit(1);
          if(p.length > 0) {
              await db.update(userProfiles).set({ currentWeightKg: w, currentBodyFat: isNaN(bf)?null:bf }).where(eq(userProfiles.id, p[0].id));
          }
          Alert.alert(t('success', lang), t('save', lang));
          loadData(); // Reload to calc diff
      } catch(e) { console.error(e); }
  };

  const deleteLog = (id: number) => {
      Alert.alert(t('delete', lang), "", [
          { text: t('cancel', lang), style: "cancel" },
          { text: t('delete', lang), style: "destructive", onPress: async () => {
              await db.delete(foodLogs).where(eq(foodLogs.id, id));
              loadData();
          }}
      ]);
  };

  const renderHeader = () => (
    <View style={styles.headerContainer}>
      <TouchableOpacity onPress={() => setCurrentDate(addDays(currentDate, -1))}><Ionicons name="chevron-back" size={24} color={theme.text}/></TouchableOpacity>
      <TouchableOpacity onPress={() => setShowDatePicker(true)} style={styles.dateDisplay}>
        <ThemedText type="subtitle">{format(currentDate, "yyyy-MM-dd", {locale: dateLocale})}</ThemedText>
        <ThemedText style={{color: theme.icon, fontSize: 14}}>{format(currentDate, "EEEE", {locale: dateLocale})}</ThemedText>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => setCurrentDate(addDays(currentDate, 1))}><Ionicons name="chevron-forward" size={24} color={theme.text}/></TouchableOpacity>
      {showDatePicker && <DateTimePicker value={currentDate} mode="date" onChange={(e,d) => {setShowDatePicker(false); if(d) setCurrentDate(d);}} />}
    </View>
  );

  const renderDiffBadge = (val: number | null, unit: string) => {
      if (val === null) return null;
      const color = val > 0 ? '#FF3B30' : (val < 0 ? '#34C759' : '#888');
      const icon = val > 0 ? 'arrow-up' : (val < 0 ? 'arrow-down' : 'remove');
      return (
          <View style={{flexDirection:'row', alignItems:'center', marginLeft:8, backgroundColor: color+'20', paddingHorizontal:6, borderRadius:4}}>
              <Ionicons name={icon} size={12} color={color} />
              <ThemedText style={{fontSize:10, color:color, fontWeight:'bold'}}>{Math.abs(val)} {unit}</ThemedText>
          </View>
      );
  };

  const renderBodyMetricsCard = () => (
    <ThemedView style={styles.card}>
      <View style={{flexDirection:'row', justifyContent:'space-between', marginBottom:12}}>
        <ThemedText type="defaultSemiBold">{t('body_metrics', lang)}</ThemedText>
        <TouchableOpacity onPress={handleSaveMetrics}><ThemedText style={{color:theme.tint, fontSize:14}}>{t('record_metrics', lang)}</ThemedText></TouchableOpacity>
      </View>
      <View style={{flexDirection:'row', justifyContent:'space-between'}}>
        <View>
            <View style={{flexDirection:'row', alignItems:'center'}}>
                <TextInput style={[styles.metricInput, {color:theme.text}]} value={weight} onChangeText={setWeight} placeholder="0.0" keyboardType="numeric"/>
                <ThemedText>kg</ThemedText>
                {renderDiffBadge(diffWeight, 'kg')}
            </View>
            <View style={{flexDirection:'row', alignItems:'center', marginTop:8}}>
                <TextInput style={[styles.metricInput, {color:theme.text}]} value={bodyFat} onChangeText={setBodyFat} placeholder="0.0" keyboardType="numeric"/>
                <ThemedText>%</ThemedText>
                {renderDiffBadge(diffFat, '%')}
            </View>
        </View>
        <View style={{justifyContent:'space-around', alignItems:'flex-end'}}>
            <ThemedText style={{fontSize:12, color:'#888'}}>{t('target_weight', lang)} {targetWeight} kg</ThemedText>
            <ThemedText style={{fontSize:12, color:'#888'}}>{t('target_body_fat', lang)} {targetBodyFat} %</ThemedText>
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
                    <ThemedText style={{fontSize:12, color:'#34C759'}}>{t('intake', lang)}</ThemedText>
                    <ThemedText style={{fontSize:12, color:'#FF9500'}}>{t('burned', lang)}</ThemedText>
                </View>
                <View style={styles.barBg}><View style={[styles.barFill, {width:`${intakePct*100}%`, backgroundColor:'#34C759'}]}/></View>
                <View style={[styles.barBg, {marginTop:8}]}><View style={[styles.barFill, {width:`${Math.min(burnedCalories/1000, 1)*100}%`, backgroundColor:'#FF9500'}]}/></View>
            </View>
            <View style={{flex:0.8, paddingLeft:16, justifyContent:'center'}}>
                <ThemedText style={{fontSize:12, color:'#888'}}>{t('intake_target', lang)}: {Math.round(intake.calories)}/{targets.calories}</ThemedText>
                <ThemedText style={{fontSize:12, color:'#FF9500'}}>{t('burned', lang)}: -{Math.round(burnedCalories)}</ThemedText>
                <View style={{flexDirection:'row', justifyContent:'space-between', marginTop:8}}>
                    <ThemedText style={{fontSize:12}}>{t('net_intake_pct', lang)}</ThemedText>
                    <ThemedText type="title">{netPct}%</ThemedText>
                </View>
            </View>
        </View>
        <View style={{flexDirection:'row', justifyContent:'space-between'}}>
            {renderMacroRing(t('protein', lang), intake.protein, targets.protein, "#FF3B30")}
            {renderMacroRing(t('fat', lang), intake.fat, targets.fat, "#FFcc00")}
            {renderMacroRing(t('carbs', lang), intake.carbs, targets.carbs, "#5856D6")}
            {renderMacroRing(t('sodium', lang), intake.sodium, targets.sodium, "#AF52DE", "mg")}
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

  // [新增] 快速紀錄區塊
  const renderQuickAdd = () => (
      <View style={{paddingHorizontal: 16, marginTop: 20}}>
          <ThemedText type="defaultSemiBold" style={{marginBottom:10}}>{t('recent_foods', lang)}</ThemedText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {recentFoods.length > 0 ? recentFoods.map((item, idx) => (
                  <TouchableOpacity 
                    key={idx} 
                    style={[styles.quickChip, {borderColor: theme.icon}]}
                    onPress={() => router.push({ pathname: "/food-editor", params: { logId: item.id } })} // Should ideally pass item data to prepopulate new entry, here using edit for simplicity or modify food-editor to support cloning
                  >
                      <ThemedText>{item.foodName}</ThemedText>
                  </TouchableOpacity>
              )) : <ThemedText style={{color:'#888', fontSize:12}}>{t('no_recent_foods', lang)}</ThemedText>}
          </ScrollView>
      </View>
  );

  const renderSwipeableLog = (log: any) => (
      <Swipeable renderRightActions={()=><TouchableOpacity style={styles.deleteAction} onPress={() => deleteLog(log.id)}><Ionicons name="trash" size={24} color="white"/></TouchableOpacity>} 
                 renderLeftActions={()=><TouchableOpacity style={styles.editAction} onPress={() => router.push({ pathname: "/food-editor", params: { logId: log.id } })}><Ionicons name="create" size={24} color="white"/></TouchableOpacity>}>
          <View style={[styles.logItem, {backgroundColor: theme.background}]}>
              <View><ThemedText>{log.foodName}</ThemedText><ThemedText style={{fontSize:12, color:theme.icon}}>{log.servingAmount} {log.servingType==='weight'?'g':t('portion', lang)}</ThemedText></View>
              <ThemedText>{Math.round(log.totalCalories)} kcal</ThemedText>
          </View>
      </Swipeable>
  );

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      {isLoading ? <ActivityIndicator size="large" style={{marginTop:50}}/> :
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {renderHeader()}
        {renderBodyMetricsCard()}
        {renderEnergySection()}
        {renderQuickAdd()}
        
        <View style={styles.recordSection}>
            <View style={styles.quickActionRow}>
                <ActionButton icon="camera" label={t('camera', lang)} onPress={() => router.push("/camera")} color="#34C759" />
                <ActionButton icon="barcode" label={t('scan_barcode', lang)} onPress={() => router.push("/barcode-scanner")} color="#007AFF" />
                <ActionButton icon="create" label={t('manual_input', lang)} onPress={() => router.push("/food-editor")} color="#5856D6" />
                <ActionButton icon="fitness" label={t('exercise', lang)} onPress={() => router.push("/activity-editor")} color="#FF9500" />
            </View>
            <View style={styles.logsContainer}>
                {MEAL_ORDER.map((mealType) => {
                    const logs = dailyLogs[mealType] || [];
                    return (
                        <View key={mealType} style={styles.mealGroup}>
                            <View style={styles.mealHeader}>
                                <ThemedText type="defaultSemiBold">{t(mealType, lang)}</ThemedText>
                                <ThemedText style={{fontSize:12, color:theme.icon}}>{Math.round(logs.reduce((sum, item) => sum + item.totalCalories, 0))} kcal</ThemedText>
                            </View>
                            {logs.length === 0 ? <View style={styles.emptyLogPlaceholder}><ThemedText style={{color:theme.icon, fontSize:13}}>{t('no_records', lang)}</ThemedText></View> : logs.map(log => <View key={log.id} style={styles.separator}>{renderSwipeableLog(log)}</View>)}
                        </View>
                    );
                })}
            </View>
            {/* Workout Section */}
            <View style={[styles.mealGroup, {marginTop: 20}]}>
                <View style={styles.mealHeader}>
                    <ThemedText type="defaultSemiBold">{t('exercise', lang)}</ThemedText>
                    <ThemedText style={{fontSize:12, color:'#FF9500'}}>-{Math.round(burnedCalories)} kcal</ThemedText>
                </View>
                {dailyActivities.length === 0 ? <View style={styles.emptyLogPlaceholder}><ThemedText style={{color:theme.icon, fontSize:13}}>{t('no_records', lang)}</ThemedText></View> : dailyActivities.map(act => (
                    <Swipeable key={act.id} renderRightActions={()=><TouchableOpacity style={styles.deleteAction} onPress={async()=>{await db.delete(activityLogs).where(eq(activityLogs.id, act.id)); loadData();}}><Ionicons name="trash" size={24} color="white"/></TouchableOpacity>}>
                        <View style={[styles.logItem, {backgroundColor: theme.background}]}>
                            <View><ThemedText>{act.activityName}</ThemedText><ThemedText style={{fontSize:12, color:theme.icon}}>{act.durationMinutes} min</ThemedText></View>
                            <ThemedText style={{color:'#FF9500'}}>-{Math.round(act.caloriesBurned)} kcal</ThemedText>
                        </View>
                    </Swipeable>
                ))}
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
  card: { marginHorizontal: 16, marginVertical: 8, padding: 16, borderRadius: 16, elevation: 2, shadowOpacity: 0.1, shadowRadius: 4, backgroundColor:'white' },
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
  separator: { borderBottomWidth: 1, borderColor: '#f0f0f0' },
  quickChip: { padding: 8, borderRadius: 20, borderWidth: 1, marginRight: 8 }
});