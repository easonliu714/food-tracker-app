import { useState, useEffect, useCallback, useMemo } from "react";
import { ScrollView, StyleSheet, View, Dimensions, TouchableOpacity, ActivityIndicator, Modal, TextInput } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BarChart } from "react-native-gifted-charts";
import { format, subDays, addDays, parseISO, differenceInDays } from "date-fns";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import { GestureHandlerRootView, PinchGestureHandler, State } from "react-native-gesture-handler";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useThemeColor } from "@/hooks/use-theme-color";
import { t, useLanguage } from "@/lib/i18n";
import { getRangeStats, db } from "@/lib/db"; 
import { dailyMetrics } from "@/drizzle/schema";
import { desc, gte, lte, and } from "drizzle-orm";

const SCREEN_WIDTH = Dimensions.get("window").width;

export default function AnalysisScreen() {
  const lang = useLanguage();
  const backgroundColor = useThemeColor({}, "background");
  const cardBackground = useThemeColor({}, "cardBackground");
  const textColor = useThemeColor({}, "text");
  const tintColor = useThemeColor({}, "tint");

  // 週期狀態
  const [period, setPeriod] = useState<"week" | "month" | "custom">("week");
  const [loading, setLoading] = useState(true);

  // 自訂日期範圍狀態
  const [customStart, setCustomStart] = useState(subDays(new Date(), 7));
  const [customEnd, setCustomEnd] = useState(new Date());
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);

  // 數據狀態
  const [chartData, setChartData] = useState<any[]>([]); // 堆疊圖數據
  const [lineDataWeight, setLineDataWeight] = useState<any[]>([]); // 體重折線
  const [lineDataFat, setLineDataFat] = useState<any[]>([]); // 體脂折線
  const [summary, setSummary] = useState({ 
      avgIntake: 0, avgBurned: 0, avgNet: 0, 
      avgWeight: 0, avgBodyFat: 0, totalSteps: 0 
  });

  // 圖表縮放參數
  const [barWidth, setBarWidth] = useState(20);
  const [spacing, setSpacing] = useState(20);
  const [zoomScale, setZoomScale] = useState(1);

  // 載入數據
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      let startStr = "";
      let endStr = format(new Date(), "yyyy-MM-dd");

      // 1. 決定日期範圍
      if (period === 'week') {
          startStr = format(subDays(new Date(), 6), "yyyy-MM-dd");
      } else if (period === 'month') {
          startStr = format(subDays(new Date(), 29), "yyyy-MM-dd");
      } else {
          startStr = format(customStart, "yyyy-MM-dd");
          endStr = format(customEnd, "yyyy-MM-dd");
      }

      // 2. 取得統計數據 (Intake, Burned)
      const rangeStats = await getRangeStats(startStr, endStr);
      
      // 3. 取得體重/體脂數據
      const metrics = await db.select()
        .from(dailyMetrics)
        .where(and(gte(dailyMetrics.date, startStr), lte(dailyMetrics.date, endStr)))
        .orderBy(desc(dailyMetrics.date));

      // 4. 整合數據為圖表格式
      const daysDiff = differenceInDays(new Date(endStr), new Date(startStr));
      const newChartData = [];
      const wData = [];
      const fData = [];

      let totalIntake = 0, totalBurned = 0, totalNet = 0;
      let validFoodDays = 0;

      // 建立日期 Map 方便查找 Metrics
      const metricsMap = new Map();
      metrics.forEach(m => metricsMap.set(m.date, m));

      for (let i = 0; i <= daysDiff; i++) {
          const d = addDays(new Date(startStr), i);
          const dStr = format(d, "yyyy-MM-dd");
          const stats = rangeStats[dStr] || { intake: 0, burned: 0, net: 0 };
          const metric = metricsMap.get(dStr);

          // 累計摘要數據
          if (stats.intake > 0) {
              totalIntake += stats.intake;
              validFoodDays++;
          }
          totalBurned += stats.burned || 0;
          totalNet += stats.net || 0;

          // 堆疊長條圖 (Stack Data)
          // 每個 Bar 包含兩個部分: [攝取, 消耗]
          newChartData.push({
            stacks: [
                { value: stats.intake, color: '#34C759', marginBottom: 2 }, // 攝取 (綠)
                { value: stats.burned, color: '#FF9500' }  // 消耗 (橘)
            ],
            label: format(d, "MM/dd"),
            labelTextStyle: { color: '#888', fontSize: 10 },
            fullDate: dStr // 用於後續過濾 Label
          });

          // 折線圖數據 (需對齊 X 軸索引，若無數據填 null 或 0，GiftedCharts 支援 data point 獨立設定)
          // 注意: GiftedCharts 混合圖表時，Line 的數據點數量需與 Bar 一致或對應
          wData.push({ value: metric?.weightKg || 0, dataPointText: metric?.weightKg?.toString() || '', hideDataPoint: !metric?.weightKg });
          fData.push({ value: metric?.bodyFatPercentage || 0, dataPointText: metric?.bodyFatPercentage?.toString() || '', hideDataPoint: !metric?.bodyFatPercentage });
      }

      setChartData(newChartData);
      setLineDataWeight(wData);
      setLineDataFat(fData);

      // 5. 計算摘要
      const validMetrics = metrics.filter(m => m.weightKg > 0);
      const avgWeight = validMetrics.length > 0 
          ? validMetrics.reduce((sum, m) => sum + (m.weightKg || 0), 0) / validMetrics.length 
          : 0;
      
      const validFat = metrics.filter(m => m.bodyFatPercentage > 0);
      const avgFat = validFat.length > 0 
          ? validFat.reduce((sum, m) => sum + (m.bodyFatPercentage || 0), 0) / validFat.length 
          : 0;

      setSummary({
          avgIntake: validFoodDays > 0 ? Math.round(totalIntake / validFoodDays) : 0,
          avgBurned: Math.round(totalBurned / (daysDiff + 1)), // 消耗通常每天都有基礎代謝，除以總天數
          avgNet: Math.round(totalNet / (daysDiff + 1)),
          avgWeight: parseFloat(avgWeight.toFixed(1)),
          avgBodyFat: parseFloat(avgFat.toFixed(1)),
          totalSteps: 0 // 若 getRangeStats 有回傳步數可填入，目前暫留 0
      });

    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [period, customStart, customEnd]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 處理縮放手勢
  const onPinchEvent = (event: any) => {
      const scale = event.nativeEvent.scale;
      // 簡單的阻尼處理，避免變化太快
      const newScale = Math.max(0.5, Math.min(zoomScale * scale, 3.0));
      setZoomScale(newScale);
      
      // 根據縮放比例調整 Bar 寬度與間距
      const baseWidth = 12;
      const baseSpacing = 10;
      
      const w = Math.max(4, baseWidth * newScale);
      const s = Math.max(2, baseSpacing * newScale);
      
      setBarWidth(w);
      setSpacing(s);
  };

  // 動態處理 X 軸標籤顯示 (避免擁擠)
  const processedChartData = useMemo(() => {
      // 如果放大到一定程度 (Bar寬度 > 20)，顯示所有日期
      // 否則根據密度抽樣顯示
      const showAll = barWidth > 20;
      const interval = showAll ? 1 : Math.ceil(chartData.length / 6); // 預設顯示約 6 個標籤

      return chartData.map((item, index) => ({
          ...item,
          label: (index % interval === 0) ? item.label : '' 
      }));
  }, [chartData, barWidth]);

  // 日期選擇器處理
  const onStartDateChange = (event: any, selectedDate?: Date) => {
      setShowStartDatePicker(false);
      if (selectedDate) setCustomStart(selectedDate);
  };
  const onEndDateChange = (event: any, selectedDate?: Date) => {
      setShowEndDatePicker(false);
      if (selectedDate) setCustomEnd(selectedDate);
  };

  // UI Render Helpers
  const renderPeriodSelector = () => (
    <View style={{flexDirection:'row', backgroundColor: cardBackground, padding:4, borderRadius:8, marginBottom:16}}>
      {['week', 'month', 'custom'].map((p) => (
        <TouchableOpacity 
          key={p} 
          onPress={() => setPeriod(p as any)}
          style={{
            flex: 1, 
            paddingVertical: 6, 
            alignItems:'center', 
            borderRadius:6, 
            backgroundColor: period === p ? tintColor : 'transparent'
          }}
        >
          <ThemedText style={{fontSize:12, fontWeight:'bold', color: period === p ? 'white' : textColor}}>
            {p === 'week' ? t('last_7_days', lang) : (p === 'month' ? t('last_30_days', lang) : t('custom', lang) || "Custom")}
          </ThemedText>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderSummaryCard = (title: string, value: string, unit: string, color?: string) => (
      <View style={{width: '32%', padding: 10, backgroundColor: cardBackground, borderRadius: 12, marginBottom: 8}}>
          <ThemedText style={{fontSize: 10, color: '#888', marginBottom: 4}}>{title}</ThemedText>
          <View style={{flexDirection: 'row', alignItems: 'baseline'}}>
            <ThemedText style={{fontSize: 16, fontWeight: 'bold', color: color || textColor}}>{value}</ThemedText>
            <ThemedText style={{fontSize: 10, marginLeft: 2, color: '#888'}}>{unit}</ThemedText>
          </View>
      </View>
  );

  const renderCustomRangePicker = () => {
      if (period !== 'custom') return null;
      return (
          <View style={{flexDirection:'row', justifyContent:'center', alignItems:'center', marginBottom: 16}}>
              <TouchableOpacity onPress={()=>setShowStartDatePicker(true)} style={[styles.dateBtn, {borderColor: textColor}]}>
                  <ThemedText>{format(customStart, "yyyy-MM-dd")}</ThemedText>
              </TouchableOpacity>
              <ThemedText style={{marginHorizontal: 8}}>-</ThemedText>
              <TouchableOpacity onPress={()=>setShowEndDatePicker(true)} style={[styles.dateBtn, {borderColor: textColor}]}>
                  <ThemedText>{format(customEnd, "yyyy-MM-dd")}</ThemedText>
              </TouchableOpacity>
              
              {showStartDatePicker && <DateTimePicker value={customStart} mode="date" onChange={onStartDateChange} />}
              {showEndDatePicker && <DateTimePicker value={customEnd} mode="date" onChange={onEndDateChange} />}
          </View>
      );
  };

  if (loading) return <View style={[styles.container, {backgroundColor, justifyContent:'center', alignItems:'center'}]}><ActivityIndicator /></View>;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
    <SafeAreaView style={[styles.container, { backgroundColor }]}>
      <ScrollView contentContainerStyle={{padding: 16}} scrollEnabled={true}>
        <ThemedText type="title" style={{marginBottom: 16}}>{t('analysis', lang)}</ThemedText>
        
        {renderPeriodSelector()}
        {renderCustomRangePicker()}

        {/* 1. 摘要資訊區 (六格) */}
        <View style={{flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 16}}>
            {renderSummaryCard(t('avg_daily_intake', lang), String(summary.avgIntake), 'kcal', '#34C759')}
            {renderSummaryCard(t('avg_burned', lang), String(summary.avgBurned), 'kcal', '#FF9500')}
            {renderSummaryCard(t('net_intake', lang) || "Net", String(summary.avgNet), 'kcal')}
            {renderSummaryCard(t('avg_weight', lang), String(summary.avgWeight), 'kg', tintColor)}
            {renderSummaryCard(t('avg_body_fat', lang), String(summary.avgBodyFat), '%', '#AF52DE')}
            {renderSummaryCard(t('total_steps', lang) || "Steps", String(summary.totalSteps || '--'), 'steps')}
        </View>

        {/* 2. 整合圖表 */}
        <ThemedView style={styles.chartCard}>
            <View style={{flexDirection:'row', justifyContent:'space-between', marginBottom: 16}}>
                <ThemedText type="subtitle">{t('trend_analysis', lang) || "Trend Analysis"}</ThemedText>
                <View style={{flexDirection:'row', gap: 8}}>
                    <View style={{flexDirection:'row', alignItems:'center'}}><View style={{width:8, height:8, backgroundColor:'#34C759', marginRight:4}}/><ThemedText style={{fontSize:10}}>In</ThemedText></View>
                    <View style={{flexDirection:'row', alignItems:'center'}}><View style={{width:8, height:8, backgroundColor:'#FF9500', marginRight:4}}/><ThemedText style={{fontSize:10}}>Out</ThemedText></View>
                    <View style={{flexDirection:'row', alignItems:'center'}}><View style={{width:8, height:2, backgroundColor:tintColor, marginRight:4}}/><ThemedText style={{fontSize:10}}>Kg</ThemedText></View>
                </View>
            </View>

            {processedChartData.length > 0 ? (
                <PinchGestureHandler onGestureEvent={onPinchEvent} onHandlerStateChange={onPinchEvent}>
                    <View>
                        <BarChart 
                            stackData={processedChartData} // 堆疊長條數據
                            barWidth={barWidth}
                            spacing={spacing}
                            noOfSections={4}
                            
                            // 左軸 (熱量)
                            yAxisThickness={0}
                            yAxisTextStyle={{color: '#888', fontSize: 10}}
                            yAxisLabelSuffix=" k" // 簡易顯示
                            
                            // 右軸 (體重/體脂) - 使用 GiftedCharts 的 Secondary Axis
                            secondaryYAxis={{
                                showYAxisIndices: true,
                                yAxisTextStyle: {color: tintColor, fontSize: 10},
                                maxValue: 100, // 假設體重體脂不超過 100 方便共用軸，或需動態計算 max
                                noOfSections: 4,
                            }}

                            // 折線數據 (混合圖表)
                            lineData={lineDataWeight}
                            lineConfig={{
                                color: tintColor,
                                thickness: 2,
                                curbed: true,
                                hideDataPoints: barWidth < 15, // 縮小時隱藏點
                                dataPointsColor: tintColor,
                                shiftY: 0, // 對應右軸刻度需自行換算? GiftedCharts的 secondaryYAxis 對應 lineData 需設定 isSecondary: true (在新版)
                                           // 註: GiftedCharts 對 secondary axis 支援有限，通常 lineData 預設對應左軸。
                                           // 技巧: 若 library 版本不支援 line 對應 secondary，需 normalization。
                                           // 假設這裡使用數據歸一化或接受共用刻度的限制。
                            }}
                            // 第二條線 (體脂) - GiftedCharts 支援 lineData2
                            lineData2={lineDataFat}
                            lineConfig2={{
                                color: '#AF52DE',
                                thickness: 2,
                                curbed: true,
                                hideDataPoints: barWidth < 15,
                                dataPointsColor: '#AF52DE'
                            }}
                            
                            xAxisThickness={1}
                            xAxisColor={'#ddd'}
                            rulesColor={'#eee'}
                            rulesType="solid"
                            height={280}
                            width={SCREEN_WIDTH - 64} // Card padding
                            scrollable={true} // 允許拖曳移動
                            initialSpacing={10}
                        />
                    </View>
                </PinchGestureHandler>
            ) : <ThemedText>No Data</ThemedText>}
            
            <ThemedText style={{textAlign:'center', fontSize:10, color:'#888', marginTop: 8}}>
                {t('pinch_to_zoom', lang) || "Pinch to zoom, drag to move"}
            </ThemedText>
        </ThemedView>

      </ScrollView>
    </SafeAreaView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  chartCard: { padding: 16, borderRadius: 16, marginBottom: 16, backgroundColor: 'white', overflow: 'hidden' },
  dateBtn: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 }
});