import { useState, useCallback, useEffect } from "react";
import { View, ScrollView, ActivityIndicator, Pressable, Alert, Linking, Platform } from "react-native";
import * as Notifications from 'expo-notifications';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { ThemedText } from "@/components/themed-text";
import { useThemeColor } from "@/hooks/use-theme-color";
import { getDailySummaryLocal, getProfileLocal, saveAIAdvice, getAIAdvice, getSettings } from "@/lib/storage";
import { suggestRecipe, suggestWorkout } from "@/lib/gemini";
import { t } from "@/lib/i18n";
import { Ionicons } from "@expo/vector-icons";

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowAlert: true, shouldPlaySound: false, shouldSetBadge: false }),
});

export default function RecipesScreen() {
  const insets = useSafeAreaInsets();
  const backgroundColor = useThemeColor({}, "background");
  const cardBackground = useThemeColor({}, "cardBackground");
  const tintColor = useThemeColor({}, "tint");

  const [activeTab, setActiveTab] = useState<'RECIPE' | 'WORKOUT'>('RECIPE');
  const [loading, setLoading] = useState(false);
  const [adviceData, setAdviceData] = useState<any>({ RECIPE: null, WORKOUT: null }); // [修正] 分開存
  const [profile, setProfile] = useState<any>(null);
  const [remaining, setRemaining] = useState(0);
  const [lang, setLang] = useState("zh-TW");

  // 切換頁面時，同步載入語言與資料
  useFocusEffect(useCallback(() => {
    async function load() {
       const advice = await getAIAdvice(); // { recipe:..., workout:... }
       if (advice) setAdviceData({ RECIPE: advice.RECIPE, WORKOUT: advice.WORKOUT });
       
       const s = await getSettings();
       if (s.language) setLang(s.language);

       const p = await getProfileLocal();
       const sum = await getDailySummaryLocal();
       const target = p?.dailyCalorieTarget || 2000;
       const net = (sum.totalCaloriesIn || 0) - (sum.totalCaloriesOut || 0);
       setProfile(p);
       setRemaining(target - net);
    }
    load();
  }, []));

  const currentResult = adviceData[activeTab]; // 顯示當前 Tab 的資料

  const handleGenerate = async () => {
    setLoading(true);
    setTimeout(async () => {
       try {
         let res;
         if (activeTab === 'RECIPE') {
            res = await suggestRecipe(remaining, 'STORE', lang);
         } else {
            res = await suggestWorkout(profile, remaining, lang);
         }
         
         if (res) {
           const newAdvice = { ...adviceData, [activeTab]: res };
           setAdviceData(newAdvice);
           await saveAIAdvice(activeTab, res); // 呼叫 storage 更新特定 type
         } else {
           Alert.alert("分析失敗", "AI 暫無回應");
         }
       } catch (e) {
         Alert.alert("錯誤", "發生未知錯誤");
       } finally {
         setLoading(false);
       }
    }, 100);
  };

  const handleExportPDF = async () => {
    if (!currentResult) return;
    const htmlContent = `
      <html>
        <body style="font-family: sans-serif; padding: 20px;">
          <h1 style="color: #2196F3;">${activeTab === 'RECIPE' ? t('recipe_suggestion', lang) : t('workout_suggestion', lang)}</h1>
          <h2>${activeTab === 'RECIPE' ? currentResult.title : currentResult.activity}</h2>
          <p>${currentResult.reason}</p>
          <hr/>
          </body>
      </html>
    `;
    try {
      const { uri } = await Print.printToFileAsync({ html: htmlContent });
      await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
    } catch (e) { Alert.alert("匯出失敗"); }
  };

  return (
    <View style={[styles.container, { backgroundColor }]}>
       <View style={[styles.header, { paddingTop: Math.max(insets.top, 20) }]}>
          <ThemedText type="title">{t('ai_coach', lang)}</ThemedText>
          {currentResult && (
            <Pressable onPress={handleExportPDF} style={{padding: 8}}><Ionicons name="share-outline" size={24} color={tintColor} /></Pressable>
          )}
       </View>
       
       <View style={{flexDirection: 'row', padding: 16, gap: 10}}>
          <Pressable onPress={() => setActiveTab('RECIPE')} style={[styles.tab, activeTab === 'RECIPE' && {backgroundColor: tintColor, borderColor: tintColor}]}>
             <ThemedText style={{color: activeTab==='RECIPE'?'white':'#666', fontWeight:'bold'}}>{t('recipe_suggestion', lang)}</ThemedText>
          </Pressable>
          <Pressable onPress={() => setActiveTab('WORKOUT')} style={[styles.tab, activeTab === 'WORKOUT' && {backgroundColor: tintColor, borderColor: tintColor}]}>
             <ThemedText style={{color: activeTab==='WORKOUT'?'white':'#666', fontWeight:'bold'}}>{t('workout_suggestion', lang)}</ThemedText>
          </Pressable>
       </View>
       
       <ScrollView style={{paddingHorizontal: 16}}>
          <View style={[styles.card, {backgroundColor: cardBackground}]}>
             <ThemedText style={{textAlign: 'center', color: '#666'}}>{t('remaining_budget', lang)}</ThemedText>
             <ThemedText style={{textAlign: 'center', fontSize: 32, fontWeight: 'bold', color: tintColor}}>{remaining} kcal</ThemedText>
          </View>

          <Pressable onPress={handleGenerate} style={[styles.btn, {backgroundColor: tintColor}]} disabled={loading}>
             {loading ? <ActivityIndicator color="white"/> : <ThemedText style={{color: 'white', fontWeight: 'bold'}}>{t('generate_plan', lang)}</ThemedText>}
          </Pressable>

          {currentResult && (
             <View style={[styles.card, {backgroundColor: cardBackground, marginTop: 20, marginBottom: 40}]}>
                <ThemedText type="title">{activeTab==='RECIPE' ? currentResult.title : currentResult.activity}</ThemedText>
                <ThemedText style={{marginTop: 8}}>
                   {activeTab==='RECIPE' ? `🔥 ${t('calories', lang)}: ${currentResult.calories} kcal` : `⏱️ 時間: ${currentResult.duration_minutes} min (-${currentResult.estimated_calories} kcal)`}
                </ThemedText>
                <ThemedText style={{marginTop: 16, fontWeight: 'bold'}}>💡 {t('reason', lang)}：</ThemedText>
                <ThemedText style={{lineHeight: 20}}>{currentResult.reason}</ThemedText>
                
                {/* 食譜詳細列表略 */}
             </View>
          )}
       </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  tab: { flex: 1, padding: 12, alignItems: 'center', borderRadius: 8, borderWidth: 1, borderColor: '#ddd' },
  card: { padding: 20, borderRadius: 16 },
  btn: { padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 10 }
});