import { useState, useCallback } from "react";
import { View, ScrollView, RefreshControl, StyleSheet, Dimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BarChart } from "react-native-gifted-charts";
import { useFocusEffect } from "expo-router";
import { ThemedText } from "@/components/themed-text";
import { useThemeColor } from "@/hooks/use-theme-color";
import { getFoodLogsLocal, getProfileLocal } from "@/lib/storage";
import { t, useLanguage } from "@/lib/i18n";

export default function AnalysisScreen() {
  const insets = useSafeAreaInsets();
  const lang = useLanguage();
  const [refreshing, setRefreshing] = useState(false);
  
  const [weeklyData, setWeeklyData] = useState<any[]>([]);
  const [macroData, setMacroData] = useState<any[]>([]);
  const [dailyTargets, setDailyTargets] = useState({ p: 60, c: 250, f: 60, s: 2300 }); // [修正] 加入鈉建議值

  const backgroundColor = useThemeColor({}, "background");
  const cardBackground = useThemeColor({}, "cardBackground");
  const tintColor = useThemeColor({}, "tint");
  const textColor = useThemeColor({}, "text");
  const textSecondary = useThemeColor({}, "textSecondary");

  const loadData = useCallback(async () => {
    const logs = await getFoodLogsLocal();
    const profile = await getProfileLocal();
    
    // 計算每日建議量
    if (profile?.dailyCalorieTarget) {
      const cal = profile.dailyCalorieTarget;
      setDailyTargets({
        p: Math.round((cal * 0.2) / 4),
        c: Math.round((cal * 0.5) / 4),
        f: Math.round((cal * 0.3) / 9),
        s: 2300 // 鈉建議量通常固定為 2300mg
      });
    }

    const now = new Date();
    const weekMap = new Map();
    // 初始化過去7天
    for(let i=6; i>=0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const k = d.toISOString().split('T')[0];
      weekMap.set(k, { cal: 0, p: 0, c: 0, f: 0, s: 0, date: k.slice(5) }); // [修正] 加入 s (Sodium)
    }

    logs.forEach((log: any) => {
      const dateKey = log.loggedAt.split('T')[0];
      if (weekMap.has(dateKey)) {
        const curr = weekMap.get(dateKey);
        weekMap.set(dateKey, {
          ...curr,
          cal: curr.cal + (log.totalCalories || 0),
          p: curr.p + (log.totalProteinG || 0),
          c: curr.c + (log.totalCarbsG || 0),
          f: curr.f + (log.totalFatG || 0),
          s: curr.s + (log.totalSodiumMg || 0) // [修正] 累加鈉
        });
      }
    });

    // 1. 熱量圖表數據
    const calData = Array.from(weekMap.values()).map((d: any) => ({
      value: d.cal,
      label: d.date,
      frontColor: tintColor,
      topLabelComponent: () => <ThemedText style={{fontSize:10, color: textSecondary}}>{d.cal}</ThemedText>
    }));
    setWeeklyData(calData);

    // 2. 營養素圖表數據 (Grouped Bar)
    // [修正] 改為 4 條 Bar (P, C, F, S)
    const nutData: any[] = [];
    Array.from(weekMap.values()).forEach((d: any) => {
      nutData.push(
        { value: d.p, label: d.date, spacing: 2, labelWidth: 30, labelTextStyle: {fontSize: 10, color: textColor}, frontColor: '#4CAF50' }, // Protein
        { value: d.c, spacing: 2, frontColor: '#2196F3' }, // Carbs
        { value: d.f, spacing: 2, frontColor: '#FF9800' },  // Fat
        { value: d.s, spacing: 20, frontColor: '#9C27B0' } // Sodium (Purple), Spacing 加大分組
      );
    });
    setMacroData(nutData);

  }, []);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 20) }]}>
        <ThemedText type="title">{t('tab_analysis', lang)}</ThemedText>
      </View>

      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadData} />}>
        <View style={{ paddingHorizontal: 16 }}>
          {/* Chart 1: Calorie Trend */}
          <View style={[styles.card, { backgroundColor: cardBackground }]}>
            <ThemedText type="subtitle" style={{marginBottom: 20}}>{t('trend_analysis', lang)} (Kcal)</ThemedText>
            <BarChart
              data={weeklyData}
              barWidth={22}
              noOfSections={4}
              barBorderRadius={4}
              frontColor={tintColor}
              yAxisThickness={0}
              xAxisThickness={0}
              hideRules
              yAxisTextStyle={{color: textColor}}
              xAxisLabelTextStyle={{color: textColor, fontSize: 10}}
              showGradient={false}
            />
          </View>

          {/* Chart 2: Nutrient Trend (Grouped) */}
          <View style={[styles.card, { backgroundColor: cardBackground, marginTop: 20 }]}>
            <ThemedText type="subtitle" style={{marginBottom: 10}}>{t('nutrition_distribution', lang)}</ThemedText>
            
            {/* 建議量基準線說明 */}
            <View style={{flexDirection:'row', flexWrap:'wrap', gap:10, marginBottom:15, padding:10, backgroundColor: 'rgba(0,0,0,0.05)', borderRadius:8}}>
               <View style={{flexDirection:'row', alignItems:'center'}}><View style={{width:8,height:8,backgroundColor:'#4CAF50', marginRight:4}}/><ThemedText style={{fontSize:10}}>Pro: {dailyTargets.p}g</ThemedText></View>
               <View style={{flexDirection:'row', alignItems:'center'}}><View style={{width:8,height:8,backgroundColor:'#2196F3', marginRight:4}}/><ThemedText style={{fontSize:10}}>Carb: {dailyTargets.c}g</ThemedText></View>
               <View style={{flexDirection:'row', alignItems:'center'}}><View style={{width:8,height:8,backgroundColor:'#FF9800', marginRight:4}}/><ThemedText style={{fontSize:10}}>Fat: {dailyTargets.f}g</ThemedText></View>
               <View style={{flexDirection:'row', alignItems:'center'}}><View style={{width:8,height:8,backgroundColor:'#9C27B0', marginRight:4}}/><ThemedText style={{fontSize:10}}>Sod: 2300mg</ThemedText></View>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <BarChart
                data={macroData}
                barWidth={8} // [修正] 稍微調窄一點以容納4條
                spacing={24} // spacing controlled in data
                roundedTop
                hideRules
                xAxisThickness={0}
                yAxisThickness={0}
                yAxisTextStyle={{color: textColor}}
                noOfSections={4}
                maxValue={3000} // [注意] 因為納是 mg (例如 2300)，會把 Y 軸撐大，導致 P/C/F (如 60) 看起來很矮。這是正常的物理限制。
                showGradient={false}
              />
            </ScrollView>
          </View>
        </View>
        <View style={{height: 100}}/>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: 20 },
  card: { padding: 20, borderRadius: 16, alignItems: 'center' }
});