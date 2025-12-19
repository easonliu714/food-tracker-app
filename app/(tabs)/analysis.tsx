import { ScrollView, View, StyleSheet, Dimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { useState, useCallback } from "react";
import { ThemedText } from "@/components/themed-text";
import { useThemeColor } from "@/hooks/use-theme-color";
import { getHistory7DaysLocal } from "@/lib/storage";
import { Svg, Rect, Line, Text as SvgText, G } from "react-native-svg";

export default function AnalysisScreen() {
  const insets = useSafeAreaInsets();
  const [history, setHistory] = useState<any[]>([]);
  const backgroundColor = useThemeColor({}, "background");
  const cardBackground = useThemeColor({}, "cardBackground");

  useFocusEffect(useCallback(() => {
    async function load() {
       const h = await getHistory7DaysLocal();
       setHistory(h);
    }
    load();
  }, []));

  const CHART_H = 220;
  const CHART_W = Dimensions.get('window').width - 64;
  const BAR_W = 12; 
  const SPACING = (CHART_W - 20) / 6; 
  const MAX_CAL = 3500;
  const MIN_W = 40;
  const MAX_W = 100;

  return (
    <View style={[styles.container, { backgroundColor }]}>
       <View style={[styles.header, { paddingTop: Math.max(insets.top, 20) }]}>
          <ThemedText type="title">趨勢分析</ThemedText>
       </View>
       <ScrollView style={{padding: 16}}>
          <View style={[styles.card, {backgroundColor: cardBackground, marginBottom: 40}]}>
             <ThemedText type="subtitle">熱量(Bar) & 體重(Line)</ThemedText>
             
             <View style={{flexDirection: 'row', gap: 12, marginTop: 8}}>
                <ThemedText style={{fontSize: 12, color: '#4CAF50'}}>■ 攝取</ThemedText>
                <ThemedText style={{fontSize: 12, color: '#FF9800'}}>■ 消耗</ThemedText>
                <ThemedText style={{fontSize: 12, color: '#2196F3'}}>━ 體重</ThemedText>
             </View>

             <Svg height={CHART_H + 30} width="100%" style={{marginTop: 20}}>
                <Line x1="0" y1={CHART_H} x2={CHART_W} y2={CHART_H} stroke="#ccc" />
                
                {history.map((day, i) => {
                   const x = i * SPACING + 20;
                   const hIn = Math.min((day.caloriesIn / MAX_CAL) * CHART_H, CHART_H);
                   const hOut = Math.min((day.caloriesOut / MAX_CAL) * CHART_H, CHART_H);
                   
                   const wRange = MAX_W - MIN_W;
                   const wNorm = Math.max(0, Math.min(1, (day.weight - MIN_W) / wRange));
                   const yW = CHART_H - (wNorm * CHART_H);

                   let nextX, nextYW;
                   if (i < history.length - 1) {
                      const nextDay = history[i+1];
                      nextX = (i+1) * SPACING + 20;
                      const nextWNorm = Math.max(0, Math.min(1, (nextDay.weight - MIN_W) / wRange));
                      nextYW = CHART_H - (nextWNorm * CHART_H);
                   }

                   return (
                     <G key={i}>
                        <Rect x={x - 6} y={CHART_H - hIn} width={5} height={hIn} fill="#4CAF50" rx={2} />
                        <Rect x={x} y={CHART_H - hOut} width={5} height={hOut} fill="#FF9800" rx={2} />
                        
                        {nextX && (
                           <Line x1={x} y1={yW} x2={nextX} y2={nextYW} stroke="#2196F3" strokeWidth="2" />
                        )}
                        {day.weight > 0 && (
                           <Rect x={x-3} y={yW-3} width={6} height={6} fill="#2196F3" rx={3} />
                        )}

                        <SvgText 
                          x={x} 
                          y={CHART_H + 20} 
                          fontSize="10" 
                          fill="#666" 
                          textAnchor="middle"
                        >
                           {new Date(day.date).getDate()}日
                        </SvgText>
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