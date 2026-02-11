// context/TutorialContext.tsx
import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { View, Modal, StyleSheet, Text, Dimensions, TextInput, Image, Animated, Platform, KeyboardAvoidingView, TouchableOpacity, Keyboard } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { getTutorialState, setTutorialState, getUserName, setUserName, TUTORIAL_KEYS } from '@/lib/tutorial-storage';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useLanguage, t } from '@/lib/i18n';
import { getTutorialSteps, TutorialStep } from '@/constants/tutorial-steps';
import { db } from '@/lib/db'; 
import { userProfiles } from '@/drizzle/schema';
import { eq } from 'drizzle-orm';

const GuideAvatarImage = require('@/assets/images/guide_avatar.png'); 
const SCREEN_HEIGHT = Dimensions.get('window').height;

// [修改] 簡化定義，不再需要 padding/offset，因為我們直接框住元件
export interface TargetAdjustment {
  // 僅保留可能的捲動微調，但大部分可以移除
  scrollOffsetY?: number;
}

type TargetLayout = { 
  x: number; y: number; w: number; h: number; 
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
  activeTargetKey: string | null; // [新增] 讓 Target 元件知道自己是否被選中
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
  const scrollCallbackRef = useRef<((key: string) => void) | null>(null);

  useEffect(() => {
    async function init() {
      const name = await getUserName();
      if (name) setUserNameState(name);
      
      const notFirst = await getTutorialState(TUTORIAL_KEYS.IS_FIRST_LAUNCH);
      if (!notFirst) {
        // 初次啟動，直接開始歡迎流程
        const allSteps = getTutorialSteps(lang, name || 'User');
        startScenario('ONBOARDING_WELCOME', allSteps.ONBOARDING_WELCOME);
      }
    }
    init();
  }, [lang]);

  useEffect(() => {
      const step = steps[currentStepIndex];
      const prevStep = steps[currentStepIndex - 1];

      if (step?.targetKey && activeScenario) {
          if (!prevStep || prevStep.targetKey !== step.targetKey) {
              setTimeout(() => {
                  if (scrollCallbackRef.current) {
                      scrollCallbackRef.current(step.targetKey);
                  }
              }, 100);
          }
      }
  }, [currentStepIndex, activeScenario, steps]);

  const onScrollRequest = (cb: (key: string) => void) => {
      scrollCallbackRef.current = cb;
  };

  const registerTarget = (key: string, layout: TargetLayout) => {
    if (layout.w === 0 || layout.h === 0) return;
    setTargets(prev => {
      const old = prev[key];
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
    Keyboard.dismiss(); // 關閉導覽時收起鍵盤
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

  const handleNext = async () => {
    const step = steps[currentStepIndex];
    const allSteps = getTutorialSteps(lang, userName);

    if (step.action === 'input_name') {
      const defaultName = lang === 'zh-TW' ? "親愛的用戶" : "Dear User";
      const finalName = inputName.trim() || defaultName;
      setUserNameState(finalName);
      await setUserName(finalName);
      
      try {
          const existingUsers = await db.select().from(userProfiles).limit(1);
          if (existingUsers.length > 0) {
              await db.update(userProfiles).set({ name: finalName }).where(eq(userProfiles.id, existingUsers[0].id));
          } else {
              await db.insert(userProfiles).values({
                  name: finalName, gender: 'male', heightCm: 170, currentWeightKg: 60, dailyCalorieTarget: 2000, createdAt: new Date(), updatedAt: new Date()
              });
          }
      } catch (e) { console.error(e); }

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
  const activeTargetKey = currentStep?.targetKey || null;
  const rawLayout = activeTargetKey ? targets[activeTargetKey] : null;
  
  // [智慧定位] 預設對話框位置
  let bubblePosition: 'top' | 'bottom' = 'bottom';
  
  // [修正 1] 如果是輸入名字步驟，強制顯示在上方，避免被鍵盤遮擋
  if (currentStep?.action === 'input_name') {
      bubblePosition = 'top';
  } else if (rawLayout) {
      // 根據目標位置決定氣泡位置
      const targetCenterY = rawLayout.y + (rawLayout.h / 2);
      if (targetCenterY > SCREEN_HEIGHT * 0.55) {
          bubblePosition = 'top';
      }
  }

  const bubbleContainerStyle = bubblePosition === 'bottom' 
      ? { bottom: 50, top: undefined } 
      : { top: 60, bottom: undefined }; // Top 60 避開 Safe Area

  return (
    <TutorialContext.Provider value={{ registerTarget, startScenario, stopTutorial, userName, setUserNameState, activeScenario, currentStepIndex, onScrollRequest, activeTargetKey }}>
      {children}
      <Modal transparent visible={!!activeScenario} animationType="none" onRequestClose={stopTutorial}>
        <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
            style={styles.overlay}
            pointerEvents="box-none" // 讓點擊可以穿透到下層 (如果有需要)
        >
          {/* [修正 4] 移除絕對定位的 Highlight Box，因為我們已經在 TutorialTarget 本體做邊框了 */}
          
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
                        autoFocus // 自動聚焦
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
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)' }, // 給整個背景一點點遮罩感
  coachContainer: { 
      position: 'absolute', 
      left: 20, 
      right: 20, 
      flexDirection: 'row', 
      alignItems: 'flex-end',
      zIndex: 9999 
  },
  avatarContainer: { marginRight: 10 },
  avatarImage: { width: 90, height: 90 },
  bubble: { flex: 1, padding: 16, borderRadius: 16, borderBottomLeftRadius: 4, elevation: 5, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 8, minHeight: 100, justifyContent: 'center' },
  bubbleText: { fontSize: 16, lineHeight: 24, marginBottom: 12 },
  btnRow: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 12 },
  skipBtn: { padding: 8 },
  nextBtn: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20, flexDirection: 'row', alignItems: 'center' },
  nextText: { color: 'white', fontWeight: 'bold' },
  input: { borderWidth: 1, borderRadius: 8, padding: 8, marginBottom: 12, fontSize: 16 }
});