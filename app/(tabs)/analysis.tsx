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
           sod: 2400 // 衛福部建議
         });
       }
    }
    load();
  }, []));

  // 圖表尺寸設定
  const CHART_H = 220;
  const SCREEN_W = Dimensions.get('window').width;
  // 修正：預留左右 padding (16*2) + 卡片內 padding (16*2) = 64
  const CHART_W = SCREEN_W - 64; 
  const BAR_W = 24; // 加寬
  const SPACING = (CHART_W - 40) / 6; // 預留兩側空間
  
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
          {/* 1. 熱量 & 體重圖 */}
          <View style={[styles.card, {backgroundColor: cardBackground}]}>
             <ThemedText type="subtitle">熱量(Bar) & 體重(Line)</ThemedText>
             <View style={{flexDirection: 'row', gap: 16, marginTop: 8, marginBottom: 8}}>
                <ThemedText style={{fontSize: 12, color: '#4CAF50'}}>■ 攝取</ThemedText>
                <ThemedText style={{fontSize: 12, color: '#FF9800'}}>■ 消耗</ThemedText>
                <ThemedText style={{fontSize: 12, color: '#2196F3'}}>━ 體重</ThemedText>
             </View>

             <Svg height={CHART_H + 40} width={CHART_W} style={{marginTop: 10}}>
                <Line x1="0" y1={CHART_H} x2={CHART_W} y2={CHART_H} stroke="#ccc" />
                {history.map((day, i) => {
                   // 計算 x 座標，預留左側邊距 20
                   const x = i * SPACING + 20;
                   
                   // 熱量高度
                   const hIn = Math.min((day.caloriesIn / MAX_CAL) * CHART_H, CHART_H);
                   const hOut = Math.min((day.caloriesOut / MAX_CAL) * CHART_H, CHART_H);
                   
                   // 體重高度
                   const wRange = MAX_W - MIN_W;
                   const wNorm = Math.max(0, Math.min(1, (day.weight - MIN_W) / wRange));
                   const yW = CHART_H - (wNorm * CHART_H);

                   // 連線到下一點
                   let nextX, nextYW;
                   if (i < history.length - 1) {
                      const nextDay = history[i+1];
                      nextX = (i+1) * SPACING + 20;
                      const nextWNorm = Math.max(0, Math.min(1, (nextDay.weight - MIN_W) / wRange));
                      nextYW = CHART_H - (nextWNorm * CHART_H);
                   }

                   return (
                     <G key={i}>
                        {/* Bar: 攝取 (左半) */}
                        <Rect x={x - BAR_W/2 - 2} y={CHART_H - hIn} width={BAR_W/2} height={hIn} fill="#4CAF50" rx={2} />
                        {/* Bar: 消耗 (右半) */}
                        <Rect x={x + 2} y={CHART_H - hOut} width={BAR_W/2} height={hOut} fill="#FF9800" rx={2} />
                        
                        {/* Line: 體重 */}
                        {nextX && <Line x1={x} y1={yW} x2={nextX} y2={nextYW} stroke="#2196F3" strokeWidth="2" />}
                        {day.weight > 0 && <Rect x={x-3} y={yW-3} width={6} height={6} fill="#2196F3" rx={3} />}

                        {/* X 軸日期 */}
                        <SvgText x={x} y={CHART_H + 20} fontSize="10" fill="#666" textAnchor="middle">
                           {new Date(day.date).getMonth()+1}/{new Date(day.date).getDate()}
                        </SvgText>
                     </G>
                   );
                })}
             </Svg>
          </View>

          {/* 2. 營養素分析 (含鈉) */}
          <View style={[styles.card, {backgroundColor: cardBackground, marginTop: 16, marginBottom: 40}]}>
             <ThemedText type="subtitle">每日營養攝取 (佔建議值 %)</ThemedText>
             
             {/* 建議攝取量提示區塊 */}
             <View style={{backgroundColor: '#E3F2FD', padding: 12, borderRadius: 8, marginVertical: 12}}>
                <ThemedText style={{fontSize: 12, color: '#1565C0', fontWeight: 'bold', marginBottom: 4}}>
                   您的每日建議攝取量：
                </ThemedText>
                <ThemedText style={{fontSize: 12, color: '#1565C0'}}>
                   蛋白質 {targets.pro}g / 碳水 {targets.carb}g / 脂肪 {targets.fat}g / 鈉 {targets.sod}mg
                </ThemedText>
             </View>

             <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 10}}>
                <ThemedText style={{fontSize: 10, color: '#2196F3'}}>■ 蛋</ThemedText>
                <ThemedText style={{fontSize: 10, color: '#4CAF50'}}>■ 碳</ThemedText>
                <ThemedText style={{fontSize: 10, color: '#FFD600'}}>■ 油</ThemedText>
                <ThemedText style={{fontSize: 10, color: '#9C27B0'}}>■ 鈉</ThemedText>
             </View>

             <Svg height={CHART_H + 40} width={CHART_W}>
                {/* 100% 參考虛線 */}
                <Line x1="0" y1={CHART_H * (1 - 1/BAR_MAX_PERCENT)} x2={CHART_W} y2={CHART_H * (1 - 1/BAR_MAX_PERCENT)} stroke="#ddd" strokeDasharray="4" />
                
                {history.map((day, i) => {
                   const x = i * SPACING + 20;
                   
                   // 計算高度
                   const getH = (val: number, target: number) => {
                     if (!target) return 0;
                     const pct = val / target;
                     return Math.min((pct / BAR_MAX_PERCENT) * CHART_H, CHART_H);
                   };

                   const hP = getH(day.protein, targets.pro);
                   const hC = getH(day.carbs, targets.carb);
                   const hF = getH(day.fat, targets.fat);
                   const hS = getH(day.sodium, targets.sod); 

                   const isOver = (day.protein > targets.pro) || (day.carbs > targets.carb) || (day.fat > targets.fat) || (day.sodium > targets.sod);

                   return (
                     <G key={i}>
                        {/* 並排 4 條 Bar，稍微加寬 */}
                        <Rect x={x - 12} y={CHART_H - hP} width={5} height={hP} fill="#2196F3" rx={1} />
                        <Rect x={x - 6} y={CHART_H - hC} width={5} height={hC} fill="#4CAF50" rx={1} />
                        <Rect x={x} y={CHART_H - hF} width={5} height={hF} fill="#FFD600" rx={1} />
                        <Rect x={x + 6} y={CHART_H - hS} width={5} height={hS} fill="#9C27B0" rx={1} />
                        
                        {/* 超標警示 ! */}
                        {isOver && <SvgText x={x} y={CHART_H - Math.max(hP, hC, hF, hS) - 5} fontSize="14" fill="red" textAnchor="middle">!</SvgText>}
                        
                        {/* 日期 X軸 */}
                        <SvgText x={x} y={CHART_H + 20} fontSize="10" fill="#666" textAnchor="middle">
                           {new Date(day.date).getMonth()+1}/{new Date(day.date).getDate()}
                        </SvgText>
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