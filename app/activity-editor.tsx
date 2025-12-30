import React, { useState, useEffect, useMemo } from "react";
import {
  StyleSheet,
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Modal,
  FlatList,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { format } from "date-fns";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { db } from "@/lib/db"; 
import { activityLogs, userProfiles } from "@/drizzle/schema";
import { desc } from "drizzle-orm";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { t, useLanguage } from "@/lib/i18n"; // i18n

type ActivityItem = { id: string; mets: number; icon: string };
type ActivityCategory = { id: string; items: ActivityItem[] };

// 只存 ID，顯示時再翻譯
const ACTIVITY_RAW: ActivityCategory[] = [
  {
    id: "cat_cardio",
    items: [
      { id: "act_walk", mets: 3.0, icon: "walk" },
      { id: "act_run_slow", mets: 6.0, icon: "footsteps" },
      { id: "act_run_fast", mets: 10.0, icon: "timer" },
      { id: "act_cycling", mets: 7.5, icon: "bicycle" },
      { id: "act_swim", mets: 8.0, icon: "water" },
      { id: "act_hike", mets: 7.0, icon: "trail-sign" },
      { id: "act_jump_rope", mets: 11.0, icon: "fitness" },
    ],
  },
  {
    id: "cat_gym",
    items: [
      { id: "act_weight_training", mets: 5.0, icon: "barbell" },
      { id: "act_powerlifting", mets: 6.0, icon: "hammer" },
      { id: "act_yoga", mets: 2.5, icon: "body" },
      { id: "act_pilates", mets: 3.0, icon: "accessibility" },
      { id: "act_hiit", mets: 8.0, icon: "flash" },
      { id: "act_elliptical", mets: 5.0, icon: "repeat" },
    ],
  },
  {
    id: "cat_sport",
    items: [
      { id: "act_basketball", mets: 8.0, icon: "basketball" },
      { id: "act_badminton", mets: 5.5, icon: "tennisball" },
      { id: "act_tennis", mets: 7.3, icon: "tennisball" },
      { id: "act_soccer", mets: 9.0, icon: "football" },
      { id: "act_baseball", mets: 5.0, icon: "baseball" },
    ],
  },
  {
    id: "cat_life",
    items: [
      { id: "act_housework", mets: 3.0, icon: "home" },
      { id: "act_gardening", mets: 4.0, icon: "leaf" },
      { id: "act_moving", mets: 6.0, icon: "cube" },
    ],
  },
  { id: "cat_custom", items: [] }
];

const FEELING_EMOJIS = ["😫", "😓", "😐", "🙂", "🤩", "💪"];

export default function ActivityEditorScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? "light";
  const theme = Colors[colorScheme];
  const lang = useLanguage();

  const [recordDate, setRecordDate] = useState(new Date());
  const [recordTime, setRecordTime] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  const [category, setCategory] = useState<any>(null);
  const [activity, setActivity] = useState<any>(null);
  const [showSelector, setShowSelector] = useState(false);
  const [customActivityName, setCustomActivityName] = useState("");

  const [intensity, setIntensity] = useState<"low"|"medium"|"high">("medium");
  const [duration, setDuration] = useState(""); 
  const [distance, setDistance] = useState("");
  const [steps, setSteps] = useState("");
  const [floors, setFloors] = useState("");

  const [details, setDetails] = useState("");
  const [feeling, setFeeling] = useState("🙂");
  const [userWeight, setUserWeight] = useState(70);

  useEffect(() => {
    async function loadUserProfile() {
      try {
        const profile = await db.select().from(userProfiles).orderBy(desc(userProfiles.updatedAt)).limit(1);
        if (profile.length > 0 && profile[0].currentWeightKg) {
          setUserWeight(profile[0].currentWeightKg);
        }
      } catch (e) { console.log(e); }
    }
    loadUserProfile();
  }, []);

  const calculatedCalories = useMemo(() => {
    const timeMins = parseFloat(duration);
    if (!isNaN(timeMins) && timeMins > 0) {
        const baseMets = activity ? activity.mets : 4.0;
        const multiplier = intensity === 'low' ? 0.8 : (intensity === 'high' ? 1.2 : 1.0);
        return Math.round(baseMets * multiplier * userWeight * (timeMins / 60));
    }
    let estCalories = 0;
    const distKm = parseFloat(distance);
    if (!isNaN(distKm) && distKm > 0) estCalories += distKm * userWeight * 0.9;
    const stepCount = parseInt(steps);
    if (!isNaN(stepCount) && stepCount > 0) {
        const stepCal = stepCount * 0.04;
        if (stepCal > estCalories) estCalories = stepCal;
    }
    return Math.round(estCalories);
  }, [activity, intensity, duration, distance, steps, userWeight]);

  const handleSave = async () => {
    const hasValue = duration || distance || steps || floors;
    const hasName = (category?.id === 'cat_custom' && customActivityName) || activity;

    if (!hasName || !hasValue) {
      Alert.alert(t('data_incomplete', lang), t('data_incomplete_msg', lang));
      return;
    }

    try {
      const logDate = new Date(recordDate);
      logDate.setHours(recordTime.getHours());
      logDate.setMinutes(recordTime.getMinutes());

      // 儲存時，名稱直接存當下翻譯好的，或者存 ID
      // 這裡示範存 "名稱 (ID)" 或直接存顯示名稱
      const finalName = category?.id === 'cat_custom' ? customActivityName : t(activity.id, lang);

      await db.insert(activityLogs).values({
        date: format(logDate, 'yyyy-MM-dd'),
        loggedAt: logDate,
        category: t(category?.id, lang),
        activityName: finalName,
        intensity: intensity,
        durationMinutes: parseInt(duration) || 0,
        distanceKm: parseFloat(distance) || null,
        steps: parseInt(steps) || null,
        floors: parseInt(floors) || null,
        caloriesBurned: calculatedCalories,
        feeling: feeling,
        notes: details,
      });

      Alert.alert(t('success', lang), "OK", [{ text: "OK", onPress: () => router.back() }]);
    } catch (e) {
      console.error(e);
      Alert.alert(t('error', lang), "Save Failed");
    }
  };

  // Render
  const renderSelectorModal = () => (
    <Modal visible={showSelector} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: theme.background }]}>
          <View style={styles.modalHeader}>
            <ThemedText type="subtitle">{t('select_activity', lang)}</ThemedText>
            <TouchableOpacity onPress={() => setShowSelector(false)}>
              <Ionicons name="close" size={24} color={theme.text} />
            </TouchableOpacity>
          </View>
          
          <View style={{flexDirection: 'row', flex: 1}}>
            <View style={[styles.categoryList, { borderColor: theme.icon }]}>
              {ACTIVITY_RAW.map(cat => (
                <TouchableOpacity 
                  key={cat.id} 
                  style={[styles.catItem, category?.id === cat.id && { backgroundColor: theme.tint + '20' }]}
                  onPress={() => setCategory(cat)}
                >
                  <ThemedText style={{fontWeight: category?.id === cat.id ? 'bold' : 'normal', color: category?.id === cat.id ? theme.tint : theme.text}}>
                    {t(cat.id, lang)}
                  </ThemedText>
                </TouchableOpacity>
              ))}
            </View>

            <FlatList
              data={category?.items || []}
              keyExtractor={item => item.id}
              ListEmptyComponent={
                category?.id === 'cat_custom' ? (
                  <View style={{padding: 16}}>
                    <ThemedText>{t('custom_activity', lang)}</ThemedText>
                    <TouchableOpacity 
                        style={[styles.confirmBtn, {backgroundColor: theme.tint, marginTop: 20}]}
                        onPress={() => { setActivity(null); setShowSelector(false); }}
                    >
                        <ThemedText style={{color: '#FFF'}}>OK</ThemedText>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={{padding: 16}}><ThemedText style={{color: theme.icon}}>Please Select Category</ThemedText></View>
                )
              }
              renderItem={({ item }) => (
                <TouchableOpacity 
                  style={styles.activityItem}
                  onPress={() => { setActivity(item); setShowSelector(false); }}
                >
                  <View style={{flexDirection:'row', alignItems:'center'}}>
                      <Ionicons name={item.icon as any} size={20} color={theme.text} style={{marginRight: 10}}/>
                      <ThemedText>{t(item.id, lang)}</ThemedText>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={theme.icon} />
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </View>
    </Modal>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}><Ionicons name="arrow-back" size={28} color={theme.text} /></TouchableOpacity>
        <ThemedText type="subtitle">{t('record_activity', lang)}</ThemedText>
        <TouchableOpacity onPress={handleSave}><Ionicons name="save" size={28} color={theme.tint} /></TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.dateTimeRow}>
            <TouchableOpacity onPress={() => setShowDatePicker(true)} style={styles.dateBtn}><Ionicons name="calendar-outline" size={20} color={theme.text} /><ThemedText style={{marginLeft: 8}}>{format(recordDate, "yyyy-MM-dd")}</ThemedText></TouchableOpacity>
            <TouchableOpacity onPress={() => setShowTimePicker(true)} style={styles.dateBtn}><Ionicons name="time-outline" size={20} color={theme.text} /><ThemedText style={{marginLeft: 8}}>{format(recordTime, "HH:mm")}</ThemedText></TouchableOpacity>
        </View>
        {showDatePicker && <DateTimePicker value={recordDate} mode="date" onChange={(e,d) => {setShowDatePicker(false); if(d) setRecordDate(d)}} />}
        {showTimePicker && <DateTimePicker value={recordTime} mode="time" onChange={(e,d) => {setShowTimePicker(false); if(d) setRecordTime(d)}} />}

        <ThemedView style={styles.card}>
          <TouchableOpacity style={styles.selectorBtn} onPress={() => setShowSelector(true)}>
             <View>
                <ThemedText style={styles.labelSmall}>{t('select_activity', lang)}</ThemedText>
                <View style={{flexDirection:'row', alignItems:'center', marginTop: 4}}>
                    {activity?.icon && <Ionicons name={activity.icon as any} size={24} color={theme.text} style={{marginRight:8}}/>}
                    <ThemedText type="defaultSemiBold" style={{fontSize: 18}}>
                        {category?.id === 'cat_custom' ? t('custom_activity', lang) : (activity ? t(activity.id, lang) : t('select_activity', lang))}
                    </ThemedText>
                </View>
             </View>
             <Ionicons name="chevron-down" size={20} color={theme.icon} />
          </TouchableOpacity>
          {category?.id === 'cat_custom' && (
             <TextInput style={[styles.input, { marginTop: 12, color: theme.text, borderColor: theme.icon }]} placeholder={t('input_activity_name', lang)} placeholderTextColor="#D1D1D6" value={customActivityName} onChangeText={setCustomActivityName} />
          )}
        </ThemedView>

        {renderSelectorModal()}

        <ThemedView style={styles.card}>
            <ThemedText type="defaultSemiBold" style={{marginBottom: 12}}>{t('activity_intensity', lang)}</ThemedText>
            <View style={styles.intensityContainer}>
                {['low', 'medium', 'high'].map((key) => {
                    const label = t(`intensity_${key}`, lang);
                    const color = key==='low'?'#34C759':(key==='medium'?'#FF9500':'#FF3B30');
                    const isSelected = intensity === key;
                    return (
                        <TouchableOpacity key={key} style={[styles.intensityBtn, { borderColor: color, backgroundColor: isSelected ? color : 'transparent' }]} onPress={() => setIntensity(key as any)}>
                            <ThemedText style={{color: isSelected ? '#FFF' : color, fontWeight: '600'}}>{label}</ThemedText>
                        </TouchableOpacity>
                    );
                })}
            </View>
        </ThemedView>

        <ThemedView style={styles.card}>
             <ThemedText type="defaultSemiBold" style={{marginBottom: 12}}>{t('activity_details', lang)}</ThemedText>
             <View style={styles.inputRow}>
                 <View style={styles.inputItem}><ThemedText style={styles.labelSmall}>{t('time_min', lang)}</ThemedText><TextInput style={[styles.input, { color: theme.text, borderColor: theme.icon }]} value={duration} onChangeText={setDuration} keyboardType="numeric"/></View>
                 <View style={styles.inputItem}><ThemedText style={styles.labelSmall}>{t('distance_km', lang)}</ThemedText><TextInput style={[styles.input, { color: theme.text, borderColor: theme.icon }]} value={distance} onChangeText={setDistance} keyboardType="numeric"/></View>
             </View>
             <View style={styles.inputRow}>
                 <View style={styles.inputItem}><ThemedText style={styles.labelSmall}>{t('steps', lang)}</ThemedText><TextInput style={[styles.input, { color: theme.text, borderColor: theme.icon }]} value={steps} onChangeText={setSteps} keyboardType="numeric"/></View>
                 <View style={styles.inputItem}><ThemedText style={styles.labelSmall}>{t('floors', lang)}</ThemedText><TextInput style={[styles.input, { color: theme.text, borderColor: theme.icon }]} value={floors} onChangeText={setFloors} keyboardType="numeric"/></View>
             </View>
             <View style={styles.caloriesBox}>
                 <View><ThemedText>{t('est_calories', lang)}</ThemedText></View>
                 <View style={{alignItems: 'flex-end'}}><ThemedText type="title" style={{color: '#FF9500'}}>{calculatedCalories} kcal</ThemedText></View>
             </View>
        </ThemedView>

        <ThemedView style={styles.card}>
            <ThemedText type="defaultSemiBold" style={{marginBottom: 12}}>{t('feeling_notes', lang)}</ThemedText>
            <View style={styles.feelingContainer}>
                {FEELING_EMOJIS.map(emoji => (
                    <TouchableOpacity key={emoji} style={[styles.emojiBtn, feeling === emoji && { backgroundColor: theme.tint + '30', borderColor: theme.tint }]} onPress={() => setFeeling(emoji)}>
                        <ThemedText style={{fontSize: 24}}>{emoji}</ThemedText>
                    </TouchableOpacity>
                ))}
            </View>
            <TextInput style={[styles.input, { height: 80, textAlignVertical: 'top', marginTop: 12, color: theme.text, borderColor: theme.icon }]} placeholder={t('enter_notes', lang)} placeholderTextColor="#D1D1D6" multiline value={details} onChangeText={setDetails} />
        </ThemedView>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#E5E5EA' },
  scrollContent: { padding: 16 },
  dateTimeRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  dateBtn: { flexDirection: 'row', alignItems: 'center', padding: 10, borderRadius: 8, backgroundColor: 'rgba(142, 142, 147, 0.1)', flex: 0.48, justifyContent: 'center' },
  card: { padding: 16, borderRadius: 12, marginBottom: 16, backgroundColor: 'rgba(142, 142, 147, 0.05)' },
  selectorBtn: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  labelSmall: { fontSize: 12, color: '#8E8E93', marginBottom: 4 },
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 16 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { height: '70%', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingTop: 16 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#E5E5EA' },
  categoryList: { width: '35%', borderRightWidth: 1 },
  catItem: { paddingVertical: 16, paddingHorizontal: 12 },
  activityItem: { paddingVertical: 16, paddingHorizontal: 16, flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#eee', alignItems: 'center' },
  confirmBtn: { padding: 12, borderRadius: 8, alignItems: 'center' },
  intensityContainer: { flexDirection: 'row', justifyContent: 'space-between' },
  intensityBtn: { flex: 0.3, paddingVertical: 10, borderWidth: 1, borderRadius: 8, alignItems: 'center' },
  inputRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  inputItem: { width: '48%' },
  caloriesBox: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(255, 149, 0, 0.1)', padding: 12, borderRadius: 8, marginTop: 8 },
  feelingContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  emojiBtn: { padding: 8, borderRadius: 8, borderWidth: 1, borderColor: 'transparent' },
});