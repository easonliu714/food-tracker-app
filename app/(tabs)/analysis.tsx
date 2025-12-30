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
  const [summary, setSummary] = useState({ avgIn: 0, avgOut: 0, avgPro: 0, avgFat: 0, avgCarb: 0, avgSod: 0 });

  // 確保切換 Tab 或 Period 時重新讀取
  useFocusEffect(
    useCallback(() => {
      loadAnalysis(period);
    }, [period])
  );

  const loadAnalysis = async (days: number) => {
      setLoading(true);
      try {
          const endDate = new Date();
          const startDate = subDays(endDate, days - 1);
          const dateRange = eachDayOfInterval({ start: startDate, end: endDate });
          const strStart = format(startDate, 'yyyy-MM-dd');

          const dataMap = new Map();
          dateRange.forEach(d => {
              const k = format(d, 'yyyy-MM-dd');
              dataMap.set(k, { in: 0, out: 0, pro: 0, fat: 0, carb: 0, sod: 0, label: format(d, days===7 ? 'MM/dd' : 'dd') });
          });

          // 讀取資料
          const logs = await db.select().from(foodLogs).where(gte(foodLogs.date, strStart));
          const acts = await db.select().from(activityLogs).where(gte(activityLogs.date, strStart));
          const weights = await db.select().from(dailyMetrics).where(gte(dailyMetrics.date, strStart)).orderBy(desc(dailyMetrics.date));

          // 計算有效天數 (分母)
          const activeDays = new Set();

          logs.forEach(l => {
              activeDays.add(l.date);
              if (dataMap.has(l.date)) {
                  const d = dataMap.get(l.date);
                  d.in += l.totalCalories || 0;
                  d.pro += l.totalProteinG || 0;
                  d.fat += l.totalFatG || 0;
                  d.carb += l.totalCarbsG || 0;
                  d.sod += l.totalSodiumMg || 0;
              }
          });
          acts.forEach(a => {
              activeDays.add(a.date);
              if (dataMap.has(a.date)) {
                  dataMap.get(a.date).out += a.caloriesBurned || 0;
              }
          });

          const chartArr = Array.from(dataMap.values());
          const stackData = chartArr.map(d => ({
              label: d.label,
              stacks: [
                  { value: d.in, color: '#34C759', marginBottom: 2 },
                  { value: d.out, color: '#FF9500' },
              ],
              frontColor: 'transparent',
          }));
          setCalData(stackData);

          const wData = weights.map(w => ({ value: w.weightKg, label: w.date.slice(5) })).reverse();
          setWeightData(wData.length ? wData : [{value: 0}]);

          // 計算平均：總合 / 有效天數 (至少為 1)
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
              <ThemedText type="title">{t('analysis', lang)}</ThemedText>
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

          <View style={[styles.card, {marginTop: 16}]}>
              <ThemedText type="subtitle" style={{marginBottom:16}}>{t('trend_calories', lang)}</ThemedText>
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

          <View style={[styles.card, {marginTop: 16}]}>
              <ThemedText type="subtitle" style={{marginBottom:16}}>{t('trend_body', lang)}</ThemedText>
              <LineChart 
                data={weightData} 
                color="#FF9500" 
                thickness={3} 
                dataPointsColor="#FF9500"
                hideRules
                hideYAxisText
                height={180}
                width={SCREEN_WIDTH - 80}
                curved
                isAnimated
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