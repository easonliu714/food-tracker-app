import { useState, useCallback, useEffect } from "react";
import { View, ScrollView, ActivityIndicator, Pressable, StyleSheet, Alert, Linking, Share, Platform } from "react-native";
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

// [修正] 通知的標準寫法，消除警示
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
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
  const [lang, setLang] = useState("zh-TW"); // 預設語言

  // 初始化：讀取上次建議與語言
  useEffect(() => {
     async function init() {
       const advice = await getAIAdvice();
       if (advice) setResult(advice);
       const s = await getSettings();
       if (s.language) setLang(s.language);
     }
     init();
  }, []);

  useFocusEffect(useCallback(() => {
    async function syncData() {
       const p = await getProfileLocal();
       const s = await getDailySummaryLocal();
       const target = p?.dailyCalorieTarget || 2000;
       const net = (s.totalCaloriesIn || 0) - (s.totalCaloriesOut || 0);
       setProfile(p);
       setRemaining(target - net);
       
       // 再次同步語言，以防在設定頁切換後回來
       const set = await getSettings();
       if (set.language) setLang(set.language);
    }
    syncData();
  }, []));

  const handleGenerate = async () => {
    const { status } = await Notifications.requestPermissionsAsync();
    setLoading(true);
    // 不清空 result，保留舊資料直到新資料產生
    
    // 延遲一點執行以免 UI 卡頓
    setTimeout(async () => {
       try {
         let res;
         if (activeTab === 'RECIPE') {
            res = await suggestRecipe(remaining, 'STORE', lang);
         } else {
            res = await suggestWorkout(profile, remaining, lang);
         }
         
         if (res) {
           setResult(res);
           saveAIAdvice(res); // 持久化
           if (status === 'granted') {
             await Notifications.scheduleNotificationAsync({
               content: { 
                 title: t('ai_coach', lang), 
                 body: activeTab === 'RECIPE' ? t('recipe_suggestion', lang) : t('workout_suggestion', lang) 
               },
               trigger: null,
             });
           }
         } else {
           Alert.alert("分析失敗", "AI 暫無回應，請檢查網路或稍後再試");
         }
       } catch (e) {
         Alert.alert("錯誤", "發生未知錯誤");
       } finally {
         setLoading(false);
       }
    }, 100);
  };

  const openVideo = () => { if (result?.video_url) Linking.openURL(result.video_url); };

  // 匯出 PDF
  const handleExportPDF = async () => {
    if (!result) return;
    
    // 簡單的 HTML 樣板
    const htmlContent = `
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: sans-serif; padding: 20px; line-height: 1.6; }
            h1 { color: #2196F3; border-bottom: 2px solid #eee; padding-bottom: 10px; }
            .card { background: #f9f9f9; padding: 15px; border-radius: 8px; margin: 20px 0; }
            .label { font-weight: bold; color: #555; }
          </style>
        </head>
        <body>
          <h1>${activeTab === 'RECIPE' ? t('recipe_suggestion', lang) : t('workout_suggestion', lang)}</h1>
          <h2>${activeTab === 'RECIPE' ? result.title : result.activity}</h2>
          
          <div class="card">
            <p><span class="label">${t('reason', lang)}:</span> ${result.reason}</p>
          </div>
          
          <hr/>
          
          ${activeTab === 'RECIPE' ? 
            `<h3>${t('ingredients', lang)}:</h3>
             <ul>${result.ingredients?.map((i:string)=>`<li>${i}</li>`).join('')}</ul>
             <h3>${t('steps', lang)}:</h3>
             <ol>${result.steps?.map((s:string)=>`<li>${s}</li>`).join('')}</ol>
             <p><strong>${t('calories', lang)}:</strong> ${result.calories} kcal</p>` 
            : 
            `<p><strong>時間:</strong> ${result.duration_minutes} min</p>
             <p><strong>消耗:</strong> ${result.estimated_calories} kcal</p>`
          }
          
          <p style="text-align: center; color: #999; margin-top: 50px;">Generated by Nutrition Tracker AI</p>
        </body>
      </html>
    `;

    try {
      const { uri } = await Print.printToFileAsync({ html: htmlContent });
      if (Platform.OS === "ios") {
        await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
      } else {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: '匯出 PDF' });
      }
    } catch (e) {
      Alert.alert("匯出失敗", "請檢查裝置是否支援列印或分享");
    }
  };

  return (
    <View style={[styles.container, { backgroundColor }]}>
       <View style={[styles.header, { paddingTop: Math.max(insets.top, 20) }]}>
          <ThemedText type="title">{t('ai_coach', lang)}</ThemedText>
          {result && (
            <Pressable onPress={handleExportPDF} style={{padding: 8}}>
               <Ionicons name="share-outline" size={24} color={tintColor} />
            </Pressable>
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

          {result && (
             <View style={[styles.card, {backgroundColor: cardBackground, marginTop: 20, marginBottom: 40}]}>
                <ThemedText type="title">{activeTab==='RECIPE' ? result.title : result.activity}</ThemedText>
                
                {activeTab === 'WORKOUT' && result.video_url && (
                  <Pressable onPress={openVideo} style={{marginVertical: 10}}>
                    <ThemedText style={{color: '#2196F3', textDecorationLine: 'underline'}}>📺 {t('watch_video', lang)}</ThemedText>
                  </Pressable>
                )}

                <ThemedText style={{marginTop: 8}}>
                   {activeTab==='RECIPE' ? `🔥 ${t('calories', lang)}: ${result.calories} kcal` : `⏱️ 時間: ${result.duration_minutes} min (-${result.estimated_calories} kcal)`}
                </ThemedText>
                
                <ThemedText style={{marginTop: 16, fontWeight: 'bold'}}>💡 {t('reason', lang)}：</ThemedText>
                <ThemedText style={{lineHeight: 20}}>{result.reason}</ThemedText>
                
                {activeTab === 'RECIPE' && (
                  <>
                    <ThemedText style={{marginTop: 16, fontWeight: 'bold'}}>🛒 {t('ingredients', lang)}：</ThemedText>
                    {result.ingredients?.map((item: string, i: number) => <ThemedText key={i}>• {item}</ThemedText>)}
                    <ThemedText style={{marginTop: 16, fontWeight: 'bold'}}>📝 {t('steps', lang)}：</ThemedText>
                    {result.steps?.map((step: string, i: number) => <ThemedText key={i} style={{marginTop: 4}}>{i+1}. {step}</ThemedText>)}
                  </>
                )}
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