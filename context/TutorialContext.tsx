import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { View, Modal, StyleSheet, TouchableOpacity, Text, Dimensions, TextInput, Image, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useSegments } from 'expo-router';
import { getTutorialState, setTutorialState, getUserName, setUserName, TUTORIAL_KEYS } from '@/lib/tutorial-storage';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
// [修改開始] 引入 i18n 工具與圖片
import { useLanguage, t } from '@/lib/i18n';
const GuideAvatarImage = require('@/assets/images/guide_avatar.png'); // 請確保圖片已存在
// [修改結束]

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// 定義每一步驟的結構
export type TutorialStep = {
  targetKey?: string; // 對應 TutorialTarget 的名稱
  text: string;       // 教練說的話
  action?: 'input_name' | 'navigate_profile' | 'navigate_home' | 'end_onboarding'; // 特殊動作
  forceNext?: boolean; // 是否強制下一步(不顯示Skip)
};

type TargetLayout = { x: number; y: number; w: number; h: number };

interface TutorialContextType {
  registerTarget: (key: string, layout: TargetLayout) => void;
  startScenario: (scenarioId: string, steps: TutorialStep[]) => void;
  stopTutorial: () => void;
  userName: string;
  setUserNameState: (n: string) => void;
  activeScenario: string | null;
}

const TutorialContext = createContext<TutorialContextType | null>(null);

export const useTutorial = () => {
  const context = useContext(TutorialContext);
  if (!context) throw new Error("useTutorial must be used within TutorialProvider");
  return context;
};

export const TutorialProvider = ({ children }: { children: React.ReactNode }) => {
  const router = useRouter();
  const segments = useSegments();
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  
  // [修改開始] 取得當前語言
  const lang = useLanguage();
  // [修改結束]

  const [userName, setUserNameState] = useState("User");
  const [activeScenario, setActiveScenario] = useState<string | null>(null);
  const [steps, setSteps] = useState<TutorialStep[]>([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [targets, setTargets] = useState<Record<string, TargetLayout>>({});
  
  // 輸入框狀態
  const [inputName, setInputName] = useState("");

  // 動畫值
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // 初始化檢查
  useEffect(() => {
    async function init() {
      const name = await getUserName();
      if (name) setUserNameState(name);
      
      const notFirst = await getTutorialState(TUTORIAL_KEYS.IS_FIRST_LAUNCH);
      if (!notFirst) {
        // [修改開始] 使用 t() 翻譯歡迎詞，並加入語言提示
        startScenario('ONBOARDING_WELCOME', [
          { text: t('tutorial.welcome_1', lang), forceNext: true },
          { text: t('tutorial.welcome_lang_hint', lang), forceNext: true },
          { text: t('tutorial.welcome_2', lang), forceNext: true },
          { text: t('tutorial.welcome_ask_name', lang), action: 'input_name', forceNext: true },
          { text: t('tutorial.welcome_goto_profile', lang), action: 'navigate_profile', forceNext: true }
        ]);
        // [修改結束]
      }
    }
    init();
  }, [lang]); // [修改] dependency 加入 lang

  const registerTarget = (key: string, layout: TargetLayout) => {
    setTargets(prev => {
      const old = prev[key];
      if (old && Math.abs(old.x - layout.x) < 2 && Math.abs(old.y - layout.y) < 2) return prev;
      return { ...prev, [key]: layout };
    });
  };

  const startScenario = (id: string, newSteps: TutorialStep[]) => {
    setActiveScenario(id);
    setSteps(newSteps);
    setCurrentStepIndex(0);
    Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
  };

  const stopTutorial = async () => {
    Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
      setActiveScenario(null);
      setSteps([]);
    });
    
    if (activeScenario === 'ONBOARDING_WELCOME') {
       // Profile 頁面會接手
    } else if (activeScenario === 'HOME_GUIDE') {
       await setTutorialState(TUTORIAL_KEYS.HAS_SEEN_HOME, true);
    } else if (activeScenario === 'PROFILE_GUIDE') {
       await setTutorialState(TUTORIAL_KEYS.HAS_SEEN_PROFILE, true);
    } else if (activeScenario === 'ANALYSIS_GUIDE') {
       await setTutorialState(TUTORIAL_KEYS.HAS_SEEN_ANALYSIS, true);
    }
  };

  const handleNext = async () => {
    const step = steps[currentStepIndex];

    if (step.action === 'input_name') {
      if (!inputName.trim()) return; 
      await setUserName(inputName);
      setUserNameState(inputName);
    } else if (step.action === 'navigate_profile') {
      router.push('/(tabs)/profile');
      setTimeout(() => {
         // [修改開始] 使用 t() 翻譯 Profile 引導
         startScenario('ONBOARDING_PROFILE', [
             { targetKey: 'profile_basic', text: t('tutorial.profile_basic_hint', lang) },
             { targetKey: 'profile_goals', text: t('tutorial.profile_goals_hint', lang) },
             { targetKey: 'profile_ai', text: t('tutorial.profile_ai_hint', lang) },
             { targetKey: 'profile_save', text: t('tutorial.profile_save_hint', lang), action: 'end_onboarding' }
         ]);
         // [修改結束]
      }, 500);
      return; 
    } else if (step.action === 'end_onboarding') {
      await setTutorialState(TUTORIAL_KEYS.IS_FIRST_LAUNCH, true);
      router.replace('/(tabs)');
      setTimeout(() => {
         // [修改開始] 使用 t() 翻譯 Home 引導
         startScenario('HOME_GUIDE', [
             { text: t('tutorial.home_intro', lang, { name: userName }) },
             { targetKey: 'home_metrics', text: t('tutorial.home_metrics_hint', lang) },
             { targetKey: 'home_water', text: t('tutorial.home_water_hint', lang) },
             { targetKey: 'home_energy', text: t('tutorial.home_energy_hint', lang) },
             { targetKey: 'home_actions', text: t('tutorial.home_actions_hint', lang) }
         ]);
         // [修改結束]
      }, 800);
      return;
    }

    if (currentStepIndex < steps.length - 1) {
      setCurrentStepIndex(prev => prev + 1);
    } else {
      stopTutorial();
    }
  };

  const currentStep = steps[currentStepIndex];
  const targetLayout = currentStep?.targetKey ? targets[currentStep.targetKey] : null;

  if (!activeScenario || !currentStep) return <TutorialContext.Provider value={{ registerTarget, startScenario, stopTutorial, userName, setUserNameState, activeScenario }}>{children}</TutorialContext.Provider>;

  return (
    <TutorialContext.Provider value={{ registerTarget, startScenario, stopTutorial, userName, setUserNameState, activeScenario }}>
      {children}
      <Modal transparent visible={!!activeScenario} animationType="none">
        <View style={styles.overlay}>
          {/* 背景遮罩 */}
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.6)' }]}>
             {targetLayout && (
                 <View style={{
                     position: 'absolute',
                     left: targetLayout.x - 5,
                     top: targetLayout.y - 5,
                     width: targetLayout.w + 10,
                     height: targetLayout.h + 10,
                     backgroundColor: 'rgba(255,255,255,0.1)',
                     borderRadius: 12,
                     borderWidth: 2,
                     borderColor: '#FFD700',
                     borderStyle: 'dashed'
                 }} />
             )}
          </View>

          {/* 教練與對話框 */}
          <Animated.View style={[styles.coachContainer, { opacity: fadeAnim }]}>
             {/* [修改開始] 教練頭像替換為圖片 */}
             <View style={styles.avatarContainer}>
                <Image 
                    source={GuideAvatarImage} 
                    style={styles.avatarImage} 
                    resizeMode="contain"
                />
             </View>
             {/* [修改結束] */}

             {/* 對話氣泡 */}
             <View style={[styles.bubble, { backgroundColor: theme.cardBackground }]}>
                <Text style={[styles.bubbleText, { color: theme.text }]}>{currentStep.text}</Text>
                
                {currentStep.action === 'input_name' && (
                    <TextInput 
                        style={[styles.input, { color: theme.text, borderColor: theme.border }]}
                        placeholder="Name..."
                        placeholderTextColor="#999"
                        value={inputName}
                        onChangeText={setInputName}
                        autoFocus
                    />
                )}

                <View style={styles.btnRow}>
                    {!currentStep.forceNext && (
                        <TouchableOpacity onPress={stopTutorial} style={styles.skipBtn}>
                            <Text style={{color: '#888'}}>Skip</Text>
                        </TouchableOpacity>
                    )}
                    <TouchableOpacity onPress={handleNext} style={[styles.nextBtn, { backgroundColor: theme.tint }]}>
                        <Text style={styles.nextText}>{currentStep.action === 'input_name' ? 'Confirm' : 'Next'}</Text>
                        <Ionicons name="arrow-forward" size={16} color="white" style={{marginLeft: 4}}/>
                    </TouchableOpacity>
                </View>
             </View>
          </Animated.View>
        </View>
      </Modal>
    </TutorialContext.Provider>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1 },
  coachContainer: {
    position: 'absolute',
    bottom: 50, 
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  // [修改開始] 調整頭像樣式
  avatarContainer: { 
      marginRight: 10,
      shadowColor: '#000', 
      shadowOpacity: 0.3, 
      shadowRadius: 5,
      shadowOffset: { width: 0, height: 3 },
      elevation: 10,
  },
  avatarImage: {
      width: 80, 
      height: 80, 
  },
  // [修改結束]
  avatarCircle: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#FFF', justifyContent: 'center', alignItems: 'center', elevation: 5, shadowColor:'#000', shadowOpacity:0.3, shadowRadius:4 },
  bubble: { flex: 1, padding: 16, borderRadius: 16, borderBottomLeftRadius: 4, elevation: 4, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, minHeight: 100, justifyContent: 'center' },
  bubbleText: { fontSize: 16, lineHeight: 24, marginBottom: 12 },
  btnRow: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 12 },
  skipBtn: { padding: 8 },
  nextBtn: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20, flexDirection: 'row', alignItems: 'center' },
  nextText: { color: 'white', fontWeight: 'bold' },
  input: { borderWidth: 1, borderRadius: 8, padding: 8, marginBottom: 12, fontSize: 16 }
});