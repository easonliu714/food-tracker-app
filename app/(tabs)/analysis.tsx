// [修正] 加入 useRef
import { useState, useEffect, useCallback, useRef } from "react";
import { ScrollView, StyleSheet, View, Dimensions, TouchableOpacity, ActivityIndicator, Modal, Pressable, Vibration, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BarChart } from "react-native-gifted-charts";
import { format, subDays, differenceInDays, eachDayOfInterval } from "date-fns";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import { GestureHandlerRootView, PinchGestureHandler } from "react-native-gesture-handler";
import { useFocusEffect } from "expo-router"; // 確保有引入

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useThemeColor } from "@/hooks/use-theme-color";
import { t, useLanguage } from "@/lib/i18n";
import { db } from "@/lib/db"; 
import { dailyMetrics, foodLogs, activityLogs, userProfiles } from "@/drizzle/schema";
import { gte, lte, and } from "drizzle-orm";
import { getAnalysisGrid, saveAnalysisGrid } from "@/lib/storage"; 

// [修改] 引入 TutorialContext 中需要的 onScrollRequest 與 TutorialTarget
import { useTutorial } from '@/context/TutorialContext';
import { TutorialTarget } from '@/components/TutorialTarget';
import { getTutorialState, TUTORIAL_KEYS } from '@/lib/tutorial-storage';
import { getTutorialSteps } from '@/constants/tutorial-steps'; // [新增] 引入集中管理的步驟

const SCREEN_WIDTH = Dimensions.get("window").width;
const VISIBLE_CHART_WIDTH = SCREEN_WIDTH - 30;

type StatKey = 'avgIntake' | 'avgBurned' | 'avgNet' | 'avgBMR' | 'totalDuration' | 'totalSteps' | 'avgWeight' | 'avgBodyFat' | 'avgPro' | 'avgFat' | 'avgCarb' | 'avgSod';

const ALL_STATS: { key: StatKey; labelKey: string; unit: string; color?: string }[] = [
    { key: 'avgIntake', labelKey: 'avg_daily_intake', unit: 'kcal', color: '#34C759' },
    { key: 'avgBurned', labelKey: 'avg_burned', unit: 'kcal', color: '#FF9500' },
    { key: 'avgNet', labelKey: 'net_intake', unit: 'kcal' },
    { key: 'avgBMR', labelKey: 'avg_bmr', unit: 'kcal' },
    { key: 'totalDuration', labelKey: 'total_time', unit: 'min' },
    { key: 'totalSteps', labelKey: 'total_steps', unit: 'steps' },
    { key: 'avgWeight', labelKey: 'avg_weight', unit: 'kg', color: '#007AFF' },
    { key: 'avgBodyFat', labelKey: 'avg_body_fat', unit: '%', color: '#AF52DE' },
    { key: 'avgPro', labelKey: 'protein', unit: 'g' },
    { key: 'avgFat', labelKey: 'fat', unit: 'g' },
    { key: 'avgCarb', labelKey: 'carbs', unit: 'g' },
    { key: 'avgSod', labelKey: 'sodium', unit: 'mg' },
];

export default function AnalysisScreen() {
  const lang = useLanguage();
  const theme = {
      background: useThemeColor({}, "background"),
      card: useThemeColor({}, "cardBackground"),
      text: useThemeColor({}, "text"),
      tint: useThemeColor({}, "tint"),
      icon: useThemeColor({}, 'icon'),
      border: useThemeColor({}, 'border'),
      warn: '#FF3B30'
  };
  const secondaryColor = '#AF52DE';
  const weightColor = '#007AFF';

  // [修改] 取得導覽 Context
  // [修改] 取得導覽 Context
  const { startScenario, userName, activeScenario, onScrollRequest } = useTutorial(); // [新增] activeScenario
  
  // [新增] ScrollView Ref 與位置紀錄 (現在 useRef 已被正確引入)
  const scrollViewRef = useRef<ScrollView>(null); 
  const targetPositions = useRef<Record<string, number>>({}); 

  // [新增] 當導覽開始時，自動捲動至頂部
  useEffect(() => {
      if (activeScenario === 'ANALYSIS_GUIDE') {
          scrollViewRef.current?.scrollTo({ y: 0, animated: true });
      }
  }, [activeScenario]);

  // [修改] 使用 useFocusEffect 管理 scroll listener
  useFocusEffect(
      useCallback(() => {
          // 註冊：當導覽請求捲動時執行
          onScrollRequest((targetKey) => {
              const y = targetPositions.current[targetKey];
              if (y !== undefined && scrollViewRef.current) {
                  scrollViewRef.current.scrollTo({ y: Math.max(0, y - 50), animated: true });
              }
          });

          // 清理：離開頁面時不做任何事
          return () => {};
      }, [])
  );
  
  // [修改] 導覽觸發邏輯：改用集中管理的 Steps
  useFocusEffect(useCallback(()=>{
      async function check() {
           const seen = await getTutorialState(TUTORIAL_KEYS.HAS_SEEN_ANALYSIS);
           const isFirst = await getTutorialState(TUTORIAL_KEYS.IS_FIRST_LAUNCH); // [新增] 檢查是否為首次流程
           
           // 如果是首次安裝且未看過分析導覽 (通常由 Menu 觸發，這裡做備援)
           if (isFirst && !seen) {
               // 這裡如果想要自動觸發，可以呼叫 startScenario
               // 但通常 Analysis 是透過 Menu -> 點選 -> 跳轉 -> 觸發
               // 若要保持 Menu 點擊後的連貫性，可以檢查某個 flag 或直接依賴 Menu 的 setTimeout
           }
      }
      check();
  },[lang])); 

  const [period, setPeriod] = useState<"week" | "month" | "custom">("week");
  const [loading, setLoading] = useState(true);

  const [customStart, setCustomStart] = useState(subDays(new Date(), 7));
  const [customEnd, setCustomEnd] = useState(new Date());
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);

  const [chartData, setChartData] = useState<any[]>([]); 
  const [lineDataWeight, setLineDataWeight] = useState<any[]>([]); 
  const [lineDataFat, setLineDataFat] = useState<any[]>([]); 
  
  const [summaryValues, setSummaryValues] = useState<Record<StatKey, number>>({
      avgIntake: 0, avgBurned: 0, avgNet: 0, avgBMR: 0,
      totalDuration: 0, totalSteps: 0,
      avgWeight: 0, avgBodyFat: 0,
      avgPro: 0, avgFat: 0, avgCarb: 0, avgSod: 0
  });

  const [goals, setGoals] = useState({
      calories: 2000, protein: 0, fat: 0, carbs: 0, sodium: 2300
  });

  const [gridSlots, setGridSlots] = useState<(StatKey | null)[]>([
    'avgIntake', 'avgBurned', 'avgNet', 
    'avgWeight', 'avgBodyFat', 'totalSteps',
    'avgBMR', 'totalDuration', 'avgPro',
    'avgFat', 'avgCarb', null 
  ]);
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedSlotIndex, setSelectedSlotIndex] = useState<number | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [targetAddIndex, setTargetAddIndex] = useState<number | null>(null);

  const [axisConfig, setAxisConfig] = useState({
      maxCal: 2500, minCal: -500, maxWeight: 100, minWeight: 0
  });
  
  const [barWidth, setBarWidth] = useState(16);
  const [spacing, setSpacing] = useState(24);
  const [zoomScale, setZoomScale] = useState(1);
  const [chartScrollable, setChartScrollable] = useState(false); 

  // [Helper] 插值與縮放函數
  const interpolateAndScaleData = (dataArray: number[], color: string, scalingFactor: number) => {
      const result: any[] = [];
      const len = dataArray.length;

      // 找出所有有數值的 index
      const validIndices: number[] = [];
      dataArray.forEach((val, idx) => {
          if (val > 0) validIndices.push(idx);
      });

      if (validIndices.length === 0) {
          return dataArray.map(() => ({ value: 0, hideDataPoint: true, dataPointText: '' }));
      }

      for (let i = 0; i < len; i++) {
          const currentVal = dataArray[i];

          if (currentVal > 0) {
              // 有數值：放大 value 以匹配高度，但顯示原始數值文字
              result.push({
                  value: currentVal * scalingFactor, // [關鍵] 視覺高度放大
                  dataPointText: String(currentVal), // [關鍵] 顯示原始數值
                  textColor: color,
                  textShiftY: -6, 
                  textShiftX: i === len - 1 ? -20 : -10,
                  textFontSize: 10,
                  dataPointColor: color,
                  hideDataPoint: false
              });
          } else {
              // 無數值：計算插值並放大
              const prevIdx = validIndices.filter(idx => idx < i).pop();
              const nextIdx = validIndices.find(idx => idx > i);

              let calculatedVal = 0;

              if (prevIdx !== undefined && nextIdx !== undefined) {
                  const startVal = dataArray[prevIdx];
                  const endVal = dataArray[nextIdx];
                  const steps = nextIdx - prevIdx;
                  const stepVal = (endVal - startVal) / steps;
                  calculatedVal = startVal + (stepVal * (i - prevIdx));
              } else if (prevIdx !== undefined) {
                  calculatedVal = dataArray[prevIdx];
              } else if (nextIdx !== undefined) {
                  calculatedVal = dataArray[nextIdx];
              }

              result.push({
                  value: calculatedVal * scalingFactor, // [關鍵] 視覺高度放大
                  hideDataPoint: true, 
                  dataPointText: ''    
              });
          }
      }
      return result;
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      let startStr = "", endStr = format(new Date(), "yyyy-MM-dd");
      if (period === 'week') startStr = format(subDays(new Date(), 6), "yyyy-MM-dd");
      else if (period === 'month') startStr = format(subDays(new Date(), 29), "yyyy-MM-dd");
      else { startStr = format(customStart, "yyyy-MM-dd"); endStr = format(customEnd, "yyyy-MM-dd"); }

      const daysDiff = differenceInDays(new Date(endStr), new Date(startStr)) + 1;

      const calculatedWidth = Math.floor((VISIBLE_CHART_WIDTH - 20) / (1.6 * daysDiff - 0.6));
      const finalBarWidth = Math.max(4, Math.min(30, calculatedWidth));
      const finalSpacing = Math.max(2, Math.floor(finalBarWidth * 0.6));
      
      setBarWidth(finalBarWidth);
      setSpacing(finalSpacing);
      setZoomScale(1); 
      setChartScrollable(false); 

      const userRes = await db.select().from(userProfiles).limit(1);
      const user = userRes[0] || {};
      const baseHeight = user.heightCm || 170;
      const baseAge = user.birthDate ? (new Date().getFullYear() - new Date(user.birthDate).getFullYear()) : 30;
      const isMale = user.gender === 'male';

      const cal = user.dailyCalorieTarget || 2000;
      setGoals({
          calories: cal,
          protein: Math.round(cal * (user.proteinPercentage || 30) / 100 / 4),
          fat: Math.round(cal * (user.fatPercentage || 30) / 100 / 9),
          carbs: Math.round(cal * (user.carbsPercentage || 40) / 100 / 4),
          sodium: user.sodiumTargetMg || 2300
      });

      let logs: any[] = [];
      let acts: any[] = [];
      let metrics: any[] = [];
      
      try {
          logs = await db.select().from(foodLogs).where(and(gte(foodLogs.date, startStr), lte(foodLogs.date, endStr)));
          acts = await db.select().from(activityLogs).where(and(gte(activityLogs.date, startStr), lte(activityLogs.date, endStr)));
          metrics = await db.select().from(dailyMetrics).where(and(gte(dailyMetrics.date, startStr), lte(dailyMetrics.date, endStr)));
      } catch (dbErr) {
          console.error("DB Fetch Error (Analysis):", dbErr);
      }

      if (!logs) logs = [];
      if (!acts) acts = [];
      if (!metrics) metrics = [];

      const dateMap = new Map();
      eachDayOfInterval({ start: new Date(startStr), end: new Date(endStr) }).forEach(d => {
          dateMap.set(format(d, 'yyyy-MM-dd'), {
              date: d, intake: 0, burned: 0, pro: 0, fat: 0, carb: 0, sod: 0,
              weight: 0, bodyFat: 0, steps: 0, duration: 0,
              hasFood: false, hasAct: false, hasMetric: false
          });
      });

      logs.forEach(l => {
          const d = dateMap.get(l.date);
          if(d) {
              d.intake += l.totalCalories || 0; d.pro += l.totalProteinG || 0; d.fat += l.totalFatG || 0; d.carb += l.totalCarbsG || 0; d.sod += l.totalSodiumMg || 0;
              d.hasFood = true;
          }
      });
      acts.forEach(a => {
          const d = dateMap.get(a.date);
          if(d) {
              d.burned += a.caloriesBurned || 0; d.steps += a.steps || 0; d.duration += a.durationMinutes || 0;
              d.hasAct = true;
          }
      });
      metrics.forEach(m => {
          const d = dateMap.get(m.date);
          if(d) {
              if (m.weightKg) { d.weight = m.weightKg; d.hasMetric = true; }
              if (m.bodyFatPercentage) { d.bodyFat = m.bodyFatPercentage; }
          }
      });

      // 1. 先遍歷一次數據找出最大最小值，以決定座標軸
      let maxCal = 2000, minCal = -500;
      let minWeight = 1000, maxWeight = 60; 
      let minBodyFat = 100, maxBodyFat = 0;

      // 用來暫存數據進行統計
      const tempSortedData = Array.from(dateMap.values()).sort((a:any, b:any) => a.date.getTime() - b.date.getTime());

      tempSortedData.forEach((d: any) => {
          if (d.intake > maxCal) maxCal = d.intake;
          if (-d.burned < minCal) minCal = -d.burned;

          if (d.weight > 0) {
              if (d.weight < minWeight) minWeight = d.weight;
              if (d.weight > maxWeight) maxWeight = d.weight;
          }
           if (d.bodyFat > 0) {
              if (d.bodyFat < minBodyFat) minBodyFat = d.bodyFat;
              if (d.bodyFat > maxBodyFat) maxBodyFat = d.bodyFat;
          }
      });

      const finalMaxCal = Math.ceil(maxCal / 500) * 500;
      const finalMinCal = Math.floor(minCal / 500) * 500;
      
      const yMinW = minWeight === 1000 ? 0 : Math.max(0, Math.floor(minWeight - 5));
      const yMaxW = maxWeight === 0 ? 100 : Math.ceil(maxWeight + 5);
      
      setAxisConfig({
          maxCal: finalMaxCal, minCal: finalMinCal, 
          maxWeight: yMaxW, minWeight: yMinW
      });

      // 2. 計算縮放倍率 (Scaling Factor)
      const scalingFactor = finalMaxCal / yMaxW;

      // 3. 生成圖表數據
      const newChartData: any[] = [];
      const rawWeights: number[] = [];
      const rawBodyFats: number[] = [];
      
      let sumIntake = 0, countIntake = 0, sumBurned = 0, countBurned = 0, sumNet = 0;
      let sumBMR = 0, sumDuration = 0, sumSteps = 0;
      let sumWeight = 0, countWeight = 0, sumBodyFat = 0, countBodyFat = 0;
      let sumPro = 0, sumFat = 0, sumCarb = 0, sumSod = 0;

      tempSortedData.forEach((d: any, idx: number) => {
          rawWeights.push(d.weight || 0);
          rawBodyFats.push(d.bodyFat || 0);

          const currentWeight = d.weight || user.currentWeightKg || 60; 
          const bmr = (10 * currentWeight) + (6.25 * baseHeight) - (5 * baseAge) + (isMale ? 5 : -161);
          
          if (d.hasFood) { sumIntake += d.intake; countIntake++; sumPro += d.pro; sumFat += d.fat; sumCarb += d.carb; sumSod += d.sod; }
          if (d.hasAct) { sumBurned += d.burned; countBurned++; }
          if (d.hasFood || d.hasAct) sumNet += (d.intake - d.burned);
          sumBMR += bmr; sumDuration += d.duration; sumSteps += d.steps;
          if (d.weight > 0) { sumWeight += d.weight; countWeight++; }
          if (d.bodyFat > 0) { sumBodyFat += d.bodyFat; countBodyFat++; }

          newChartData.push({
              value: d.intake, 
              stacks: [
                  { value: d.intake, color: '#34C759', marginBottom: 1 },
                  { value: -d.burned, color: '#FF9500' }
              ],
              label: format(d.date, "MM/dd"),
              labelTextStyle: { color: '#888', fontSize: 10 },
              customData: {
                  dateStr: format(d.date, "yyyy-MM-dd"),
                  intake: d.intake, burned: d.burned, net: d.intake - d.burned,
                  weight: d.weight || '--', bodyFat: d.bodyFat || '--',
                  idx: idx,
                  totalItems: daysDiff 
              }
          });
      });

      // 4. 生成折線數據 (套用插值與縮放)
      const interpolatedWeights = interpolateAndScaleData(rawWeights, weightColor, scalingFactor);
      const interpolatedBodyFats = interpolateAndScaleData(rawBodyFats, secondaryColor, scalingFactor);

      setChartData(newChartData);
      setLineDataWeight(interpolatedWeights);
      setLineDataFat(interpolatedBodyFats);

      setSummaryValues({
          avgIntake: countIntake > 0 ? Math.round(sumIntake / countIntake) : 0,
          avgBurned: countBurned > 0 ? Math.round(sumBurned / countBurned) : 0,
          avgNet: (countIntake > 0 || countBurned > 0) ? Math.round(sumNet / Math.max(countIntake, countBurned)) : 0,
          avgBMR: Math.round(sumBMR / daysDiff),
          totalDuration: Math.round(sumDuration),
          totalSteps: Math.round(sumSteps),
          avgWeight: countWeight > 0 ? parseFloat((sumWeight / countWeight).toFixed(1)) : 0,
          avgBodyFat: countBodyFat > 0 ? parseFloat((sumBodyFat / countBodyFat).toFixed(1)) : 0,
          avgPro: countIntake > 0 ? Math.round(sumPro / countIntake) : 0,
          avgFat: countIntake > 0 ? Math.round(sumFat / countIntake) : 0,
          avgCarb: countIntake > 0 ? Math.round(sumCarb / countIntake) : 0,
          avgSod: countIntake > 0 ? Math.round(sumSod / countIntake) : 0,
      });

    } catch (e) { 
      console.error("Analysis Load Error:", e);
    } finally { 
      setLoading(false);
    }
  }, [period, customStart, customEnd]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
      const loadGridSettings = async () => {
          const savedSlots = await getAnalysisGrid();
          if (savedSlots && Array.isArray(savedSlots) && savedSlots.length > 0) {
              setGridSlots(savedSlots);
          }
      };
      loadGridSettings();
  }, []);

  const updateAndSaveGrid = (newSlots: (StatKey | null)[]) => {
      setGridSlots(newSlots);
      saveAnalysisGrid(newSlots);
  };

  const onPinchEvent = (event: any) => {
      const scale = event.nativeEvent.scale;
      if (!scale || isNaN(scale)) return;

      const newScale = Math.max(0.5, Math.min(zoomScale * scale, 3.0)); 
      
      const newBarWidth = Math.max(4, Math.min(50, barWidth * scale)); 
      const newSpacing = Math.max(2, Math.min(40, spacing * scale));
      
      setZoomScale(newScale);
      setBarWidth(newBarWidth);
      setSpacing(newSpacing);
      setChartScrollable(newScale > 1.2); 
  };

  const handleGridLongPress = () => {
      Vibration.vibrate(50);
      setIsEditMode(true);
  };

  const handleGridPress = (index: number) => {
      if (!isEditMode) return;
      if (selectedSlotIndex === null) {
          setSelectedSlotIndex(index);
      } else {
          const newSlots = [...gridSlots];
          const temp = newSlots[selectedSlotIndex];
          newSlots[selectedSlotIndex] = newSlots[index];
          newSlots[index] = temp;
          updateAndSaveGrid(newSlots);
          setSelectedSlotIndex(null); 
      }
  };

  const handleDeleteSlot = (index: number) => {
      const newSlots = [...gridSlots];
      newSlots[index] = null;
      updateAndSaveGrid(newSlots);
  };

  const selectStatToAdd = (key: StatKey) => {
      if (targetAddIndex !== null) {
          const newSlots = [...gridSlots];
          newSlots[targetAddIndex] = key;
          updateAndSaveGrid(newSlots);
          setShowAddModal(false);
          setTargetAddIndex(null);
      }
  };

  const handleAddPress = (index: number) => {
      setTargetAddIndex(index);
      setShowAddModal(true);
  };

  const onStartDateChange = (event: any, selectedDate?: Date) => {
      setShowStartDatePicker(false);
      if (selectedDate) setCustomStart(selectedDate);
  };
  const onEndDateChange = (event: any, selectedDate?: Date) => {
      setShowEndDatePicker(false);
      if (selectedDate) setCustomEnd(selectedDate);
  };

  const renderTooltip = (item: any) => {
      const d = item.customData || {};
      const total = chartData.length;
      const currentIndex = d.idx || 0;
      const isRightSide = currentIndex > (total * 0.6); 

      return (
          <View style={{
              backgroundColor: 'rgba(30,30,30,0.95)', 
              padding: 10, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
              position: 'absolute',
              right: isRightSide ? 10 : undefined, 
              left: isRightSide ? undefined : 10,  
              top: -10, 
              zIndex: 1000,
              minWidth: 130
          }}>
              <ThemedText style={{fontWeight: 'bold', color:'white', marginBottom: 6}}>{d.dateStr}</ThemedText>
              
              <View style={styles.rowBetween}>
                  <ThemedText style={[styles.ttLabel, {color:'#34C759'}]}>{t('intake', lang)}</ThemedText>
                  <ThemedText style={styles.ttVal}>{Math.round(d.intake)}</ThemedText>
              </View>
              
              <View style={styles.rowBetween}>
                  <ThemedText style={[styles.ttLabel, {color:'#FF9500'}]}>{t('burned', lang)}</ThemedText>
                  <ThemedText style={styles.ttVal}>{Math.round(d.burned)}</ThemedText>
              </View>
              
              <View style={styles.rowBetween}>
                  <ThemedText style={[styles.ttLabel, {color:'#ccc'}]}>{t('net_intake', lang)}</ThemedText>
                  <ThemedText style={styles.ttVal}>{Math.round(d.net)}</ThemedText>
              </View>
              
              <View style={{height:1, backgroundColor:'#555', marginVertical:4}}/>
              
              <View style={styles.rowBetween}>
                  <ThemedText style={[styles.ttLabel, {color:theme.tint}]}>{t('weight', lang)}</ThemedText>
                  <ThemedText style={styles.ttVal}>{d.weight} kg</ThemedText>
              </View>
              
              <View style={styles.rowBetween}>
                  <ThemedText style={[styles.ttLabel, {color:secondaryColor}]}>{t('body_fat', lang)}</ThemedText>
                  <ThemedText style={styles.ttVal}>{d.bodyFat} %</ThemedText>
              </View>
          </View>
      );
  };

  const renderGridItem = (key: StatKey | null, index: number) => {
      const statDef = key ? ALL_STATS.find(s => s.key === key) : null;
      const val = key ? summaryValues[key] : 0;
      const isSelected = selectedSlotIndex === index;

      let isOver = false;
      if (key === 'avgIntake' && goals.calories > 0 && val > goals.calories) isOver = true;
      if (key === 'avgPro' && goals.protein > 0 && val > goals.protein) isOver = true;
      if (key === 'avgFat' && goals.fat > 0 && val > goals.fat) isOver = true;
      if (key === 'avgCarb' && goals.carbs > 0 && val > goals.carbs) isOver = true;
      if (key === 'avgSod' && goals.sodium > 0 && val > goals.sodium) isOver = true;

      return (
          <Pressable 
            key={index} 
            style={[
                styles.gridItem, 
                { backgroundColor: theme.card, borderColor: isSelected ? theme.tint : 'transparent', borderWidth: isSelected ? 2 : 0 },
                isEditMode && { opacity: 0.9 } 
            ]}
            onLongPress={handleGridLongPress}
            onPress={() => handleGridPress(index)}
            delayLongPress={300}
          >
              {isEditMode && key && (
                  <TouchableOpacity style={styles.deleteBadge} onPress={() => handleDeleteSlot(index)}>
                      <Ionicons name="close" size={12} color="white" />
                  </TouchableOpacity>
              )}
              
              {key && statDef ? (
                  <>
                    <ThemedText style={{fontSize: 10, color: '#888', marginBottom: 4}}>{t(statDef.labelKey, lang) || statDef.labelKey}</ThemedText>
                    <View style={{flexDirection: 'row', alignItems: 'baseline'}}>
                        <ThemedText style={{fontSize: 15, fontWeight: 'bold', color: isOver ? theme.warn : (statDef.color || theme.text)}}>{val}</ThemedText>
                        <ThemedText style={{fontSize: 9, marginLeft: 2, color: '#888'}}>{statDef.unit}</ThemedText>
                    </View>
                  </>
              ) : (
                  isEditMode ? (
                      <TouchableOpacity onPress={() => handleAddPress(index)} style={{flex:1, justifyContent:'center', alignItems:'center'}}>
                          <Ionicons name="add-circle" size={32} color="#34C759" />
                      </TouchableOpacity>
                  ) : <View />
              )}
          </Pressable>
      );
  };

  const renderCustomRangePicker = () => {
      if (period !== 'custom') return null;
      return (
          <View style={{flexDirection:'row', justifyContent:'center', alignItems:'center', marginBottom: 16}}>
              <TouchableOpacity onPress={()=>setShowStartDatePicker(true)} style={[styles.dateBtn, {borderColor: theme.text}]}>
                  <ThemedText>{format(customStart, "yyyy-MM-dd")}</ThemedText>
              </TouchableOpacity>
              <ThemedText style={{marginHorizontal: 8}}>-</ThemedText>
              <TouchableOpacity onPress={()=>setShowEndDatePicker(true)} style={[styles.dateBtn, {borderColor: theme.text}]}>
                  <ThemedText>{format(customEnd, "yyyy-MM-dd")}</ThemedText>
              </TouchableOpacity>
              
              {showStartDatePicker && <DateTimePicker value={customStart} mode="date" onChange={onStartDateChange} />}
              {showEndDatePicker && <DateTimePicker value={customEnd} mode="date" onChange={onEndDateChange} />}
          </View>
      );
  };

  if (loading) return <View style={[styles.container, {backgroundColor: theme.background, justifyContent:'center', alignItems:'center'}]}><ActivityIndicator /></View>;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView ref={scrollViewRef} contentContainerStyle={{padding: 16}} scrollEnabled={true}>
        <View style={{flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom: 16}}>
              <ThemedText type="title">{t('analysis', lang)}</ThemedText>
              {isEditMode && (
                  <TouchableOpacity onPress={() => { setIsEditMode(false); setSelectedSlotIndex(null); }} style={{backgroundColor: theme.tint, paddingHorizontal:12, paddingVertical:6, borderRadius:16}}>
                      <ThemedText style={{color:'white', fontWeight:'bold', fontSize:12}}>{t('done', lang)}</ThemedText>
                  </TouchableOpacity>
              )}
        </View>
        
        {/* 2. 週期選擇區塊 (analysis_period) */}
        <TutorialTarget targetKey="analysis_period" onMeasure={(y) => targetPositions.current['analysis_period'] = y} adjustment={{offsetY: 100}}>
            <View style={{flexDirection:'row', backgroundColor: theme.card, padding:4, borderRadius:8, marginBottom:16}}>
                {['week', 'month', 'custom'].map((p) => (
                    <TouchableOpacity key={p} onPress={() => setPeriod(p as any)} style={{flex: 1, paddingVertical: 6, alignItems:'center', borderRadius:6, backgroundColor: period === p ? theme.tint : 'transparent'}}>
                        <ThemedText style={{fontSize:12, fontWeight:'bold', color: period === p ? 'white' : theme.text}}>
                            {p === 'week' ? t('last_7_days', lang) : (p === 'month' ? t('last_30_days', lang) : t('custom', lang))}
                        </ThemedText>
                    </TouchableOpacity>
                ))}
            </View>
        </TutorialTarget>

        {/* 3. 日期範圍區塊 (analysis_range) */}
        <TutorialTarget targetKey="analysis_range" onMeasure={(y) => targetPositions.current['analysis_range'] = y} adjustment={{offsetY: 100}}>
            {renderCustomRangePicker()}
        </TutorialTarget>

        {isEditMode && <ThemedText style={{fontSize:12, color:'#FF9500', marginBottom:8, textAlign:'center'}}>{t('tap_msg', lang)}</ThemedText>}
        
        {/* 4. 統計數據區塊 (analysis_grid) */}
        <TutorialTarget targetKey="analysis_grid" onMeasure={(y) => targetPositions.current['analysis_grid'] = y} adjustment={{offsetY: 0}}>
            <View style={{flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 16}}>
                {gridSlots.map((key, index) => renderGridItem(key, index))}
            </View>
        </TutorialTarget>

        {/* 5. 趨勢圖表區塊 (analysis_chart) */}
        <TutorialTarget targetKey="analysis_chart" onMeasure={(y) => targetPositions.current['analysis_chart'] = y} adjustment={{offsetY: -50}}>
            <ThemedView style={[styles.chartCard, { backgroundColor: theme.card }]}>
                <View style={{flexDirection:'row', justifyContent:'space-between', marginBottom: 16}}>
                    <ThemedText type="subtitle">{t('trend_analysis', lang)}</ThemedText>
                    <View style={{flexDirection:'row', gap: 8, flexWrap:'wrap', justifyContent:'flex-end', flex:1}}>
                        <View style={{flexDirection:'row', alignItems:'center'}}><View style={{width:8, height:8, backgroundColor:'#34C759', marginRight:4}}/><ThemedText style={{fontSize:10}}>{t('intake', lang)}</ThemedText></View>
                        <View style={{flexDirection:'row', alignItems:'center'}}><View style={{width:8, height:8, backgroundColor:'#FF9500', marginRight:4}}/><ThemedText style={{fontSize:10}}>{t('burned', lang)}</ThemedText></View>
                        <View style={{flexDirection:'row', alignItems:'center'}}><View style={{width:8, height:2, backgroundColor:weightColor, marginRight:4}}/><ThemedText style={{fontSize:10}}>{t('weight', lang)}</ThemedText></View>
                        <View style={{flexDirection:'row', alignItems:'center'}}><View style={{width:8, height:2, backgroundColor:secondaryColor, marginRight:4}}/><ThemedText style={{fontSize:10}}>{t('body_fat', lang)}</ThemedText></View>
                    </View>
                </View>

                {chartData.length > 0 ? (
                    <PinchGestureHandler onGestureEvent={onPinchEvent} onHandlerStateChange={onPinchEvent}>
                        <View>
                            <BarChart 
                                stackData={chartData}
                                barWidth={barWidth}
                                spacing={spacing}
                                initialSpacing={10}
                                noOfSections={5}
                                
                                yAxisThickness={0}
                                yAxisTextStyle={{color: theme.text, fontSize: 10}} 
                                maxValue={axisConfig.maxCal}
                                minValue={axisConfig.minCal}
                                
                                showSecondaryYAxis
                                secondaryYAxisConfig={{
                                    showYAxisIndices: true,
                                    yAxisTextStyle: {color: weightColor, fontSize: 10},
                                    maxValue: axisConfig.maxWeight,
                                    minValue: axisConfig.minWeight,
                                    noOfSections: 5,
                                }}

                                showLine
                                connectPoints={true} 
                                
                                lineData={lineDataWeight}
                                lineConfig={{ 
                                    color: weightColor, 
                                    thickness: 3, 
                                    curved: false, 
                                    hideDataPoints: false, 
                                    dataPointsColor: weightColor,
                                    textFontSize: 10, 
                                    textShiftY: -12, 
                                    textColor: weightColor, 
                                }}
                                
                                lineData2={lineDataFat}
                                lineConfig2={{ 
                                    color: secondaryColor, 
                                    thickness: 3, 
                                    curved: false, 
                                    hideDataPoints: false, 
                                    dataPointsColor: secondaryColor, 
                                    textFontSize: 10, 
                                    textShiftY: -12, 
                                    textColor: secondaryColor, 
                                }}
                                
                                xAxisThickness={1}
                                xAxisColor={theme.border} 
                                rulesColor={theme.border} 
                                rulesType="solid"
                                height={280}
                                width={VISIBLE_CHART_WIDTH}
                                scrollable={chartScrollable}
                                renderTooltip={renderTooltip}
                            />
                            <View style={{marginTop: 10, alignItems: 'center'}}>
                                <ThemedText style={{fontSize: 10, color: '#888'}}>
                                    {t('pinch_to_zoom', lang)} • {t('drag_to_move', lang)}
                                </ThemedText>
                            </View>
                        </View>
                    </PinchGestureHandler>
                ) : <ThemedText>No Data</ThemedText>}
            </ThemedView>
        </TutorialTarget>
        
        <Modal visible={showAddModal} transparent animationType="fade" onRequestClose={()=>setShowAddModal(false)}>
            <View style={styles.modalOverlay}>
                <View style={[styles.modalContent, {backgroundColor: theme.card}]}>
                    <ThemedText type="subtitle" style={{marginBottom:16}}>Add Statistic</ThemedText>
                    <ScrollView style={{maxHeight: 300}}>
                        {ALL_STATS.filter(s => !gridSlots.includes(s.key)).map(s => (
                            <TouchableOpacity key={s.key} onPress={() => selectStatToAdd(s.key)} style={{padding: 12, borderBottomWidth:1, borderColor:'#eee'}}>
                                <ThemedText>{t(s.labelKey, lang) || s.labelKey}</ThemedText>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                    <TouchableOpacity onPress={()=>setShowAddModal(false)} style={{marginTop:16, alignItems:'center'}}><ThemedText style={{color:theme.tint}}>Cancel</ThemedText></TouchableOpacity>
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
  chartCard: { padding: 16, borderRadius: 16, marginBottom: 16, overflow: 'hidden' },
  dateBtn: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  tooltipRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 },
  ttLabel: { fontSize:11 },
  ttVal: { fontSize:11, color:'white' },
  gridItem: { width: '32%', padding: 10, borderRadius: 12, marginBottom: 8, minHeight: 60, justifyContent: 'center' },
  deleteBadge: { position:'absolute', top:-6, right:-6, backgroundColor:'red', borderRadius:10, width:20, height:20, justifyContent:'center', alignItems:'center', zIndex:10 },
  rowBetween: { flexDirection:'row', justifyContent:'space-between'},
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 30 },
  modalContent: { padding: 20, borderRadius: 16 }
});