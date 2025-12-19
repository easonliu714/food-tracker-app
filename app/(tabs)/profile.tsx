import { useRouter } from "expo-router";
import { useState, useEffect } from "react";
import {
  ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View, Alert, Modal
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { ThemedText } from "@/components/themed-text";
import { useAuth } from "@/hooks/use-auth";
import { useThemeColor } from "@/hooks/use-theme-color";
import { saveProfileLocal, getProfileLocal, saveSettings, getSettings } from "@/lib/storage";
import { validateApiKey } from "@/lib/gemini"; // 引用測試函式

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, isAuthenticated, logout } = useAuth();
  const [loading, setLoading] = useState(true);

  // Profile State
  const [gender, setGender] = useState<"male" | "female" | "other">("male");
  const [birthYear, setBirthYear] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [currentWeight, setCurrentWeight] = useState("");
  const [targetWeight, setTargetWeight] = useState("");
  const [activityLevel, setActivityLevel] = useState<"sedentary"|"lightly_active"|"moderately_active"|"very_active"|"extra_active">("sedentary");
  const [goal, setGoal] = useState<"lose_weight"|"maintain"|"gain_weight">("maintain");

  // AI Settings State
  const [apiKey, setApiKey] = useState("");
  const [selectedModel, setSelectedModel] = useState("gemini-2.5-flash");
  const [modelList, setModelList] = useState<string[]>([]);
  const [testingKey, setTestingKey] = useState(false);
  const [showModelPicker, setShowModelPicker] = useState(false);

  const backgroundColor = useThemeColor({}, "background");
  const cardBackground = useThemeColor({}, "cardBackground");
  const tintColor = useThemeColor({}, "tint");
  const textColor = useThemeColor({}, "text");
  const textSecondary = useThemeColor({}, "textSecondary");
  const borderColor = useThemeColor({}, "border");

  useEffect(() => {
    async function loadData() {
      if (!isAuthenticated) return;
      try {
        const p = await getProfileLocal();
        if (p) {
          if (p.gender) setGender(p.gender);
          if (p.birthDate) setBirthYear(new Date(p.birthDate).getFullYear().toString());
          if (p.heightCm) setHeightCm(p.heightCm.toString());
          if (p.currentWeightKg) setCurrentWeight(p.currentWeightKg.toString());
          if (p.targetWeightKg) setTargetWeight(p.targetWeightKg.toString());
          if (p.activityLevel) setActivityLevel(p.activityLevel);
          if (p.goal) setGoal(p.goal);
        }
        // 載入設定
        const s = await getSettings();
        if (s.apiKey) setApiKey(s.apiKey);
        if (s.model) setSelectedModel(s.model);
      } catch (e) {
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [isAuthenticated]);

  const calculateBMR = () => {
    const w = parseFloat(currentWeight);
    const h = parseFloat(heightCm);
    const age = new Date().getFullYear() - (parseInt(birthYear) || 2000);
    if (!w || !h) return 0;
    let bmr = 10 * w + 6.25 * h - 5 * age;
    bmr += gender === "male" ? 5 : -161;
    const multipliers = { sedentary: 1.2, lightly_active: 1.375, moderately_active: 1.55, very_active: 1.725, extra_active: 1.9 };
    let tdee = bmr * multipliers[activityLevel];
    if (goal === "lose_weight") tdee -= 500;
    if (goal === "gain_weight") tdee += 300;
    return Math.round(tdee);
  };

  const handleSave = async () => {
    const dailyCalorieTarget = calculateBMR();
    const data = {
      gender,
      birthDate: birthYear ? new Date(parseInt(birthYear), 0, 1).toISOString() : undefined,
      heightCm: parseInt(heightCm) || undefined,
      currentWeightKg: parseFloat(currentWeight) || undefined,
      targetWeightKg: parseFloat(targetWeight) || undefined,
      activityLevel,
      goal,
      dailyCalorieTarget,
    };
    
    // 儲存所有資料 (Profile + Settings)
    await saveProfileLocal(data);
    await saveSettings({ apiKey, model: selectedModel });
    
    Alert.alert("儲存成功", "個人資料與 AI 設定已更新");
  };

  // 測試 Key 並獲取模型
  const handleTestKey = async () => {
    if (!apiKey) return Alert.alert("請輸入 API Key");
    setTestingKey(true);
    const res = await validateApiKey(apiKey);
    setTestingKey(false);
    
    if (res.valid && res.models) {
      setModelList(res.models);
      // 自動選第一個 (通常是最新的)
      if (res.models.length > 0 && !modelList.includes(selectedModel)) {
        setSelectedModel(res.models[0]);
      }
      Alert.alert("測試成功", `金鑰有效！共找到 ${res.models.length} 個可用模型。`);
    } else {
      Alert.alert("測試失敗", res.error || "無法連線");
    }
  };

  if (!isAuthenticated) return <View style={[styles.container, styles.centerContent, { backgroundColor }]}><Pressable onPress={() => router.push("/login")} style={[styles.loginPromptButton, { backgroundColor: tintColor }]}><ThemedText style={styles.loginPromptText}>登入</ThemedText></Pressable></View>;

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <ScrollView style={styles.scrollView}>
        <View style={[styles.header, { paddingTop: Math.max(insets.top, 20) }]}>
          <ThemedText type="title" style={{ fontSize: 32 }}>個人檔案</ThemedText>
        </View>

        {loading ? <ActivityIndicator size="large" color={tintColor} /> : (
          <>
            {/* AI 設定區塊 */}
            <View style={[styles.card, { backgroundColor: cardBackground, marginBottom: 16 }]}>
              <ThemedText type="subtitle" style={styles.sectionTitle}>AI 設定</ThemedText>
              
              <View style={styles.inputGroup}>
                <ThemedText style={[styles.label, { color: textSecondary }]}>Gemini API Key</ThemedText>
                <TextInput
                  style={[styles.input, { backgroundColor: 'white', color: textColor, borderColor }]}
                  value={apiKey}
                  onChangeText={setApiKey}
                  placeholder="請貼上您的 API Key"
                  placeholderTextColor={textSecondary}
                  secureTextEntry
                />
              </View>

              <View style={{flexDirection: 'row', gap: 10, alignItems: 'center'}}>
                <Pressable onPress={handleTestKey} disabled={testingKey} style={[styles.testBtn, {backgroundColor: tintColor, opacity: testingKey?0.5:1}]}>
                  {testingKey ? <ActivityIndicator color="white"/> : <ThemedText style={{color: 'white', fontWeight: 'bold'}}>測試並取得模型</ThemedText>}
                </Pressable>
              </View>

              {/* 模型選擇 */}
              <View style={[styles.inputGroup, {marginTop: 16}]}>
                <ThemedText style={[styles.label, { color: textSecondary }]}>目前使用模型</ThemedText>
                <Pressable onPress={() => modelList.length > 0 && setShowModelPicker(true)} style={[styles.input, {backgroundColor: 'white', justifyContent:'center'}]}>
                   <ThemedText>{selectedModel}</ThemedText>
                   {modelList.length === 0 && <ThemedText style={{fontSize: 10, color: 'red'}}> (請先按測試以載入列表)</ThemedText>}
                </Pressable>
              </View>
            </View>

            {/* 基本資料 (保持原樣，省略部分細節) */}
            <View style={[styles.card, { backgroundColor: cardBackground }]}>
              <ThemedText type="subtitle" style={styles.sectionTitle}>基本資料</ThemedText>
              <View style={styles.inputGroup}>
                <ThemedText style={styles.label}>性別</ThemedText>
                <View style={styles.row}>
                  {["male", "female"].map(g => (
                    <Pressable key={g} onPress={() => setGender(g as any)} style={[styles.option, gender === g && {backgroundColor: tintColor}]}>
                       <ThemedText style={{color: gender===g?'white':textColor}}>{g==='male'?'男':'女'}</ThemedText>
                    </Pressable>
                  ))}
                </View>
              </View>
              {/* 年份、身高、體重 */}
              <View style={styles.row}>
                <View style={{flex:1}}><ThemedText style={styles.label}>出生年</ThemedText><TextInput style={[styles.input, {backgroundColor:'white'}]} value={birthYear} onChangeText={setBirthYear} keyboardType="numeric"/></View>
                <View style={{width:10}}/>
                <View style={{flex:1}}><ThemedText style={styles.label}>身高(cm)</ThemedText><TextInput style={[styles.input, {backgroundColor:'white'}]} value={heightCm} onChangeText={setHeightCm} keyboardType="numeric"/></View>
              </View>
              <View style={[styles.row, {marginTop:10}]}>
                <View style={{flex:1}}><ThemedText style={styles.label}>體重(kg)</ThemedText><TextInput style={[styles.input, {backgroundColor:'white'}]} value={currentWeight} onChangeText={setCurrentWeight} keyboardType="numeric"/></View>
                <View style={{width:10}}/>
                <View style={{flex:1}}><ThemedText style={styles.label}>目標(kg)</ThemedText><TextInput style={[styles.input, {backgroundColor:'white'}]} value={targetWeight} onChangeText={setTargetWeight} keyboardType="numeric"/></View>
              </View>
            </View>

            {/* 活動量 */}
            <View style={[styles.card, { backgroundColor: cardBackground, marginTop: 16 }]}>
              <ThemedText type="subtitle" style={styles.sectionTitle}>活動量</ThemedText>
              {/* 簡易選單 */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {["sedentary", "lightly_active", "moderately_active", "very_active"].map(a => (
                  <Pressable key={a} onPress={() => setActivityLevel(a as any)} style={[styles.chip, activityLevel === a && {backgroundColor: tintColor, borderColor: tintColor}]}>
                    <ThemedText style={{color: activityLevel===a?'white':textColor}}>{a.replace('_', ' ')}</ThemedText>
                  </Pressable>
                ))}
              </ScrollView>
              <View style={[styles.targetBox, { borderColor: tintColor }]}>
                <ThemedText style={{ color: textSecondary }}>每日目標</ThemedText>
                <ThemedText style={{ fontSize: 24, fontWeight: 'bold', color: tintColor }}>{calculateBMR()} kcal</ThemedText>
              </View>
            </View>

            <View style={styles.buttonContainer}>
              <Pressable onPress={handleSave} style={[styles.saveButton, { backgroundColor: tintColor }]}><ThemedText style={styles.saveButtonText}>儲存設定</ThemedText></Pressable>
              <Pressable onPress={logout} style={[styles.logoutButton, { borderColor: "#FF3B30" }]}><ThemedText style={{ color: "#FF3B30" }}>登出</ThemedText></Pressable>
            </View>
            <View style={{ height: 40 }} />
          </>
        )}
      </ScrollView>

      {/* 模型選擇 Modal */}
      <Modal visible={showModelPicker} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, {backgroundColor: cardBackground}]}>
            <ThemedText type="subtitle" style={{marginBottom:10}}>選擇模型</ThemedText>
            <ScrollView style={{maxHeight: 300}}>
              {modelList.map(m => (
                <Pressable key={m} onPress={() => {setSelectedModel(m); setShowModelPicker(false);}} style={{padding: 15, borderBottomWidth:1, borderColor:'#eee'}}>
                  <ThemedText style={{color: selectedModel===m?tintColor:textColor, fontWeight: selectedModel===m?'bold':'normal'}}>{m}</ThemedText>
                </Pressable>
              ))}
            </ScrollView>
            <Pressable onPress={() => setShowModelPicker(false)} style={{padding:15, alignItems:'center'}}><ThemedText>取消</ThemedText></Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollView: { flex: 1 },
  centerContent: { justifyContent: "center", alignItems: "center", padding: 32 },
  header: { paddingHorizontal: 20, paddingBottom: 20 },
  loadingContainer: { padding: 40, alignItems: "center" },
  card: { marginHorizontal: 16, padding: 20, borderRadius: 16 },
  sectionTitle: { marginBottom: 16, fontSize: 20, lineHeight: 25 },
  inputGroup: { marginBottom: 16 },
  label: { fontSize: 14, marginBottom: 8, lineHeight: 18 },
  input: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, borderWidth: 1, fontSize: 16, lineHeight: 22 },
  buttonContainer: { paddingHorizontal: 16, gap: 12, marginTop: 20 },
  saveButton: { paddingVertical: 16, borderRadius: 12, alignItems: "center", minHeight: 52 },
  saveButtonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "600" },
  logoutButton: { paddingVertical: 14, borderRadius: 12, borderWidth: 2, alignItems: "center" },
  loginPromptButton: { paddingVertical: 16, paddingHorizontal: 48, borderRadius: 12 },
  loginPromptText: { color: "#FFFFFF", fontSize: 16, fontWeight: "600" },
  testBtn: { padding: 12, borderRadius: 8, alignItems: 'center', flex: 1 },
  row: { flexDirection: 'row' },
  option: { flex: 1, padding: 10, borderWidth: 1, borderColor: '#ddd', alignItems: 'center', borderRadius: 8, marginHorizontal: 2 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#ddd', marginRight: 8 },
  targetBox: { marginTop: 16, padding: 16, borderRadius: 12, borderWidth: 2, alignItems: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 40 },
  modalContent: { padding: 20, borderRadius: 16 }
});