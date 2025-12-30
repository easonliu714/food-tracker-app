import React, { useState, useCallback } from "react";
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
const CHART_WIDTH = SCREEN_WIDTH - 48; // 扣除 padding
const INITIAL_SPACING = 20; // 統一的起始間距

export default function AnalysisScreen() {
  const theme = Colors[useColorScheme() ?? "light"];
  const lang = useLanguage();
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<7 | 30>(7);
  
  const [calData, setCalData] = useState<any[]>([]);
  const [dataSet, setDataSet] = useState<any[]>([]); 
  const [summary, setSummary] = useState({ avgIn: 0, avgOut: 0, avgPro: 0, avgFat: 0, avgCarb: 0, avgSod: 0 });

  // [精算] 圖表參數設定
  // 目標：讓 LineChart 的點 精準對齊 BarChart 的中心
  // BarChart Slot Width = barWidth + spacing
  // LineChart Point Distance = barWidth + spacing
  const chartConfig = period === 7 
    ? { barWidth: 24, spacing: 32 } // 7天: 較寬
    : { barWidth: 8, spacing: 12 }; // 30天: 較窄

  const lineSpacing = chartConfig.barWidth + chartConfig.spacing;
  // LineChart 起始點 = BarChart起始間距 + (Bar寬度 / 2) -> 對齊 Bar 中心
  const lineInitialSpacing = INITIAL_SPACING + (chartConfig.barWidth / 2);

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

          // 初始化 Map (確保每一天都有佔位)
          const dataMap = new Map();
          dateRange.forEach(d => {
              const k = format(d, 'yyyy-MM-dd');
              // X軸標籤顯示邏輯
              const showLabel = days === 7 || d.getDate() % 5 === 0;
              dataMap.set(k, { 
                  in: 0, out: 0, pro: 0, fat: 0, carb: 0, sod: 0, 
                  w: null, bf: null, 
                  hasData: false, 
                  label: showLabel ? format(d, 'MM/dd') : '',
                  dateStr: k
              });
          });

          // 讀取數據
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

          const chartArr = Array.from(dataMap.values());

          // 1. 熱量堆疊圖數據
          const stackData = chartArr.map((d, idx) => ({
              label: d.label,
              labelTextStyle: { fontSize: 9, color: '#888', width: 40, textAlign: 'center' },
              stacks: [
                  { value: d.in, color: '#34C759', marginBottom: 2 },
                  { value: -(d.out), color: '#FF9500' }, 
              ],
              frontColor: 'transparent',
              // 存入完整資訊供 Tooltip 使用
              customData: { ...d, index: idx, total: chartArr.length } 
          }));
          setCalData(stackData);

          // 2. 體重體脂數據 (插補邏輯)
          // 確保回傳陣列長度 == days，空值用插補填補但隱藏點
          const interpolate = (arr: any[], key: string) => {
             const knownIndices = arr.map((item, i) => item[key] !== null ? i : -1).filter(i => i !== -1);
             
             return arr.map((item, i) => {
                 // 情況 A: 有真實數據
                 if (item[key] !== null) {
                     return { 
                         value: item[key], 
                         label: item.label, // 必須保留 label 以佔位 X 軸
                         dataPointText: item[key].toString(),
                         customData: { ...item, type: 'real' }
                     };
                 }
                 
                 // 情況 B: 無數據 (需插補)
                 const prevIdx = knownIndices.filter(idx => idx < i).pop();
                 const nextIdx = knownIndices.filter(idx => idx > i).shift();

                 let val;
                 if (prevIdx !== undefined && nextIdx !== undefined) {
                     const startVal = arr[prevIdx][key];
                     const endVal = arr[nextIdx][key];
                     const ratio = (i - prevIdx) / (nextIdx - prevIdx);
                     val = startVal + (endVal - startVal) * ratio;
                 } else if (prevIdx !== undefined) {
                     val = arr[prevIdx][key]; 
                 } else if (nextIdx !== undefined) {
                     val = arr[nextIdx][key]; 
                 } else {
                     val = 0; 
                 }
                 
                 return { 
                     value: Number(val.toFixed(1)), 
                     label: item.label, 
                     hideDataPoint: true, // 隱藏點，只留線
                     customData: { ...item, type: 'interpolated' }
                 };
             });
          };

          const wArr = interpolate(chartArr, 'w');
          const bfArr = interpolate(chartArr, 'bf');
          
          const enrich = (arr: any[], name: string) => arr.map((item, idx) => ({
             ...item,
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

          // 統計摘要
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

  // Tooltip 元件：熱量圖
  const renderCalTooltip = (item: any) => {
      if (!item.customData) return null;
      const { index, total } = item.customData;
      // 智慧定位：若在右半邊，視窗靠左顯示 (-110)，否則靠右 (10)
      const isRightSide = index > total / 2;
      const leftPos = isRightSide ? -110 : 10;

      return (
          <View style={[styles.tooltip, { left: leftPos, top: 0 }]}>
              <ThemedText style={styles.tooltipTitle}>{item.customData.dateStr}</ThemedText>
              <ThemedText style={styles.tooltipText}>{t('intake', lang)}: {Math.round(item.customData.in)}</ThemedText>
              <ThemedText style={styles.tooltipText}>{t('burned', lang)}: {Math.round(item.customData.out)}</ThemedText>
          </View>
      );
  };

  // Tooltip 元件：折線圖
  const renderLineTooltip = (item: any) => {
      const idx = item.customData?.index || 0;
      const total = item.customData?.total || 1;
      const name = item.customData?.name || '';
      
      // 插補點不顯示數值
      if (item.customData?.type === 'interpolated') return null;

      // 智慧定位
      const isRightSide = idx > total / 2;
      const leftPos = isRightSide ? -90 : 10;

      return (
          <View style={[styles.tooltip, { left: leftPos, top: 0 }]}>
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
                data={calData} 
                stackData={calData}
                barWidth={chartConfig.barWidth} 
                spacing={chartConfig.spacing}
                initialSpacing={INITIAL_SPACING} // [對齊關鍵]
                noOfSections={3} 
                barBorderRadius={4} 
                yAxisThickness={0} 
                xAxisThickness={1}
                hideRules
                height={180}
                width={CHART_WIDTH} // 確保寬度一致
                isAnimated
                xAxisLabelTextStyle={{fontSize: 9, color: '#888', width: 40}}
                // Tooltip 設定
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
                dataSet={dataSet}
                hideRules
                height={180}
                width={CHART_WIDTH} // 確保寬度一致
                spacing={lineSpacing} // [對齊關鍵] BarWidth + BarSpacing
                initialSpacing={lineInitialSpacing} // [對齊關鍵] BarInitial + (BarWidth/2)
                curved
                isAnimated
                yAxisThickness={0}
                xAxisThickness={1}
                xAxisLabelTextStyle={{fontSize: 9, color: '#888', width: 40}}
                // Tooltip 設定
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
        zIndex: 9999, // 確保在最上層
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)'
    },
    tooltipTitle: { color: 'white', fontSize: 11, fontWeight: 'bold', marginBottom: 4 },
    tooltipText: { color: 'white', fontSize: 12, lineHeight: 16 }
});