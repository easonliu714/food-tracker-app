import React, { useState, useCallback } from "react";
import { View, ScrollView, StyleSheet, Dimensions, ActivityIndicator, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ThemedText } from "@/components/themed-text";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { BarChart, LineChart } from "react-native-gifted-charts";
import { useFocusEffect } from "expo-router";
import { db } from "@/lib/db";
import { foodLogs, dailyMetrics, activityLogs } from "@/drizzle/schema";
import { gte, lte } from "drizzle-orm";
import { format, subDays, eachDayOfInterval, startOfDay, endOfDay } from "date-fns";
import { t, useLanguage } from "@/lib/i18n";

const SCREEN_WIDTH = Dimensions.get("window").width;

export default function AnalysisScreen() {
  const theme = Colors[useColorScheme() ?? "light"];
  const lang = useLanguage();
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<7 | 30>(7);
  
  const [calData, setCalData] = useState<any[]>([]);
  const [weightData, setWeightData] = useState<any[]>([]);
  const [bfData, setBfData] = useState<any[]>([]); 
  const [summary, setSummary] = useState({ avgIn: 0, avgOut: 0, avgPro: 0, avgFat: 0, avgCarb: 0, avgSod: 0 });

  useFocusEffect(
    useCallback(() => { loadAnalysis(period); }, [period])
  );

  const loadAnalysis = async (days: number) => {
      setLoading(true);
      try {
          const endDate = new Date(); // 今天
          const startDate = subDays(endDate, days - 1);
          
          // [修正] 使用完整的日期區間生成 Key，確保最近日期（今天）有被包含
          const dateRange = eachDayOfInterval({ start: startDate, end: endDate });
          const strStart = format(startDate, 'yyyy-MM-dd');
          const strEnd = format(endDate, 'yyyy-MM-dd'); // 確保查詢包含到今天結束

          // 初始化 Map
          const dataMap = new Map();
          dateRange.forEach(d => {
              const k = format(d, 'yyyy-MM-dd');
              const showLabel = days === 7 || d.getDate() % 5 === 0;
              dataMap.set(k, { 
                  in: 0, out: 0, pro: 0, fat: 0, carb: 0, sod: 0, 
                  w: null, bf: null, // [修正] 預設為 null，避免補 0
                  hasData: false, // 標記是否有數據，用於平均計算
                  label: showLabel ? format(d, 'MM/dd') : '' 
              });
          });

          // Fetch Data with Range
          const logs = await db.select().from(foodLogs).where(gte(foodLogs.date, strStart));
          const acts = await db.select().from(activityLogs).where(gte(activityLogs.date, strStart));
          const metrics = await db.select().from(dailyMetrics).where(gte(dailyMetrics.date, strStart));

          // Fill Data
          const activeDays = new Set();
          
          logs.forEach(l => {
              if (dataMap.has(l.date)) {
                  activeDays.add(l.date);
                  const d = dataMap.get(l.date);
                  d.in += l.totalCalories || 0;
                  d.pro += l.totalProteinG || 0;
                  d.fat += l.totalFatG || 0;
                  d.carb += l.totalCarbsG || 0;
                  d.sod += l.totalSodiumMg || 0;
                  d.hasData = true;
              }
          });
          
          acts.forEach(a => {
              if (dataMap.has(a.date)) {
                  activeDays.add(a.date);
                  const d = dataMap.get(a.date);
                  d.out += a.caloriesBurned || 0; 
                  d.hasData = true;
              }
          });

          metrics.forEach(m => {
              if (dataMap.has(m.date)) {
                  const d = dataMap.get(m.date);
                  if (m.weightKg) { d.w = m.weightKg; activeDays.add(m.date); }
                  if (m.bodyFatPercentage) { d.bf = m.bodyFatPercentage; activeDays.add(m.date); }
              }
          });

          const chartArr = Array.from(dataMap.values());

          // 1. 熱量堆疊圖 (修正：消耗顯示為負數)
          const stackData = chartArr.map(d => ({
              label: d.label,
              stacks: [
                  { value: d.in, color: '#34C759', marginBottom: 2 },
                  { value: -(d.out), color: '#FF9500' }, // [修正] 負數
              ],
              frontColor: 'transparent',
          }));
          setCalData(stackData);

          // 2. 體重體脂圖 (修正：無數據不補0)
          const wArr = chartArr.map(d => ({ 
              value: d.w, // 若為 null，GiftedCharts 預設行為通常是斷點或略過，不會畫成 0
              label: d.label, 
              hideDataPoint: d.w === null 
          }));
          const bfArr = chartArr.map(d => ({ 
              value: d.bf, 
              hideDataPoint: d.bf === null 
          }));
          
          setWeightData(wArr);
          setBfData(bfArr);

          // Summary (修正：分母為有效天數)
          const validInDays = chartArr.filter(d => d.in > 0).length || 1;
          const validOutDays = chartArr.filter(d => d.out > 0).length || 1;
          const validMacroDays = chartArr.filter(d => d.hasData).length || 1;

          const sum = chartArr.reduce((acc, cur) => ({
              avgIn: acc.avgIn + cur.in, avgOut: acc.avgOut + cur.out,
              avgPro: acc.avgPro + cur.pro, avgFat: acc.avgFat + cur.fat,
              avgCarb: acc.avgCarb + cur.carb, avgSod: acc.avgSod + cur.sod
          }), { avgIn:0, avgOut:0, avgPro:0, avgFat:0, avgCarb:0, avgSod:0 });

          setSummary({
              avgIn: Math.round(sum.avgIn / validInDays),
              avgOut: Math.round(sum.avgOut / validOutDays),
              avgPro: Math.round(sum.avgPro / validMacroDays),
              avgFat: Math.round(sum.avgFat / validMacroDays),
              avgCarb: Math.round(sum.avgCarb / validMacroDays),
              avgSod: Math.round(sum.avgSod / validMacroDays),
          });

      } catch(e) { console.error(e); } finally { setLoading(false); }
  };

  // [修正] 共用圖表參數，確保 X 軸寬度一致
  const chartWidth = SCREEN_WIDTH - 60;
  const barWidth = period === 7 ? 20 : 6;
  const spacing = period === 7 ? 30 : 10; 

  return (
    <SafeAreaView style={[styles.container, {backgroundColor: theme.background}]}>
       <ScrollView contentContainerStyle={{padding: 16}}>
          <View style={{flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:20}}>
              <ThemedText type="title">{t('trend_analysis', lang)}</ThemedText>
              <View style={styles.periodSwitch}>
                  <Pressable onPress={()=>setPeriod(7)} style={[styles.pBtn, period===7 && {backgroundColor:theme.tint}]}><ThemedText style={{color:period===7?'#FFF':theme.text, fontSize:12}}>{t('week', lang)}</ThemedText></Pressable>
                  <Pressable onPress={()=>setPeriod(30)} style={[styles.pBtn, period===30 && {backgroundColor:theme.tint}]}><ThemedText style={{color:period===30?'#FFF':theme.text, fontSize:12}}>{t('month', lang)}</ThemedText></Pressable>
              </View>
          </View>

          <View style={styles.card}>
              <ThemedText type="subtitle" style={{marginBottom:12}}>{t('avg_daily', lang)}</ThemedText>
              <View style={styles.grid}>
                  <StatBox label={t('intake', lang)} val={summary.avgIn} unit="kcal" color="#34C759"/>
                  <StatBox label={t('burned', lang)} val={summary.avgOut} unit="kcal" color="#FF9500"/>
                  <StatBox label={t('protein', lang)} val={summary.avgPro} unit="g"/>
                  <StatBox label={t('fat', lang)} val={summary.avgFat} unit="g"/>
                  <StatBox label={t('carbs', lang)} val={summary.avgCarb} unit="g"/>
                  <StatBox label={t('sodium', lang)} val={summary.avgSod} unit="mg"/>
              </View>
          </View>

          {/* Calorie Chart */}
          <View style={[styles.card, {marginTop: 16}]}>
              <ThemedText type="subtitle" style={{marginBottom:16}}>{t('chart_title_cal', lang)}</ThemedText>
              <BarChart 
                data={calData} 
                stackData={calData}
                barWidth={barWidth} 
                spacing={spacing}
                noOfSections={3} 
                barBorderRadius={4} 
                yAxisThickness={0} 
                xAxisThickness={1}
                hideRules
                height={180}
                width={chartWidth}
                isAnimated
              />
          </View>

          import React, { useState, useCallback } from "react";
import { View, ScrollView, StyleSheet, Dimensions, ActivityIndicator, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ThemedText } from "@/components/themed-text";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { BarChart, LineChart } from "react-native-gifted-charts";
import { useFocusEffect } from "expo-router";
import { db } from "@/lib/db";
import { foodLogs, dailyMetrics, activityLogs } from "@/drizzle/schema";
import { gte, lte } from "drizzle-orm";
import { format, subDays, eachDayOfInterval, startOfDay, endOfDay } from "date-fns";
import { t, useLanguage } from "@/lib/i18n";

const SCREEN_WIDTH = Dimensions.get("window").width;

export default function AnalysisScreen() {
  const theme = Colors[useColorScheme() ?? "light"];
  const lang = useLanguage();
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<7 | 30>(7);
  
  const [calData, setCalData] = useState<any[]>([]);
  const [weightData, setWeightData] = useState<any[]>([]);
  const [bfData, setBfData] = useState<any[]>([]); 
  const [summary, setSummary] = useState({ avgIn: 0, avgOut: 0, avgPro: 0, avgFat: 0, avgCarb: 0, avgSod: 0 });

  useFocusEffect(
    useCallback(() => { loadAnalysis(period); }, [period])
  );

  const loadAnalysis = async (days: number) => {
      setLoading(true);
      try {
          const endDate = new Date(); // 今天
          const startDate = subDays(endDate, days - 1);
          
          // [修正] 使用完整的日期區間生成 Key，確保最近日期（今天）有被包含
          const dateRange = eachDayOfInterval({ start: startDate, end: endDate });
          const strStart = format(startDate, 'yyyy-MM-dd');
          const strEnd = format(endDate, 'yyyy-MM-dd'); // 確保查詢包含到今天結束

          // 初始化 Map
          const dataMap = new Map();
          dateRange.forEach(d => {
              const k = format(d, 'yyyy-MM-dd');
              const showLabel = days === 7 || d.getDate() % 5 === 0;
              dataMap.set(k, { 
                  in: 0, out: 0, pro: 0, fat: 0, carb: 0, sod: 0, 
                  w: null, bf: null, // [修正] 預設為 null，避免補 0
                  hasData: false, // 標記是否有數據，用於平均計算
                  label: showLabel ? format(d, 'MM/dd') : '' 
              });
          });

          // Fetch Data with Range
          const logs = await db.select().from(foodLogs).where(gte(foodLogs.date, strStart));
          const acts = await db.select().from(activityLogs).where(gte(activityLogs.date, strStart));
          const metrics = await db.select().from(dailyMetrics).where(gte(dailyMetrics.date, strStart));

          // Fill Data
          const activeDays = new Set();
          
          logs.forEach(l => {
              if (dataMap.has(l.date)) {
                  activeDays.add(l.date);
                  const d = dataMap.get(l.date);
                  d.in += l.totalCalories || 0;
                  d.pro += l.totalProteinG || 0;
                  d.fat += l.totalFatG || 0;
                  d.carb += l.totalCarbsG || 0;
                  d.sod += l.totalSodiumMg || 0;
                  d.hasData = true;
              }
          });
          
          acts.forEach(a => {
              if (dataMap.has(a.date)) {
                  activeDays.add(a.date);
                  const d = dataMap.get(a.date);
                  d.out += a.caloriesBurned || 0; 
                  d.hasData = true;
              }
          });

          metrics.forEach(m => {
              if (dataMap.has(m.date)) {
                  const d = dataMap.get(m.date);
                  if (m.weightKg) { d.w = m.weightKg; activeDays.add(m.date); }
                  if (m.bodyFatPercentage) { d.bf = m.bodyFatPercentage; activeDays.add(m.date); }
              }
          });

          const chartArr = Array.from(dataMap.values());

          // 1. 熱量堆疊圖 (修正：消耗顯示為負數)
          const stackData = chartArr.map(d => ({
              label: d.label,
              stacks: [
                  { value: d.in, color: '#34C759', marginBottom: 2 },
                  { value: -(d.out), color: '#FF9500' }, // [修正] 負數
              ],
              frontColor: 'transparent',
          }));
          setCalData(stackData);

          // 2. 體重體脂圖 (修正：無數據不補0)
          const wArr = chartArr.map(d => ({ 
              value: d.w, // 若為 null，GiftedCharts 預設行為通常是斷點或略過，不會畫成 0
              label: d.label, 
              hideDataPoint: d.w === null 
          }));
          const bfArr = chartArr.map(d => ({ 
              value: d.bf, 
              hideDataPoint: d.bf === null 
          }));
          
          setWeightData(wArr);
          setBfData(bfArr);

          // Summary (修正：分母為有效天數)
          const validInDays = chartArr.filter(d => d.in > 0).length || 1;
          const validOutDays = chartArr.filter(d => d.out > 0).length || 1;
          const validMacroDays = chartArr.filter(d => d.hasData).length || 1;

          const sum = chartArr.reduce((acc, cur) => ({
              avgIn: acc.avgIn + cur.in, avgOut: acc.avgOut + cur.out,
              avgPro: acc.avgPro + cur.pro, avgFat: acc.avgFat + cur.fat,
              avgCarb: acc.avgCarb + cur.carb, avgSod: acc.avgSod + cur.sod
          }), { avgIn:0, avgOut:0, avgPro:0, avgFat:0, avgCarb:0, avgSod:0 });

          setSummary({
              avgIn: Math.round(sum.avgIn / validInDays),
              avgOut: Math.round(sum.avgOut / validOutDays),
              avgPro: Math.round(sum.avgPro / validMacroDays),
              avgFat: Math.round(sum.avgFat / validMacroDays),
              avgCarb: Math.round(sum.avgCarb / validMacroDays),
              avgSod: Math.round(sum.avgSod / validMacroDays),
          });

      } catch(e) { console.error(e); } finally { setLoading(false); }
  };

  // [修正] 共用圖表參數，確保 X 軸寬度一致
  const chartWidth = SCREEN_WIDTH - 60;
  const barWidth = period === 7 ? 20 : 6;
  const spacing = period === 7 ? 30 : 10; 

  return (
    <SafeAreaView style={[styles.container, {backgroundColor: theme.background}]}>
       <ScrollView contentContainerStyle={{padding: 16}}>
          <View style={{flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:20}}>
              <ThemedText type="title">{t('trend_analysis', lang)}</ThemedText>
              <View style={styles.periodSwitch}>
                  <Pressable onPress={()=>setPeriod(7)} style={[styles.pBtn, period===7 && {backgroundColor:theme.tint}]}><ThemedText style={{color:period===7?'#FFF':theme.text, fontSize:12}}>{t('week', lang)}</ThemedText></Pressable>
                  <Pressable onPress={()=>setPeriod(30)} style={[styles.pBtn, period===30 && {backgroundColor:theme.tint}]}><ThemedText style={{color:period===30?'#FFF':theme.text, fontSize:12}}>{t('month', lang)}</ThemedText></Pressable>
              </View>
          </View>
          
          <View style={styles.card}>
              <ThemedText type="subtitle" style={{marginBottom:12}}>{t('avg_daily', lang)}</ThemedText>
              <View style={styles.grid}>
                  <StatBox label={t('intake', lang)} val={summary.avgIn} unit="kcal" color="#34C759"/>
                  <StatBox label={t('burned', lang)} val={summary.avgOut} unit="kcal" color="#FF9500"/>
                  <StatBox label={t('protein', lang)} val={summary.avgPro} unit="g"/>
                  <StatBox label={t('fat', lang)} val={summary.avgFat} unit="g"/>
                  <StatBox label={t('carbs', lang)} val={summary.avgCarb} unit="g"/>
                  <StatBox label={t('sodium', lang)} val={summary.avgSod} unit="mg"/>
              </View>
          </View>

          {/* Calorie Chart */}
          <View style={[styles.card, {marginTop: 16}]}>
              <ThemedText type="subtitle" style={{marginBottom:16}}>{t('chart_title_cal', lang)}</ThemedText>
              <BarChart 
                data={calData} 
                stackData={calData}
                barWidth={barWidth} 
                spacing={spacing}
                noOfSections={3} 
                barBorderRadius={4} 
                yAxisThickness={0} 
                xAxisThickness={1}
                hideRules
                height={180}
                width={chartWidth}
                isAnimated
              />
          </View>

          {/* Body Metrics Chart (Double Axis) */}
          <View style={[styles.card, {marginTop: 16, marginBottom: 40}]}>
              <ThemedText type="subtitle" style={{marginBottom:16}}>{t('chart_title_body', lang)}</ThemedText>
              <View style={{flexDirection:'row', justifyContent:'center', marginBottom:10}}>
                  <ThemedText style={{color:'#FF9500', fontSize:12, marginRight:10}}>━ {t('weight', lang)} (L)</ThemedText>
                  <ThemedText style={{color:'#007AFF', fontSize:12}}>━ {t('body_fat', lang)} (R)</ThemedText>
              </View>
              {/* [修正] 使用相同的 barWidth/spacing 模擬 LineChart 的點位置，或手動計算寬度 */}
              <LineChart 
                data={weightData} 
                color="#FF9500" 
                thickness={3} 
                dataPointsColor="#FF9500"
                hideRules
                height={180}
                width={chartWidth} 
                // LineChart 的 spacing 行為可能與 BarChart 略有不同，需調整以視覺對齊
                spacing={spacing + barWidth} 
                initialSpacing={barWidth/2}
                curved
                isAnimated
                secondaryData={bfData}
                secondaryLineConfig={{ color: '#007AFF', thickness: 3 }}
                showSecondaryYAxis
                secondaryYAxisColor={theme.text}
                secondaryYAxisLabelTextStyle={{color: '#007AFF', fontSize: 10}}
                connectPoint={false} // 不連接斷點（無數據處）
              />
          </View>
       </ScrollView>
    </SafeAreaView>
  );
}

const StatBox = ({ label, val, unit, color }: any) => (
    <View style={{width:'33%', marginBottom: 12}}>
        <ThemedText style={{fontSize:11, color:'#888'}}>{label}</ThemedText>
        <ThemedText style={{fontSize:16, fontWeight:'bold', color: color || undefined}}>{val} <ThemedText style={{fontSize:10, fontWeight:'normal'}}>{unit}</ThemedText></ThemedText>
    </View>
);

const styles = StyleSheet.create({
    container: { flex: 1 },
    card: { padding: 16, borderRadius: 16, backgroundColor: 'rgba(120,120,120,0.05)' },
    periodSwitch: { flexDirection:'row', backgroundColor:'rgba(120,120,120,0.1)', borderRadius:20, padding:2 },
    pBtn: { paddingVertical:6, paddingHorizontal:12, borderRadius:18 },
    grid: { flexDirection:'row', flexWrap:'wrap' }
});
          <View style={[styles.card, {marginTop: 16, marginBottom: 40}]}>
              <ThemedText type="subtitle" style={{marginBottom:16}}>{t('chart_title_body', lang)}</ThemedText>
              <View style={{flexDirection:'row', justifyContent:'center', marginBottom:10}}>
                  <ThemedText style={{color:'#FF9500', fontSize:12, marginRight:10}}>━ {t('weight', lang)} (L)</ThemedText>
                  <ThemedText style={{color:'#007AFF', fontSize:12}}>━ {t('body_fat', lang)} (R)</ThemedText>
              </View>
              {/* [修正] 使用相同的 barWidth/spacing 模擬 LineChart 的點位置，或手動計算寬度 */}
              <LineChart 
                data={weightData} 
                color="#FF9500" 
                thickness={3} 
                dataPointsColor="#FF9500"
                hideRules
                height={180}
                width={chartWidth} 
                // LineChart 的 spacing 行為可能與 BarChart 略有不同，需調整以視覺對齊
                spacing={spacing + barWidth} 
                initialSpacing={barWidth/2}
                curved
                isAnimated
                secondaryData={bfData}
                secondaryLineConfig={{ color: '#007AFF', thickness: 3 }}
                showSecondaryYAxis
                secondaryYAxisColor={theme.text}
                secondaryYAxisLabelTextStyle={{color: '#007AFF', fontSize: 10}}
                connectPoint={false} // 不連接斷點（無數據處）
              />
          </View>
       </ScrollView>
    </SafeAreaView>
  );
}

const StatBox = ({ label, val, unit, color }: any) => (
    <View style={{width:'33%', marginBottom: 12}}>
        <ThemedText style={{fontSize:11, color:'#888'}}>{label}</ThemedText>
        <ThemedText style={{fontSize:16, fontWeight:'bold', color: color || undefined}}>{val} <ThemedText style={{fontSize:10, fontWeight:'normal'}}>{unit}</ThemedText></ThemedText>
    </View>
);

const styles = StyleSheet.create({
    container: { flex: 1 },
    card: { padding: 16, borderRadius: 16, backgroundColor: 'rgba(120,120,120,0.05)' },
    periodSwitch: { flexDirection:'row', backgroundColor:'rgba(120,120,120,0.1)', borderRadius:20, padding:2 },
    pBtn: { paddingVertical:6, paddingHorizontal:12, borderRadius:18 },
    grid: { flexDirection:'row', flexWrap:'wrap' }
});