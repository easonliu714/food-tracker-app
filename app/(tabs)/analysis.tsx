import { ScrollView, View, StyleSheet, Dimensions, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { useState, useCallback } from "react";
import { ThemedText } from "@/components/themed-text";
import { useThemeColor } from "@/hooks/use-theme-color";
import { getAggregatedHistory, getProfileLocal, getSettings } from "@/lib/storage";
import { Svg, Rect, Line, Text as SvgText, G } from "react-native-svg";
import { t } from "@/lib/i18n";

const SCREEN_W = Dimensions.get('window').width;
const CHART_W = SCREEN_W - 32;
const CHART_H = 220;

export default function AnalysisScreen() {
  const insets = useSafeAreaInsets();
  const [period, setPeriod] = useState<"week"|"month_day"|"month_week"|"year">("week");
  const [history, setHistory] = useState<any[]>([]);
  const [targets, setTargets] = useState({ pro: 60, carb: 250, fat: 60, sod: 2400 });
  const [lang, setLang] = useState("zh-TW");
  
  const backgroundColor = useThemeColor({}, "background");
  const cardBackground = useThemeColor({}, "cardBackground");
  const tintColor = useThemeColor({}, "tint");

  useFocusEffect(useCallback(() => {
    async function load() {
       const h = await getAggregatedHistory(period);
       setHistory(h);
       
       const s = await getSettings();
       if (s.language) setLang(s.language);

       const p = await getProfileLocal();
       if (p?.dailyCalorieTarget) {
         const t = p.dailyCalorieTarget;
         setTargets({
           pro: Math.round(t * 0.2 / 4),
           carb: Math.round(t * 0.5 / 4),
           fat: Math.round(t * 0.3 / 9),
           sod: 2400
         });
       }
    }
    load();
  }, [period]));

  const dataCount = Math.max(history.length, 1);
  const BAR_W = Math.max(10, (CHART_W / dataCount) * 0.4);
  const SPACING = CHART_W / dataCount;
  
  const MAX_CAL = 3500;
  const MIN_W = 40;
  const MAX_W = 100;
  const BAR_MAX_PERCENT = 1.5; 

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

          <View style={[styles.card, {backgroundColor: cardBackground}]}>
             <View style={{flexDirection: 'row', gap: 12, marginTop: 8}}>
                <ThemedText style={{fontSize: 10, color: '#4CAF50'}}>■ {t('intake', lang)}</ThemedText>
                <ThemedText style={{fontSize: 10, color: '#FF9800'}}>■ {t('burned', lang)}</ThemedText>
                <ThemedText style={{fontSize: 10, color: '#2196F3'}}>━ {t('weight', lang)}</ThemedText>
                <ThemedText style={{fontSize: 10, color: '#9C27B0'}}>● {t('body_fat', lang)}</ThemedText>
             </View>

             <Svg height={CHART_H + 40} width={CHART_W} style={{marginTop: 10}}>
                <Line x1="0" y1={CHART_H} x2={CHART_W} y2={CHART_H} stroke="#ccc" />
                {history.map((day, i) => {
                   const x = i * SPACING + (SPACING / 2);
                   const hIn = Math.min((day.caloriesIn / MAX_CAL) * CHART_H, CHART_H);
                   const hOut = Math.min((day.caloriesOut / MAX_CAL) * CHART_H, CHART_H);
                   const wNorm = Math.max(0, Math.min(1, (day.weight - MIN_W) / (MAX_W - MIN_W)));
                   const yW = CHART_H - (wNorm * CHART_H);

                   let nextX, nextYW;
                   if (i < history.length - 1) {
                      const nextDay = history[i+1];
                      nextX = (i+1) * SPACING + (SPACING / 2);
                      const nextWNorm = Math.max(0, Math.min(1, (nextDay.weight - MIN_W) / (MAX_W - MIN_W)));
                      nextYW = CHART_H - (nextWNorm * CHART_H);
                   }

                   return (
                     <G key={i}>
                        <Rect x={x - BAR_W/2 - 1} y={CHART_H - hIn} width={BAR_W/2} height={hIn} fill="#4CAF50" rx={2} />
                        <Rect x={x + 1} y={CHART_H - hOut} width={BAR_W/2} height={hOut} fill="#FF9800" rx={2} />
                        {nextX && <Line x1={x} y1={yW} x2={nextX} y2={nextYW} stroke="#2196F3" strokeWidth="2" />}
                        {day.weight > 0 && <Rect x={x-2} y={yW-2} width={4} height={4} fill="#2196F3" />}
                        {day.bodyFat > 0 && (
                           <SvgText x={x} y={CHART_H - (day.bodyFat*2) - 5} fontSize="8" fill="#9C27B0" textAnchor="middle">{day.bodyFat}%</SvgText>
                        )}
                        <SvgText x={x} y={CHART_H + 15} fontSize="10" fill="#666" textAnchor="middle">{day.label.slice(-5)}</SvgText>
                     </G>
                   );
                })}
             </Svg>
          </View>

          <View style={[styles.card, {backgroundColor: cardBackground, marginTop: 16, marginBottom: 40}]}>
             <ThemedText type="subtitle">{t('suggestion_limit', lang)}</ThemedText>
             <View style={{backgroundColor: '#E3F2FD', padding: 10, borderRadius: 8, marginVertical: 10}}>
                <ThemedText style={{fontSize: 11, color: '#1565C0'}}>
                   {t('protein', lang)}{targets.pro}g / {t('carbs', lang)}{targets.carb}g / {t('fat', lang)}{targets.fat}g / {t('sodium', lang)}{targets.sod}mg
                </ThemedText>
             </View>

             <Svg height={CHART_H + 40} width={CHART_W}>
                <Line x1="0" y1={CHART_H * (1 - 1/BAR_MAX_PERCENT)} x2={CHART_W} y2={CHART_H * (1 - 1/BAR_MAX_PERCENT)} stroke="#ddd" strokeDasharray="4" />
                
                {history.map((day, i) => {
                   const x = i * SPACING + (SPACING / 2);
                   const microW = BAR_W / 4; 

                   const getH = (v: number, t: number) => Math.min((v/t/BAR_MAX_PERCENT)*CHART_H, CHART_H);
                   const hP = getH(day.protein, targets.pro);
                   const hC = getH(day.carbs, targets.carb);
                   const hF = getH(day.fat, targets.fat);
                   const hS = getH(day.sodium, targets.sod);

                   return (
                     <G key={i}>
                        <Rect x={x - microW*2} y={CHART_H - hP} width={microW} height={hP} fill="#2196F3" />
                        <Rect x={x - microW} y={CHART_H - hC} width={microW} height={hC} fill="#4CAF50" />
                        <Rect x={x} y={CHART_H - hF} width={microW} height={hF} fill="#FFD600" />
                        <Rect x={x + microW} y={CHART_H - hS} width={microW} height={hS} fill="#9C27B0" />
                        <SvgText x={x} y={CHART_H + 15} fontSize="10" fill="#666" textAnchor="middle">{day.label.slice(-5)}</SvgText>
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