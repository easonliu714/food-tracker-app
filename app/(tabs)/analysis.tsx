import React, { useState, useCallback, useRef } from "react";
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
const PADDING_H = 16;
// 圖表顯示區域寬度
const VISIBLE_WIDTH = SCREEN_WIDTH - (PADDING_H * 2);

export default function AnalysisScreen() {
  const theme = Colors[useColorScheme() ?? "light"];
  const lang = useLanguage();
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<7 | 30>(7);
  
  const [calData, setCalData] = useState<any[]>([]);
  const [dataSet, setDataSet] = useState<any[]>([]); 
  const [summary, setSummary] = useState({ avgIn: 0, avgOut: 0, avgPro: 0, avgFat: 0, avgCarb: 0, avgSod: 0 });

  // 使用 Ref 來控制捲動，解決跳動問題
  const barChartRef = useRef<any>(null);
  const lineChartRef = useRef<any>(null);

  // [參數精算]
  // 為了確保對齊，固定 BarWidth 和 Spacing，讓總寬度超出螢幕時自動產生捲動
  const barWidth = 12;
  const spacing = 28; // 間距加大，讓標籤不擁擠
  const initialSpacing = 10;
  
  // 計算總內容寬度 (用於檢查是否需要滑動)
  // 但 GiftedCharts 會自動根據 data 數量處理，我們只需設定 width={VISIBLE_WIDTH}
  // 並確保 LineChart 的點與 BarChart 的柱子中心對齊
  
  // LineChart 的點間距 = BarWidth + Spacing
  const lineSpacing = barWidth + spacing;
  // LineChart 的起始位移 = InitialSpacing + (BarWidth / 2)
  const lineInitialSpacing = initialSpacing + (barWidth / 2);

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

          // 初始化 Map
          const dataMap = new Map();
          dateRange.forEach(d => {
              const k = format(d, 'yyyy-MM-dd');
              dataMap.set(k, { 
                  in: 0, out: 0, pro: 0, fat: 0, carb: 0, sod: 0, 
                  w: null, bf: null, 
                  hasData: false, 
                  // 根據天數決定標籤顯示頻率
                  label: days === 7 ? format(d, 'MM/dd') : (d.getDate() % 5 === 0 ? format(d, 'MM/dd') : ''),
                  dateStr: k
              });
          });

          // Fetch Data
          const logs = await db.select().from(foodLogs).where(gte(foodLogs.date, strStart));
          const acts = await db.select().from(activityLogs).where(gte(activityLogs.date, strStart));
          const metrics = await db.select().from(dailyMetrics).where(gte(dailyMetrics.date, strStart));

          // Fill Data
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

          const chartArr = Array.from(dataMap.values());

          // 1. 熱量堆疊圖數據
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

          // 2. 體重體脂數據 (關鍵修正：確保每個日期都有點)
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
                 
                 // 插補邏輯
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
             // 重要：如果不設定 label，GiftedCharts 可能會忽略寬度計算
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

          // Summary
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

          // [修正] 使用 setTimeout 延遲捲動，避免渲染衝突導致的跳動
          setTimeout(() => {
              if(barChartRef.current) barChartRef.current.scrollToEnd({ animated: false });
              if(lineChartRef.current) lineChartRef.current.scrollToEnd({ animated: false });
          }, 100);

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

          {/* Calorie Chart */}
          <View style={[styles.card, {marginTop: 16}]}>
              <ThemedText type="subtitle" style={{marginBottom:16}}>{t('chart_title_cal', lang)}</ThemedText>
              <BarChart 
                ref={barChartRef}
                data={calData} 
                stackData={calData}
                barWidth={barWidth} 
                spacing={spacing}
                initialSpacing={initialSpacing}
                noOfSections={3} 
                barBorderRadius={4} 
                yAxisThickness={0} 
                xAxisThickness={1}
                hideRules
                height={180}
                // 設定 width=VISIBLE_WIDTH 並不代表內容只有這麼寬
                // GiftedCharts 會自動延伸內容並允許滑動
                width={VISIBLE_WIDTH} 
                isAnimated={false} // 關閉動畫以避免捲動時跳動
                xAxisLabelTextStyle={{fontSize: 9, color: '#888', width: 40}}
                focusBarOnPress={true}
                renderTooltip={renderCalTooltip}
              />
          </View>

          {/* Body Metrics Chart */}
          <View style={[styles.card, {marginTop: 16, marginBottom: 40}]}>
              <ThemedText type="subtitle" style={{marginBottom:16}}>{t('chart_title_body', lang)}</ThemedText>
              <View style={{flexDirection:'row', justifyContent:'center', marginBottom:10}}>
                  <ThemedText style={{color:'#FF9500', fontSize:12, marginRight:10}}>━ {t('weight', lang)}</ThemedText>
                  <ThemedText style={{color:'#007AFF', fontSize:12}}>━ {t('body_fat', lang)}</ThemedText>
              </View>
              <LineChart 
                ref={lineChartRef}
                dataSet={dataSet}
                hideRules
                height={180}
                width={VISIBLE_WIDTH} 
                spacing={lineSpacing} // 強制與 BarChart 物理對齊
                initialSpacing={lineInitialSpacing} 
                curved
                isAnimated={false} // 關閉動畫
                yAxisThickness={0}
                xAxisThickness={1}
                xAxisLabelTextStyle={{fontSize: 9, color: '#888', width: 40}}
                pointerConfig={{
                    pointerStripUptoDataPoint: true,
                    pointerStripColor: 'lightgray',
                    pointerStripWidth: 2,
                    strokeDashArray: [2, 5],
                    pointerLabelComponent: (items: any) => renderLineTooltip(items[0]),
                }}
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