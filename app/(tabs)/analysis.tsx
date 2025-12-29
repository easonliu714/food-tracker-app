import React, { useState, useCallback } from "react";
import { View, ScrollView, StyleSheet, Dimensions, ActivityIndicator, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ThemedText } from "@/components/themed-text";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { BarChart, LineChart } from "react-native-gifted-charts";
import { useFocusEffect } from "expo-router";
import { db } from "@/lib/db";
import { foodLogs, dailyMetrics } from "@/drizzle/schema";
import { desc, sql, gte, lte } from "drizzle-orm";
import { format, subDays, startOfWeek, endOfWeek, eachDayOfInterval } from "date-fns";

const SCREEN_WIDTH = Dimensions.get("window").width;

export default function AnalysisScreen() {
  const colorScheme = useColorScheme() ?? "light";
  const theme = Colors[colorScheme];
  const [loading, setLoading] = useState(true);
  const [barData, setBarData] = useState<any[]>([]);
  const [lineData, setLineData] = useState<any[]>([]);
  const [nutrientData, setNutrientData] = useState<any[]>([]);
  const [selectedBar, setSelectedBar] = useState<any>(null);

  useFocusEffect(
    useCallback(() => {
      async function load() {
        setLoading(true);
        try {
            // 1. 最近 7 天熱量 (Bar Chart)
            const endDate = new Date();
            const startDate = subDays(endDate, 6);
            const dateRange = eachDayOfInterval({ start: startDate, end: endDate });
            
            // 預填空資料
            const chartMap = new Map();
            dateRange.forEach(d => {
                const k = format(d, 'yyyy-MM-dd');
                chartMap.set(k, { val: 0, label: format(d, 'MM/dd') });
            });

            const logs = await db.select({
                date: foodLogs.date,
                calories: foodLogs.totalCalories
            }).from(foodLogs).where(gte(foodLogs.date, format(startDate, 'yyyy-MM-dd')));

            logs.forEach(l => {
                if (chartMap.has(l.date)) {
                    const curr = chartMap.get(l.date);
                    curr.val += l.calories;
                }
            });

            const bars = Array.from(chartMap.values()).map((v: any) => ({
                value: v.val,
                label: v.label,
                frontColor: theme.tint,
                onPress: () => setSelectedBar(v)
            }));
            setBarData(bars);

            // 2. 體重趨勢 (Line Chart)
            const metrics = await db.select().from(dailyMetrics)
                .where(gte(dailyMetrics.date, format(startDate, 'yyyy-MM-dd')))
                .orderBy(desc(dailyMetrics.date));
            
            const weightData = metrics.map(m => ({ 
                value: m.weightKg, 
                label: m.date.slice(5),
                dataPointText: String(m.weightKg) 
            })).reverse();
            
            setLineData(weightData.length ? weightData : [{value: 0}]);

        } catch(e) { console.error(e); }
        finally { setLoading(false); }
      }
      load();
    }, [])
  );

  return (
    <SafeAreaView style={[styles.container, {backgroundColor: theme.background}]}>
       <ScrollView contentContainerStyle={{padding: 16}}>
          <ThemedText type="title" style={{marginBottom: 20}}>數據分析</ThemedText>
          
          <View style={styles.chartCard}>
              <ThemedText type="subtitle" style={{marginBottom:10}}>本週熱量攝取</ThemedText>
              {selectedBar && (
                  <View style={{position:'absolute', top: 10, right: 10, backgroundColor:'#FFF', padding:4, borderRadius:4, borderWidth:1, borderColor:'#ddd'}}>
                      <ThemedText style={{fontSize:12, color:theme.tint}}>{selectedBar.label}: {Math.round(selectedBar.val)} kcal</ThemedText>
                  </View>
              )}
              {barData.length > 0 ? (
                  <BarChart 
                    data={barData} 
                    barWidth={22} 
                    noOfSections={3} 
                    barBorderRadius={4} 
                    yAxisThickness={0} 
                    xAxisThickness={0}
                    hideRules
                    height={180}
                    width={SCREEN_WIDTH - 80}
                    isAnimated
                  />
              ) : <ActivityIndicator/>}
          </View>

          <View style={[styles.chartCard, {marginTop: 20}]}>
              <ThemedText type="subtitle" style={{marginBottom:10}}>體重趨勢</ThemedText>
              {lineData.length > 0 && lineData[0].value > 0 ? (
                  <LineChart 
                    data={lineData} 
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
              ) : <ThemedText style={{color:'#888', textAlign:'center', marginVertical: 20}}>尚無體重紀錄</ThemedText>}
          </View>
       </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    chartCard: { padding: 16, borderRadius: 16, backgroundColor: 'rgba(120,120,120,0.05)', overflow: 'hidden' }
});