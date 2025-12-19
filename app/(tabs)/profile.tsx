import { useRouter } from "expo-router";
import { useState, useEffect } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { ThemedText } from "@/components/themed-text";
import { useAuth } from "@/hooks/use-auth";
import { useThemeColor } from "@/hooks/use-theme-color";
// [修改] 引入本地存儲工具
import { saveProfileLocal, getProfileLocal } from "@/lib/storage";

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, isAuthenticated, logout } = useAuth();
  const [loading, setLoading] = useState(true);

  const [gender, setGender] = useState<"male" | "female" | "other">("male");
  const [birthYear, setBirthYear] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [currentWeight, setCurrentWeight] = useState("");
  const [targetWeight, setTargetWeight] = useState("");
  const [activityLevel, setActivityLevel] = useState<
    "sedentary" | "lightly_active" | "moderately_active" | "very_active" | "extra_active"
  >("sedentary");
  const [goal, setGoal] = useState<"lose_weight" | "maintain" | "gain_weight">("maintain");

  const backgroundColor = useThemeColor({}, "background");
  const cardBackground = useThemeColor({}, "cardBackground");
  const tintColor = useThemeColor({}, "tint");
  const textColor = useThemeColor({}, "text");
  const textSecondary = useThemeColor({}, "textSecondary");
  const borderColor = useThemeColor({}, "border");

  // [修改] 載入本地資料
  useEffect(() => {
    async function loadData() {
      if (!isAuthenticated) return;
      try {
        const profile = await getProfileLocal();
        if (profile) {
          if (profile.gender) setGender(profile.gender);
          if (profile.birthDate) {
            const year = new Date(profile.birthDate).getFullYear();
            setBirthYear(year.toString());
          }
          if (profile.heightCm) setHeightCm(profile.heightCm.toString());
          if (profile.currentWeightKg) setCurrentWeight(profile.currentWeightKg.toString());
          if (profile.targetWeightKg) setTargetWeight(profile.targetWeightKg.toString());
          if (profile.activityLevel) setActivityLevel(profile.activityLevel);
          if (profile.goal) setGoal(profile.goal);
        }
      } catch (e) {
        console.error("Failed to load profile", e);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [isAuthenticated]);

  const calculateAge = () => {
    const year = parseInt(birthYear);
    if (!year || year < 1900 || year > new Date().getFullYear()) return 30; // Default age
    return new Date().getFullYear() - year;
  };

  const calculateBMR = () => {
    const weight = parseFloat(currentWeight);
    const height = parseFloat(heightCm);
    if (!weight || !height) return 0;

    const age = calculateAge();

    // Mifflin-St Jeor Equation
    let bmr = 10 * weight + 6.25 * height - 5 * age;
    if (gender === "male") {
      bmr += 5;
    } else {
      bmr -= 161;
    }

    // Activity multiplier
    const multipliers = {
      sedentary: 1.2,
      lightly_active: 1.375,
      moderately_active: 1.55,
      very_active: 1.725,
      extra_active: 1.9,
    };

    let tdee = bmr * multipliers[activityLevel];

    // Adjust for goal
    if (goal === "lose_weight") {
      tdee -= 500; // 500 calorie deficit
    } else if (goal === "gain_weight") {
      tdee += 300; // 300 calorie surplus
    }

    return Math.round(tdee);
  };

  // [修改] 儲存到本地
  const handleSave = async () => {
    const dailyCalorieTarget = calculateBMR();
    const year = parseInt(birthYear);
    const birthDate = year && year >= 1900 && year <= new Date().getFullYear()
      ? new Date(year, 0, 1).toISOString() // 轉成字串存
      : undefined;

    const data = {
      gender,
      birthDate,
      heightCm: parseInt(heightCm) || undefined,
      currentWeightKg: parseFloat(currentWeight) || undefined,
      targetWeightKg: parseFloat(targetWeight) || undefined,
      activityLevel,
      goal,
      dailyCalorieTarget,
    };

    try {
      await saveProfileLocal(data);
      alert("個人檔案已儲存");
    } catch (error: any) {
      console.error("Error saving profile:", error);
      alert("儲存失敗,請稍後再試");
    }
  };

  if (!isAuthenticated) {
    return (
      <View style={[styles.container, styles.centerContent, { backgroundColor }]}>
        <Ionicons name="person-circle-outline" size={80} color={tintColor} style={{ marginBottom: 24 }} />
        <ThemedText type="title" style={{ marginBottom: 16, fontSize: 28, lineHeight: 34 }}>
          個人檔案
        </ThemedText>
        <ThemedText style={[styles.welcomeText, { color: textSecondary, marginBottom: 32 }]}>
          請先登入以設定您的個人資料
        </ThemedText>
        <Pressable
          onPress={() => router.push("/login")}
          style={[styles.loginPromptButton, { backgroundColor: tintColor }]}
        >
          <ThemedText style={styles.loginPromptText}>登入</ThemedText>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <ScrollView style={styles.scrollView}>
        {/* Header */}
        <View style={[styles.header, { paddingTop: Math.max(insets.top, 20) }]}>
          <ThemedText type="title" style={{ fontSize: 32, lineHeight: 38 }}>
            個人檔案
          </ThemedText>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={tintColor} />
          </View>
        ) : (
          <>
            {/* User Info */}
            <View style={[styles.card, { backgroundColor: cardBackground }]}>
              <View style={styles.userInfo}>
                <View style={[styles.avatar, { backgroundColor: `${tintColor}30` }]}>
                  <Ionicons name="person" size={40} color={tintColor} />
                </View>
                <View style={styles.userDetails}>
                  <ThemedText type="subtitle">{user?.name || "使用者"}</ThemedText>
                  <ThemedText style={[styles.userEmail, { color: textSecondary }]}>
                    {user?.email || "本地帳號"}
                  </ThemedText>
                </View>
              </View>
            </View>

            {/* Basic Info */}
            <View style={[styles.card, { backgroundColor: cardBackground }]}>
              <ThemedText type="subtitle" style={styles.sectionTitle}>
                基本資料
              </ThemedText>

              {/* Gender */}
              <View style={styles.inputGroup}>
                <ThemedText style={[styles.label, { color: textSecondary }]}>性別</ThemedText>
                <View style={styles.genderButtons}>
                  {(["male", "female", "other"] as const).map((g) => (
                    <Pressable
                      key={g}
                      onPress={() => setGender(g)}
                      style={[
                        styles.genderButton,
                        { borderColor },
                        gender === g && { backgroundColor: tintColor, borderColor: tintColor },
                      ]}
                    >
                      <ThemedText
                        style={[
                          styles.genderButtonText,
                          gender === g && { color: "#FFFFFF" },
                        ]}
                      >
                        {g === "male" ? "男性" : g === "female" ? "女性" : "其他"}
                      </ThemedText>
                    </Pressable>
                  ))}
                </View>
              </View>

              {/* Birth Year */}
              <View style={styles.inputGroup}>
                <ThemedText style={[styles.label, { color: textSecondary }]}>
                  出生年份 (西元)
                </ThemedText>
                <TextInput
                  style={[styles.input, { backgroundColor, color: textColor, borderColor }]}
                  value={birthYear}
                  onChangeText={setBirthYear}
                  keyboardType="number-pad"
                  placeholder="例如: 1990"
                  placeholderTextColor={textSecondary}
                  maxLength={4}
                />
                {birthYear && (
                  <ThemedText style={[styles.hint, { color: textSecondary }]}>
                    年齡: {calculateAge()} 歲
                  </ThemedText>
                )}
              </View>

              {/* Height */}
              <View style={styles.inputGroup}>
                <ThemedText style={[styles.label, { color: textSecondary }]}>身高 (cm)</ThemedText>
                <TextInput
                  style={[styles.input, { backgroundColor, color: textColor, borderColor }]}
                  value={heightCm}
                  onChangeText={setHeightCm}
                  keyboardType="decimal-pad"
                  placeholder="例如: 170"
                  placeholderTextColor={textSecondary}
                />
              </View>

              {/* Current Weight */}
              <View style={styles.inputGroup}>
                <ThemedText style={[styles.label, { color: textSecondary }]}>
                  當前體重 (kg)
                </ThemedText>
                <TextInput
                  style={[styles.input, { backgroundColor, color: textColor, borderColor }]}
                  value={currentWeight}
                  onChangeText={setCurrentWeight}
                  keyboardType="decimal-pad"
                  placeholder="例如: 70"
                  placeholderTextColor={textSecondary}
                />
              </View>

              {/* Target Weight */}
              <View style={styles.inputGroup}>
                <ThemedText style={[styles.label, { color: textSecondary }]}>
                  目標體重 (kg)
                </ThemedText>
                <TextInput
                  style={[styles.input, { backgroundColor, color: textColor, borderColor }]}
                  value={targetWeight}
                  onChangeText={setTargetWeight}
                  keyboardType="decimal-pad"
                  placeholder="例如: 65"
                  placeholderTextColor={textSecondary}
                />
              </View>
            </View>

            {/* Goal Settings */}
            <View style={[styles.card, { backgroundColor: cardBackground }]}>
              <ThemedText type="subtitle" style={styles.sectionTitle}>
                目標設定
              </ThemedText>

              {/* Goal */}
              <View style={styles.inputGroup}>
                <ThemedText style={[styles.label, { color: textSecondary }]}>健身目標</ThemedText>
                <View style={styles.goalButtons}>
                  {(["lose_weight", "maintain", "gain_weight"] as const).map((g) => (
                    <Pressable
                      key={g}
                      onPress={() => setGoal(g)}
                      style={[
                        styles.goalButton,
                        { borderColor },
                        goal === g && { backgroundColor: tintColor, borderColor: tintColor },
                      ]}
                    >
                      <ThemedText
                        style={[
                          styles.goalButtonText,
                          goal === g && { color: "#FFFFFF" },
                        ]}
                      >
                        {g === "lose_weight" ? "減重" : g === "maintain" ? "維持" : "增重"}
                      </ThemedText>
                    </Pressable>
                  ))}
                </View>
              </View>

              {/* Activity Level */}
              <View style={styles.inputGroup}>
                <ThemedText style={[styles.label, { color: textSecondary }]}>活動量</ThemedText>
                <View style={styles.activityButtons}>
                  {(
                    [
                      "sedentary",
                      "lightly_active",
                      "moderately_active",
                      "very_active",
                      "extra_active",
                    ] as const
                  ).map((a) => (
                    <Pressable
                      key={a}
                      onPress={() => setActivityLevel(a)}
                      style={[
                        styles.activityButton,
                        { borderColor },
                        activityLevel === a && {
                          backgroundColor: tintColor,
                          borderColor: tintColor,
                        },
                      ]}
                    >
                      <ThemedText
                        style={[
                          styles.activityButtonText,
                          activityLevel === a && { color: "#FFFFFF" },
                        ]}
                      >
                        {a === "sedentary"
                          ? "久坐"
                          : a === "lightly_active"
                            ? "輕度活動"
                            : a === "moderately_active"
                              ? "中度活動"
                              : a === "very_active"
                                ? "高度活動"
                                : "超高活動"}
                      </ThemedText>
                    </Pressable>
                  ))}
                </View>
              </View>

              {/* Calculated Target */}
              <View style={[styles.targetBox, { backgroundColor: `${tintColor}10`, borderColor: tintColor }]}>
                <ThemedText style={[styles.targetLabel, { color: textSecondary }]}>
                  每日卡路里目標
                </ThemedText>
                <ThemedText style={[styles.targetValue, { color: tintColor }]}>
                  {calculateBMR()} kcal
                </ThemedText>
              </View>
            </View>

            {/* Save Button */}
            <View style={styles.buttonContainer}>
              <Pressable
                onPress={handleSave}
                style={[styles.saveButton, { backgroundColor: tintColor }]}
              >
                <ThemedText style={styles.saveButtonText}>儲存設定</ThemedText>
              </Pressable>

              <Pressable onPress={logout} style={[styles.logoutButton, { borderColor: "#FF3B30" }]}>
                <ThemedText style={[styles.logoutButtonText, { color: "#FF3B30" }]}>
                  登出
                </ThemedText>
              </Pressable>
            </View>

            <View style={{ height: 40 }} />
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  centerContent: {
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  welcomeText: {
    textAlign: "center",
    fontSize: 16,
    lineHeight: 22,
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  loadingContainer: {
    padding: 40,
    alignItems: "center",
  },
  card: {
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 20,
    borderRadius: 16,
  },
  userInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: "center",
    alignItems: "center",
  },
  userDetails: {
    flex: 1,
  },
  userEmail: {
    fontSize: 14,
    marginTop: 4,
    lineHeight: 18,
  },
  sectionTitle: {
    marginBottom: 16,
    fontSize: 20,
    lineHeight: 25,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    marginBottom: 8,
    lineHeight: 18,
  },
  input: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 16,
    lineHeight: 22,
  },
  genderButtons: {
    flexDirection: "row",
    gap: 8,
  },
  genderButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: "center",
  },
  genderButtonText: {
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 18,
  },
  goalButtons: {
    flexDirection: "row",
    gap: 8,
  },
  goalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: "center",
  },
  goalButtonText: {
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 18,
  },
  activityButtons: {
    gap: 8,
  },
  activityButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: "center",
  },
  activityButtonText: {
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 18,
  },
  targetBox: {
    marginTop: 8,
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: "center",
  },
  targetLabel: {
    fontSize: 14,
    marginBottom: 4,
    lineHeight: 18,
  },
  targetValue: {
    fontSize: 28,
    fontWeight: "bold",
    lineHeight: 34,
  },
  buttonContainer: {
    paddingHorizontal: 16,
    gap: 12,
  },
  saveButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    minHeight: 52,
  },
  saveButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
    lineHeight: 22,
  },
  logoutButton: {
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: "center",
  },
  logoutButtonText: {
    fontSize: 16,
    fontWeight: "600",
    lineHeight: 22,
  },
  loginPromptButton: {
    paddingVertical: 16,
    paddingHorizontal: 48,
    borderRadius: 12,
    minHeight: 52,
  },
  loginPromptText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
    lineHeight: 22,
  },
  hint: {
    fontSize: 14,
    marginTop: 6,
    lineHeight: 18,
  },
});