import { ScrollView, View, StyleSheet, Dimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { useState, useCallback } from "react";
import { ThemedText } from "@/components/themed-text";
import { useThemeColor } from "@/hooks/use-theme-color";
import { getHistory7DaysLocal, getProfileLocal } from "@/lib/storage";
import { Svg, Rect, Line, Text as SvgText, G } from "react-native-svg";

export default function AnalysisScreen() {
  const insets = useSafeAreaInsets();
  const [history, setHistory] = useState<any[]>([]);
  const [targets, setTargets] = useState({ pro: 60, carb: 250, fat: 60, sod: 2400 });
  
  const backgroundColor = useThemeColor({}, "background");
  const cardBackground = useThemeColor({}, "cardBackground");

  useFocusEffect(useCallback(() => {
    async function load() {
       const h = await getHistory7DaysLocal();
       // 防呆：確保每個物件都有 sodium，即使 storage 沒回傳 (舊資料) 也能顯示 0
       const safeHistory = h.map((d: any) => ({ ...d, sodium: d.sodium || 0 }));
       setHistory(safeHistory);

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
  }, []));

  const CHART_H = 220;
  const CHART_W = Dimensions.get('window').width - 64;
  const SPACING = (CHART_W - 20) / 6; 
  const MAX_CAL = 3500;
  const MIN_W = 40;
  const MAX_W = 100;
  
  // 營養素圖表參數 (最高顯示建議值的 150%)
  const BAR_MAX_PERCENT = 1.5; 

  return (
    <View style={[styles.container, { backgroundColor }]}>
       <View style={[styles.header, { paddingTop: Math.max(insets.top, 20) }]}>
          <ThemedText type="title">趨勢分析</ThemedText>
       </View>
       <ScrollView style={{padding: 16}}>
          {/* 1. 熱量(Bar) & 體重(Line) */}
          <View style={[styles.card, {backgroundColor: cardBackground}]}>
             <ThemedText type="subtitle">熱量 & 體重</ThemedText>
             <View style={{flexDirection: 'row', gap: 12, marginTop: 8}}>
                <ThemedText style={{fontSize: 10, color: '#4CAF50'}}>■ 攝取</ThemedText>
                <ThemedText style={{fontSize: 10, color: '#FF9800'}}>■ 消耗</ThemedText>
                <ThemedText style={{fontSize: 10, color: '#2196F3'}}>━ 體重</ThemedText>
             </View>

             <Svg height={CHART_H + 30} width="100%" style={{marginTop: 20}}>
                <Line x1="0" y1={CHART_H} x2={CHART_W} y2={CHART_H} stroke="#ccc" />
                {history.map((day, i) => {
                   const x = i * SPACING + 20;
                   
                   // 熱量 (左軸 0~3500)
                   const hIn = Math.min((day.caloriesIn / MAX_CAL) * CHART_H, CHART_H);
                   const hOut = Math.min((day.caloriesOut / MAX_CAL) * CHART_H, CHART_H);
                   
                   // 體重 (右軸 40~100)
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
                        {/* Bar: 攝取 */}
                        <Rect x={x - 6} y={CHART_H - hIn} width={5} height={hIn} fill="#4CAF50" rx={2} />
                        {/* Bar: 消耗 */}
                        <Rect x={x} y={CHART_H - hOut} width={5} height={hOut} fill="#FF9800" rx={2} />
                        
                        {/* Line: 體重 */}
                        {nextX && <Line x1={x} y1={yW} x2={nextX} y2={nextYW} stroke="#2196F3" strokeWidth="2" />}
                        {day.weight > 0 && <Rect x={x-3} y={yW-3} width={6} height={6} fill="#2196F3" rx={3} />}

                        {/* 日期 X軸 */}
                        <SvgText x={x} y={CHART_H + 20} fontSize="10" fill="#666" textAnchor="middle">{new Date(day.date).getDate()}</SvgText>
                     </G>
                   );
                })}
             </Svg>
          </View>

          {/* 2. 營養素分析 (含鈉) */}
          <View style={[styles.card, {backgroundColor: cardBackground, marginTop: 16, marginBottom: 40}]}>
             <ThemedText type="subtitle">每日營養攝取 (佔建議值 %)</ThemedText>
             <View style={{marginTop: 5, flexDirection: 'row', flexWrap: 'wrap', gap: 8}}>
                <ThemedText style={{fontSize: 10, color: '#2196F3'}}>■ 蛋</ThemedText>
                <ThemedText style={{fontSize: 10, color: '#4CAF50'}}>■ 碳</ThemedText>
                <ThemedText style={{fontSize: 10, color: '#FFD600'}}>■ 油</ThemedText>
                <ThemedText style={{fontSize: 10, color: '#9C27B0'}}>■ 鈉</ThemedText>
             </View>

             <Svg height={CHART_H} width="100%" style={{marginTop: 20}}>
                {/* 100% 參考虛線 */}
                <Line x1="0" y1={CHART_H * (1 - 1/BAR_MAX_PERCENT)} x2={CHART_W} y2={CHART_H * (1 - 1/BAR_MAX_PERCENT)} stroke="#ddd" strokeDasharray="4" />
                
                {history.map((day, i) => {
                   const x = i * SPACING + 20;
                   
                   // 計算高度 (相對於建議值的百分比，最高 150%)
                   const getH = (val: number, target: number) => {
                     if (!target) return 0;
                     const pct = val / target;
                     return Math.min((pct / BAR_MAX_PERCENT) * CHART_H, CHART_H);
                   };

                   const hP = getH(day.protein, targets.pro);
                   const hC = getH(day.carbs, targets.carb);
                   const hF = getH(day.fat, targets.fat);
                   const hS = getH(day.sodium, targets.sod); // 鈉

                   const isOver = (day.protein > targets.pro) || (day.carbs > targets.carb) || (day.fat > targets.fat) || (day.sodium > targets.sod);

                   return (
                     <G key={i}>
                        <Rect x={x - 9} y={CHART_H - hP} width={3} height={hP} fill="#2196F3" />
                        <Rect x={x - 5} y={CHART_H - hC} width={3} height={hC} fill="#4CAF50" />
                        <Rect x={x - 1} y={CHART_H - hF} width={3} height={hF} fill="#FFD600" />
                        <Rect x={x + 3} y={CHART_H - hS} width={3} height={hS} fill="#9C27B0" />
                        
                        {/* 超標警示 ! */}
                        {isOver && <SvgText x={x} y={CHART_H - Math.max(hP, hC, hF, hS) - 5} fontSize="14" fill="red" textAnchor="middle">!</SvgText>}
                        
                        <SvgText x={x} y={CHART_H + 15} fontSize="10" fill="#666" textAnchor="middle">{new Date(day.date).getDate()}</SvgText>
                     </G>
                   );
                })}
             </Svg>
             <ThemedText style={{marginTop: 10, fontSize: 12, color: 'red'}}>! 虛線為建議值上限 (100%)，驚嘆號代表有項目超標</ThemedText>
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