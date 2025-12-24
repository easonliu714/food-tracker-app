import { ScrollView, View, StyleSheet, Dimensions, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { useState, useCallback } from "react";
import { ThemedText } from "@/components/themed-text";
import { useThemeColor } from "@/hooks/use-theme-color";
import { getAggregatedHistory, getProfileLocal } from "@/lib/storage";
import { Svg, Rect, Line, Text as SvgText, G } from "react-native-svg";
import { t, useLanguage } from "@/lib/i18n";

const SCREEN_W = Dimensions.get('window').width;
const CHART_W = SCREEN_W - 32;
const CHART_H = 220;
const NUTRIENT_CHART_H = 150;

export default function AnalysisScreen() {
  const insets = useSafeAreaInsets();
  const lang = useLanguage();
  const [period, setPeriod] = useState<"week"|"month_day"|"month_week"|"year">("week");
  const [history, setHistory] = useState<any[]>([]);
  const [targets, setTargets] = useState({ pro: 60, carb: 300, fat: 65, sod: 2400 });
  
  const backgroundColor = useThemeColor({}, "background");
  const cardBackground = useThemeColor({}, "cardBackground");
  const tintColor = useThemeColor({}, "tint");
  const textSecondary = useThemeColor({}, "textSecondary");

  useFocusEffect(useCallback(() => {
    async function load() {
       const h = await getAggregatedHistory(period);
       setHistory(h);
       const p = await getProfileLocal();
       if (p?.dailyCalorieTarget) {
         const t = p.dailyCalorieTarget;
         setTargets({
           pro: Math.round((t * 0.2) / 4),
           carb: Math.round((t * 0.5) / 4),
           fat: Math.round((t * 0.3) / 9),
           sod: 2400 
         });
       }
    }
    load();
  }, [period]));

  const dataCount = Math.max(history.length, 1);
  const SPACING = CHART_W / dataCount;
  
  const BAR_W = Math.max(4, (SPACING * 0.4));
  const MAX_CAL = 3500;

  const N_BAR_W = Math.max(3, (SPACING * 0.15)); 
  const NUTRIENTS = [
    { key: 'protein', label: t('protein', lang), color: '#4CAF50', target: targets.pro },
    { key: 'carbs', label: t('carbs', lang), color: '#2196F3', target: targets.carb },
    { key: 'fat', label: t('fat', lang), color: '#FF9800', target: targets.fat },
    { key: 'sodium', label: t('sodium', lang), color: '#9C27B0', target: targets.sod },
  ];

  return (
    <View style={[styles.container, { backgroundColor }]}>
       <View style={[styles.header, { paddingTop: Math.max(insets.top, 20) }]}>
          <ThemedText type="title">{t('trend_analysis', lang)}</ThemedText>
       </View>
       <ScrollView style={{padding: 16}}>
          <View style={{flexDirection:'row', justifyContent:'space-around', marginBottom: 16, backgroundColor: cardBackground, padding: 8, borderRadius: 12}}>
             {['week','month_day','month_week','year'].map(p => (
                <Pressable key={p} onPress={()=>setPeriod(p as any)} style={{padding: 8, borderBottomWidth: period===p?2:0, borderColor: tintColor}}>
                   <ThemedText style={{fontWeight: period===p?'bold':'normal', color: period===p?tintColor:'#666'}}>{t(p, lang)}</ThemedText>
                </Pressable>
             ))}
          </View>

          {/* Chart 1 */}
          <View style={[styles.card, {backgroundColor: cardBackground}]}>
             <ThemedText type="subtitle" style={{marginBottom: 10}}>{t('chart_title_cal_weight', lang)}</ThemedText>
             <View style={{flexDirection: 'row', gap: 10, flexWrap:'wrap'}}>
                <ThemedText style={{fontSize: 10, color: '#4CAF50'}}>■ {t('intake', lang)}</ThemedText>
                <ThemedText style={{fontSize: 10, color: '#FF9800'}}>■ {t('burned', lang)}</ThemedText>
                <ThemedText style={{fontSize: 10, color: '#2196F3'}}>━ {t('weight', lang)}</ThemedText>
                <ThemedText style={{fontSize: 10, color: '#9C27B0'}}>-- {t('body_fat', lang)}</ThemedText>
             </View>
             <Svg height={CHART_H + 30} width={CHART_W} style={{marginTop: 10}}>
                <Line x1="0" y1={CHART_H} x2={CHART_W} y2={CHART_H} stroke="#ccc" />
                {history.map((day, i) => {
                   const x = i * SPACING + (SPACING / 2);
                   const hIn = Math.min((day.caloriesIn / MAX_CAL) * CHART_H, CHART_H);
                   const hOut = Math.min((day.caloriesOut / MAX_CAL) * CHART_H, CHART_H);
                   
                   const wNorm = Math.max(0, Math.min(1, (day.weight - 40) / 80)); 
                   const yW = CHART_H - (wNorm * CHART_H);

                   const bfNorm = Math.max(0, Math.min(1, (day.bodyFat - 5) / 35));
                   const yBF = CHART_H - (bfNorm * CHART_H);
                   
                   let nextX, nextYW, nextYBF;
                   if (i < history.length - 1) {
                      const nextDay = history[i+1];
                      nextX = (i+1) * SPACING + (SPACING / 2);
                      const nextWNorm = Math.max(0, Math.min(1, (nextDay.weight - 40) / 80));
                      nextYW = CHART_H - (nextWNorm * CHART_H);
                      
                      const nextBFNorm = Math.max(0, Math.min(1, (nextDay.bodyFat - 5) / 35));
                      nextYBF = CHART_H - (nextBFNorm * CHART_H);
                   }

                   return (
                     <G key={i}>
                        <Rect x={x - BAR_W - 1} y={CHART_H - hIn} width={BAR_W} height={hIn} fill="#4CAF50" rx={2} />
                        <Rect x={x + 1} y={CHART_H - hOut} width={BAR_W} height={hOut} fill="#FF9800" rx={2} />
                        
                        {nextX && (
                          <>
                            <Line x1={x} y1={yW} x2={nextX} y2={nextYW} stroke="#2196F3" strokeWidth="2" />
                            <Line x1={x} y1={yBF} x2={nextX} y2={nextYBF} stroke="#9C27B0" strokeWidth="2" strokeDasharray="3 3" />
                          </>
                        )}
                        
                        {day.weight > 0 && <Rect x={x-2} y={yW-2} width={4} height={4} fill="#2196F3" />}
                        {day.bodyFat > 0 && <Rect x={x-2} y={yBF-2} width={4} height={4} fill="#9C27B0" />}
                        
                        <SvgText x={x} y={CHART_H + 15} fontSize="10" fill={textSecondary} textAnchor="middle">{day.label.slice(-5)}</SvgText>
                     </G>
                   );
                })}
             </Svg>
          </View>

          {/* Chart 2 */}
          <View style={[styles.card, {backgroundColor: cardBackground, marginTop: 16, marginBottom: 50}]}>
             <ThemedText type="subtitle" style={{marginBottom: 10}}>{t('chart_title_nutrients', lang)}</ThemedText>
             <View style={{flexDirection: 'row', gap: 12, flexWrap: 'wrap'}}>
                {NUTRIENTS.map(n => (
                  <ThemedText key={n.key} style={{fontSize: 10, color: n.color}}>■ {n.label}</ThemedText>
                ))}
             </View>
             <Svg height={NUTRIENT_CHART_H + 30} width={CHART_W} style={{marginTop: 10}}>
                <Line x1="0" y1={NUTRIENT_CHART_H * 0.5} x2={CHART_W} y2={NUTRIENT_CHART_H * 0.5} stroke="#FF5252" strokeWidth="1" strokeDasharray="4 2" />
                <SvgText x={5} y={NUTRIENT_CHART_H * 0.5 - 5} fontSize="10" fill="#FF5252">100%</SvgText>
                <Line x1="0" y1={NUTRIENT_CHART_H} x2={CHART_W} y2={NUTRIENT_CHART_H} stroke="#ccc" />
                {history.map((day, i) => {
                   const centerX = i * SPACING + (SPACING / 2);
                   return (
                     <G key={i}>
                        {NUTRIENTS.map((nut, idx) => {
                          const val = day[nut.key] || 0;
                          const percent = Math.min(val / nut.target, 2.0);
                          const barH = percent * (NUTRIENT_CHART_H * 0.5);
                          const x = centerX - (NUTRIENTS.length * N_BAR_W / 2) + (idx * N_BAR_W);
                          return <Rect key={nut.key} x={x} y={NUTRIENT_CHART_H - barH} width={N_BAR_W - 1} height={barH} fill={nut.color} rx={1} />;
                        })}
                        <SvgText x={centerX} y={NUTRIENT_CHART_H + 15} fontSize="10" fill={textSecondary} textAnchor="middle">{day.label.slice(-5)}</SvgText>
                     </G>
                   );
                })}
             </Svg>
          </View>
       </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: 20 },
  card: { padding: 16, borderRadius: 16 }
});