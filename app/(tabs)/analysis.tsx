import React, { useState, useCallback, useRef, useEffect } from "react";
import { View, ScrollView, StyleSheet, Dimensions, Pressable, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ThemedText } from "@/components/themed-text";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { BarChart } from "react-native-gifted-charts"; 
import { useFocusEffect } from "expo-router";
import { db } from "@/lib/db";
import { foodLogs, dailyMetrics, activityLogs } from "@/drizzle/schema";
import { gte } from "drizzle-orm";
import { format, subDays, eachDayOfInterval } from "date-fns";
import { t, useLanguage } from "@/lib/i18n";

const SCREEN_WIDTH = Dimensions.get("window").width;
const VISIBLE_WIDTH = SCREEN_WIDTH - 48; 

export default function AnalysisScreen() {
  const theme = Colors[useColorScheme() ?? "light"];
  const lang = useLanguage();
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<7 | 30>(7);
  
  const [chartData, setChartData] = useState<any[]>([]);
  const [lineData, setLineData] = useState<any[]>([]);     
  const [lineData2, setLineData2] = useState<any[]>([]);   
  const [summary, setSummary] = useState({ avgIn: 0, avgOut: 0, avgPro: 0, avgFat: 0, avgCarb: 0, avgSod: 0 });
  
  // [NEW] 用於處理雙軸縮放的參數
  const [axisConfig, setAxisConfig] = useState({
      maxCal: 2500,
      maxWeight: 100,
      scaleFactor: 1, // 用於將體重映射到熱量軸的比例
      yAxisLabelTexts: ['0', '25', '50', '75', '100'] // 右側軸的顯示標籤
  });

  const chartRef = useRef<any>(null);

  const barConfig = period === 30 
    ? { barWidth: 8, spacing: 12, initialSpacing: 10 }
    : { barWidth: 20, spacing: 24, initialSpacing: 20 };

  useFocusEffect(
    useCallback(() => { loadAnalysis(period); }, [period])
  );

  // [FIX] 確保資料載入後捲動到最右側 (最新日期)
  useEffect(() => {
      if (chartData.length > 0 && chartRef.current) {
          setTimeout(() => {
              chartRef.current.scrollToEnd({ animated: false }); 
          }, 300); // 延遲確保渲染完成
      }
  }, [chartData]);

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

          // Fetch Data
          const logs = await db.select().from(foodLogs).where(gte(foodLogs.date, strStart));
          const acts = await db.select().from(activityLogs).where(gte(activityLogs.date, strStart));
          const metrics = await db.select().from(dailyMetrics).where(gte(dailyMetrics.date, strStart));

          let maxCalVal = 2000; 
          let maxWeightVal = 80;

          logs.forEach(l => {
              if (dataMap.has(l.date)) {
                  const d = dataMap.get(l.date);
                  d.in += l.totalCalories || 0;
                  d.pro += l.totalProteinG || 0;
                  d.fat += l.totalFatG || 0;
                  d.carb += l.totalCarbsG || 0;
                  d.sod += l.totalSodiumMg || 0;
                  d.hasData = true;
                  if (d.in > maxCalVal) maxCalVal = d.in;
              }
          });
          acts.forEach(a => {
              if (dataMap.has(a.date)) {
                  const d = dataMap.get(a.date);
                  d.out += a.caloriesBurned || 0; 
                  d.hasData = true;
                  if (d.out > maxCalVal) maxCalVal = d.out; // 消耗也納入最大值考量
              }
          });
          metrics.forEach(m => {
              if (dataMap.has(m.date)) {
                  const d = dataMap.get(m.date);
                  if (m.weightKg && m.weightKg > 0) {
                      d.w = m.weightKg;
                      if (d.w > maxWeightVal) maxWeightVal = d.w;
                  }
                  if (m.bodyFatPercentage && m.bodyFatPercentage > 0) d.bf = m.bodyFatPercentage;
              }
          });

          // [FIX] 計算雙軸縮放參數
          // 1. 熱量軸最大值 (取 500 的倍數)
          const finalMaxCal = Math.ceil(maxCalVal / 500) * 500;
          // 2. 體重軸最大值 (取 10 的倍數)
          const finalMaxWeight = Math.ceil((maxWeightVal + 10) / 10) * 10;
          // 3. 縮放比例 (讓體重數值能 mapping 到熱量軸的高度)
          const factor = finalMaxCal / finalMaxWeight;

          // 產生右側軸的標籤文字 (0, 20%, 40%, 60%, 80%, 100% of maxWeight)
          const yAxisLabels = [
              '0', 
              Math.round(finalMaxWeight * 0.25).toString(),
              Math.round(finalMaxWeight * 0.5).toString(),
              Math.round(finalMaxWeight * 0.75).toString(),
              Math.round(finalMaxWeight).toString()
          ];

          setAxisConfig({
              maxCal: finalMaxCal,
              maxWeight: finalMaxWeight,
              scaleFactor: factor,
              yAxisLabelTexts: yAxisLabels
          });

          const sortedArr = Array.from(dataMap.values()).sort((a:any, b:any) => a.dateStr.localeCompare(b.dateStr));

          // 構建 Bar Data
          const bars = sortedArr.map((d, idx) => ({
              label: d.label,
              labelTextStyle: { fontSize: 10, color: '#888', width: 40, textAlign: 'center' },
              stacks: [
                  { value: d.in, color: '#34C759', marginBottom: 1 }, 
                  { value: -d.out, color: '#FF9500' }, 
              ],
              customData: { ...d, index: idx } 
          }));

          // 構建 Line Data (使用縮放後的值繪圖，Tooltip 顯示真實值)
          const interpolate = (arr: any[], key: string) => {
             const knownIndices = arr.map((item, i) => item[key] !== null ? i : -1).filter(i => i !== -1);
             return arr.map((item, i) => {
                 if (item[key] !== null) {
                     return { 
                         value: item[key] * factor, // [Scaling] 放大數值以配合左軸高度
                         dataPointText: String(item[key]),
                         customData: { type: 'real', dateStr: item.dateStr, name: key==='w'?'Weight':'BodyFat', realVal: item[key] }
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
                     value: (val > 0 ? val : 0) * factor, // [Scaling]
                     hideDataPoint: true, 
                     customData: { type: 'interpolated', dateStr: item.dateStr, realVal: Number(val.toFixed(1)) }
                 };
             });
          };

          setChartData(bars);
          setLineData(interpolate(sortedArr, 'w'));
          setLineData2(interpolate(sortedArr, 'bf'));

          // 計算平均值
          const validInDays = sortedArr.filter(d => d.in > 0).length || 1;
          const validOutDays = sortedArr.filter(d => d.out > 0).length || 1;
          const validMacroDays = sortedArr.filter(d => d.hasData).length || 1;
          const sum = sortedArr.reduce((acc, cur) => ({
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

  const renderTooltip = (item: any) => {
      if (!item.customData) return null;
      const isRightSide = item.customData.index > (chartData.length / 2);
      
      return (
          <View style={[styles.tooltip, { left: isRightSide ? -110 : 10, top: 0 }]}>
              <ThemedText style={styles.tooltipTitle}>{item.customData.dateStr}</ThemedText>
              <ThemedText style={styles.tooltipText}>➕ {t('intake', lang)}: {Math.round(item.customData.in)}</ThemedText>
              <ThemedText style={styles.tooltipText}>➖ {t('burned', lang)}: {Math.round(item.customData.out)}</ThemedText>
              {item.customData.w && <ThemedText style={styles.tooltipText}>⚖️ {t('weight', lang)}: {item.customData.w} kg</ThemedText>}
              {item.customData.bf && <ThemedText style={styles.tooltipText}>💧 {t('body_fat', lang)}: {item.customData.bf} %</ThemedText>}
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

          <View style={[styles.card, {marginTop: 16, marginBottom: 40}]}>
              <ThemedText type="subtitle" style={{marginBottom:16}}>{t('calories_and_weight', lang)}</ThemedText>
              
              <View style={{flexDirection:'row', justifyContent:'center', marginBottom:10, gap: 16, flexWrap: 'wrap'}}>
                  <LegendItem color="#34C759" label={`${t('intake', lang)}`} />
                  <LegendItem color="#FF9500" label={`${t('burned', lang)}`} />
                  <LegendItem color="#007AFF" label={`${t('weight', lang)}`} isLine />
                  <LegendItem color="#AF52DE" label={`${t('body_fat', lang)}`} isLine />
              </View>

              {loading ? <ActivityIndicator size="large" color={theme.tint}/> : (
                  <BarChart 
                    ref={chartRef}
                    data={chartData} 
                    stackData={chartData} 
                    barWidth={barConfig.barWidth} 
                    spacing={barConfig.spacing}
                    initialSpacing={barConfig.initialSpacing}
                    noOfSections={4} 
                    maxValue={axisConfig.maxCal} // 左軸最大值
                    barBorderRadius={4} 
                    xAxisThickness={1}
                    xAxisColor={theme.icon}
                    yAxisThickness={0}
                    yAxisTextStyle={{ fontSize: 10, color: '#34C759' }}
                    hideRules
                    height={220}
                    width={VISIBLE_WIDTH} 
                      // [新增] 加入右側留白，避免最後一筆日期的文字或數值被切掉
                    endSpacing={50} 
                    isAnimated={false} 
                    // 建議同時檢查這項，確保 X 軸標籤不會因為過寬而重疊或截斷
                    xAxisLabelTextStyle={{fontSize: 9, color: '#888', width: 50, textAlign: 'center'}}
                    renderTooltip={renderTooltip}
                    
                    // [FIX] 啟用右側 Y 軸並手動設定標籤
                    showSecondaryYAxis
                    secondaryYAxisConfig={{
                        noOfSections: 4,
                        maxValue: axisConfig.maxCal, // 這裡必須設為跟主軸一樣，才能對齊 grid
                        showYAxisIndices: true,
                        yAxisLabelTexts: axisConfig.yAxisLabelTexts, // 顯示真實體重數值
                        yAxisTextStyle: { color: '#007AFF', fontSize: 10 },
                    }}

                    showLine
                    lineData={lineData} 
                    lineConfig={{
                        color: '#007AFF',
                        thickness: 3,
                        curved: true,
                        hideDataPoints: false,
                        dataPointsColor: '#007AFF',
                        dataPointsRadius: 3,
                        textShiftY: -10,
                        textFontSize: 9,
                        textColor: '#007AFF',
                        zIndex: 100
                    }}
                    
                    lineData2={lineData2} 
                    lineConfig2={{
                        color: '#AF52DE',
                        thickness: 3,
                        curved: true,
                        hideDataPoints: false,
                        dataPointsColor: '#AF52DE',
                        dataPointsRadius: 3,
                        textShiftY: 10,
                        textFontSize: 9,
                        textColor: '#AF52DE',
                        zIndex: 100
                    }}
                  />
              )}
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

const LegendItem = ({color, label, isLine}: any) => (
    <View style={{flexDirection:'row', alignItems:'center'}}>
        <View style={{width:12, height: isLine?3:12, backgroundColor:color, marginRight:4}}/>
        <ThemedText style={{fontSize:10}}>{label}</ThemedText>
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
        minWidth: 120,
        zIndex: 9999, 
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)'
    },
    tooltipTitle: { color: 'white', fontSize: 11, fontWeight: 'bold', marginBottom: 4 },
    tooltipText: { color: 'white', fontSize: 12, lineHeight: 16 }
});
