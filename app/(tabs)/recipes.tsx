import { useState, useCallback } from "react";
import { View, ScrollView, ActivityIndicator, Pressable, StyleSheet, Alert } from "react-native";
import * as Notifications from 'expo-notifications';
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { ThemedText } from "@/components/themed-text";
import { useThemeColor } from "@/hooks/use-theme-color";
import { getDailySummaryLocal, getProfileLocal } from "@/lib/storage";
import { suggestRecipe, suggestWorkout } from "@/lib/gemini";

// 設定通知行為
Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowAlert: true, shouldPlaySound: true, shouldSetBadge: false }),
});

export default function RecipesScreen() {
  const insets = useSafeAreaInsets();
  const backgroundColor = useThemeColor({}, "background");
  const cardBackground = useThemeColor({}, "cardBackground");
  const tintColor = useThemeColor({}, "tint");

  const [activeTab, setActiveTab] = useState<'RECIPE' | 'WORKOUT'>('RECIPE');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [remaining, setRemaining] = useState(0);

  // 同步資料
  useFocusEffect(useCallback(() => {
    async function syncData() {
       const p = await getProfileLocal();
       const s = await getDailySummaryLocal();
       const target = p?.dailyCalorieTarget || 2000;
       const net = (s.totalCaloriesIn || 0) - (s.totalCaloriesOut || 0);
       setProfile(p);
       setRemaining(target - net);
    }
    syncData();
  }, []));

  const handleGenerate = async () => {
    // 請求通知權限
    const { status } = await Notifications.requestPermissionsAsync();
    
    setLoading(true);
    setResult(null);
    Alert.alert("AI 分析中", "您可以稍後再回來查看結果。");

    // 模擬背景執行 (避免畫面卡住)
    setTimeout(async () => {
       try {
         let res;
         if (activeTab === 'RECIPE') {
            res = await suggestRecipe(remaining, 'STORE');
         } else {
            res = await suggestWorkout(profile, remaining);
         }
         
         setResult(res);
         setLoading(false);
         
         if (status === 'granted') {
           await Notifications.scheduleNotificationAsync({
             content: { title: "AI 教練通知", body: "您的建議已生成完畢！" },
             trigger: null,
           });
         }
       } catch (e) {
         setLoading(false);
         Alert.alert("生成失敗", "請檢查網路連線");
       }
    }, 100);
  };

  return (
    <View style={[styles.container, { backgroundColor }]}>
       <View style={[styles.header, { paddingTop: Math.max(insets.top, 20) }]}>
          <ThemedText type="title">AI 智能教練</ThemedText>
       </View>
       <View style={{flexDirection: 'row', padding: 16, gap: 10}}>
          <Pressable onPress={() => {setActiveTab('RECIPE'); setResult(null);}} style={[styles.tab, activeTab === 'RECIPE' && {backgroundColor: tintColor}]}><ThemedText style={activeTab==='RECIPE'&&{color:'white'}}>食譜建議</ThemedText></Pressable>
          <Pressable onPress={() => {setActiveTab('WORKOUT'); setResult(null);}} style={[styles.tab, activeTab === 'WORKOUT' && {backgroundColor: tintColor}]}><ThemedText style={activeTab==='WORKOUT'&&{color:'white'}}>運動建議</ThemedText></Pressable>
       </View>
       
       <ScrollView style={{paddingHorizontal: 16}}>
          <View style={[styles.card, {backgroundColor: cardBackground}]}>
             <ThemedText style={{textAlign: 'center', color: '#666'}}>目前剩餘額度</ThemedText>
             <ThemedText style={{textAlign: 'center', fontSize: 32, fontWeight: 'bold', color: tintColor}}>{remaining} kcal</ThemedText>
          </View>

          <Pressable onPress={handleGenerate} style={[styles.btn, {backgroundColor: tintColor}]} disabled={loading}>
             {loading ? <ActivityIndicator color="white"/> : <ThemedText style={{color: 'white', fontWeight: 'bold'}}>生成{activeTab==='RECIPE'?'食譜':'運動'}計畫</ThemedText>}
          </Pressable>

          {result && (
             <View style={[styles.card, {backgroundColor: cardBackground, marginTop: 20}]}>
                <ThemedText type="title">{activeTab==='RECIPE' ? result.title : result.activity}</ThemedText>
                <ThemedText style={{marginTop: 8}}>
                   {activeTab==='RECIPE' ? `🔥 熱量: ${result.calories} kcal` : `⏱️ 時間: ${result.duration_minutes} 分鐘 (-${result.estimated_calories} kcal)`}
                </ThemedText>
                <ThemedText style={{marginTop: 16, fontWeight: 'bold'}}>💡 建議原因：</ThemedText>
                <ThemedText>{result.reason}</ThemedText>
                {/* 如果是食譜，顯示步驟 */}
                {result.steps && result.steps.map((s:string, i:number) => <ThemedText key={i} style={{fontSize:12, marginTop:4}}>{i+1}. {s}</ThemedText>)}
             </View>
          )}
       </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: 20 },
  tab: { flex: 1, padding: 12, alignItems: 'center', borderRadius: 8, borderWidth: 1, borderColor: '#ddd' },
  card: { padding: 20, borderRadius: 16 },
  btn: { padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 10 }
});