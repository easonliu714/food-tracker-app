import { useState, useCallback, useEffect, useRef } from "react";
import { View, ScrollView, ActivityIndicator, Pressable, StyleSheet, Alert, TextInput, KeyboardAvoidingView, Platform, Linking } from "react-native";
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { ThemedText } from "@/components/themed-text";
import { useThemeColor } from "@/hooks/use-theme-color";
import { t, useLanguage } from "@/lib/i18n";
import { Ionicons } from "@expo/vector-icons";
import { chatWithAI, suggestRecipe, suggestWorkout } from "@/lib/gemini"; 
import { db } from "@/lib/db";
import { userProfiles, foodLogs, activityLogs } from "@/drizzle/schema";
import { eq } from "drizzle-orm";
import { format } from "date-fns";

export default function AICoachScreen() {
  const insets = useSafeAreaInsets();
  const backgroundColor = useThemeColor({}, "background");
  const cardBackground = useThemeColor({}, "cardBackground");
  const tintColor = useThemeColor({}, "tint");
  const textColor = useThemeColor({}, "text");
  const lang = useLanguage(); 

  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [remaining, setRemaining] = useState(0);
  const [currentResult, setCurrentResult] = useState<any>(null); // For Rich Card
  const [activeTab, setActiveTab] = useState<'RECIPE' | 'WORKOUT'>('RECIPE'); // For legacy PDF compatibility

  const scrollViewRef = useRef<ScrollView>(null);

  useFocusEffect(useCallback(() => {
    async function syncData() {
        try {
            const today = format(new Date(), 'yyyy-MM-dd');
            const pRes = await db.select().from(userProfiles).limit(1);
            const p = pRes[0] || null;
            const fRes = await db.select().from(foodLogs).where(eq(foodLogs.date, today));
            const consumed = fRes.reduce((sum, i) => sum + (i.totalCalories || 0), 0);
            const aRes = await db.select().from(activityLogs).where(eq(activityLogs.date, today));
            const burned = aRes.reduce((sum, i) => sum + (i.caloriesBurned || 0), 0);
            const target = p?.dailyCalorieTarget || 2000;
            setProfile(p);
            setRemaining(Math.round(target - consumed + burned));
        } catch (e) { console.error(e); }
    }
    syncData();
  }, []));

  const handleSend = async (msg: string) => {
      if (!msg.trim()) return;
      const userText = msg.trim();
      
      // Intercept special commands
      if (userText === t('ask_recipe', lang)) {
          handleGenerate(true);
          return;
      }
      if (userText === t('ask_workout', lang)) {
          handleGenerate(false);
          return;
      }

      const newHistory = [...messages, { role: 'user', parts: [{ text: userText }] }];
      setMessages(newHistory);
      setInputText("");
      setLoading(true);
      setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);

      const response = await chatWithAI(newHistory, userText, { ...profile, remaining }, lang);
      
      setMessages([...newHistory, { role: 'model', parts: [{ text: response }] }]);
      setLoading(false);
      setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
  };

  const handleGenerate = async (isRecipe: boolean) => {
      setLoading(true);
      setActiveTab(isRecipe ? 'RECIPE' : 'WORKOUT');
      try {
          let res;
          if (isRecipe) {
              res = await suggestRecipe(remaining, 'STORE', lang, profile);
          } else {
              res = await suggestWorkout(profile, remaining, lang);
          }
          if (res) {
              setCurrentResult(res);
              // Add system message indicating success
              const sysMsg = { role: 'model', parts: [{ text: isRecipe ? t('recipe_suggestion', lang) : t('workout_suggestion', lang) }] };
              setMessages([...messages, { role: 'user', parts: [{ text: isRecipe ? t('ask_recipe', lang) : t('ask_workout', lang) }] }, sysMsg]);
          }
      } catch(e) { /* */ } 
      finally { setLoading(false); setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100); }
  };

  const handleExportPDF = async () => {
      // (保留原有的 handleExportPDF 邏輯，需確保 currentResult 存在)
      if (!currentResult) return;
      const htmlContent = `<h1>${currentResult.title || currentResult.activity}</h1><p>${currentResult.reason}</p>`; 
      // ... 簡化展示，請將原版詳細 PDF 生成代碼放回此處 ...
      try {
        const { uri } = await Print.printToFileAsync({ html: htmlContent });
        await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
      } catch (e) { Alert.alert("Error", "Export Failed"); }
  };

  const openVideo = () => { if (currentResult?.video_url) Linking.openURL(currentResult.video_url); };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={[styles.container, { backgroundColor }]}>
       <View style={[styles.header, { paddingTop: Math.max(insets.top, 20) }]}>
          <ThemedText type="title">{t('ai_coach', lang)}</ThemedText>
          {currentResult && <Pressable onPress={handleExportPDF}><Ionicons name="share-outline" size={24} color={tintColor}/></Pressable>}
       </View>
       
       <View style={[styles.summaryCard, {backgroundColor: cardBackground}]}>
           <ThemedText style={{fontSize: 12, color: '#888'}}>{t('remaining_budget', lang)}</ThemedText>
           <ThemedText style={{fontSize: 24, fontWeight: 'bold', color: remaining < 0 ? 'red' : tintColor}}>{remaining} kcal</ThemedText>
       </View>

       <ScrollView ref={scrollViewRef} style={{flex: 1, paddingHorizontal: 16}} contentContainerStyle={{paddingBottom: 20}}>
          {messages.length === 0 && (
              <View style={{marginTop: 40, alignItems: 'center'}}>
                  <Ionicons name="chatbubbles-outline" size={60} color="#ccc" />
                  <ThemedText style={{color:'#888', marginTop:10}}>{t('ai_hello', lang)}</ThemedText>
              </View>
          )}

          {messages.map((m, i) => (
              <View key={i} style={[styles.msgBubble, m.role === 'user' ? { alignSelf: 'flex-end', backgroundColor: tintColor } : { alignSelf: 'flex-start', backgroundColor: '#E5E5EA' }]}>
                  <ThemedText style={{color: m.role==='user'?'#FFF':'#000'}}>{m.parts[0].text}</ThemedText>
              </View>
          ))}
          
          {loading && <ActivityIndicator style={{marginTop:10}} />}

          {/* Rich Card Display */}
          {currentResult && (
             <View style={[styles.card, {backgroundColor: cardBackground, marginTop: 10}]}>
                <ThemedText type="title" style={{fontSize:18}}>{activeTab==='RECIPE' ? currentResult.title : currentResult.activity}</ThemedText>
                {activeTab === 'WORKOUT' && currentResult.video_url && <Pressable onPress={openVideo}><ThemedText style={{color: '#2196F3', textDecorationLine: 'underline'}}>📺 {t('watch_video', lang)}</ThemedText></Pressable>}
                <ThemedText style={{marginTop: 8}}>{activeTab==='RECIPE' ? `🔥 ${currentResult.calories} kcal` : `⏱️ ${currentResult.duration_minutes} min`}</ThemedText>
                <ThemedText style={{marginTop: 8, fontStyle:'italic'}}>{currentResult.reason}</ThemedText>
             </View>
          )}

          {/* Preset Buttons */}
          {!loading && (
              <View style={{flexDirection:'row', flexWrap:'wrap', gap: 8, marginTop: 20}}>
                  <Pressable onPress={() => handleSend(t('ask_recipe', lang))} style={[styles.chip, {backgroundColor: tintColor}]}><ThemedText style={{fontSize: 12, color: 'white'}}>{t('ask_recipe', lang)}</ThemedText></Pressable>
                  <Pressable onPress={() => handleSend(t('ask_workout', lang))} style={[styles.chip, {backgroundColor: tintColor}]}><ThemedText style={{fontSize: 12, color: 'white'}}>{t('ask_workout', lang)}</ThemedText></Pressable>
                  {[t('follow_up_1', lang), t('follow_up_2', lang), t('follow_up_3', lang)].map((q, i) => (
                      <Pressable key={i} onPress={() => handleSend(q)} style={[styles.chip, {borderColor: tintColor, borderWidth:1}]}><ThemedText style={{fontSize: 12, color: tintColor}}>{q}</ThemedText></Pressable>
                  ))}
              </View>
          )}
       </ScrollView>

       <View style={[styles.inputArea, {backgroundColor: cardBackground, paddingBottom: Math.max(insets.bottom, 10)}]}>
           <TextInput style={[styles.input, {color: textColor, borderColor: '#ddd'}]} value={inputText} onChangeText={setInputText} placeholder={t('ask_ai', lang)} placeholderTextColor="#999" />
           <Pressable onPress={() => handleSend(inputText)} style={{padding: 10}}><Ionicons name="send" size={24} color={tintColor} /></Pressable>
       </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: 20, flexDirection:'row', justifyContent:'space-between', borderBottomWidth: 1, borderBottomColor: '#eee' },
  summaryCard: { margin: 16, padding: 16, borderRadius: 12, alignItems: 'center' },
  msgBubble: { padding: 12, borderRadius: 16, marginBottom: 8, maxWidth: '80%' },
  chip: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20 },
  inputArea: { flexDirection: 'row', padding: 10, borderTopWidth: 1, borderTopColor: '#eee', alignItems: 'center' },
  input: { flex: 1, height: 40, borderWidth: 1, borderRadius: 20, paddingHorizontal: 15 },
  card: { padding: 16, borderRadius: 12 }
});