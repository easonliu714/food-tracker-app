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
          
          // [修正] 生成日期陣列時，start 在前，end 在後，順序是 [Old, ..., New]
          // 圖表繪製時 Index 0 是左邊 (Old)，Index N 是右邊 (New)
          const dateRange = eachDayOfInterval({ start: startDate, end: endDate });
          const strStart = format(startDate, 'yyyy-MM-dd');

          // 初始化 Map
          const dataMap = new Map();
          dateRange.forEach(d => {
              const k = format(d, 'yyyy-MM-dd');
              // 7天顯示全部日期，30天顯示部分
              const showLabel = days === 7 || d.getDate() % 5 === 0;
              dataMap.set(k, { 
                  in: 0, out: 0, pro: 0, fat: 0, carb: 0, sod: 0, 
                  w: null, bf: null, 
                  hasData: false, 
                  label: showLabel ? format(d, 'MM/dd') : '',
                  dateStr: k
              });
          });

          // Fetch Data
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

          // [修正] 確保 chartArr 依照日期排序 (Old -> New)
          // Map 遍歷順序是插入順序，而我們是按照 dateRange (Old -> New) 插入的，所以順序正確。
          const chartArr = Array.from(dataMap.values());

          // 1. 熱量堆疊圖
          const stackData = chartArr.map(d => ({
              label: d.label,
              labelTextStyle: { fontSize: 10, color: '#888', width: 40, textAlign: 'center' }, // [修正] 避免日期顯示不全
              stacks: [
                  { value: d.in, color: '#34C759', marginBottom: 2 },
                  { value: -(d.out), color: '#FF9500' }, 
              ],
              frontColor: 'transparent',
              topLabelComponent: () => <ThemedText style={{fontSize:9}}>{d.in>0?Math.round(d.in):''}</ThemedText>
          }));
          setCalData(stackData);

          // 2. 體重體脂圖 (插補邏輯 Interpolation)
          // [修正] 確保沒有 null 值，將空值補上「插補值」，使線條連續
          const interpolate = (arr: any[], key: string) => {
             // 1. 找到所有有值的 index
             const knownIndices = arr.map((item, i) => item[key] !== null ? i : -1).filter(i => i !== -1);
             
             return arr.map((item, i) => {
                 if (item[key] !== null) return { value: item[key], label: item.label, dataPointText: item[key].toString() };
                 
                 // 尋找前後最近的有值點
                 const prevIdx = knownIndices.filter(idx => idx < i).pop();
                 const nextIdx = knownIndices.filter(idx => idx > i).shift();

                 let val;
                 if (prevIdx !== undefined && nextIdx !== undefined) {
                     // 線性插值
                     const startVal = arr[prevIdx][key];
                     const endVal = arr[nextIdx][key];
                     const ratio = (i - prevIdx) / (nextIdx - prevIdx);
                     val = startVal + (endVal - startVal) * ratio;
                 } else if (prevIdx !== undefined) {
                     val = arr[prevIdx][key]; // 沿用舊值
                 } else if (nextIdx !== undefined) {
                     val = arr[nextIdx][key]; // 用未來值填補
                 } else {
                     val = 0; // 全無資料
                 }
                 
                 return { 
                     value: Number(val.toFixed(1)), 
                     label: item.label, 
                     hideDataPoint: true, // 插補點不顯示圓點
                 };
             });
          };

          const wArr = interpolate(chartArr, 'w');
          const bfArr = interpolate(chartArr, 'bf');
          
          // [修正] 為了讓 Tooltip 智慧顯示，將 index 資訊注入 data customData
          const wArrWithMeta = wArr.map((item, idx) => ({
             ...item,
             customData: { index: idx, total: wArr.length, date: chartArr[idx].dateStr }
          }));

          setWeightData(wArrWithMeta);
          setBfData(bfArr);

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

      } catch(e) { console.error(e); } finally { setLoading(false); }
  };

  const chartWidth = SCREEN_WIDTH - 60;
  const barWidth = period === 7 ? 20 : 6;
  const spacing = period === 7 ? 30 : 10; 

  // [修正] Tooltip 智慧定位
  const renderTooltip = (item: any) => {
      const idx = item.customData?.index || 0;
      const total = item.customData?.total || 1;
      const isRightSide = idx > total / 2;
      
      return (
          <View style={{
              position: 'absolute',
              // 如果在右半邊，Tooltip 往左偏 (-100)，否則往右偏 (10)
              left: isRightSide ? -110 : 10, 
              top: -40,
              backgroundColor: 'rgba(0,0,0,0.8)',
              padding: 8,
              borderRadius: 8,
              width: 100,
              zIndex: 1000
          }}>
              <ThemedText style={{color:'white', fontSize:10, fontWeight:'bold'}}>{item.customData?.date}</ThemedText>
              <ThemedText style={{color:'white', fontSize:12}}>{item.value} kg</ThemedText>
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
                // [修正] 調整標籤樣式以顯示完整
                xAxisLabelTextStyle={{fontSize: 10, color: '#888', width: 40}}
              />
          </View>

          {/* Body Metrics Chart */}
          <View style={[styles.card, {marginTop: 16, marginBottom: 40}]}>
              <ThemedText type="subtitle" style={{marginBottom:16}}>{t('chart_title_body', lang)}</ThemedText>
              <View style={{flexDirection:'row', justifyContent:'center', marginBottom:10}}>
                  <ThemedText style={{color:'#FF9500', fontSize:12, marginRight:10}}>━ {t('weight', lang)} {t('axis_l', lang)}</ThemedText>
                  <ThemedText style={{color:'#007AFF', fontSize:12}}>━ {t('body_fat', lang)} {t('axis_r', lang)}</ThemedText>
              </View>
              <LineChart 
                data={weightData} 
                color="#FF9500" 
                thickness={3} 
                dataPointsColor="#FF9500"
                hideRules
                height={180}
                width={chartWidth} 
                // [修正] Spacing 與 BarChart 嚴格對齊 (BarWidth + Spacing)
                // LineChart 點對點距離 = BarChart (Bar + Spacing)
                // initialSpacing 需為 BarWidth/2 以對齊 Bar 中心
                spacing={spacing + barWidth} 
                initialSpacing={barWidth/2}
                curved
                isAnimated
                secondaryData={bfData}
                secondaryLineConfig={{ color: '#007AFF', thickness: 3 }}
                showSecondaryYAxis
                secondaryYAxisColor={theme.text}
                secondaryYAxisLabelTextStyle={{color: '#007AFF', fontSize: 10}}
                // [修正] 智慧 Tooltip
                pointerConfig={{
                    pointerStripUptoDataPoint: true,
                    pointerStripColor: 'lightgray',
                    pointerStripWidth: 2,
                    strokeDashArray: [2, 5],
                    pointerLabelComponent: (items: any) => renderTooltip(items[0]),
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
    grid: { flexDirection:'row', flexWrap:'wrap' }
});