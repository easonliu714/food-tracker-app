import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { View, Modal, StyleSheet, Text, Dimensions, TextInput, Image, Animated, Platform, KeyboardAvoidingView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, usePathname } from 'expo-router';
import { getTutorialState, setTutorialState, getUserName, setUserName, TUTORIAL_KEYS } from '@/lib/tutorial-storage';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useLanguage, t } from '@/lib/i18n';
import { getTutorialSteps, TutorialStep } from '@/constants/tutorial-steps';
// [新增] 引入 DB 相關，以便在輸入名字時直接寫入資料庫，達成「登入」效果
import { db } from '@/lib/db'; 
import { userProfiles } from '@/drizzle/schema';
import { eq } from 'drizzle-orm';

const GuideAvatarImage = require('@/assets/images/guide_avatar.png'); 
const SCREEN_HEIGHT = Dimensions.get('window').height;

export interface TargetAdjustment {
  padding?: number;
  offsetX?: number;
  offsetY?: number;
  widthAdd?: number;
  heightAdd?: number;
}

type TargetLayout = { 
  x: number; y: number; w: number; h: number; 
  adjustment?: TargetAdjustment;
};

interface TutorialContextType {
  registerTarget: (key: string, layout: TargetLayout) => void;
  startScenario: (scenarioId: string, customSteps?: TutorialStep[]) => void;
  stopTutorial: () => void;
  userName: string;
  setUserNameState: (n: string) => void;
  activeScenario: string | null;
  currentStepIndex: number;
  onScrollRequest: (callback: (targetKey: string) => void) => void;
}

const TutorialContext = createContext<TutorialContextType | null>(null);

export const useTutorial = () => {
  const context = useContext(TutorialContext);
  if (!context) throw new Error("useTutorial must be used within TutorialProvider");
  return context;
};

export const TutorialProvider = ({ children }: { children: React.ReactNode }) => {
  const router = useRouter();
  const theme = Colors[useColorScheme() ?? 'light'];
  const lang = useLanguage();

  const [userName, setUserNameState] = useState("User");
  const [activeScenario, setActiveScenario] = useState<string | null>(null);
  const [steps, setSteps] = useState<TutorialStep[]>([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [targets, setTargets] = useState<Record<string, TargetLayout>>({});
  const [inputName, setInputName] = useState("");
  
  const fadeAnim = useRef(new Animated.Value(0)).current;
  
  // [修改] 改用 Map 來儲存不同頁面的捲動函數，Key 可以是 scenario ID 或自訂標籤
  // 這裡我們簡化處理：直接存一個 callback，但我們會確保頁面 focus 時才註冊
  const scrollCallbackRef = useRef<((key: string) => void) | null>(null);

  useEffect(() => {
    async function init() {
      const name = await getUserName();
      if (name) setUserNameState(name);
      
      const notFirst = await getTutorialState(TUTORIAL_KEYS.IS_FIRST_LAUNCH);
      if (!notFirst) {
        // [優先權] 強制啟動歡迎流程，覆蓋底層畫面
        const allSteps = getTutorialSteps(lang, name || 'User');
        startScenario('ONBOARDING_WELCOME', allSteps.ONBOARDING_WELCOME);
      }
    }
    init();
  }, [lang]);

  // [修改] 捲動邏輯：加入延遲與重試機制
  useEffect(() => {
      const step = steps[currentStepIndex];
      const prevStep = steps[currentStepIndex - 1];

      if (step?.targetKey && activeScenario) {
          // 只有當 targetKey 改變時才觸發
          if (!prevStep || prevStep.targetKey !== step.targetKey) {
              // 給一點時間讓頁面切換或 ScrollView 準備好
              setTimeout(() => {
                  if (scrollCallbackRef.current) {
                      console.log(`[Tutorial] Requesting scroll to: ${step.targetKey}`);
                      scrollCallbackRef.current(step.targetKey);
                  } else {
                      console.warn(`[Tutorial] No scroll callback registered for ${step.targetKey}`);
                  }
              }, 100);
          }
      }
  }, [currentStepIndex, activeScenario, steps]);

  const onScrollRequest = (cb: (key: string) => void) => {
      console.log("[Tutorial] Scroll callback registered");
      scrollCallbackRef.current = cb;
  };

  const registerTarget = (key: string, layout: TargetLayout) => {
    if (layout.w === 0 || layout.h === 0) return;
    setTargets(prev => {
      const old = prev[key];
      // 簡單防抖動
      if (old && Math.abs(old.x - layout.x) < 5 && Math.abs(old.y - layout.y) < 5) return prev;
      return { ...prev, [key]: layout };
    });
  };

  const startScenario = (id: string, customSteps?: TutorialStep[]) => {
    if (customSteps && customSteps.length > 0) {
        setActiveScenario(id);
        setSteps(customSteps);
        setCurrentStepIndex(0);
        Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    }
  };

  const stopTutorial = async () => {
    Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(async () => {
      setActiveScenario(null);
      setSteps([]);
      if (activeScenario === 'HOME_GUIDE') await setTutorialState(TUTORIAL_KEYS.HAS_SEEN_HOME, true);
      else if (activeScenario === 'PROFILE_GUIDE') await setTutorialState(TUTORIAL_KEYS.HAS_SEEN_PROFILE, true);
      else if (activeScenario === 'ANALYSIS_GUIDE') await setTutorialState(TUTORIAL_KEYS.HAS_SEEN_ANALYSIS, true);
      else if (activeScenario === 'RECIPES_GUIDE') await setTutorialState(TUTORIAL_KEYS.HAS_SEEN_RECIPES, true);
    });
  };
  
  const handlePrev = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(prev => prev - 1);
    }
  };
  // [重點修改] 處理下一步與名稱輸入邏輯
  const handleNext = async () => {
    const step = steps[currentStepIndex];
    const allSteps = getTutorialSteps(lang, userName);

    if (step.action === 'input_name') {
      // 1. 決定最終名稱：有輸入用輸入值，沒輸入用預設值
      const defaultName = lang === 'zh-TW' ? "親愛的用戶" : "Dear User";
      const finalName = inputName.trim() || defaultName;
      // 2. 更新 Context 狀態
      setUserNameState(finalName);
      // 3. 持久化存儲 (Local Storage)
      await setUserName(finalName);
      // 4. [新增] 同步寫入資料庫 (模擬登入/註冊行為)
      try {
          const existingUsers = await db.select().from(userProfiles).limit(1);
          if (existingUsers.length > 0) {
              await db.update(userProfiles).set({ name: finalName }).where(eq(userProfiles.id, existingUsers[0].id));
          } else {
              // 建立新用戶，這裡填入基本預設值
              await db.insert(userProfiles).values({
                  name: finalName, gender: 'male', heightCm: 170, currentWeightKg: 60, dailyCalorieTarget: 2000, createdAt: new Date(), updatedAt: new Date()
              });
          }
      } catch (e) { console.error(e); }

      // [畫面切換] 強制替換路由，移除底層登入頁
      router.replace('/(tabs)'); 

    } else if (step.action === 'navigate_profile') {
      router.push('/(tabs)/profile');
      setTimeout(() => startScenario('ONBOARDING_PROFILE', allSteps.ONBOARDING_PROFILE), 600);
      return; 
    } else if (step.action === 'end_onboarding') {
      await setTutorialState(TUTORIAL_KEYS.IS_FIRST_LAUNCH, true);
      router.replace('/(tabs)');
      setTimeout(() => startScenario('HOME_GUIDE', allSteps.HOME_GUIDE), 800);
      return;
    }

    if (currentStepIndex < steps.length - 1) {
      setCurrentStepIndex(prev => prev + 1);
    } else {
      stopTutorial();
    }
  };

  const currentStep = steps[currentStepIndex];
  const rawLayout = currentStep?.targetKey ? targets[currentStep.targetKey] : null;
  
  let finalLayout = null;
  // [智慧定位] 預設對話框在下方
  let bubblePosition: 'top' | 'bottom' = 'bottom';

  if (rawLayout) {
      const adj = rawLayout.adjustment || {};
      const padding = adj.padding || 0;
      const offX = adj.offsetX || 0;
      const offY = adj.offsetY || 0;
      const wAdd = adj.widthAdd || 0;
      const hAdd = adj.heightAdd || 0;
      const basePadding = 5;
      
      finalLayout = {
          x: rawLayout.x - basePadding - padding + offX,
          y: rawLayout.y - basePadding - padding + offY,
          w: rawLayout.w + (basePadding * 2) + (padding * 2) + wAdd,
          h: rawLayout.h + (basePadding * 2) + (padding * 2) + hAdd
      };

      // [智慧定位] 若目標中心在螢幕下半部，對話框移至上方
      const targetCenterY = finalLayout.y + (finalLayout.h / 2);
      if (targetCenterY > SCREEN_HEIGHT * 0.55) {
          bubblePosition = 'top';
      }
  }

  const bubbleContainerStyle = bubblePosition === 'bottom' 
      ? { bottom: 50, top: undefined } 
      : { top: 100, bottom: undefined }; // 上方預留 Header 空間

  return (
    <TutorialContext.Provider value={{ registerTarget, startScenario, stopTutorial, userName, setUserNameState, activeScenario, currentStepIndex, onScrollRequest }}>
      {children}
      <Modal transparent visible={!!activeScenario} animationType="none" onRequestClose={stopTutorial}>
        {/* 使用 KeyboardAvoidingView 避免輸入法遮擋導覽員對話框 */}
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.overlay}>
          {/* Highlight Box Layer */}
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.6)' }]}>
             {finalLayout && (
                 <View style={{
                     position: 'absolute',
                     left: finalLayout.x,
                     top: finalLayout.y,
                     width: finalLayout.w,
                     height: finalLayout.h,
                     backgroundColor: 'rgba(255,255,255,0.05)',
                     borderRadius: 8,
                     borderWidth: 2,
                     borderColor: '#FFD700',
                     borderStyle: 'dashed'
                 }} />
             )}
          </View>

          <Animated.View style={[styles.coachContainer, bubbleContainerStyle, { opacity: fadeAnim }]}>
             <View style={styles.avatarContainer}>
                <Image source={GuideAvatarImage} style={styles.avatarImage} resizeMode="contain" />
             </View>

             <View style={[styles.bubble, { backgroundColor: theme.cardBackground }]}>
                <Text style={[styles.bubbleText, { color: theme.text }]}>{currentStep?.text}</Text>
                
                {currentStep?.action === 'input_name' && (
                    <TextInput 
                        style={[styles.input, { color: theme.text, borderColor: theme.border }]}
                        placeholder={lang === 'zh-TW' ? "您的名字 (可略過)" : "Your Name (Optional)"}
                        placeholderTextColor="#999"
                        value={inputName}
                        onChangeText={setInputName}
                        autoFocus
                    />
                )}

                <View style={styles.btnRow}>
                    {currentStepIndex > 0 && (
                        <TouchableOpacity onPress={handlePrev} style={styles.skipBtn}>
                            <Text style={{color: theme.tint}}>{t('prev_step', lang)}</Text>
                        </TouchableOpacity>
                    )}

                    {!currentStep?.forceNext && (
                        <TouchableOpacity onPress={stopTutorial} style={styles.skipBtn}>
                            <Text style={{color: '#888'}}>{t('skip_tutorial', lang) || "Skip"}</Text>
                        </TouchableOpacity>
                    )}
                    <TouchableOpacity onPress={handleNext} style={[styles.nextBtn, { backgroundColor: theme.tint }]}>
                        <Text style={styles.nextText}>
                            {currentStep?.action === 'input_name' ? t('confirm', lang) : (currentStepIndex === steps.length - 1 ? t('finish_tutorial', lang) : t('next_step', lang))}
                        </Text>
                        <Ionicons name="arrow-forward" size={16} color="white" style={{marginLeft: 4}}/>
                    </TouchableOpacity>
                </View>
             </View>
          </Animated.View>
        </KeyboardAvoidingView>
      </Modal>
    </TutorialContext.Provider>
  );
};

const styles = StyleSheet.create({
  //overlay: { flex: 1, justifyContent: 'flex-end' }, // 修改：讓 KeyboardAvoidingView 生效
  overlay: { flex: 1 }, 
  coachContainer: { 
      position: 'absolute', 
      left: 20, 
      right: 20, 
      flexDirection: 'row', 
      alignItems: 'flex-end',
      zIndex: 9999 // [關鍵] 確保在最上層
  },
  avatarContainer: { marginRight: 10, backgroundColor: 'transparent' },
  avatarImage: { width: 90, height: 90 },
  bubble: { flex: 1, padding: 16, borderRadius: 16, borderBottomLeftRadius: 4, elevation: 5, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 8, minHeight: 100, justifyContent: 'center' },
  bubbleText: { fontSize: 16, lineHeight: 24, marginBottom: 12 },
  btnRow: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 12 },
  skipBtn: { padding: 8 },
  nextBtn: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20, flexDirection: 'row', alignItems: 'center' },
  nextText: { color: 'white', fontWeight: 'bold' },
  input: { borderWidth: 1, borderRadius: 8, padding: 8, marginBottom: 12, fontSize: 16 }
});