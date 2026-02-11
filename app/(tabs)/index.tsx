import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  StyleSheet,
  View,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  TextInput,
  Alert,
  Modal,
  RefreshControl,
  Text,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { format, addDays, startOfMonth, endOfMonth, eachDayOfInterval, getDay, addMonths, subMonths, isSameDay, isValid, parse, startOfDay, endOfDay } from "date-fns";
import { zhTW, enUS, ja, ko, fr, ru } from "date-fns/locale"; 
import { Ionicons } from "@expo/vector-icons";
import { PieChart } from "react-native-gifted-charts";
import { eq, desc, and, sql } from "drizzle-orm";
import { Swipeable, GestureHandlerRootView } from "react-native-gesture-handler";
import DateTimePicker from "@react-native-community/datetimepicker"; 

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { t, useLanguage } from "@/lib/i18n"; 

import { db, getLatestTwoDailyMetrics, duplicateFoodLog, getFrequentActivities, getRangeStats } from "@/lib/db";
import { userProfiles, foodLogs, activityLogs, dailyMetrics } from "@/drizzle/schema";

import { initHealthConnect, getHealthData } from "@/lib/health";
import { ActivityIcon, ACTIVITY_RAW } from '@/app/activity-editor'; 
import { useTutorial } from '@/context/TutorialContext';
import { TutorialTarget } from '@/components/TutorialTarget';
import { getTutorialState, TUTORIAL_KEYS } from '@/lib/tutorial-storage';
import { getTutorialSteps } from '@/constants/tutorial-steps';

const SCREEN_WIDTH = Dimensions.get("window").width;
const MEAL_ORDER = ["breakfast", "lunch", "afternoon_tea", "dinner", "late_night"];
const LOCALE_MAP: any = { 'zh-TW': zhTW, 'en': enUS, 'ja': ja, 'ko': ko, 'fr': fr, 'ru': ru };

const decimalToHHMM = (decimal: number) => {
  if (!decimal && decimal !== 0) return "";
  const hours = Math.floor(decimal);
  const minutes = Math.round((decimal - hours) * 60);
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

const hhmmToDecimal = (hhmm: string) => {
  if (!hhmm) return 0;
  const clean = hhmm.replace(':', '');
  // [修正] 增加防呆，如果格式是 0652 也能正確解析
  let h = 0, m = 0;
  if (hhmm.includes(':')) {
      const parts = hhmm.split(':');
      h = parseInt(parts[0]) || 0;
      m = parseInt(parts[1]) || 0;
  } else {
      if (clean.length === 4) {
          h = parseInt(clean.substring(0, 2));
          m = parseInt(clean.substring(2));
      } else if (clean.length === 3) {
           h = parseInt(clean.substring(0, 1));
           m = parseInt(clean.substring(1));
      } else {
          h = parseInt(clean) || 0;
      }
  }
  const totalHours = h + (m / 60);
  return Math.round(totalHours * 100) / 100;
};


// [修正 1] 睡眠時間輸入邏輯修正：652 -> 0652 -> 06:52
const formatTimeInput = (text: string) => {
    let cleaned = text.replace(/[^0-9]/g, '');
    
    // 限制最大長度為 4
    if (cleaned.length > 4) cleaned = cleaned.substring(0, 4);

    // 如果輸入 3 位數 (例如 652)，且第一位數字大於 2 (代表不可能是 65:xx)，自動補 0
    // 或者單純使用者打完 3 碼，我們就暫時不格式化，等到第 4 碼或 onBlur (這裡簡化處理)
    // 這裡採用: 當長度為 3 且使用者停止輸入時的邏輯比較難在 onChangeText 實作
    // 改為：只要長度為 3，嘗試解析。若是 "652"，我們假設是 "0652"
    if (cleaned.length === 3) {
        // 簡單判斷：如果前兩碼大於 23 (小時)，那很有可能是少打 0
        const potentialHour = parseInt(cleaned.substring(0, 2));
        if (potentialHour > 23) {
             cleaned = '0' + cleaned;
        }
    }

    if (cleaned.length >= 3) {
        // 如果是 3 碼 (例如 130 -> 1:30, 065 -> 06:5)，維持原樣
        // 如果是 4 碼 (0652 -> 06:52)
        if (cleaned.length === 3) {
             return `${cleaned.substring(0, 1)}:${cleaned.substring(1)}`;
        }
        return `${cleaned.substring(0, 2)}:${cleaned.substring(2)}`;
    }
    return cleaned;
};

// [修正] 將 ActionButton 定義移到上方，避免 ReferenceError
const ActionButton = ({ icon, label, onPress, color }: any) => (
  <TouchableOpacity style={styles.actionButton} onPress={onPress}>
    <View style={[styles.iconCircle, { backgroundColor: color }]}>
      <Ionicons name={icon} size={24} color="#FFF" />
    </View>
    <ThemedText style={styles.actionLabel}>{label}</ThemedText>
  </TouchableOpacity>
);

export default function HomeScreen() {
  const router = useRouter();
  const theme = Colors[useColorScheme() ?? "light"];
  const lang = useLanguage();
  const dateLocale = LOCALE_MAP[lang] || enUS;
  
  const isDark = useColorScheme() === 'dark';
  const ringTrackColor = isDark ? '#555555' : '#e5e5ea';

  const scrollViewRef = useRef<ScrollView>(null);
  
  const { startScenario, userName, activeScenario, onScrollRequest } = useTutorial();
  const targetPositions = useRef<Record<string, number>>({});

// [修改] 捲動處理函式：使用 useCallback 鎖定，避免閉包陷阱
  const handleScrollRequest = useCallback((targetKey: string) => {
      const y = targetPositions.current[targetKey];
      if (y !== undefined && scrollViewRef.current) {
          setTimeout(() => {
              // 稍微往上捲一點，讓目標物不要貼頂
              scrollViewRef.current?.scrollTo({ y: Math.max(0, y - 50), animated: true });
          }, 100);
      }
  }, []);

  // [修改] 統一使用 useFocusEffect 管理導覽與捲動註冊
  useFocusEffect(
    useCallback(() => {
        onScrollRequest(handleScrollRequest);
        if (activeScenario === 'HOME_GUIDE') {
             setTimeout(() => scrollViewRef.current?.scrollTo({ y: 0, animated: false }), 100);
        }
        async function checkTutorial() {
            if (activeScenario === 'HOME_GUIDE') return;
            const seen = await getTutorialState(TUTORIAL_KEYS.HAS_SEEN_HOME);
            const isFirst = await getTutorialState(TUTORIAL_KEYS.IS_FIRST_LAUNCH);
            // [修正 3] 只有當「非初次啟動」但「沒看過首頁導覽」時才觸發，避免與 Onboarding 衝突
            if (isFirst && !seen && !activeScenario) {
                const allSteps = getTutorialSteps(lang, userName);
                startScenario('HOME_GUIDE', allSteps.HOME_GUIDE);
            }
        }
        checkTutorial();
    }, [activeScenario, userName, lang, handleScrollRequest])
  );

  const [currentDate, setCurrentDate] = useState(new Date());
  const [showCalendarModal, setShowCalendarModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false); 
  
  const [weight, setWeight] = useState(""); 
  const [bodyFat, setBodyFat] = useState("");
  const [diffWeight, setDiffWeight] = useState<number | null>(null);
  const [diffFat, setDiffFat] = useState<number | null>(null);
  
  const [showSleepModal, setShowSleepModal] = useState(false);
  const [manualSleep, setManualSleep] = useState("");

  const [waterMl, setWaterMl] = useState(0);
  const [waterGoal, setWaterGoal] = useState(2000); 
  const WATER_CUP_SIZE = 250;

  const [healthSteps, setHealthSteps] = useState(0);
  const [healthSleep, setHealthSleep] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false); 

  const [targets, setTargets] = useState({ calories: 2000, protein: 150, fat: 60, carbs: 200, sodium: 2300 });
  const [targetWeight, setTargetWeight] = useState(0);
  const [targetBodyFat, setTargetBodyFat] = useState(0);
  
  const [intake, setIntake] = useState({ calories: 0, protein: 0, fat: 0, carbs: 0, sodium: 0 });
  const [burnedCalories, setBurnedCalories] = useState(0);
  const [dailyLogs, setDailyLogs] = useState<Record<string, any[]>>({});
  const [allDailyLogs, setAllDailyLogs] = useState<any[]>([]);
  const [dailyActivities, setDailyActivities] = useState<any[]>([]);
  const [recentFoods, setRecentFoods] = useState<any[]>([]);
  const [frequentActivities, setFrequentActivities] = useState<string[]>([]);
  const [selectedMacro, setSelectedMacro] = useState<{label: string, key: string, unit: string} | null>(null);

  useFocusEffect(
    useCallback(() => { loadData(); }, [currentDate])
  );

  const handleSaveSleep = async () => {
      const h = hhmmToDecimal(manualSleep);
      if (isNaN(h)) return;
      try {
          const dateStr = format(currentDate, "yyyy-MM-dd");
          const existing = await db.select().from(dailyMetrics).where(eq(dailyMetrics.date, dateStr));
          if(existing.length > 0) {
              await db.update(dailyMetrics).set({ sleepHours: h }).where(eq(dailyMetrics.id, existing[0].id));
          } else {
              await db.insert(dailyMetrics).values({ date: dateStr, sleepHours: h });
          }
          setHealthSleep(h);
          setShowSleepModal(false);
          setManualSleep(decimalToHHMM(h)); 
      } catch(e) { console.error(e); }
  };

  const syncHealthData = async (dateStr: string) => {
      if (isSyncing) return;
      setIsSyncing(true);
      try {
          const authorized = await initHealthConnect();
          if (!authorized) {
              Alert.alert(t('tip', lang), "Health Connect Authorization Failed");
              setIsSyncing(false);
              return;
          }
          const start = startOfDay(new Date(dateStr));
          const end = endOfDay(new Date(dateStr));
          const { steps, sleep } = await getHealthData(start, end);
          
          const totalSteps = steps.reduce((sum: number, r: any) => sum + (r.count || 0), 0);
          if (totalSteps > 0) {
              setHealthSteps(totalSteps);
              const existingSteps = await db.select().from(activityLogs).where(and(eq(activityLogs.date, dateStr), eq(activityLogs.activityName, "Daily Steps")));
              if (existingSteps.length > 0) {
                  await db.update(activityLogs).set({ steps: totalSteps, caloriesBurned: totalSteps * 0.04 }).where(eq(activityLogs.id, existingSteps[0].id));
              } else {
                  await db.insert(activityLogs).values({
                      date: dateStr,
                      loggedAt: new Date(),
                      activityName: "Daily Steps",
                      category: "walking",
                      durationMinutes: 0,
                      caloriesBurned: totalSteps * 0.04,
                      steps: totalSteps
                  });
              }
          }

          let totalSleepHours = 0;
          sleep.forEach((s: any) => {
              const durationMs = new Date(s.endTime).getTime() - new Date(s.startTime).getTime();
              totalSleepHours += durationMs / (1000 * 60 * 60);
          });
          
          if (totalSleepHours > 0) {
              const fixedSleep = parseFloat(totalSleepHours.toFixed(1));
              setHealthSleep(fixedSleep);
              setManualSleep(decimalToHHMM(fixedSleep));
              const existingMetrics = await db.select().from(dailyMetrics).where(eq(dailyMetrics.date, dateStr));
              if (existingMetrics.length > 0) {
                  await db.update(dailyMetrics).set({ sleepHours: fixedSleep }).where(eq(dailyMetrics.id, existingMetrics[0].id));
              } else {
                  await db.insert(dailyMetrics).values({ date: dateStr, sleepHours: fixedSleep });
              }
          }
          Alert.alert(t('success', lang), "Sync Completed");

      } catch (e: any) {
          console.log("Health Connect Sync Error:", e);
      } finally {
          setIsSyncing(false);
          loadData(); 
      }
  };

  const loadData = async () => {
    setIsLoading(true);
    setWeight("");
    setBodyFat("");
    setDiffWeight(null);
    setDiffFat(null);
    setWaterMl(0);
    setManualSleep(""); 
    setHealthSleep(0);

    try {
      const dateStr = format(currentDate, "yyyy-MM-dd");

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
        
        const dynamicWater = Math.round((p.currentWeightKg || 60) * 33);
        setWaterGoal(dynamicWater);
      }

      const metricsRes = await db.select().from(dailyMetrics).where(eq(dailyMetrics.date, dateStr));
      if (metricsRes.length > 0) {
        const curW = metricsRes[0].weightKg || 0;
        const curF = metricsRes[0].bodyFatPercentage || 0;
        setWeight(curW > 0 ? String(curW) : "");
        setBodyFat(curF > 0 ? String(curF) : "");
        setWaterMl(metricsRes[0].waterMl || 0);
        
        if (metricsRes[0].sleepHours) {
            const h = metricsRes[0].sleepHours;
            setHealthSleep(h);
            setManualSleep(decimalToHHMM(h));
        } else {
            setHealthSleep(0);
            setManualSleep("");
        }
      } else {
        setHealthSleep(0);
        setManualSleep("");
      }

      const latestTwo = await getLatestTwoDailyMetrics();
      if (latestTwo.length >= 2) {
          const latest = latestTwo[0];
          const previous = latestTwo[1];
          if (latest.date === dateStr && latest.weightKg && previous.weightKg) {
             setDiffWeight(parseFloat((latest.weightKg - previous.weightKg).toFixed(1)));
          }
          if (latest.date === dateStr && latest.bodyFatPercentage && previous.bodyFatPercentage) {
             setDiffFat(parseFloat((latest.bodyFatPercentage - previous.bodyFatPercentage).toFixed(1)));
          }
      }

      const logsRes = await db.select().from(foodLogs).where(eq(foodLogs.date, dateStr));
      setAllDailyLogs(logsRes);

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

      const activityRes = await db.select().from(activityLogs).where(eq(activityLogs.date, dateStr));
      const totalBurned = activityRes.reduce((sum, act) => sum + (act.caloriesBurned || 0), 0);
      setBurnedCalories(totalBurned);
      setDailyActivities(activityRes);
      
      const dbSteps = activityRes.reduce((sum, act) => sum + (act.steps || 0), 0);
      const healthConnectLog = activityRes.find(a => a.activityName === "Daily Steps");
      const healthStepsVal = healthConnectLog ? (healthConnectLog.steps || 0) : 0;
      setHealthSteps(healthStepsVal > 0 ? healthStepsVal : dbSteps);

      const frequentFoodsRes = await db
        .select({
          foodName: foodLogs.foodName,
          count: sql`count(${foodLogs.id})`.as('count'),
          id: sql`max(${foodLogs.id})`.mapWith(Number).as('id'),
        })
        .from(foodLogs)
        .groupBy(foodLogs.foodName)
        .orderBy(desc(sql`count`))
        .limit(5);

      setRecentFoods(frequentFoodsRes);

      const acts = await getFrequentActivities();
      setFrequentActivities(acts);

    } catch (e) { console.error(e); } finally { setIsLoading(false); setRefreshing(false); }
  };

  const onRefresh = () => { setRefreshing(true); loadData(); };

  const handleSaveMetrics = async () => {
      const w = parseFloat(weight);
      const bf = parseFloat(bodyFat);
      if (isNaN(w)) return Alert.alert(t('error', lang), t('invalid_input', lang) || "Invalid Input");
      try {
          const dateStr = format(currentDate, "yyyy-MM-dd");
          const existing = await db.select().from(dailyMetrics).where(eq(dailyMetrics.date, dateStr));
          if(existing.length > 0) {
              await db.update(dailyMetrics).set({ weightKg: w, bodyFatPercentage: isNaN(bf)?null:bf }).where(eq(dailyMetrics.id, existing[0].id));
          } else {
              await db.insert(dailyMetrics).values({ date: dateStr, weightKg: w, bodyFatPercentage: isNaN(bf)?null:bf });
          }
          const p = await db.select().from(userProfiles).limit(1);
          if(p.length > 0) {
              await db.update(userProfiles).set({ currentWeightKg: w, currentBodyFat: isNaN(bf)?null:bf }).where(eq(userProfiles.id, p[0].id));
          }
          Alert.alert(t('success', lang), t('save_success', lang));
          loadData(); 
      } catch(e) { console.error(e); }
  };
  const handleDuplicate = async (id: number) => {
      try { await duplicateFoodLog(id); Alert.alert(t('success', lang), t('save_success', lang)); loadData(); } catch (e) { Alert.alert(t('error', lang), "Copy failed"); }
  };
  const deleteLog = (id: number) => {
      Alert.alert(t('delete', lang), "", [{ text: t('cancel', lang), style: "cancel" }, { text: t('delete', lang), style: "destructive", onPress: async () => { await db.delete(foodLogs).where(eq(foodLogs.id, id)); loadData(); }}]);
  };

  const addWater = async () => {
      const newAmount = waterMl + WATER_CUP_SIZE;
      setWaterMl(newAmount); 
      
      const dateStr = format(currentDate, "yyyy-MM-dd");
      const existing = await db.select().from(dailyMetrics).where(eq(dailyMetrics.date, dateStr));
      
      try {
          if(existing.length > 0) {
              await db.update(dailyMetrics).set({ waterMl: newAmount }).where(eq(dailyMetrics.id, existing[0].id));
          } else {
              await db.insert(dailyMetrics).values({ date: dateStr, waterMl: newAmount });
          }
      } catch(e) { console.error("Water update failed", e); }
  };
  
  const removeWater = async () => {
      const newAmount = Math.max(0, waterMl - WATER_CUP_SIZE);
      setWaterMl(newAmount);
      
      const dateStr = format(currentDate, "yyyy-MM-dd");
      const existing = await db.select().from(dailyMetrics).where(eq(dailyMetrics.date, dateStr));

      try {
          if(existing.length > 0) {
              await db.update(dailyMetrics).set({ waterMl: newAmount }).where(eq(dailyMetrics.id, existing[0].id));
          }
      } catch(e) { console.error("Water update failed", e); }
  };

  const getActivityIconInfo = (name: string) => {
    for (const cat of ACTIVITY_RAW) {
        const item = cat.items.find(i => t(i.id, lang) === name);
        if (item) {
            return { icon: item.icon, library: item.library };
        }
    }
    return { icon: 'walk', library: undefined };
  };

  const CustomCalendarModal = () => {
    const [viewDate, setViewDate] = useState(currentDate);
    const [monthStats, setMonthStats] = useState<Record<string, any>>({});
    const [showYearMonthPicker, setShowYearMonthPicker] = useState(false);
    const [showInputModal, setShowInputModal] = useState(false);
    const [inputDateStr, setInputDateStr] = useState("");

    useEffect(() => {
        async function fetchStats() {
            const start = format(startOfMonth(viewDate), 'yyyy-MM-dd');
            const end = format(endOfMonth(viewDate), 'yyyy-MM-dd');
            const stats = await getRangeStats(start, end);
            setMonthStats(stats);
        }
        fetchStats();
    }, [viewDate, showCalendarModal]);

    const daysInMonth = eachDayOfInterval({ start: startOfMonth(viewDate), end: endOfMonth(viewDate) });
    const startDayOfWeek = getDay(startOfMonth(viewDate));
    const emptySlots = Array(startDayOfWeek).fill(null);
    const weeks = [];
    let currentWeek = [...emptySlots];
    
    daysInMonth.forEach(day => {
        currentWeek.push(day);
        if (currentWeek.length === 7) { weeks.push(currentWeek); currentWeek = []; }
    });
    if (currentWeek.length > 0) weeks.push(currentWeek);

    const handleManualInput = () => {
        const parsed = parse(inputDateStr, 'yyyy-MM-dd', new Date());
        if (isValid(parsed)) {
            setCurrentDate(parsed);
            setViewDate(parsed);
            setShowInputModal(false);
            setShowCalendarModal(false);
        } else {
            Alert.alert(t('error', lang), t('invalid_date_format', lang) || "Invalid Format (YYYY-MM-DD)");
        }
    };

    return (
        <Modal visible={showCalendarModal} animationType="slide" transparent>
            <View style={styles.modalOverlay}>
                <View style={[styles.modalContent, {backgroundColor: theme.cardBackground, height: '70%'}]}>
                    <View style={{flexDirection:'row', justifyContent:'space-between', alignItems:'center', padding:10}}>
                        <TouchableOpacity onPress={()=>setViewDate(subMonths(viewDate, 1))}><Ionicons name="chevron-back" size={24} color={theme.text}/></TouchableOpacity>
                        <TouchableOpacity onPress={() => setShowYearMonthPicker(true)} style={{flexDirection:'row', alignItems:'center'}}>
                            <ThemedText type="subtitle" style={{marginRight: 4}}>{format(viewDate, "yyyy MMMM", {locale: dateLocale})}</ThemedText>
                            <Ionicons name="caret-down" size={16} color={theme.icon}/>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={()=>setViewDate(addMonths(viewDate, 1))}><Ionicons name="chevron-forward" size={24} color={theme.text}/></TouchableOpacity>
                    </View>
                    <View style={{flexDirection:'row', justifyContent:'space-around', borderBottomWidth:1, borderColor:'#eee', paddingBottom:8}}>
                        {['S','M','T','W','T','F','S'].map((d,i)=>(<ThemedText key={i} style={{width: 40, textAlign:'center', color: theme.icon, fontWeight:'bold'}}>{d}</ThemedText>))}
                    </View>
                    <ScrollView>
                        {weeks.map((week, wIdx) => (
                            <View key={wIdx} style={{flexDirection:'row', justifyContent:'space-around', marginVertical: 8}}>
                                {week.map((day, dIdx) => {
                                    if (!day) return <View key={dIdx} style={{width: 40}} />;
                                    const dateStr = format(day, 'yyyy-MM-dd');
                                    const stat = monthStats[dateStr];
                                    const net = stat ? Math.round(stat.net) : 0;
                                    const isSelected = isSameDay(day, currentDate);
                                    const isOverLimit = targets.calories > 0 && net > targets.calories;
                                    return (
                                        <TouchableOpacity 
                                            key={dIdx} 
                                            onPress={() => { setCurrentDate(day); setShowCalendarModal(false); }}
                                            style={{width: 40, alignItems:'center', backgroundColor: isSelected ? theme.tint+'20' : 'transparent', borderRadius: 8, padding: 4}}
                                        >
                                            <ThemedText style={{fontWeight: isSelected?'bold':'normal', color: isSelected?theme.tint:theme.text}}>{format(day, 'd')}</ThemedText>
                                            <Text style={{fontSize: 9, color: isOverLimit ? '#FF3B30' : theme.icon, marginTop: 2}}>{stat ? net : '-'}</Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        ))}
                    </ScrollView>
                    <View style={{flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderColor: '#eee', position: 'relative'}}>
                        <TouchableOpacity onPress={() => setShowInputModal(true)} style={{position: 'absolute', left: 10, padding: 10}}><Ionicons name="keypad-outline" size={24} color={theme.tint} /></TouchableOpacity>
                        <TouchableOpacity onPress={() => { const today = new Date(); setCurrentDate(today); setViewDate(today); setShowCalendarModal(false); }} style={{padding: 10, flexDirection:'row', alignItems:'center'}}><Ionicons name="today-outline" size={18} color={theme.tint} style={{marginRight: 6}}/><ThemedText style={{color: theme.tint, fontWeight:'bold', fontSize: 16}}>{t('today', lang) || "Today"}</ThemedText></TouchableOpacity>
                    </View>
                    {showYearMonthPicker && <DateTimePicker value={viewDate} mode="date" display="spinner" onChange={(e, d) => { setShowYearMonthPicker(false); if (d) setViewDate(d); }} />}
                    <Modal visible={showInputModal} transparent animationType="fade">
                        <KeyboardAvoidingView behavior={Platform.OS==='ios'?'padding':'height'} style={styles.modalOverlay}>
                            <View style={[styles.modalContent, {backgroundColor: 'white', height: 'auto', padding: 20}]}>
                                <ThemedText type="subtitle" style={{marginBottom:16}}>{t('input_date', lang)}</ThemedText>
                                <TextInput style={{borderWidth:1, borderColor:'#ccc', borderRadius:8, padding:10, fontSize:16, marginBottom:16}} placeholder="YYYY-MM-DD" value={inputDateStr} onChangeText={setInputDateStr} keyboardType="numbers-and-punctuation" />
                                <View style={{flexDirection:'row', justifyContent:'flex-end', gap: 16}}>
                                    <TouchableOpacity onPress={()=>setShowInputModal(false)}><ThemedText>{t('cancel', lang)}</ThemedText></TouchableOpacity>
                                    <TouchableOpacity onPress={handleManualInput}><ThemedText style={{color:theme.tint, fontWeight:'bold'}}>{t('confirm', lang)}</ThemedText></TouchableOpacity>
                                </View>
                            </View>
                        </KeyboardAvoidingView>
                    </Modal>
                </View>
            </View>
        </Modal>
    );
  };

  const renderHeader = () => (
    <View style={styles.headerContainer}>
      <TouchableOpacity onPress={() => setCurrentDate(addDays(currentDate, -1))}><Ionicons name="chevron-back" size={24} color={theme.text}/></TouchableOpacity>
      <TouchableOpacity onPress={() => setShowCalendarModal(true)} style={styles.dateDisplay}>
        <ThemedText type="subtitle">{format(currentDate, "yyyy-MM-dd", {locale: dateLocale})}</ThemedText>
        <ThemedText style={{color: theme.icon, fontSize: 14}}>{format(currentDate, "EEEE", {locale: dateLocale})}</ThemedText>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => setCurrentDate(addDays(currentDate, 1))}><Ionicons name="chevron-forward" size={24} color={theme.text}/></TouchableOpacity>
    </View>
  );

  const renderDiffBadge = (val: number | null, unit: string) => { if(val===null) return null; const c=val>0?'#FF3B30':(val<0?'#34C759':'#888'); return (<View style={{flexDirection:'row',marginLeft:8,backgroundColor:c+'20',paddingHorizontal:6,borderRadius:4}}><Ionicons name={val>0?'arrow-up':(val<0?'arrow-down':'remove')} size={12} color={c}/><ThemedText style={{fontSize:10,color:c,fontWeight:'bold'}}>{Math.abs(val)} {unit}</ThemedText></View>);};
  
  const renderBodyMetricsCard = () => (
    <ThemedView style={[styles.card, { paddingVertical: 20, backgroundColor: theme.cardBackground }]}> 
      <View style={{flexDirection:'row',justifyContent:'space-between',marginBottom:16}}>
          <View style={{flexDirection: 'row', alignItems: 'center'}}>
            <ThemedText type="defaultSemiBold" style={{fontSize: 18}}>{t('body_metrics',lang)}</ThemedText>
            <TouchableOpacity onPress={handleSaveMetrics} style={{marginLeft: 12}}>
               <Ionicons name="add-circle" size={24} color={theme.tint} />
            </TouchableOpacity>
          </View>
          
          <View style={{flexDirection:'row', gap: 12}}>
             <TouchableOpacity onPress={() => syncHealthData(format(currentDate, 'yyyy-MM-dd'))} style={{flexDirection: 'row', alignItems: 'center', backgroundColor: theme.inputBackground, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12}}>
                <ThemedText style={{fontSize: 10, color: '#888', marginRight: 4}}>{t('sync_health_hint', lang)}</ThemedText>
                {isSyncing ? <ActivityIndicator size="small" color={theme.tint}/> : <Ionicons name="sync" size={16} color={theme.tint} />}
             </TouchableOpacity>
          </View>
      </View>

      <View style={{flexDirection:'row',justifyContent:'space-between', marginBottom: 16}}>
        <View style={{gap: 10}}>
            <View style={{flexDirection:'row',alignItems:'center'}}>
                <ThemedText style={{width: 95, fontSize: 14}}>{t('weight', lang)}</ThemedText>
                <TextInput 
                    style={[styles.metricInput, {fontSize: 16, color: theme.text, backgroundColor: theme.inputBackground, borderRadius: 8, borderWidth: 0}]} 
                    value={weight} 
                    onChangeText={setWeight} 
                    placeholder="--" 
                    placeholderTextColor="#999" 
                    keyboardType="numeric"
                />
                <ThemedText style={{fontSize:14, marginLeft: 4}}>kg</ThemedText>
                {renderDiffBadge(diffWeight,'kg')}
            </View>
            <View style={{flexDirection:'row',alignItems:'center'}}>
                <ThemedText style={{width: 95, fontSize: 14}}>{t('body_fat', lang)}</ThemedText>
                <TextInput 
                    style={[styles.metricInput, {fontSize: 16, color: theme.text, backgroundColor: theme.inputBackground, borderRadius: 8, borderWidth: 0}]} 
                    value={bodyFat} 
                    onChangeText={setBodyFat} 
                    placeholder="--" 
                    placeholderTextColor="#999" 
                    keyboardType="numeric"
                />
                <ThemedText style={{fontSize:14, marginLeft: 4}}>% </ThemedText>
                {renderDiffBadge(diffFat,'%')}
            </View>
        </View>

        <View style={{justifyContent:'center', alignItems:'flex-end', gap: 8}}>
            <ThemedText style={{fontSize:12,color:'#888'}}>{t('target_weight',lang)}: {targetWeight} kg</ThemedText>
            <ThemedText style={{fontSize:12,color:'#888'}}>{t('target_body_fat',lang)}: {targetBodyFat} %</ThemedText>
        </View>
      </View>

      <View style={{borderTopWidth:1, borderColor: theme.border || '#eee', paddingTop:12, flexDirection:'row', justifyContent:'space-around'}}>
          <View style={{flexDirection:'row', alignItems:'center'}}>
              <Ionicons name="footsteps" size={18} color="#FF9500"/>
              <ThemedText style={{fontSize:14, marginLeft:6, fontWeight:'500'}}>{healthSteps} {t('steps', lang) || "steps"}</ThemedText>
          </View>
          <View style={{height: '100%', width:1, backgroundColor:'#eee'}}/>
          
          <TouchableOpacity onPress={() => setShowSleepModal(true)} style={{flexDirection:'row', alignItems:'center'}}>
              <Ionicons name="bed" size={18} color="#5856D6"/>
              <ThemedText style={{fontSize:14, marginLeft:6, fontWeight:'500'}}>{healthSleep} h {t('sleep', lang) || "sleep"}</ThemedText>
          </TouchableOpacity>
      </View>
    </ThemedView>
  );

  // [修正 5] 喝水紀錄 UI 優化：保持一行，動態調整大小
  const renderWaterSection = () => {
      const totalCups = Math.ceil(waterGoal / WATER_CUP_SIZE);
      const currentCups = Math.floor(waterMl / WATER_CUP_SIZE);
      
      // 動態計算 icon 大小：若杯數 > 10，縮小尺寸以塞入一行
      const iconSize = totalCups > 10 ? Math.max(16, Math.floor(260 / totalCups)) : 26;
      const marginSize = totalCups > 10 ? 1 : 2;

      return (
          <ThemedView style={[styles.card, { backgroundColor: theme.cardBackground }]}>
              <View style={{flexDirection:'row', justifyContent:'space-between', marginBottom:12}}>
                  <ThemedText type="defaultSemiBold">💧 {t('water_intake', lang) || "Water Intake"}</ThemedText>
                  <ThemedText style={{color: theme.tint}}>{waterMl} / {waterGoal} ml</ThemedText>
              </View>
              
              <View style={{flexDirection:'row', alignItems: 'center', justifyContent:'space-between', minHeight: 50}}>
                  <TouchableOpacity 
                      onPress={removeWater}
                      style={{width: 30, height: 30, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.inputBackground, borderRadius: 20, zIndex: 10}}
                  >
                      <Ionicons name="remove" size={24} color={theme.text} />
                  </TouchableOpacity>

                  {/* flexWrap: 'nowrap' 強制不換行 */}
                  <View style={{flex: 1, flexDirection:'row', flexWrap:'nowrap', justifyContent:'center', alignItems:'center', paddingHorizontal: 4}}>
                      {Array.from({length: totalCups}).map((_, idx) => (
                          <View 
                            key={idx} 
                            style={{opacity: idx < currentCups ? 1 : 0.3, margin: marginSize}}
                          >
                              <Ionicons name={idx < currentCups ? "water" : "water-outline"} size={iconSize} color="#007AFF" />
                          </View>
                      ))}
                      {currentCups > totalCups && (
                           <View style={{flexDirection:'row', alignItems:'center', margin: 2}}>
                               <Ionicons name="add" size={14} color={theme.text}/>
                               <Ionicons name="water" size={iconSize} color="#007AFF" />
                               <ThemedText style={{fontSize:10, fontWeight:'bold', position:'absolute', color:'white', left:4}}>+{currentCups - totalCups}</ThemedText>
                           </View>
                      )}
                  </View>

                  <TouchableOpacity 
                      onPress={addWater}
                      style={{width: 30, height: 30, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.inputBackground, borderRadius: 20, zIndex: 10}}
                  >
                      <Ionicons name="add" size={24} color={theme.text} />
                  </TouchableOpacity>
              </View>
              
              <ThemedText style={{fontSize:10, color:'#888', textAlign:'center', marginTop:8}}>
                  {t('tap_buttons_to_adjust', lang) || "Tap buttons to adjust (+/- 250ml)"}
              </ThemedText>
          </ThemedView>
      );
  };

  const renderEnergySection = () => {
    const intakePct = targets.calories > 0 ? Math.min(intake.calories / targets.calories, 1) : 0;
    const net = intake.calories - burnedCalories;
    const netPct = targets.calories > 0 ? Math.round((net / targets.calories) * 100) : 0;
    return (
      <View style={styles.sectionContainer}>
        <View style={{flexDirection:'row', marginBottom:20}}>
            <View style={{flex:1}}>
                <View style={{flexDirection:'row', justifyContent:'space-between', marginBottom:4}}><ThemedText style={{fontSize:12, color:'#34C759'}}>{t('intake', lang)}</ThemedText><ThemedText style={{fontSize:12, color:'#FF9500'}}>{t('burned', lang)}</ThemedText></View>
                <View style={[styles.barBg, { backgroundColor: ringTrackColor }]}><View style={[styles.barFill, {width:`${intakePct*100}%`, backgroundColor:'#34C759'}]}/></View>
                <View style={[styles.barBg, {marginTop:8, backgroundColor: ringTrackColor }]}><View style={[styles.barFill, {width:`${Math.min(burnedCalories/1000, 1)*100}%`, backgroundColor:'#FF9500'}]}/></View>
            </View>
            <View style={{flex:0.8, paddingLeft:16, justifyContent:'center'}}>
                <ThemedText style={{fontSize:12, color:'#888'}}>{t('intake_target', lang)}: {Math.round(intake.calories)}/{targets.calories}</ThemedText>
                <ThemedText style={{fontSize:12, color:'#FF9500'}}>{t('burned', lang)}: -{Math.round(burnedCalories)}</ThemedText>
                <View style={{flexDirection:'row', justifyContent:'space-between', marginTop:8}}><ThemedText style={{fontSize:12}}>{t('net_intake_pct', lang)}</ThemedText><ThemedText type="title">{netPct}%</ThemedText></View>
            </View>
        </View>
        <View style={{flexDirection:'row', justifyContent:'space-between'}}>
            {renderMacroRing(t('protein', lang), intake.protein, targets.protein, "#FF3B30", "protein")}
            {renderMacroRing(t('fat', lang), intake.fat, targets.fat, "#FFcc00", "fat")}
            {renderMacroRing(t('carbs', lang), intake.carbs, targets.carbs, "#5856D6", "carbs")}
            {renderMacroRing(t('sodium', lang), intake.sodium, targets.sodium, "#AF52DE", "sodium", "mg")}
        </View>
      </View>
    );
  };

  const renderMacroRing = (label:string, val:number, target:number, color:string, key: string, unit="g") => {
      const realPct = target > 0 ? (val/target)*100 : 0; 
      const visualPct = Math.min(realPct, 100); 
      
      return (
        <TouchableOpacity onPress={() => setSelectedMacro({label, key, unit})} style={{alignItems:'center', width: SCREEN_WIDTH/4.5}}>
            <View pointerEvents="none">
                <PieChart 
                    data={[{value: visualPct, color}, {value: 100-visualPct, color: ringTrackColor }]} 
                    donut 
                    radius={32} 
                    innerRadius={24} 
                    innerCircleColor={theme.cardBackground}
                    centerLabelComponent={() => (
                        <ThemedText style={{fontSize:10, fontWeight:'bold', color: theme.text}}> 
                            {Math.round(realPct)}%
                        </ThemedText>
                    )}
                />
            </View>
            <ThemedText style={{fontSize:12, marginTop:8, fontWeight:'600'}}>{label}</ThemedText>
            <ThemedText style={{fontSize:10, color:'#888'}}>{Math.round(val)}/{target}{unit}</ThemedText>
        </TouchableOpacity>
      );
  };

  const renderMacroDetailModal = () => { if (!selectedMacro) return null; const keyMap: any = {'protein': 'totalProteinG','fat': 'totalFatG','carbs': 'totalCarbsG','sodium': 'totalSodiumMg'}; const dbKey = keyMap[selectedMacro.key]; const sortedLogs = allDailyLogs.filter(l => (l[dbKey] || 0) > 0).sort((a, b) => (b[dbKey] || 0) - (a[dbKey] || 0)); const totalVal = sortedLogs.reduce((sum, item) => sum + (item[dbKey] || 0), 0); return (<Modal visible={!!selectedMacro} transparent animationType="slide" onRequestClose={()=>setSelectedMacro(null)}><View style={styles.modalOverlay}><View style={[styles.modalContent, {backgroundColor: theme.cardBackground, maxHeight: '60%'}]}><View style={{flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:16}}><ThemedText type="subtitle">{selectedMacro.label} {t('analysis', lang)}</ThemedText><TouchableOpacity onPress={()=>setSelectedMacro(null)}><Ionicons name="close" size={24} color={theme.text}/></TouchableOpacity></View><ThemedText style={{marginBottom:10, color: theme.tint, fontWeight:'bold'}}>{t('total', lang)}: {Math.round(totalVal)} {selectedMacro.unit}</ThemedText><ScrollView>{sortedLogs.length === 0 ? <ThemedText style={{color:'#888'}}>{t('no_records', lang)}</ThemedText> : sortedLogs.map((log, idx) => { const val = log[dbKey] || 0; const pct = totalVal > 0 ? (val / totalVal * 100).toFixed(1) : "0"; return (<View key={idx} style={{flexDirection:'row', justifyContent:'space-between', paddingVertical:10, borderBottomWidth:1, borderColor:'#eee'}}><View style={{flex:1}}><ThemedText>{log.foodName}</ThemedText><View style={{width: '100%', height:4, backgroundColor:'#eee', marginTop:4, borderRadius:2}}><View style={{width: `${pct}%`, backgroundColor: theme.tint, height:'100%', borderRadius:2}}/></View></View><View style={{alignItems:'flex-end', marginLeft:10}}><ThemedText style={{fontWeight:'bold'}}>{Math.round(val)} {selectedMacro.unit}</ThemedText><ThemedText style={{fontSize:10, color:'#888'}}>{pct}%</ThemedText></View></View>);})}</ScrollView></View></View></Modal>);};

  const renderQuickAdd = () => (<View style={{paddingHorizontal: 16, marginTop: 20}}><ThemedText type="defaultSemiBold" style={{marginBottom:10}}>{t('quick_record', lang)}</ThemedText><ScrollView horizontal showsHorizontalScrollIndicator={false}>{recentFoods.length > 0 ? recentFoods.map((item, idx) => (<TouchableOpacity key={idx} style={[styles.quickChip, {borderColor: theme.icon}]} onPress={() => router.push({ pathname: "/food-editor", params: { logId: item.id, clone: "true" } })} ><ThemedText>{item.foodName}</ThemedText></TouchableOpacity>)) : <ThemedText style={{color:'#888', fontSize:12}}>{t('no_recent_foods', lang)}</ThemedText>}</ScrollView></View>);

  const renderSwipeableLog = (log: any) => (<Swipeable renderRightActions={()=>(<View style={{flexDirection: 'row', width: 140}}><TouchableOpacity style={[styles.actionBtnBase, {backgroundColor: '#FF9500'}]} onPress={() => handleDuplicate(log.id)}><Ionicons name="copy" size={24} color="white"/></TouchableOpacity><TouchableOpacity style={[styles.actionBtnBase, {backgroundColor: '#FF3B30'}]} onPress={() => deleteLog(log.id)}><Ionicons name="trash" size={24} color="white"/></TouchableOpacity></View>)} renderLeftActions={()=>(<TouchableOpacity style={[styles.actionBtnBase, {backgroundColor: '#34C759', width: 70}]} onPress={() => router.push({ pathname: "/food-editor", params: { logId: log.id } })}><Ionicons name="create" size={24} color="white"/></TouchableOpacity>)}><View style={[styles.logItem, {backgroundColor: theme.background}]}><View><ThemedText>{log.foodName}</ThemedText><ThemedText style={{fontSize:12, color:theme.icon}}>{log.servingAmount} {log.servingType==='weight'?'g':t('portion', lang)}</ThemedText></View><ThemedText>{Math.round(log.totalCalories)} kcal</ThemedText></View></Swipeable>);

  // --------------------------------------------------------------------------------
  // [修正 2] 渲染與 TutorialTarget 整合
  // 關鍵修正：移除大量寫死的 offsetX/offsetY，讓 TutorialTarget 自動計算
  // --------------------------------------------------------------------------------
return (
    <GestureHandlerRootView style={{ flex: 1 }}>
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      <ScrollView ref={scrollViewRef} contentContainerStyle={styles.scrollContent} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        
        {/* Header - 幾乎不需要位移，包住即可 */}
        <TutorialTarget 
            targetKey="home_header" 
            onMeasure={(y) => targetPositions.current['home_header'] = y}
            adjustment={{ padding: 5 }} 
        >
            {renderHeader()}
        </TutorialTarget>
        
        {/* Metrics - 移除原本的大位移 */}
        <TutorialTarget
         targetKey="home_metrics"
         onMeasure={(y) => targetPositions.current['home_metrics'] = y}
         adjustment={{ padding: 5 }} // 只保留少量 padding
         >
            {renderBodyMetricsCard()}
        </TutorialTarget>

        {/* Water */}
        <TutorialTarget
         targetKey="home_water" 
         onMeasure={(y) => targetPositions.current['home_water'] = y}
         adjustment={{ padding: 5 }}
         >
            {renderWaterSection()}
        </TutorialTarget>

        {/* Energy */}
        <TutorialTarget
         targetKey="home_energy" 
         onMeasure={(y) => targetPositions.current['home_energy'] = y}
         adjustment={{ padding: 5 }}
         >
            {renderEnergySection()}
        </TutorialTarget>

        {/* Actions - 這裡原本有 -600 的偏移，這是因為之前 TutorialTarget 包錯位置或計算錯誤
           現在直接包住 Action Button 的容器 */}
        <TutorialTarget
             targetKey="home_actions" 
             onMeasure={(y) => targetPositions.current['home_actions'] = y}
             style={[styles.recordSection, { marginBottom: 0 }]} 
             adjustment={{ padding: 5 }}
             >
               <View style={styles.quickActionRow}>
                    <ActionButton icon="camera" label={t('camera', lang)} onPress={() => router.push("/camera")} color="#34C759" />
                    <ActionButton icon="barcode" label={t('scan_barcode', lang)} onPress={() => router.push("/barcode-scanner")} color="#007AFF" />
                    <ActionButton icon="create" label={t('manual_input', lang)} onPress={() => router.push("/food-editor")} color="#5856D6" />
                    <ActionButton icon="fitness" label={t('exercise', lang)} onPress={() => router.push("/activity-editor")} color="#FF9500" />
               </View>
        </TutorialTarget>

        {/* Logs */}
        <TutorialTarget 
            targetKey="home_logs" 
            onMeasure={(y) => targetPositions.current['home_logs'] = y}
            style={{ paddingHorizontal: 16 }} 
            adjustment={{ padding: 5 }}
        >
            <View>
                {renderQuickAdd()} 
                <View style={styles.logsContainer}>
                    {/* ... Logs Content ... */}
                    {MEAL_ORDER.map((mealType) => {
                        const logs = dailyLogs[mealType] || [];
                        return (
                            <View key={mealType} style={styles.mealGroup}>
                                <View style={styles.mealHeader}><ThemedText type="defaultSemiBold">{t(mealType, lang)}</ThemedText><ThemedText style={{fontSize:12, color:theme.icon}}>{Math.round(logs.reduce((sum, item) => sum + item.totalCalories, 0))} kcal</ThemedText></View>
                                {logs.length === 0 ? <View style={styles.emptyLogPlaceholder}><ThemedText style={{color:theme.icon, fontSize:13}}>{t('no_records', lang)}</ThemedText></View> : logs.map(log => <View key={log.id} style={styles.separator}>{renderSwipeableLog(log)}</View>)}
                            </View>
                        );
                    })}
                </View>
                {/* ... Rest of logs ... */}
                 <View style={{marginTop: 20, marginBottom: 8}}>
                    <ThemedText type="defaultSemiBold" style={{marginBottom:10}}>{t('quick_add_activity', lang) || "Quick Add Activity"}</ThemedText>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap: 8, minHeight: 40}}>
                        {frequentActivities.length > 0 ? frequentActivities.map((name, idx) => {
                            const { icon, library } = getActivityIconInfo(name);
                            return (
                                <TouchableOpacity key={idx} style={[styles.quickChip, {borderColor: theme.icon, flexDirection:'row', alignItems:'center'}]} onPress={() => router.push({ pathname: "/activity-editor", params: { activityName: name } })}>
                                    <ActivityIcon library={library} name={icon} size={16} color={theme.text} style={{marginRight: 4}} />
                                    <ThemedText>{name}</ThemedText>
                                </TouchableOpacity>
                            );
                        }) : (
                             <ThemedText style={{color: '#888', fontSize: 13, fontStyle: 'italic', paddingVertical: 10}}>{t('no_recent_activities', lang) || "No recent activities"}</ThemedText>
                        )}
                    </ScrollView>
                </View>

                <View style={[styles.mealGroup, {marginTop: 20}]}>
                    <View style={styles.mealHeader}>
                        <ThemedText type="defaultSemiBold">{t('exercise', lang)}</ThemedText>
                        <ThemedText style={{fontSize:12, color:'#FF9500'}}>-{Math.round(burnedCalories)} kcal</ThemedText>
                    </View>
                    {dailyActivities.length === 0 ? <View style={styles.emptyLogPlaceholder}><ThemedText style={{color:theme.icon, fontSize:13}}>{t('no_records', lang)}</ThemedText></View> : dailyActivities.map(act => (<Swipeable key={act.id} renderRightActions={()=><TouchableOpacity style={[styles.actionBtnBase, {backgroundColor: '#FF3B30', width: 70}]} onPress={async()=>{await db.delete(activityLogs).where(eq(activityLogs.id, act.id)); loadData();}}><Ionicons name="trash" size={24} color="white"/></TouchableOpacity>} renderLeftActions={()=><TouchableOpacity style={[styles.actionBtnBase, {backgroundColor: '#34C759', width: 70}]} onPress={() => router.push({ pathname: "/activity-editor", params: { logId: act.id } })}><Ionicons name="create" size={24} color="white"/></TouchableOpacity>}><View style={[styles.logItem, {backgroundColor: theme.background}]}><View><ThemedText>{act.activityName}</ThemedText><ThemedText style={{fontSize:12, color:theme.icon}}>{act.durationMinutes} min</ThemedText></View><ThemedText style={{color:'#FF9500'}}>-{Math.round(act.caloriesBurned)} kcal</ThemedText></View></Swipeable>))}
                </View>
            </View>
        </TutorialTarget>
        
        {CustomCalendarModal()}
        {renderMacroDetailModal()}

        <Modal visible={showSleepModal} transparent animationType="fade">
            <View style={styles.modalOverlay}>
                <View style={[styles.modalContent, {backgroundColor: theme.cardBackground}]}>
                    <ThemedText type="subtitle" style={{marginBottom:16}}>{t('input_sleep', lang)}</ThemedText>
                    {/* [修正 1] 睡眠輸入框邏輯修正：允許輸入 4 碼，並自動補 0 */}
                    <TextInput 
                        style={[styles.metricInput, {width: '100%', backgroundColor: theme.inputBackground, borderRadius:8, padding:10, marginBottom:16, color: theme.text}]}
                        placeholder={t('sleep_hours', lang) || "HHMM (e.g. 0730)"} 
                        placeholderTextColor="#999"
                        keyboardType="number-pad"
                        maxLength={5} // 07:30 = 5 chars
                        value={manualSleep}
                        onChangeText={(text) => {
                             // 如果使用者刪除內容，不做格式化
                             if (text.length < manualSleep.length) {
                                 setManualSleep(text);
                                 return;
                             }
                             
                             const formatted = formatTimeInput(text);
                             // 特殊處理：當輸入滿 3 碼且是合理時間 (如 652 -> 06:52)，強制補零
                             if (text.replace(':','').length === 3 && formatted.length === 5) {
                                 setManualSleep(formatted);
                             } else {
                                 setManualSleep(formatted);
                             }
                        }}
                    />
                    <View style={{flexDirection:'row', justifyContent:'flex-end', gap: 16}}>
                        <TouchableOpacity onPress={()=>setShowSleepModal(false)}><ThemedText>{t('cancel', lang)}</ThemedText></TouchableOpacity>
                        <TouchableOpacity onPress={handleSaveSleep}><ThemedText style={{color:theme.tint, fontWeight:'bold'}}>{t('confirm', lang)}</ThemedText></TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>

      </ScrollView>
    </SafeAreaView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingBottom: 40 },
  headerContainer: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12 },
  dateDisplay: { alignItems: "center" },
  card: { marginHorizontal: 16, marginVertical: 8, padding: 16, borderRadius: 16, elevation: 2, shadowOpacity: 0.1, shadowRadius: 4 }, 
  metricInput: { width: 70, fontSize: 18, fontWeight: "600", textAlign: "center", paddingVertical: 8, paddingHorizontal: 4 }, 
  sectionContainer: { paddingHorizontal: 16, marginTop: 16 },
  barBg: { height: 12, borderRadius: 6, overflow: "hidden" }, 
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
  actionBtnBase: { justifyContent: 'center', alignItems: 'center', width: 70, height: '100%' },
  separator: { borderBottomWidth: 1, borderColor: '#f0f0f0' },
  quickChip: { padding: 8, borderRadius: 20, borderWidth: 1, marginRight: 8 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 30 },
  modalContent: { padding: 20, borderRadius: 16 }
});