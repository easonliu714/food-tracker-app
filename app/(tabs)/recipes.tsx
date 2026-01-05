import React, { useState, useRef, useEffect } from "react";
import { View, ScrollView, TextInput, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform, TouchableOpacity, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { ThemedText } from "@/components/themed-text";
import { useThemeColor } from "@/hooks/use-theme-color";
import { chatWithAI } from "@/lib/gemini"; 
import { t, useLanguage } from "@/lib/i18n";
import { db } from "@/lib/db"; 
import { foodLogs, activityLogs, userProfiles } from "@/drizzle/schema";
import { eq } from "drizzle-orm";
import { format } from "date-fns";
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useFocusEffect } from "expo-router";

interface Message {
    id: string;
    role: 'user' | 'model';
    text: string;
}

export default function RecipesScreen() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(false);
  
  // 頂部資訊卡狀態
  const [status, setStatus] = useState({ target: 2000, intake: 0, burned: 0, remaining: 2000 });
  
  const scrollViewRef = useRef<ScrollView>(null);
  const lang = useLanguage();

  const backgroundColor = useThemeColor({}, "background");
  const tintColor = useThemeColor({}, "tint");
  const inputBg = useThemeColor({}, "cardBackground");
  const textColor = useThemeColor({}, "text");

  // 更新剩餘熱量
  useFocusEffect(
      React.useCallback(() => {
          fetchContextData();
      }, [])
  );

  const fetchContextData = async () => {
      try {
          const today = format(new Date(), 'yyyy-MM-dd');
          const profile = await db.select().from(userProfiles).limit(1);
          const p = profile[0] || {};
          const target = p.dailyCalorieTarget || 2000;

          const foods = await db.select().from(foodLogs).where(eq(foodLogs.date, today));
          const intake = foods.reduce((sum, f) => sum + (f.totalCalories||0), 0);

          const acts = await db.select().from(activityLogs).where(eq(activityLogs.date, today));
          const burned = acts.reduce((sum, a) => sum + (a.caloriesBurned||0), 0);

          setStatus({ target, intake, burned, remaining: Math.round(target - intake + burned) });
      } catch(e) { console.error(e); }
  };

  // [FIX] 使用 i18n 翻譯的提示詞
  const suggestionGroups = [
      {
          title: t('meal_suggestions', lang),
          items: [
              { 
                  label: "🍳 " + t('cook_meal', lang), 
                  prompt: t('coach_prompt_cook', lang) 
              },
              { 
                  label: "🏪 " + t('store_meal', lang), 
                  prompt: t('coach_prompt_store', lang) 
              }
          ]
      },
      {
          title: t('workout_suggestions', lang),
          items: [
              { 
                  label: "🏠 " + t('home_workout', lang), 
                  prompt: t('coach_prompt_home_workout', lang) 
              },
              { 
                  label: "🏋️ " + t('gym_workout', lang), 
                  prompt: t('coach_prompt_gym_workout', lang) 
              }
          ]
      }
  ];

  const getSystemContext = async () => {
      await fetchContextData(); 
      return `
        [User Context]
        Target Calories: ${status.target} kcal
        Today's Intake: ${Math.round(status.intake)} kcal
        Today's Burned: ${Math.round(status.burned)} kcal
        Remaining Budget: ${status.remaining} kcal
        (Please adjust recommendations strictly based on this remaining budget)
      `;
  };

  const handleSend = async (text: string, isSystemPrompt = false) => {
      if (!text.trim()) return;

      const userMsg: Message = { id: Date.now().toString(), role: 'user', text };
      setMessages(prev => [...prev, userMsg]);
      setInputText("");
      setLoading(true);

      try {
          const context = await getSystemContext();
          const finalPrompt = `${context}\n\nUser Request: ${text}`;

          const history = messages.map(m => ({
              role: m.role === 'user' ? 'user' : 'model',
              parts: [{ text: m.text }]
          }));

          const responseText = await chatWithAI(history, finalPrompt, null, lang);
          const botMsg: Message = { id: (Date.now()+1).toString(), role: 'model', text: responseText };
          setMessages(prev => [...prev, botMsg]);

      } catch (e) {
          Alert.alert(t('error', lang), "AI Service Unavailable");
      } finally {
          setLoading(false);
      }
  };

  const handleExportPDF = async () => {
      if (messages.length === 0) return Alert.alert(t('tip', lang), "No conversation to export.");
      try {
          const html = `
            <html><body><h1>AI Coach Session</h1>
            ${messages.map(m => `<p><b>${m.role}:</b> ${m.text}</p>`).join('')}
            </body></html>`;
          const { uri } = await Print.printToFileAsync({ html });
          await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
      } catch (e) { Alert.alert("Error", "Export failed"); }
  };

  useEffect(() => {
    if(scrollViewRef.current) scrollViewRef.current.scrollToEnd({ animated: true });
  }, [messages]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor }]}>
      <View style={styles.header}>
          <ThemedText type="title">{t('ai_coach', lang)}</ThemedText>
          <View style={{flexDirection:'row', gap: 16}}>
              <TouchableOpacity onPress={handleExportPDF}><Ionicons name="document-text-outline" size={24} color={textColor}/></TouchableOpacity>
              <TouchableOpacity onPress={() => setMessages([])}><Ionicons name="trash-outline" size={24} color={textColor}/></TouchableOpacity>
          </View>
      </View>

      {/* 剩餘熱量儀表板 */}
      <View style={[styles.statusCard, {backgroundColor: tintColor + '15'}]}>
          <View style={styles.statusItem}>
              <ThemedText style={{fontSize:10, color:'#888'}}>{t('daily_calorie_target', lang)}</ThemedText>
              <ThemedText style={{fontWeight:'bold'}}>{status.target}</ThemedText>
          </View>
          <View style={styles.statusItem}>
              <ThemedText style={{fontSize:10, color:'#888'}}>{t('intake', lang)}</ThemedText>
              <ThemedText style={{fontWeight:'bold', color:'#34C759'}}>{Math.round(status.intake)}</ThemedText>
          </View>
          <View style={styles.statusItem}>
              <ThemedText style={{fontSize:10, color:'#888'}}>{t('burned', lang)}</ThemedText>
              <ThemedText style={{fontWeight:'bold', color:'#FF9500'}}>{Math.round(status.burned)}</ThemedText>
          </View>
          <View style={[styles.statusItem, {borderLeftWidth:1, borderColor:'#ccc', paddingLeft:10}]}>
              <ThemedText style={{fontSize:10, color:tintColor}}>{t('remaining', lang)}</ThemedText>
              <ThemedText type="subtitle" style={{color:tintColor}}>{status.remaining}</ThemedText>
          </View>
      </View>

      <ScrollView ref={scrollViewRef} contentContainerStyle={styles.chatContent} style={{flex:1}}>
          {messages.length === 0 ? (
              <View style={{marginTop: 10}}>
                  <View style={{alignItems:'center', marginBottom: 20, opacity: 0.6}}>
                      <Ionicons name="chatbubbles-outline" size={48} color={tintColor} />
                      <ThemedText style={{marginTop:8, fontSize:12, textAlign:'center', maxWidth: '80%'}}>
                          {t('ai_welcome_msg', lang)}
                      </ThemedText>
                  </View>

                  {suggestionGroups.map((group, idx) => (
                      <View key={idx} style={{marginBottom: 20}}>
                          <ThemedText type="defaultSemiBold" style={{marginBottom: 8, fontSize: 14}}>{group.title}</ThemedText>
                          <View style={{flexDirection: 'row', gap: 10}}>
                              {group.items.map((item, i) => (
                                  <TouchableOpacity 
                                    key={i} 
                                    style={[styles.chip, {borderColor: tintColor, backgroundColor: backgroundColor}]} 
                                    onPress={() => handleSend(item.prompt, true)}
                                  >
                                      <ThemedText style={{fontSize: 13, color: tintColor}}>{item.label}</ThemedText>
                                  </TouchableOpacity>
                              ))}
                          </View>
                      </View>
                  ))}
              </View>
          ) : (
              messages.map(msg => (
                  <View key={msg.id} style={[styles.bubble, msg.role === 'user' ? { alignSelf: 'flex-end', backgroundColor: tintColor } : { alignSelf: 'flex-start', backgroundColor: inputBg }]}>
                      <ThemedText style={{color: msg.role==='user'?'white':textColor}}>{msg.text}</ThemedText>
                  </View>
              ))
          )}
          {loading && <ActivityIndicator style={{marginTop: 10}} size="small" color={tintColor}/>}
      </ScrollView>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}>
          <View style={[styles.inputContainer, { backgroundColor: inputBg }]}>
              <TextInput style={[styles.input, { color: textColor }]} value={inputText} onChangeText={setInputText} placeholder={t('ask_ai_placeholder', lang)} placeholderTextColor="#999"/>
              <TouchableOpacity onPress={() => handleSend(inputText)} disabled={!inputText.trim() || loading} style={{marginLeft: 8}}>
                  <Ionicons name="send" size={24} color={inputText.trim() ? tintColor : '#ccc'} />
              </TouchableOpacity>
          </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#eee' },
  statusCard: { flexDirection: 'row', justifyContent: 'space-around', padding: 12, marginHorizontal: 16, borderRadius: 12, marginBottom: 8 },
  statusItem: { alignItems: 'center' },
  chatContent: { padding: 16, paddingBottom: 20 },
  bubble: { padding: 12, borderRadius: 16, maxWidth: '80%', marginBottom: 12 },
  inputContainer: { flexDirection: 'row', alignItems: 'center', padding: 12, borderTopWidth: 1, borderTopColor: '#eee' },
  input: { flex: 1, fontSize: 16, maxHeight: 100 },
  chip: { flex: 1, padding: 14, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' }
});