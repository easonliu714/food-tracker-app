import { useState, useCallback, useEffect } from "react";
import { View, ScrollView, ActivityIndicator, Pressable, StyleSheet, Alert, Linking, Share } from "react-native";
import * as Notifications from 'expo-notifications';
import * as Print from 'expo-print'; // [新增]
import * as Sharing from 'expo-sharing'; // [新增]
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { ThemedText } from "@/components/themed-text";
import { useThemeColor } from "@/hooks/use-theme-color";
import { getDailySummaryLocal, getProfileLocal, saveAIAdvice, getAIAdvice } from "@/lib/storage";
import { suggestRecipe, suggestWorkout } from "@/lib/gemini";
import { t, detectLanguage } from "@/lib/i18n";
import { Ionicons } from "@expo/vector-icons";

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
  const [lang, setLang] = useState("zh-TW"); // 預設

  // 初始化：讀取上次建議
  useEffect(() => {
     getAIAdvice().then(res => { if(res) setResult(res); });
     // 讀取語言設定... (省略，假設 profile.tsx 已存)
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

  const handleGenerate = async () => {
    const { status } = await Notifications.requestPermissionsAsync();
    setLoading(true);
    // 不清空 result，讓使用者還能看到舊的
    
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
           saveAIAdvice(res); // [新增] 持久化
           if (status === 'granted') {
             await Notifications.scheduleNotificationAsync({
               content: { title: "AI 教練通知", body: "新建議已生成！" },
               trigger: null,
             });
           }
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

  const openVideo = () => { if (result?.video_url) Linking.openURL(result.video_url); };

  // [新增] 匯出 PDF
  const handleExportPDF = async () => {
    if (!result) return;
    const htmlContent = `
      <html>
        <body>
          <h1>${activeTab === 'RECIPE' ? '飲食建議' : '運動計畫'}</h1>
          <h2>${activeTab === 'RECIPE' ? result.title : result.activity}</h2>
          <p>${result.reason}</p>
          <hr/>
          ${activeTab === 'RECIPE' ? 
            `<h3>食材:</h3><ul>${result.ingredients?.map((i:string)=>`<li>${i}</li>`).join('')}</ul>
             <h3>步驟:</h3><ol>${result.steps?.map((s:string)=>`<li>${s}</li>`).join('')}</ol>` : 
            `<p>時間: ${result.duration_minutes} 分</p><p>消耗: ${result.estimated_calories} kcal</p>`
          }
        </body>
      </html>
    `;
    try {
      const { uri } = await Print.printToFileAsync({ html: htmlContent });
      await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
    } catch (e) {
      Alert.alert("匯出失敗", "請檢查裝置支援");
    }
  };

  return (
    <View style={[styles.container, { backgroundColor }]}>
       <View style={[styles.header, { paddingTop: Math.max(insets.top, 20) }]}>
          <ThemedText type="title">AI 智能教練</ThemedText>
          {result && (
            <Pressable onPress={handleExportPDF}>
               <Ionicons name="share-outline" size={24} color={tintColor} />
            </Pressable>
          )}
       </View>
       
       <View style={{flexDirection: 'row', padding: 16, gap: 10}}>
          <Pressable onPress={() => setActiveTab('RECIPE')} style={[styles.tab, activeTab === 'RECIPE' && {backgroundColor: tintColor}]}><ThemedText style={activeTab==='RECIPE'&&{color:'white'}}>食譜建議</ThemedText></Pressable>
          <Pressable onPress={() => setActiveTab('WORKOUT')} style={[styles.tab, activeTab === 'WORKOUT' && {backgroundColor: tintColor}]}><ThemedText style={activeTab==='WORKOUT'&&{color:'white'}}>運動建議</ThemedText></Pressable>
       </View>
       
       <ScrollView style={{paddingHorizontal: 16}}>
          <View style={[styles.card, {backgroundColor: cardBackground}]}>
             <ThemedText style={{textAlign: 'center', color: '#666'}}>目前剩餘額度</ThemedText>
             <ThemedText style={{textAlign: 'center', fontSize: 32, fontWeight: 'bold', color: tintColor}}>{remaining} kcal</ThemedText>
          </View>

          <Pressable onPress={handleGenerate} style={[styles.btn, {backgroundColor: tintColor}]} disabled={loading}>
             {loading ? <ActivityIndicator color="white"/> : <ThemedText style={{color: 'white', fontWeight: 'bold'}}>更新計畫</ThemedText>}
          </Pressable>

          {result && (
             <View style={[styles.card, {backgroundColor: cardBackground, marginTop: 20, marginBottom: 40}]}>
                <ThemedText type="title">{activeTab==='RECIPE' ? result.title : result.activity}</ThemedText>
                
                {activeTab === 'WORKOUT' && result.video_url && (
                  <Pressable onPress={openVideo} style={{marginVertical: 10}}>
                    <ThemedText style={{color: '#2196F3', textDecorationLine: 'underline'}}>📺 觀看教學影片</ThemedText>
                  </Pressable>
                )}

                <ThemedText style={{marginTop: 8}}>
                   {activeTab==='RECIPE' ? `🔥 熱量: ${result.calories} kcal` : `⏱️ 時間: ${result.duration_minutes} 分鐘 (-${result.estimated_calories} kcal)`}
                </ThemedText>
                
                <ThemedText style={{marginTop: 16, fontWeight: 'bold'}}>💡 建議原因：</ThemedText>
                <ThemedText>{result.reason}</ThemedText>
                
                {activeTab === 'RECIPE' && (
                  <>
                    <ThemedText style={{marginTop: 16, fontWeight: 'bold'}}>🛒 食材：</ThemedText>
                    {result.ingredients?.map((item: string, i: number) => <ThemedText key={i}>• {item}</ThemedText>)}
                    <ThemedText style={{marginTop: 16, fontWeight: 'bold'}}>📝 步驟：</ThemedText>
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