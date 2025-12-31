// [START OF FILE app/(tabs)/analysis.tsx]
import React, { useState, useCallback, useRef, useEffect } from "react";
import { View, ScrollView, StyleSheet, Dimensions, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ThemedText } from "@/components/themed-text";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { BarChart, LineChart } from "react-native-gifted-charts";
import { useFocusEffect } from "expo-router";
import { db } from "@/lib/db";
import { foodLogs, dailyMetrics, activityLogs } from "@/drizzle/schema";
import { gte } from "drizzle-orm";
import { format, subDays, eachDayOfInterval } from "date-fns";
import { t, useLanguage } from "@/lib/i18n";

const SCREEN_WIDTH = Dimensions.get("window").width;
// [FIX] 明確定義可視寬度
const VISIBLE_WIDTH = SCREEN_WIDTH - 32; 

export default function AnalysisScreen() {
  const theme = Colors[useColorScheme() ?? "light"];
  const lang = useLanguage();
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<7 | 30>(7);
  
  const [calData, setCalData] = useState<any[]>([]);
  const [dataSet, setDataSet] = useState<any[]>([]); 
  const [summary, setSummary] = useState({ avgIn: 0, avgOut: 0, avgPro: 0, avgFat: 0, avgCarb: 0, avgSod: 0 });

  const barChartRef = useRef<any>(null);
  const lineChartRef = useRef<any>(null);

  const config = period === 30 
    ? { barWidth: 12, spacing: 8, initialSpacing: 10, endSpacing: 50 }
    : { barWidth: 16, spacing: 24, initialSpacing: 20, endSpacing: 20 };

  const lineSpacing = config.barWidth + config.spacing;
  const lineInitialSpacing = config.initialSpacing; 

  useFocusEffect(
    useCallback(() => { loadAnalysis(period); }, [period])
  );

  // [FIX] 增加延遲時間確保 Layout 完成後再捲動
  useEffect(() => {
      if (calData.length > 0) {
          const timer = setTimeout(() => {
              if (barChartRef.current) barChartRef.current.scrollToEnd({ animated: true });
              if (lineChartRef.current) lineChartRef.current.scrollToEnd({ animated: true });
          }, 500); 
          return () => clearTimeout(timer);
      }
  }, [calData, dataSet]);

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
              const showLabel = days === 7 || d.getDate() % 5 === 0;
              dataMap.set(k, { 
                  in: 0, out: 0, pro: 0, fat: 0, carb: 0, sod: 0, 
                  w: null, bf: null, 
                  hasData: false, 
                  label: showLabel ? format(d, 'MM/dd') : '',
                  dateStr: k
              });
          });

          const logs = await db.select().from(foodLogs).where(gte(foodLogs.date, strStart));
          const acts = await db.select().from(activityLogs).where(gte(activityLogs.date, strStart));
          const metrics = await db.select().from(dailyMetrics).where(gte(dailyMetrics.date, strStart));

          logs.forEach(l => {
              if (dataMap.has(l.date)) {
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
                  const d = dataMap.get(a.date);
                  d.out += a.caloriesBurned || 0; 
                  d.hasData = true;
              }
          });
          metrics.forEach(m => {
              if (dataMap.has(m.date)) {
                  const d = dataMap.get(m.date);
                  if (m.weightKg && m.weightKg > 0) d.w = m.weightKg; 
                  if (m.bodyFatPercentage && m.bodyFatPercentage > 0) d.bf = m.bodyFatPercentage; 
              }
          });

          const chartArr = Array.from(dataMap.values()).sort((a:any, b:any) => a.dateStr.localeCompare(b.dateStr));

          // 1. Calorie Chart
          const stackData = chartArr.map((d, idx) => ({
              label: d.label,
              labelTextStyle: { fontSize: 10, color: '#888', width: 40, textAlign: 'center' },
              stacks: [
                  { value: d.in, color: '#34C759', marginBottom: 2 },
                  { value: -(d.out), color: '#FF9500' }, 
              ],
              frontColor: 'transparent',
              customData: { ...d, index: idx, total: chartArr.length } 
          }));
          setCalData(stackData);

          // 2. Weight Line Chart
          const interpolate = (arr: any[], key: string) => {
             const knownIndices = arr.map((item, i) => item[key] !== null ? i : -1).filter(i => i !== -1);
             return arr.map((item, i) => {
                 if (item[key] !== null) {
                     return { 
                         value: item[key], 
                         dataPointText: item[key].toString(),
                         customData: { ...item, type: 'real' }
                     };
                 }
                 const prevIdx = knownIndices.filter(idx => idx < i).pop();
                 const nextIdx = knownIndices.filter(idx => idx > i).shift();
                 let val = 0;
                 if (prevIdx !== undefined && nextIdx !== undefined) {
                     const startVal = arr[prevIdx][key];
                     const endVal = arr[nextIdx][key];
                     val = startVal + (endVal - startVal) * ((i - prevIdx) / (nextIdx - prevIdx));
                 } else if (prevIdx !== undefined) val = arr[prevIdx][key]; 
                 else if (nextIdx !== undefined) val = arr[nextIdx][key]; 
                 
                 return { 
                     value: Number(val.toFixed(1)), 
                     hideDataPoint: true, 
                     customData: { ...item, type: 'interpolated' }
                 };
             });
          };

          const wArr = interpolate(chartArr, 'w');
          const bfArr = interpolate(chartArr, 'bf');
          
          const enrich = (arr: any[], name: string) => arr.map((item, idx) => ({
             ...item,
             label: item.label || ' ', 
             customData: { ...item.customData, index: idx, total: arr.length, name }
          }));

          setDataSet([
              {
                  data: enrich(wArr, t('weight', lang)),
                  color: '#FF9500',
                  dataPointsColor: '#FF9500',
                  thickness: 3,
                  curved: true,
                  hideDataPoints: false
              },
              {
                  data: enrich(bfArr, t('body_fat', lang)),
                  color: '#007AFF',
                  dataPointsColor: '#007AFF',
                  thickness: 3,
                  curved: true,
                  hideDataPoints: false
              }
          ]);

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

  const renderCalTooltip = (item: any) => {
      if (!item.customData) return null;
      const { index, total } = item.customData;
      const isRightSide = index > total / 2;
      return (
          <View style={[styles.tooltip, { left: isRightSide ? -110 : 10, top: 0 }]}>
              <ThemedText style={styles.tooltipTitle}>{item.customData.dateStr}</ThemedText>
              <ThemedText style={styles.tooltipText}>{t('intake', lang)}: {Math.round(item.customData.in)}</ThemedText>
              <ThemedText style={styles.tooltipText}>{t('burned', lang)}: {Math.round(item.customData.out)}</ThemedText>
          </View>
      );
  };

  const renderLineTooltip = (item: any) => {
      if (item.customData?.type === 'interpolated') return null;
      const { index, total, name } = item.customData || {};
      const isRightSide = index > (total || 1) / 2;
      return (
          <View style={[styles.tooltip, { left: isRightSide ? -90 : 10, top: 0 }]}>
              <ThemedText style={styles.tooltipTitle}>{item.customData?.dateStr}</ThemedText>
              <ThemedText style={styles.tooltipText}>{name}: {item.value}</ThemedText>
          </View>
      );
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

          <View style={[styles.card, {marginTop: 16}]}>
              <ThemedText type="subtitle" style={{marginBottom:16}}>{t('chart_title_cal', lang)}</ThemedText>
              {/* @ts-ignore */}
              <BarChart 
                ref={barChartRef}
                data={calData} 
                stackData={calData}
                barWidth={config.barWidth} 
                spacing={config.spacing}
                initialSpacing={config.initialSpacing}
                endSpacing={config.endSpacing || 0}
                noOfSections={3} 
                barBorderRadius={4} 
                yAxisThickness={0} 
                xAxisThickness={1}
                hideRules
                height={180}
                width={VISIBLE_WIDTH} 
                isAnimated={false} 
                xAxisLabelTextStyle={{fontSize: 9, color: '#888', width: 40}}
                yAxisTextStyle={{ fontSize: 10, color: '#888' }}
                focusBarOnPress={true}
                renderTooltip={renderCalTooltip}
              />
          </View>

          <View style={[styles.card, {marginTop: 16, marginBottom: 40}]}>
              <ThemedText type="subtitle" style={{marginBottom:16}}>{t('chart_title_body', lang)}</ThemedText>
              <View style={{flexDirection:'row', justifyContent:'center', marginBottom:10}}>
                  <ThemedText style={{color:'#FF9500', fontSize:12, marginRight:10}}>━ {t('weight', lang)}</ThemedText>
                  <ThemedText style={{color:'#007AFF', fontSize:12}}>━ {t('body_fat', lang)}</ThemedText>
              </View>
              {/* @ts-ignore */}
              <LineChart 
                ref={lineChartRef}
                dataSet={dataSet}
                hideRules
                height={180}
                width={VISIBLE_WIDTH} 
                spacing={lineSpacing} 
                initialSpacing={lineInitialSpacing} 
                endSpacing={config.endSpacing || 20}
                curved
                isAnimated={false} 
                yAxisThickness={0}
                // [FIX] 增加 X 軸可見性設定
                xAxisThickness={1}
                xAxisColor="lightgray"
                xAxisLabelTextStyle={{fontSize: 9, color: '#888', width: 40}}
                yAxisTextStyle={{ fontSize: 10, color: '#888' }}
                pointerConfig={{
                    pointerStripUptoDataPoint: true,
                    pointerStripColor: 'lightgray',
                    pointerStripWidth: 2,
                    strokeDashArray: [2, 5],
                    pointerLabelComponent: (items: any) => renderLineTooltip(items[0]),
                }}
                scrollable={true} 
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
    grid: { flexDirection:'row', flexWrap:'wrap' },
    tooltip: {
        position: 'absolute',
        backgroundColor: 'rgba(0,0,0,0.85)',
        padding: 10,
        borderRadius: 8,
        minWidth: 100,
        zIndex: 9999, 
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)'
    },
    tooltipTitle: { color: 'white', fontSize: 11, fontWeight: 'bold', marginBottom: 4 },
    tooltipText: { color: 'white', fontSize: 12, lineHeight: 16 }
});
// [END OF FILE app/(tabs)/analysis.tsx]