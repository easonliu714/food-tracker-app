import { useState, useCallback, useEffect, useRef } from "react";
import { View, ScrollView, ActivityIndicator, Pressable, StyleSheet, Alert, TextInput, KeyboardAvoidingView, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { ThemedText } from "@/components/themed-text";
import { useThemeColor } from "@/hooks/use-theme-color";
import { t, useLanguage } from "@/lib/i18n";
import { Ionicons } from "@expo/vector-icons";
import { chatWithAI } from "@/lib/gemini"; // 需使用新版 gemini.ts

// DB Imports
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
  const scrollViewRef = useRef<ScrollView>(null);

  // Sync Data
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
      if (!msg.trim() || !profile) return;
      const userText = msg.trim();
      
      const newHistory = [...messages, { role: 'user', parts: [{ text: userText }] }];
      setMessages(newHistory);
      setInputText("");
      setLoading(true);

      // Scroll to bottom
      setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);

      // Call AI
      const response = await chatWithAI(newHistory, userText, { ...profile, remaining }, lang);
      
      setMessages([...newHistory, { role: 'model', parts: [{ text: response }] }]);
      setLoading(false);
      setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={[styles.container, { backgroundColor }]}>
       <View style={[styles.header, { paddingTop: Math.max(insets.top, 20) }]}>
          <ThemedText type="title">{t('ai_coach', lang)}</ThemedText>
       </View>
       
       <View style={[styles.summaryCard, {backgroundColor: cardBackground}]}>
           <ThemedText style={{fontSize: 12, color: '#888'}}>{t('remaining_budget', lang)}</ThemedText>
           <ThemedText style={{fontSize: 24, fontWeight: 'bold', color: remaining < 0 ? 'red' : tintColor}}>{remaining} kcal</ThemedText>
       </View>

       <ScrollView 
          ref={scrollViewRef}
          style={{flex: 1, paddingHorizontal: 16}}
          contentContainerStyle={{paddingBottom: 20}}
       >
          {messages.length === 0 && (
              <View style={{marginTop: 40, alignItems: 'center'}}>
                  <Ionicons name="chatbubbles-outline" size={60} color="#ccc" />
                  <ThemedText style={{color:'#888', marginTop:10}}>
                      Hi! I am your AI Coach. Ask me anything about diet or workout.
                  </ThemedText>
              </View>
          )}

          {messages.map((m, i) => (
              <View key={i} style={[
                  styles.msgBubble, 
                  m.role === 'user' ? { alignSelf: 'flex-end', backgroundColor: tintColor } : { alignSelf: 'flex-start', backgroundColor: '#E5E5EA' }
              ]}>
                  <ThemedText style={{color: m.role==='user'?'#FFF':'#000'}}>{m.parts[0].text}</ThemedText>
              </View>
          ))}
          
          {loading && <ActivityIndicator style={{marginTop:10}} />}

          {/* Quick Suggestions */}
          {!loading && (
              <View style={{flexDirection:'row', flexWrap:'wrap', gap: 8, marginTop: 20}}>
                  {[t('follow_up_1', lang), t('follow_up_2', lang), t('follow_up_3', lang)].map((q, i) => (
                      <Pressable key={i} onPress={() => handleSend(q)} style={[styles.chip, {borderColor: tintColor}]}>
                          <ThemedText style={{fontSize: 12, color: tintColor}}>{q}</ThemedText>
                      </Pressable>
                  ))}
              </View>
          )}
       </ScrollView>

       <View style={[styles.inputArea, {backgroundColor: cardBackground, paddingBottom: Math.max(insets.bottom, 10)}]}>
           <TextInput 
              style={[styles.input, {color: textColor, borderColor: '#ddd'}]}
              value={inputText}
              onChangeText={setInputText}
              placeholder={t('ask_ai', lang)}
              placeholderTextColor="#999"
           />
           <Pressable onPress={() => handleSend(inputText)} style={{padding: 10}}>
               <Ionicons name="send" size={24} color={tintColor} />
           </Pressable>
       </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: 20, borderBottomWidth: 1, borderBottomColor: '#eee' },
  summaryCard: { margin: 16, padding: 16, borderRadius: 12, alignItems: 'center' },
  msgBubble: { padding: 12, borderRadius: 16, marginBottom: 8, maxWidth: '80%' },
  chip: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20, borderWidth: 1, backgroundColor: 'transparent' },
  inputArea: { flexDirection: 'row', padding: 10, borderTopWidth: 1, borderTopColor: '#eee', alignItems: 'center' },
  input: { flex: 1, height: 40, borderWidth: 1, borderRadius: 20, paddingHorizontal: 15 }
});