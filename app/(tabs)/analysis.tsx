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
import { desc, gte } from "drizzle-orm";
import { format, subDays, eachDayOfInterval } from "date-fns";
import { t, useLanguage } from "@/lib/i18n";

const SCREEN_WIDTH = Dimensions.get("window").width;

export default function AnalysisScreen() {
  const theme = Colors[useColorScheme() ?? "light"];
  const lang = useLanguage();
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<7 | 30>(7);
  
  const [calData, setCalData] = useState<any[]>([]);
  const [weightData, setWeightData] = useState<any[]>([]);
  const [bfData, setBfData] = useState<any[]>([]); // 體脂資料
  const [summary, setSummary] = useState({ avgIn: 0, avgOut: 0, avgPro: 0, avgFat: 0, avgCarb: 0, avgSod: 0 });

  useFocusEffect(
    useCallback(() => { loadAnalysis(period); }, [period])
  );

  const loadAnalysis = async (days: number) => {
      setLoading(true);
      try {
          const endDate = new Date();
          const startDate = subDays(endDate, days - 1);
          const dateRange = eachDayOfInterval({ start: startDate, end: endDate });
          const strStart = format(startDate, 'yyyy-MM-dd');

          // 初始化對應表，確保每天都有數據
          const dataMap = new Map();
          dateRange.forEach(d => {
              const k = format(d, 'yyyy-MM-dd');
              // label 根據天數縮放顯示，避免擁擠
              const showLabel = days === 7 || d.getDate() % 5 === 0;
              dataMap.set(k, { 
                  in: 0, out: 0, pro: 0, fat: 0, carb: 0, sod: 0, 
                  w: 0, bf: 0,
                  label: showLabel ? format(d, 'MM/dd') : '' 
              });
          });

          // Fetch Data
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
              }
          });
          acts.forEach(a => {
              if (dataMap.has(a.date)) {
                  activeDays.add(a.date);
                  dataMap.get(a.date).out += a.caloriesBurned || 0;
              }
          });
          // 體重體脂填入 (需處理當天多筆取最新，這裡簡化為覆蓋)
          metrics.forEach(m => {
              if (dataMap.has(m.date)) {
                  const d = dataMap.get(m.date);
                  if (m.weightKg) d.w = m.weightKg;
                  if (m.bodyFatPercentage) d.bf = m.bodyFatPercentage;
              }
          });

          const chartArr = Array.from(dataMap.values());

          // 1. 熱量堆疊圖
          const stackData = chartArr.map(d => ({
              label: d.label,
              stacks: [
                  { value: d.in, color: '#34C759', marginBottom: 2 },
                  { value: d.out, color: '#FF9500' },
              ],
              frontColor: 'transparent',
          }));
          setCalData(stackData);

          // 2. 體重體脂圖 (雙 Y 軸)
          // Line 1: Weight (左軸)
          const wArr = chartArr.map(d => ({ value: d.w, label: d.label, hideDataPoint: d.w===0 }));
          // Line 2: Body Fat (右軸 - 需要 secondaryData)
          const bfArr = chartArr.map(d => ({ value: d.bf, hideDataPoint: d.bf===0 }));
          
          setWeightData(wArr);
          setBfData(bfArr);

          // Summary
          const totalDays = Math.max(activeDays.size, 1);
          const sum = chartArr.reduce((acc, cur) => ({
              avgIn: acc.avgIn + cur.in, avgOut: acc.avgOut + cur.out,
              avgPro: acc.avgPro + cur.pro, avgFat: acc.avgFat + cur.fat,
              avgCarb: acc.avgCarb + cur.carb, avgSod: acc.avgSod + cur.sod
          }), { avgIn:0, avgOut:0, avgPro:0, avgFat:0, avgCarb:0, avgSod:0 });

          setSummary({
              avgIn: Math.round(sum.avgIn / totalDays),
              avgOut: Math.round(sum.avgOut / totalDays),
              avgPro: Math.round(sum.avgPro / totalDays),
              avgFat: Math.round(sum.avgFat / totalDays),
              avgCarb: Math.round(sum.avgCarb / totalDays),
              avgSod: Math.round(sum.avgSod / totalDays),
          });

      } catch(e) { console.error(e); } finally { setLoading(false); }
  };

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
                barWidth={period===7 ? 20 : 6} 
                spacing={period===7 ? 20 : 4}
                noOfSections={3} 
                barBorderRadius={4} 
                yAxisThickness={0} 
                xAxisThickness={0}
                hideRules
                height={180}
                width={SCREEN_WIDTH - 80}
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
              <LineChart 
                data={weightData} 
                color="#FF9500" 
                thickness={3} 
                dataPointsColor="#FF9500"
                hideRules
                height={180}
                width={SCREEN_WIDTH - 80}
                curved
                isAnimated
                // Secondary Axis for Body Fat
                secondaryData={bfData}
                secondaryLineConfig={{ color: '#007AFF', thickness: 3 }}
                showSecondaryYAxis
                secondaryYAxisColor={theme.text}
                secondaryYAxisLabelTextStyle={{color: '#007AFF', fontSize: 10}}
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