import { ScrollView, View, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { useState, useCallback } from "react";
import { ThemedText } from "@/components/themed-text";
import { useThemeColor } from "@/hooks/use-theme-color";
import { getHistory7DaysLocal, getProfileLocal } from "@/lib/storage";

export default function AnalysisScreen() {
  const insets = useSafeAreaInsets();
  const [history, setHistory] = useState<any[]>([]);
  const [currentWeight, setCurrentWeight] = useState(0);
  
  const backgroundColor = useThemeColor({}, "background");
  const cardBackground = useThemeColor({}, "cardBackground");
  const tintColor = useThemeColor({}, "tint");

  useFocusEffect(useCallback(() => {
    async function load() {
       const h = await getHistory7DaysLocal();
       const p = await getProfileLocal();
       setHistory(h);
       if (p?.currentWeightKg) setCurrentWeight(p.currentWeightKg);
    }
    load();
  }, []));

  return (
    <View style={[styles.container, { backgroundColor }]}>
       <View style={[styles.header, { paddingTop: Math.max(insets.top, 20) }]}>
          <ThemedText type="title">趨勢分析</ThemedText>
       </View>
       <ScrollView style={{padding: 16}}>
          <ThemedText type="subtitle" style={{marginBottom: 10}}>近 7 日熱量平衡</ThemedText>
          {history.map((day: any, i) => (
             <View key={i} style={[styles.row, {backgroundColor: cardBackground}]}>
                <ThemedText style={{width: 50, fontWeight: 'bold'}}>{new Date(day.date).getMonth()+1}/{new Date(day.date).getDate()}</ThemedText>
                <View style={{flex: 1}}>
                   <View style={{flexDirection: 'row', justifyContent: 'space-between'}}>
                      <ThemedText style={{fontSize: 10, color: '#4CAF50'}}>攝取 {day.caloriesIn}</ThemedText>
                      <ThemedText style={{fontSize: 10, color: '#FF9800'}}>消耗 {day.caloriesOut}</ThemedText>
                   </View>
                   <View style={{height: 6, backgroundColor: '#eee', borderRadius: 3, marginTop: 4, flexDirection: 'row'}}>
                      <View style={{flex: day.caloriesIn/3000, backgroundColor: '#4CAF50', borderRadius: 3}} />
                   </View>
                </View>
             </View>
          ))}

          <ThemedText type="subtitle" style={{marginTop: 20}}>體重追蹤</ThemedText>
          <View style={[styles.card, {backgroundColor: cardBackground, marginTop: 10}]}>
             <ThemedText style={{fontSize: 32, fontWeight: 'bold', color: tintColor}}>{currentWeight} kg</ThemedText>
             <ThemedText style={{color: '#888'}}>請至個人檔案更新體重以追蹤變化</ThemedText>
          </View>
       </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: 20 },
  row: { flexDirection: 'row', padding: 16, borderRadius: 12, marginBottom: 8, alignItems: 'center', gap: 10 },
  card: { padding: 20, borderRadius: 16 }
});