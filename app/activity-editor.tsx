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

// --- 詳細運動數據庫 ---
type ActivityItem = { id: string; name: string; mets: number; icon: string };
type ActivityCategory = { id: string; name: string; items: ActivityItem[] };

const ACTIVITY_DATA: ActivityCategory[] = [
  {
    id: "cardio",
    name: "有氧與耐力",
    items: [
      { id: "walk", name: "散步", mets: 3.0, icon: "walk" },
      { id: "run_slow", name: "慢跑", mets: 6.0, icon: "footsteps" },
      { id: "run_fast", name: "快跑", mets: 10.0, icon: "timer" },
      { id: "cycling", name: "騎腳踏車", mets: 7.5, icon: "bicycle" },
      { id: "swim", name: "游泳", mets: 8.0, icon: "water" },
      { id: "hike", name: "登山健行", mets: 7.0, icon: "trail-sign" },
      { id: "jump_rope", name: "跳繩", mets: 11.0, icon: "fitness" },
    ],
  },
  {
    id: "gym",
    name: "健身房",
    items: [
      { id: "weight_training", name: "重量訓練 (一般)", mets: 5.0, icon: "barbell" },
      { id: "powerlifting", name: "健力/大重量", mets: 6.0, icon: "hammer" },
      { id: "yoga", name: "瑜珈", mets: 2.5, icon: "body" },
      { id: "pilates", name: "皮拉提斯", mets: 3.0, icon: "accessibility" },
      { id: "hiit", name: "HIIT 間歇", mets: 8.0, icon: "flash" },
      { id: "elliptical", name: "橢圓機", mets: 5.0, icon: "repeat" },
    ],
  },
  {
    id: "sport",
    name: "球類與競技",
    items: [
      { id: "basketball", name: "籃球", mets: 8.0, icon: "basketball" },
      { id: "badminton", name: "羽球", mets: 5.5, icon: "tennisball" }, // 無羽球icon暫用tennisball
      { id: "tennis", name: "網球", mets: 7.3, icon: "tennisball" },
      { id: "soccer", name: "足球", mets: 9.0, icon: "football" },
      { id: "baseball", name: "棒球/壘球", mets: 5.0, icon: "baseball" },
    ],
  },
  {
    id: "life",
    name: "日常生活",
    items: [
      { id: "housework", name: "做家事", mets: 3.0, icon: "home" },
      { id: "gardening", name: "園藝", mets: 4.0, icon: "leaf" },
      { id: "moving", name: "搬運重物", mets: 6.0, icon: "cube" },
    ],
  },
  { id: "custom", name: "自訂", items: [] }
];

const INTENSITY_MULTIPLIER = {
  low: { label: "低強度", value: 0.8, color: "#34C759" },
  medium: { label: "中強度", value: 1.0, color: "#FF9500" },
  high: { label: "高強度", value: 1.2, color: "#FF3B30" },
};

const FEELING_EMOJIS = ["😫", "😓", "😐", "🙂", "🤩", "💪"];

export default function ActivityEditorScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? "light";
  const theme = Colors[colorScheme];

  // State
  const [recordDate, setRecordDate] = useState(new Date());
  const [recordTime, setRecordTime] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  const [category, setCategory] = useState<ActivityCategory | null>(null);
  const [activity, setActivity] = useState<ActivityItem | null>(null);
  const [showSelector, setShowSelector] = useState(false);
  const [customActivityName, setCustomActivityName] = useState("");

  const [intensity, setIntensity] = useState<keyof typeof INTENSITY_MULTIPLIER>("medium");
  
  // 數值輸入：改為預設空字串
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

  // --- 改良版熱量估算邏輯 ---
  const calculatedCalories = useMemo(() => {
    // 1. 如果有時間 (標準 METs 公式)
    // Formula: METs * 強度 * 體重(kg) * 時間(hr)
    const timeMins = parseFloat(duration);
    if (!isNaN(timeMins) && timeMins > 0) {
        const baseMets = activity ? activity.mets : 4.0;
        const multiplier = INTENSITY_MULTIPLIER[intensity].value;
        return Math.round(baseMets * multiplier * userWeight * (timeMins / 60));
    }

    // 2. 如果沒時間，但有其他數據 (估算)
    let estCalories = 0;

    // 距離 (例如跑步/走路 1km 約消耗 1kcal * kg * 0.9)
    const distKm = parseFloat(distance);
    if (!isNaN(distKm) && distKm > 0) {
        estCalories += distKm * userWeight * 0.9;
    }

    // 步數 (粗估 1步 0.04 kcal)
    const stepCount = parseInt(steps);
    if (!isNaN(stepCount) && stepCount > 0) {
        // 如果同時有距離，取最大值避免重複計算，或者這裡僅作為備用
        const stepCal = stepCount * 0.04;
        if (stepCal > estCalories) estCalories = stepCal;
    }

    return Math.round(estCalories);

  }, [activity, intensity, duration, distance, steps, userWeight]);

  const handleSave = async () => {
    // 驗證邏輯修正：只要 名稱OK 且 (四個數值任一有值) 即可
    const hasValue = duration || distance || steps || floors;
    const hasName = (category?.id === 'custom' && customActivityName) || activity;

    if (!hasName || !hasValue) {
      Alert.alert("資料不完整", "請選擇運動項目，並至少輸入一項數據(時間/距離/步數/樓層)");
      return;
    }

    try {
      const logDate = new Date(recordDate);
      logDate.setHours(recordTime.getHours());
      logDate.setMinutes(recordTime.getMinutes());

      const finalName = category?.id === 'custom' ? customActivityName : activity?.name || customActivityName;

      await db.insert(activityLogs).values({
        date: format(logDate, 'yyyy-MM-dd'),
        loggedAt: logDate,
        category: category?.name || "自訂",
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

      Alert.alert("成功", "運動紀錄已儲存", [{ text: "OK", onPress: () => router.back() }]);
    } catch (e) {
      console.error(e);
      Alert.alert("錯誤", "儲存失敗");
    }
  };

  // Render Helpers
  const renderSelectorModal = () => (
    <Modal visible={showSelector} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: theme.background }]}>
          <View style={styles.modalHeader}>
            <ThemedText type="subtitle">選擇運動</ThemedText>
            <TouchableOpacity onPress={() => setShowSelector(false)}>
              <Ionicons name="close" size={24} color={theme.text} />
            </TouchableOpacity>
          </View>
          
          <View style={{flexDirection: 'row', flex: 1}}>
            <View style={[styles.categoryList, { borderColor: theme.icon }]}>
              {ACTIVITY_DATA.map(cat => (
                <TouchableOpacity 
                  key={cat.id} 
                  style={[styles.catItem, category?.id === cat.id && { backgroundColor: theme.tint + '20' }]}
                  onPress={() => setCategory(cat)}
                >
                  <ThemedText style={{fontWeight: category?.id === cat.id ? 'bold' : 'normal', color: category?.id === cat.id ? theme.tint : theme.text}}>
                    {cat.name}
                  </ThemedText>
                </TouchableOpacity>
              ))}
            </View>

            <FlatList
              data={category?.items || []}
              keyExtractor={item => item.id}
              ListEmptyComponent={
                category?.id === 'custom' ? (
                  <View style={{padding: 16}}>
                    <ThemedText>請在主畫面直接輸入名稱</ThemedText>
                    <TouchableOpacity 
                        style={[styles.confirmBtn, {backgroundColor: theme.tint, marginTop: 20}]}
                        onPress={() => { setActivity(null); setShowSelector(false); }}
                    >
                        <ThemedText style={{color: '#FFF'}}>確認自訂</ThemedText>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={{padding: 16}}><ThemedText style={{color: theme.icon}}>請先選擇左側類別</ThemedText></View>
                )
              }
              renderItem={({ item }) => (
                <TouchableOpacity 
                  style={styles.activityItem}
                  onPress={() => { setActivity(item); setShowSelector(false); }}
                >
                  <View style={{flexDirection:'row', alignItems:'center'}}>
                      <Ionicons name={item.icon as any} size={20} color={theme.text} style={{marginRight: 10}}/>
                      <ThemedText>{item.name}</ThemedText>
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
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={28} color={theme.text} />
        </TouchableOpacity>
        <ThemedText type="subtitle">紀錄運動</ThemedText>
        <TouchableOpacity onPress={handleSave}>
          <Ionicons name="save" size={28} color={theme.tint} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.dateTimeRow}>
            <TouchableOpacity onPress={() => setShowDatePicker(true)} style={styles.dateBtn}>
                <Ionicons name="calendar-outline" size={20} color={theme.text} />
                <ThemedText style={{marginLeft: 8}}>{format(recordDate, "yyyy-MM-dd")}</ThemedText>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowTimePicker(true)} style={styles.dateBtn}>
                <Ionicons name="time-outline" size={20} color={theme.text} />
                <ThemedText style={{marginLeft: 8}}>{format(recordTime, "HH:mm")}</ThemedText>
            </TouchableOpacity>
        </View>
        {showDatePicker && <DateTimePicker value={recordDate} mode="date" onChange={(e,d) => {setShowDatePicker(false); if(d) setRecordDate(d)}} />}
        {showTimePicker && <DateTimePicker value={recordTime} mode="time" onChange={(e,d) => {setShowTimePicker(false); if(d) setRecordTime(d)}} />}

        <ThemedView style={styles.card}>
          <TouchableOpacity style={styles.selectorBtn} onPress={() => setShowSelector(true)}>
             <View>
                <ThemedText style={styles.labelSmall}>運動項目</ThemedText>
                <View style={{flexDirection:'row', alignItems:'center', marginTop: 4}}>
                    {activity?.icon && <Ionicons name={activity.icon as any} size={24} color={theme.text} style={{marginRight:8}}/>}
                    <ThemedText type="defaultSemiBold" style={{fontSize: 18}}>
                        {category?.id === 'custom' ? "自訂運動" : (activity?.name || "點擊選擇運動")}
                    </ThemedText>
                </View>
             </View>
             <Ionicons name="chevron-down" size={20} color={theme.icon} />
          </TouchableOpacity>
          {category?.id === 'custom' && (
             <TextInput
                style={[styles.input, { marginTop: 12, color: theme.text, borderColor: theme.icon }]}
                placeholder="輸入運動名稱"
                placeholderTextColor="#D1D1D6"
                value={customActivityName}
                onChangeText={setCustomActivityName}
             />
          )}
        </ThemedView>

        {renderSelectorModal()}

        <ThemedView style={styles.card}>
            <ThemedText type="defaultSemiBold" style={{marginBottom: 12}}>運動強度</ThemedText>
            <View style={styles.intensityContainer}>
                {(Object.keys(INTENSITY_MULTIPLIER) as Array<keyof typeof INTENSITY_MULTIPLIER>).map((key) => {
                    const item = INTENSITY_MULTIPLIER[key];
                    const isSelected = intensity === key;
                    return (
                        <TouchableOpacity
                            key={key}
                            style={[styles.intensityBtn, { borderColor: item.color, backgroundColor: isSelected ? item.color : 'transparent' }]}
                            onPress={() => setIntensity(key)}
                        >
                            <ThemedText style={{color: isSelected ? '#FFF' : item.color, fontWeight: '600'}}>{item.label}</ThemedText>
                        </TouchableOpacity>
                    );
                })}
            </View>
        </ThemedView>

        <ThemedView style={styles.card}>
             <ThemedText type="defaultSemiBold" style={{marginBottom: 12}}>詳細數據</ThemedText>
             <View style={styles.inputRow}>
                 <View style={styles.inputItem}>
                     <ThemedText style={styles.labelSmall}>時間 (分鐘)</ThemedText>
                     <TextInput 
                        style={[styles.input, { color: theme.text, borderColor: theme.icon }]} 
                        value={duration} 
                        onChangeText={setDuration}
                        keyboardType="numeric"
                        placeholder="0"
                        placeholderTextColor="#D1D1D6"
                     />
                 </View>
                 <View style={styles.inputItem}>
                     <ThemedText style={styles.labelSmall}>距離 (km)</ThemedText>
                     <TextInput 
                        style={[styles.input, { color: theme.text, borderColor: theme.icon }]} 
                        value={distance} 
                        onChangeText={setDistance}
                        keyboardType="numeric"
                        placeholder="0"
                        placeholderTextColor="#D1D1D6"
                     />
                 </View>
             </View>

             <View style={styles.inputRow}>
                 <View style={styles.inputItem}>
                     <ThemedText style={styles.labelSmall}>步數</ThemedText>
                     <TextInput 
                        style={[styles.input, { color: theme.text, borderColor: theme.icon }]} 
                        value={steps} 
                        onChangeText={setSteps}
                        keyboardType="numeric"
                        placeholder="0"
                        placeholderTextColor="#D1D1D6"
                     />
                 </View>
                 <View style={styles.inputItem}>
                     <ThemedText style={styles.labelSmall}>樓層</ThemedText>
                     <TextInput 
                        style={[styles.input, { color: theme.text, borderColor: theme.icon }]} 
                        value={floors} 
                        onChangeText={setFloors}
                        keyboardType="numeric"
                        placeholder="0"
                        placeholderTextColor="#D1D1D6"
                     />
                 </View>
             </View>

             <View style={styles.caloriesBox}>
                 <View>
                     <ThemedText>預估消耗熱量</ThemedText>
                     <ThemedText style={{fontSize: 12, color: theme.icon}}>
                         {duration ? "基於 時間 與 METs" : "基於 距離/步數 粗估"}
                     </ThemedText>
                 </View>
                 <View style={{alignItems: 'flex-end'}}>
                     <ThemedText type="title" style={{color: '#FF9500'}}>{calculatedCalories} kcal</ThemedText>
                 </View>
             </View>
        </ThemedView>

        <ThemedView style={styles.card}>
            <ThemedText type="defaultSemiBold" style={{marginBottom: 12}}>運動感受 & 筆記</ThemedText>
            <View style={styles.feelingContainer}>
                {FEELING_EMOJIS.map(emoji => (
                    <TouchableOpacity 
                        key={emoji} 
                        style={[styles.emojiBtn, feeling === emoji && { backgroundColor: theme.tint + '30', borderColor: theme.tint }]}
                        onPress={() => setFeeling(emoji)}
                    >
                        <ThemedText style={{fontSize: 24}}>{emoji}</ThemedText>
                    </TouchableOpacity>
                ))}
            </View>
            <TextInput
                style={[styles.input, { height: 80, textAlignVertical: 'top', marginTop: 12, color: theme.text, borderColor: theme.icon }]}
                placeholder="輸入運動筆記..."
                placeholderTextColor="#D1D1D6"
                multiline
                value={details}
                onChangeText={setDetails}
            />
        </ThemedView>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#E5E5EA',
  },
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