import { useState, useCallback } from "react";
import { View, ScrollView, RefreshControl, StyleSheet, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BarChart } from "react-native-gifted-charts";
import { useFocusEffect } from "expo-router";
import { ThemedText } from "@/components/themed-text";
import { useThemeColor } from "@/hooks/use-theme-color";
import { getAggregatedHistory, getProfileLocal } from "@/lib/storage";
import { t, useLanguage } from "@/lib/i18n";

export default function AnalysisScreen() {
  const insets = useSafeAreaInsets();
  const lang = useLanguage();
  const [refreshing, setRefreshing] = useState(false);
  
  const [period, setPeriod] = useState<'week'|'month_day'|'year'>('week');
  const [chartData, setChartData] = useState<any[]>([]);
  const [macroData, setMacroData] = useState<any[]>([]);
  const [dailyTargets, setDailyTargets] = useState({ p: 60, c: 250, f: 60, s: 2300 });

  const backgroundColor = useThemeColor({}, "background");
  const cardBackground = useThemeColor({}, "cardBackground");
  const tintColor = useThemeColor({}, "tint");
  const textColor = useThemeColor({}, "text");
  const textSecondary = useThemeColor({}, "textSecondary");

  const loadData = useCallback(async () => {
    const profile = await getProfileLocal();
    if (profile?.dailyCalorieTarget) {
      const cal = profile.dailyCalorieTarget;
      setDailyTargets({
        p: Math.round((cal * 0.2) / 4),
        c: Math.round((cal * 0.5) / 4),
        f: Math.round((cal * 0.3) / 9),
        s: 2300
      });
    }

    const history = await getAggregatedHistory(period);

    const cData = history.map((item: any) => ({
      value: item.caloriesIn,
      label: item.label,
      frontColor: tintColor,
      topLabelComponent: () => <ThemedText style={{fontSize:10, color: textSecondary}}>{item.caloriesIn}</ThemedText>
    }));
    setChartData(cData);

    const mData: any[] = [];
    history.forEach((item: any) => {
      mData.push(
        { value: item.protein, label: item.label, spacing: 2, labelWidth: 30, labelTextStyle: {fontSize: 10, color: textColor, transform: [{rotate: '90deg'}]}, frontColor: '#4CAF50' }, 
        { value: item.carbs, spacing: 2, frontColor: '#2196F3' }, 
        { value: item.fat, spacing: 2, frontColor: '#FF9800' },  
        { value: item.sodium, spacing: 20, frontColor: '#9C27B0' } 
      );
    });
    setMacroData(mData);

  }, [period]);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const PeriodSelector = () => (
    <View style={{flexDirection:'row', backgroundColor:'#e0e0e0', borderRadius:8, padding:2, marginHorizontal:20, marginBottom:16}}>
      {[
        {k:'week', l: t('week', lang)}, 
        {k:'month_day', l: t('month_day', lang)}, 
        {k:'year', l: t('year', lang)}
      ].map((item: any) => (
        <Pressable key={item.k} onPress={()=>setPeriod(item.k)} style={{flex:1, paddingVertical:6, alignItems:'center', borderRadius:6, backgroundColor: period===item.k?'white':'transparent'}}>
           <ThemedText style={{fontWeight: period===item.k?'bold':'normal', color: period===item.k?tintColor:'#666'}}>{item.l}</ThemedText>
        </Pressable>
      ))}
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 20) }]}>
        <ThemedText type="title">{t('tab_analysis', lang)}</ThemedText>
      </View>

      <PeriodSelector />

      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadData} />}>
        <View style={{ paddingHorizontal: 16 }}>
          <View style={[styles.card, { backgroundColor: cardBackground }]}>
            <ThemedText type="subtitle" style={{marginBottom: 20}}>{t('trend_analysis', lang)} (Kcal)</ThemedText>
            <BarChart
              data={chartData}
              barWidth={22}
              noOfSections={4}
              barBorderRadius={4}
              frontColor={tintColor}
              yAxisThickness={0}
              xAxisThickness={0}
              hideRules
              yAxisTextStyle={{color: textColor}}
              // [修正] X 軸文字轉 90 度
              xAxisLabelTextStyle={{color: textColor, fontSize: 10, width: 40, textAlign:'center', transform: [{rotate: '90deg'}]}}
              showGradient={false}
            />
          </View>

          <View style={[styles.card, { backgroundColor: cardBackground, marginTop: 20 }]}>
            <ThemedText type="subtitle" style={{marginBottom: 10}}>{t('nutrition_distribution', lang)}</ThemedText>
            <View style={{flexDirection:'row', flexWrap:'wrap', gap:10, marginBottom:15, padding:10, backgroundColor: 'rgba(0,0,0,0.05)', borderRadius:8}}>
               <View style={{flexDirection:'row', alignItems:'center'}}><View style={{width:8,height:8,backgroundColor:'#4CAF50', marginRight:4}}/><ThemedText style={{fontSize:10}}>Pro: {dailyTargets.p}g</ThemedText></View>
               <View style={{flexDirection:'row', alignItems:'center'}}><View style={{width:8,height:8,backgroundColor:'#2196F3', marginRight:4}}/><ThemedText style={{fontSize:10}}>Carb: {dailyTargets.c}g</ThemedText></View>
               <View style={{flexDirection:'row', alignItems:'center'}}><View style={{width:8,height:8,backgroundColor:'#FF9800', marginRight:4}}/><ThemedText style={{fontSize:10}}>Fat: {dailyTargets.f}g</ThemedText></View>
               <View style={{flexDirection:'row', alignItems:'center'}}><View style={{width:8,height:8,backgroundColor:'#9C27B0', marginRight:4}}/><ThemedText style={{fontSize:10}}>Sod: 2300mg</ThemedText></View>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <BarChart
                data={macroData}
                barWidth={8}
                spacing={24}
                roundedTop
                hideRules
                xAxisThickness={0}
                yAxisThickness={0}
                yAxisTextStyle={{color: textColor}}
                noOfSections={4}
                maxValue={3000}
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