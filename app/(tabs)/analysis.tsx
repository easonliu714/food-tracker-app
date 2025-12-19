import { ScrollView, View, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { useState, useCallback } from "react";
import { ThemedText } from "@/components/themed-text";
import { useThemeColor } from "@/hooks/use-theme-color";
import { getHistory7DaysLocal } from "@/lib/storage";
import { Svg, Rect, Line, Text as SvgText } from "react-native-svg"; // 需安裝

export default function AnalysisScreen() {
  const insets = useSafeAreaInsets();
  const [history, setHistory] = useState<any[]>([]);
  const backgroundColor = useThemeColor({}, "background");
  const cardBackground = useThemeColor({}, "cardBackground");

  useFocusEffect(useCallback(() => {
    async function load() {
       const h = await getHistory7DaysLocal();
       setHistory(h); // 預設 h 包含 date, caloriesIn, caloriesOut, weight
    }
    load();
  }, []));

  // 簡易圖表參數
  const CHART_HEIGHT = 200;
  const BAR_WIDTH = 12;
  const MAX_CAL = 3000;

  return (
    <View style={[styles.container, { backgroundColor }]}>
       <View style={[styles.header, { paddingTop: Math.max(insets.top, 20) }]}>
          <ThemedText type="title">趨勢分析</ThemedText>
       </View>
       <ScrollView style={{padding: 16}}>
          {/* 熱量長條圖 */}
          <View style={[styles.card, {backgroundColor: cardBackground}]}>
             <ThemedText type="subtitle">近 7 日熱量 (左攝取/右消耗)</ThemedText>
             <View style={{height: CHART_HEIGHT, marginTop: 20, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between'}}>
                {history.map((day, i) => {
                   const hIn = (day.caloriesIn / MAX_CAL) * CHART_HEIGHT;
                   const hOut = (day.caloriesOut / MAX_CAL) * CHART_HEIGHT;
                   return (
                     <View key={i} style={{alignItems: 'center'}}>
                        <View style={{flexDirection: 'row', alignItems: 'flex-end', gap: 2}}>
                           <View style={{width: BAR_WIDTH, height: hIn, backgroundColor: '#4CAF50', borderTopLeftRadius: 4}} />
                           <View style={{width: BAR_WIDTH, height: hOut, backgroundColor: '#FF9800', borderTopRightRadius: 4}} />
                        </View>
                        <ThemedText style={{fontSize: 10, marginTop: 4}}>{new Date(day.date).getDate()}日</ThemedText>
                     </View>
                   );
                })}
             </View>
          </View>

          {/* 體重折線圖 (SVG 範例) */}
          <View style={[styles.card, {backgroundColor: cardBackground, marginTop: 16}]}>
             <ThemedText type="subtitle">體重趨勢</ThemedText>
             <Svg height="150" width="100%">
                {/* 簡單畫線邏輯: 這裡省略複雜計算，直接畫一條示意線 */}
                <Line x1="0" y1="100" x2="300" y2="80" stroke="blue" strokeWidth="2" />
                <SvgText x="10" y="130" fill="gray" fontSize="12">持續記錄以解鎖完整圖表</SvgText>
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