import { useState, useCallback, useEffect } from "react";
import { View, ScrollView, ActivityIndicator, Pressable, StyleSheet, Alert, Linking, Platform } from "react-native";
// [修改] 移除 expo-notifications 以解決 SDK 54 Android Expo Go 崩潰問題
// import * as Notifications from 'expo-notifications'; 
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { ThemedText } from "@/components/themed-text";
import { useThemeColor } from "@/hooks/use-theme-color";
import { getDailySummaryLocal, getProfileLocal, saveAIAdvice, getAIAdvice } from "@/lib/storage";
import { suggestRecipe, suggestWorkout } from "@/lib/gemini";
import { t, useLanguage } from "@/lib/i18n";
import { Ionicons } from "@expo/vector-icons";

// [移除] 移除通知處理器設定
// Notifications.setNotificationHandler({...});

export default function RecipesScreen() {
  const insets = useSafeAreaInsets();
  const backgroundColor = useThemeColor({}, "background");
  const cardBackground = useThemeColor({}, "cardBackground");
  const tintColor = useThemeColor({}, "tint");
  const lang = useLanguage(); 

  const [activeTab, setActiveTab] = useState<'RECIPE' | 'WORKOUT'>('RECIPE');
  const [loading, setLoading] = useState(false);
  const [adviceData, setAdviceData] = useState<any>({ RECIPE: null, WORKOUT: null });
  const [profile, setProfile] = useState<any>(null);
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
     async function init() {
       try {
         const advice = await getAIAdvice();
         if (advice) {
           setAdviceData({
             RECIPE: advice.RECIPE || null,
             WORKOUT: advice.WORKOUT || null
           });
         }
       } catch (e) {
         console.error("Failed to load saved advice", e);
       }
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
    }
    syncData();
  }, []));

  const currentResult = adviceData[activeTab];

  const handleGenerate = async () => {
    // [修改] 移除通知權限請求
    
    setLoading(true);
    
    // 延遲執行以避免 UI 卡頓
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
           await saveAIAdvice(activeTab, res);
           
           // [修改] 改用 Alert 替代推播通知
           Alert.alert(
             t('ai_coach', lang), 
             (activeTab === 'RECIPE' ? t('recipe_suggestion', lang) : t('workout_suggestion', lang)) + 
             "\n(模擬器不支援推播，此訊息代表通知已觸發)"
           );

         } else {
           Alert.alert("分析失敗", "AI 暫無回應，請檢查網路或 API Key");
         }
       } catch (e) {
         Alert.alert("錯誤", "發生未知錯誤");
         console.error(e);
       } finally {
         setLoading(false);
       }
    }, 100);
  };

  const openVideo = () => { 
    if (currentResult?.video_url) {
      Linking.openURL(currentResult.video_url);
    }
  };

  const handleExportPDF = async () => {
    if (!currentResult) return;
    
    const contentHtml = activeTab === 'RECIPE' ? 
      `
        <div class="section">
          <h3>🛒 ${t('ingredients', lang)}</h3>
          <ul>
            ${currentResult.ingredients?.map((item: string) => `<li>${item}</li>`).join('') || '<li>無資料</li>'}
          </ul>
        </div>
        <div class="section">
          <h3>📝 ${t('steps', lang)}</h3>
          <ol>
            ${currentResult.steps?.map((step: string) => `<li>${step}</li>`).join('') || '<li>無資料</li>'}
          </ol>
        </div>
        <div class="highlight">
          🔥 <strong>${t('calories', lang)}:</strong> ${currentResult.calories} kcal
        </div>
      ` : 
      `
        <div class="section">
          <h3>🏋️ 運動詳情</h3>
          <p><strong>項目:</strong> ${currentResult.activity}</p>
          <p><strong>時間:</strong> ${currentResult.duration_minutes} 分鐘</p>
          <div class="highlight">
            ⚡ <strong>預估消耗:</strong> ${currentResult.estimated_calories} kcal
          </div>
        </div>
      `;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Helvetica, Arial, sans-serif; padding: 40px; line-height: 1.6; color: #333; }
            h1 { color: #2196F3; border-bottom: 2px solid #eee; padding-bottom: 15px; }
            h2 { color: #444; margin-top: 0; }
            .card { background: #f5f5f5; padding: 20px; border-radius: 12px; margin: 20px 0; border-left: 5px solid #2196F3; }
            .section { margin-bottom: 20px; }
            .highlight { font-size: 1.2em; color: #E65100; font-weight: bold; margin-top: 10px; }
            li { margin-bottom: 8px; }
            .footer { text-align: center; color: #999; margin-top: 60px; font-size: 0.8em; border-top: 1px solid #eee; padding-top: 20px; }
          </style>
        </head>
        <body>
          <h1>${activeTab === 'RECIPE' ? t('recipe_suggestion', lang) : t('workout_suggestion', lang)}</h1>
          
          <div class="card">
            <h2>${activeTab === 'RECIPE' ? currentResult.title : currentResult.activity}</h2>
            <p><strong>💡 ${t('reason', lang)}:</strong></p>
            <p>${currentResult.reason}</p>
          </div>
          
          <hr style="border: 0; border-top: 1px solid #eee; margin: 30px 0;" />
          
          ${contentHtml}
          
          <div class="footer">
            Generated by Nutrition Tracker AI • ${new Date().toLocaleDateString()}
          </div>
        </body>
      </html>
    `;

    try {
      const { uri } = await Print.printToFileAsync({ html: htmlContent });
      if (Platform.OS === "ios") {
        await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
      } else {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: t('export_pdf', lang) });
      }
    } catch (e) {
      Alert.alert("匯出失敗", "請檢查裝置是否支援列印或分享功能");
    }
  };

  return (
    <View style={[styles.container, { backgroundColor }]}>
       <View style={[styles.header, { paddingTop: Math.max(insets.top, 20) }]}>
          <ThemedText type="title">{t('ai_coach', lang)}</ThemedText>
          {currentResult && (
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

          {currentResult && (
             <View style={[styles.card, {backgroundColor: cardBackground, marginTop: 20, marginBottom: 40}]}>
                <ThemedText type="title">{activeTab==='RECIPE' ? currentResult.title : currentResult.activity}</ThemedText>
                
                {activeTab === 'WORKOUT' && currentResult.video_url && (
                  <Pressable onPress={openVideo} style={{marginVertical: 10}}>
                    <ThemedText style={{color: '#2196F3', textDecorationLine: 'underline'}}>📺 {t('watch_video', lang)}</ThemedText>
                  </Pressable>
                )}

                <ThemedText style={{marginTop: 8}}>
                   {activeTab==='RECIPE' ? `🔥 ${t('calories', lang)}: ${currentResult.calories} kcal` : `⏱️ 時間: ${currentResult.duration_minutes} min (-${currentResult.estimated_calories} kcal)`}
                </ThemedText>
                
                <ThemedText style={{marginTop: 16, fontWeight: 'bold'}}>💡 {t('reason', lang)}：</ThemedText>
                <ThemedText style={{lineHeight: 20}}>{currentResult.reason}</ThemedText>
                
                {activeTab === 'RECIPE' && (
                  <>
                    <ThemedText style={{marginTop: 16, fontWeight: 'bold'}}>🛒 {t('ingredients', lang)}：</ThemedText>
                    {currentResult.ingredients?.map((item: string, i: number) => <ThemedText key={i}>• {item}</ThemedText>)}
                    <ThemedText style={{marginTop: 16, fontWeight: 'bold'}}>📝 {t('steps', lang)}：</ThemedText>
                    {currentResult.steps?.map((step: string, i: number) => <ThemedText key={i} style={{marginTop: 4}}>{i+1}. {step}</ThemedText>)}
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