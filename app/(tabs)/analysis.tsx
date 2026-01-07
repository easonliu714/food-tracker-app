import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { ScrollView, StyleSheet, View, Dimensions, TouchableOpacity, ActivityIndicator, Modal, Pressable, Alert, Vibration } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BarChart } from "react-native-gifted-charts";
import { format, subDays, addDays, differenceInDays, eachDayOfInterval } from "date-fns";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import { GestureHandlerRootView, PinchGestureHandler, State } from "react-native-gesture-handler";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useThemeColor } from "@/hooks/use-theme-color";
import { t, useLanguage } from "@/lib/i18n";
import { db } from "@/lib/db"; 
import { dailyMetrics, foodLogs, activityLogs, userProfiles } from "@/drizzle/schema";
import { desc, gte, lte, and } from "drizzle-orm";
// [新增] 引入存取函式
import { getAnalysisGrid, saveAnalysisGrid } from "@/lib/storage"; 

const SCREEN_WIDTH = Dimensions.get("window").width;
const VISIBLE_CHART_WIDTH = SCREEN_WIDTH - 32; // Card padding * 2

// 定義所有可用的統計項目
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
      icon: useThemeColor({}, "icon"),
      warn: '#FF3B30'
  };
  const secondaryColor = '#AF52DE'; // 體脂顏色 (紫色)
  const weightColor = '#007AFF';    // [新增] 體重顏色 (藍色)，確保與統計表一致

  // 週期狀態
  const [period, setPeriod] = useState<"week" | "month" | "custom">("week");
  const [loading, setLoading] = useState(true);

  // 自訂日期範圍狀態
  const [customStart, setCustomStart] = useState(subDays(new Date(), 7));
  const [customEnd, setCustomEnd] = useState(new Date());
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);

  // 數據狀態
  const [chartData, setChartData] = useState<any[]>([]); 
  const [lineDataWeight, setLineDataWeight] = useState<any[]>([]); 
  const [lineDataFat, setLineDataFat] = useState<any[]>([]); 
  
  // 統計數值
  const [summaryValues, setSummaryValues] = useState<Record<StatKey, number>>({
      avgIntake: 0, avgBurned: 0, avgNet: 0, avgBMR: 0,
      totalDuration: 0, totalSteps: 0,
      avgWeight: 0, avgBodyFat: 0,
      avgPro: 0, avgFat: 0, avgCarb: 0, avgSod: 0
  });

  // [修改] Grid System State
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

  // 座標軸與圖表設定
  const [axisConfig, setAxisConfig] = useState({
      maxCal: 2500, minCal: -500, maxWeight: 100, yAxisLabelTexts: ['0', '25', '50', '75', '100']
  });
  
  // 圖表縮放 (Fit to Screen)
  const [barWidth, setBarWidth] = useState(16);
  const [spacing, setSpacing] = useState(24);
  const [zoomScale, setZoomScale] = useState(1);
  const [chartScrollable, setChartScrollable] = useState(false); 

  // 載入數據
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      let startStr = "", endStr = format(new Date(), "yyyy-MM-dd");
      if (period === 'week') startStr = format(subDays(new Date(), 6), "yyyy-MM-dd");
      else if (period === 'month') startStr = format(subDays(new Date(), 29), "yyyy-MM-dd");
      else { startStr = format(customStart, "yyyy-MM-dd"); endStr = format(customEnd, "yyyy-MM-dd"); }

      const daysDiff = differenceInDays(new Date(endStr), new Date(startStr)) + 1;

      // Fit to Screen 計算 (自動調整寬度以塞入所有天數)
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

      const logs = await db.select().from(foodLogs).where(and(gte(foodLogs.date, startStr), lte(foodLogs.date, endStr)));
      const acts = await db.select().from(activityLogs).where(and(gte(activityLogs.date, startStr), lte(activityLogs.date, endStr)));
      const metrics = await db.select().from(dailyMetrics).where(and(gte(dailyMetrics.date, startStr), lte(dailyMetrics.date, endStr)));

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

      const newChartData = [];
      const wData = [];
      const fData = [];
      
      let maxCal = 2000, minCal = -500, maxWeight = 80;
      let sumIntake = 0, countIntake = 0, sumBurned = 0, countBurned = 0, sumNet = 0;
      let sumBMR = 0, sumDuration = 0, sumSteps = 0;
      let sumWeight = 0, countWeight = 0, sumBodyFat = 0, countBodyFat = 0;
      let sumPro = 0, sumFat = 0, sumCarb = 0, sumSod = 0;

      const sortedData = Array.from(dateMap.values()).sort((a:any, b:any) => a.date.getTime() - b.date.getTime());
      
      let lastWeight = user.currentWeightKg || 60;
      const interpolatedWeights = sortedData.map(d => {
          if (d.weight > 0) lastWeight = d.weight;
          return lastWeight;
      });

      sortedData.forEach((d: any, idx: number) => {
          if (d.intake > maxCal) maxCal = d.intake;
          if (-d.burned < minCal) minCal = -d.burned;
          if (d.weight > maxWeight) maxWeight = d.weight;

          const currentWeight = d.weight || interpolatedWeights[idx];
          const bmr = (10 * currentWeight) + (6.25 * baseHeight) - (5 * baseAge) + (isMale ? 5 : -161);
          
          if (d.hasFood) { sumIntake += d.intake; countIntake++; sumPro += d.pro; sumFat += d.fat; sumCarb += d.carb; sumSod += d.sod; }
          if (d.hasAct) { sumBurned += d.burned; countBurned++; }
          if (d.hasFood || d.hasAct) sumNet += (d.intake - d.burned);
          sumBMR += bmr; sumDuration += d.duration; sumSteps += d.steps;
          if (d.weight > 0) { sumWeight += d.weight; countWeight++; }
          if (d.bodyFat > 0) { sumBodyFat += d.bodyFat; countBodyFat++; }

          newChartData.push({
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

      const finalMaxCal = Math.ceil(maxCal / 500) * 500;
      const finalMinCal = Math.floor(minCal / 500) * 500;
      const finalMaxWeight = Math.ceil((maxWeight + 10) / 10) * 10;
      const factor = (finalMaxCal - 0) / finalMaxWeight;

      setAxisConfig({
          maxCal: finalMaxCal, minCal: finalMinCal, maxWeight: finalMaxWeight,
          yAxisLabelTexts: ['0', Math.round(finalMaxWeight*0.25).toString(), Math.round(finalMaxWeight*0.5).toString(), Math.round(finalMaxWeight*0.75).toString(), Math.round(finalMaxWeight).toString()]
      });

      // [修改] 取得最後一筆資料的索引
      const lastIndex = sortedData.length - 1;

      sortedData.forEach((d: any, i: number) => {
          // [修改] 如果是最後一筆資料，將文字向左移 20 單位，避免被截斷
          const textShiftX = i === lastIndex ? -20 : 0;

          // 處理體重 (wData)
          if (d.weight > 0) {
              wData.push({ 
                  value: d.weight * factor, 
                  dataPointText: String(d.weight), 
                  textShiftX: textShiftX, // 套用位移
                  customData: { val: d.weight }
              });
          }
          else {
              wData.push({ value: interpolatedWeights[i] * factor, hideDataPoint: true });
          }

          // 處理體脂 (fData)
          if (d.bodyFat > 0) {
              fData.push({ 
                  value: d.bodyFat * factor, 
                  dataPointText: String(d.bodyFat), 
                  textColor: secondaryColor,
                  textShiftX: textShiftX // 套用位移
              });
          }
          else {
              const lastFat = fData.length > 0 ? fData[fData.length-1].value : 0;
              fData.push({ value: lastFat, hideDataPoint: true });
          }
      });

      setChartData(newChartData);
      setLineDataWeight(wData);
      setLineDataFat(fData);

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

    } catch (e) { console.error(e); } finally { setLoading(false); }
  }, [period, customStart, customEnd]);

  // [新增] 畫面載入時，讀取已儲存的佈局
  useEffect(() => {
      const loadGridSettings = async () => {
          const savedSlots = await getAnalysisGrid();
          if (savedSlots && Array.isArray(savedSlots) && savedSlots.length > 0) {
              setGridSlots(savedSlots);
          }
      };
      loadGridSettings();
  }, []);

  // [新增] 封裝儲存邏輯的 Helper
  const updateAndSaveGrid = (newSlots: (StatKey | null)[]) => {
      setGridSlots(newSlots);
      saveAnalysisGrid(newSlots); // 自動儲存
  };

  // Zoom Logic
  const onPinchEvent = (event: any) => {
      const scale = event.nativeEvent.scale;
      const newScale = Math.max(1, Math.min(zoomScale * scale, 3.0)); 
      setZoomScale(newScale);
      setBarWidth(Math.max(barWidth * newScale, 4));
      setSpacing(Math.max(spacing * newScale, 2));
      setChartScrollable(newScale > 1.1);
  };

  // Grid Interactions
  const handleGridLongPress = () => {
      Vibration.vibrate(50);
      setIsEditMode(true);
  };

  // [修改] Grid Interactions - 交換位置
  const handleGridPress = (index: number) => {
      if (!isEditMode) return;
      if (selectedSlotIndex === null) {
          setSelectedSlotIndex(index);
      } else {
          const newSlots = [...gridSlots];
          const temp = newSlots[selectedSlotIndex];
          newSlots[selectedSlotIndex] = newSlots[index];
          newSlots[index] = temp;
          updateAndSaveGrid(newSlots); // [修改] 使用封裝函式
          setSelectedSlotIndex(null); 
      }
  };

  // [修改] 刪除方塊
  const handleDeleteSlot = (index: number) => {
      const newSlots = [...gridSlots];
      newSlots[index] = null;
      updateAndSaveGrid(newSlots); // [修改] 使用封裝函式
  };

  // [修改] 新增方塊
  const selectStatToAdd = (key: StatKey) => {
      if (targetAddIndex !== null) {
          const newSlots = [...gridSlots];
          newSlots[targetAddIndex] = key;
          updateAndSaveGrid(newSlots); // [修改] 使用封裝函式
          setShowAddModal(false);
          setTargetAddIndex(null);
      }
  };

  const selectStatToAdd = (key: StatKey) => {
      if (targetAddIndex !== null) {
          const newSlots = [...gridSlots];
          newSlots[targetAddIndex] = key;
          setGridSlots(newSlots);
          setShowAddModal(false);
          setTargetAddIndex(null);
      }
  };

  // Date Pickers
  const onStartDateChange = (event: any, selectedDate?: Date) => {
      setShowStartDatePicker(false);
      if (selectedDate) setCustomStart(selectedDate);
  };
  const onEndDateChange = (event: any, selectedDate?: Date) => {
      setShowEndDatePicker(false);
      if (selectedDate) setCustomEnd(selectedDate);
  };

  // Renderers
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
              <View style={styles.rowBetween}><ThemedText style={styles.ttLabel} style={{color:'#34C759'}}>{t('intake', lang)}</ThemedText><ThemedText style={styles.ttVal}>{Math.round(d.intake)}</ThemedText></View>
              <View style={styles.rowBetween}><ThemedText style={styles.ttLabel} style={{color:'#FF9500'}}>{t('burned', lang)}</ThemedText><ThemedText style={styles.ttVal}>{Math.round(d.burned)}</ThemedText></View>
              <View style={styles.rowBetween}><ThemedText style={styles.ttLabel} style={{color:'#ccc'}}>{t('net_intake', lang)}</ThemedText><ThemedText style={styles.ttVal}>{Math.round(d.net)}</ThemedText></View>
              <View style={{height:1, backgroundColor:'#555', marginVertical:4}}/>
              <View style={styles.rowBetween}><ThemedText style={styles.ttLabel} style={{color:theme.tint}}>{t('weight', lang)}</ThemedText><ThemedText style={styles.ttVal}>{d.weight} kg</ThemedText></View>
              <View style={styles.rowBetween}><ThemedText style={styles.ttLabel} style={{color:secondaryColor}}>{t('body_fat', lang)}</ThemedText><ThemedText style={styles.ttVal}>{d.bodyFat} %</ThemedText></View>
          </View>
      );
  };

  const renderGridItem = (key: StatKey | null, index: number) => {
      const statDef = key ? ALL_STATS.find(s => s.key === key) : null;
      const val = key ? summaryValues[key] : null;
      const isSelected = selectedSlotIndex === index;

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
                        <ThemedText style={{fontSize: 15, fontWeight: 'bold', color: statDef.color || theme.text}}>{val}</ThemedText>
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

  // [NEW] 補回遺漏的自訂區間選擇器
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
      <ScrollView contentContainerStyle={{padding: 16}} scrollEnabled={true}>
        {/* Header */}
        <View style={{flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom: 16}}>
             <ThemedText type="title">{t('analysis', lang)}</ThemedText>
             {isEditMode && (
                 <TouchableOpacity onPress={() => { setIsEditMode(false); setSelectedSlotIndex(null); }} style={{backgroundColor: theme.tint, paddingHorizontal:12, paddingVertical:6, borderRadius:16}}>
                     <ThemedText style={{color:'white', fontWeight:'bold', fontSize:12}}>{t('done', lang)}</ThemedText>
                 </TouchableOpacity>
             )}
        </View>
        
        {/* Period Selector */}
        <View style={{flexDirection:'row', backgroundColor: theme.card, padding:4, borderRadius:8, marginBottom:16}}>
            {['week', 'month', 'custom'].map((p) => (
                <TouchableOpacity key={p} onPress={() => setPeriod(p as any)} style={{flex: 1, paddingVertical: 6, alignItems:'center', borderRadius:6, backgroundColor: period === p ? theme.tint : 'transparent'}}>
                    <ThemedText style={{fontSize:12, fontWeight:'bold', color: period === p ? 'white' : theme.text}}>
                        {p === 'week' ? t('last_7_days', lang) : (p === 'month' ? t('last_30_days', lang) : t('custom', lang))}
                    </ThemedText>
                </TouchableOpacity>
            ))}
        </View>

        {/* [Fixed] 補回 Custom Date Picker */}
        {renderCustomRangePicker()}

        {/* 1. 統計方塊區 (Grid System) */}
        {isEditMode && <ThemedText style={{fontSize:12, color:'#FF9500', marginBottom:8, textAlign:'center'}}>{t('tap_msg', lang)}</ThemedText>}
        <View style={{flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 16}}>
            {gridSlots.map((key, index) => renderGridItem(key, index))}
        </View>

        {/* 2. 整合圖表 */}
        <ThemedView style={styles.chartCard}>
            <View style={{flexDirection:'row', justifyContent:'space-between', marginBottom: 16}}>
                <ThemedText type="subtitle">{t('trend_analysis', lang)}</ThemedText>
                <View style={{flexDirection:'row', gap: 8, flexWrap:'wrap', justifyContent:'flex-end', flex:1}}>
                    <View style={{flexDirection:'row', alignItems:'center'}}><View style={{width:8, height:8, backgroundColor:'#34C759', marginRight:4}}/><ThemedText style={{fontSize:10}}>{t('intake', lang)}</ThemedText></View>
                    <View style={{flexDirection:'row', alignItems:'center'}}><View style={{width:8, height:8, backgroundColor:'#FF9500', marginRight:4}}/><ThemedText style={{fontSize:10}}>{t('burned', lang)}</ThemedText></View>
                    {/* [修改] 圖例顏色改為 weightColor (藍色) */}
                    <View style={{flexDirection:'row', alignItems:'center'}}><View style={{width:8, height:2, backgroundColor:weightColor, marginRight:4}}/><ThemedText style={{fontSize:10}}>{t('weight', lang)}</ThemedText></View>
                    <View style={{flexDirection:'row', alignItems:'center'}}><View style={{width:8, height:2, backgroundColor:secondaryColor, marginRight:4}}/><ThemedText style={{fontSize:10}}>{t('body_fat', lang)}</ThemedText></View>
                </View>
            </View>

            {chartData.length > 0 ? (
                <PinchGestureHandler onGestureEvent={onPinchEvent} onHandlerStateChange={onPinchEvent}>
                    <View>
                        <BarChart 
                            data={chartData}
                            stackData={chartData}
                            barWidth={barWidth}
                            spacing={spacing}
                            initialSpacing={10}
                            noOfSections={5}
                            
                            yAxisThickness={0}
                            yAxisTextStyle={{color: '#888', fontSize: 10}}
                            maxValue={axisConfig.maxCal}
                            minValue={axisConfig.minCal}
                            
                            showSecondaryYAxis
                            secondaryYAxisConfig={{
                                showYAxisIndices: true,
                                yAxisTextStyle: {color: weightColor, fontSize: 10}, // [修改] 右軸文字改為藍色
                                maxValue: axisConfig.maxWeight,
                                noOfSections: 5,
                                yAxisLabelTexts: axisConfig.yAxisLabelTexts
                            }}

                            showLine
                            lineData={lineDataWeight}
                            lineConfig={{ 
                                color: weightColor, // [修改] 線條顏色改為藍色
                                thickness: 2, 
                                curved: true, 
                                hideDataPoints: barWidth < 10, 
                                dataPointsColor: weightColor, // [修改] 數據點顏色改為藍色
                                textFontSize: 9, 
                                textShiftY: -10, 
                                textColor: weightColor, // [修改] 數據文字顏色改為藍色
                                zIndex: 10, 
                                isSecondary: true 
                            }}
                            
                            lineData2={lineDataFat}
                            lineConfig2={{ color: secondaryColor, thickness: 2, curved: true, hideDataPoints: barWidth < 10, dataPointsColor: secondaryColor, textFontSize: 9, textShiftY: 10, textColor: secondaryColor, zIndex: 10, isSecondary: true }}
                            
                            xAxisThickness={1}
                            xAxisColor={'#ddd'}
                            rulesColor={'#eee'}
                            rulesType="solid"
                            height={280}
                            width={VISIBLE_CHART_WIDTH} // 固定寬度
                            scrollable={chartScrollable} //控制是否可滾動
                            renderTooltip={renderTooltip}
                        />
                    </View>
                </PinchGestureHandler>
            ) : <ThemedText>No Data</ThemedText>}
        </ThemedView>

        {/* Modal: Add Stat */}
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
  chartCard: { padding: 16, borderRadius: 16, marginBottom: 16, backgroundColor: 'white', overflow: 'hidden' },
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
