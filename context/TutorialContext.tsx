import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { View, Modal, StyleSheet, TouchableOpacity, Text, Dimensions, TextInput, Image, Animated, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, usePathname } from 'expo-router'; // [新增] usePathname
import { getTutorialState, setTutorialState, getUserName, setUserName, TUTORIAL_KEYS } from '@/lib/tutorial-storage';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useLanguage, t } from '@/lib/i18n';
import { getTutorialSteps, TutorialStep } from '@/constants/tutorial-steps';

const GuideAvatarImage = require('@/assets/images/guide_avatar.png'); 

interface TargetLayout { x: number; y: number; w: number; h: number }

interface TutorialContextType {
  registerTarget: (key: string, layout: TargetLayout) => void;
  startScenario: (scenarioId: string, customSteps?: TutorialStep[]) => void;
  stopTutorial: () => void;
  userName: string;
  setUserNameState: (n: string) => void;
  activeScenario: string | null;
  currentStepIndex: number;
  // [新增] 用於頁面註冊捲動回呼
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
  const pathname = usePathname();
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const lang = useLanguage();

  const [userName, setUserNameState] = useState("User");
  const [activeScenario, setActiveScenario] = useState<string | null>(null);
  const [steps, setSteps] = useState<TutorialStep[]>([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [targets, setTargets] = useState<Record<string, TargetLayout>>({});
  const [inputName, setInputName] = useState("");
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // [新增] 捲動回呼 Ref
  const scrollCallbackRef = useRef<((key: string) => void) | null>(null);

  useEffect(() => {
    async function init() {
      const name = await getUserName();
      if (name) setUserNameState(name);
      
      const notFirst = await getTutorialState(TUTORIAL_KEYS.IS_FIRST_LAUNCH);
      if (!notFirst) {
        const allSteps = getTutorialSteps(lang, name || 'User');
        // 確保在首頁才觸發歡迎流程，避免在其他頁面重整時誤觸
        if (pathname === '/' || pathname === '/(tabs)') {
            startScenario('ONBOARDING_WELCOME', allSteps.ONBOARDING_WELCOME);
        }
      }
    }
    init();
  }, [lang]); // 移除 pathname 依賴，避免換頁重複觸發

  // 當步驟改變時，嘗試觸發頁面捲動
  useEffect(() => {
      const step = steps[currentStepIndex];
      if (step?.targetKey && activeScenario && scrollCallbackRef.current) {
          // 呼叫頁面註冊的捲動函數
          scrollCallbackRef.current(step.targetKey);
      }
  }, [currentStepIndex, activeScenario, steps]);

  const registerTarget = (key: string, layout: TargetLayout) => {
    // [修正] 增加防呆，避免無效座標 (Android 常見問題)
    if (layout.w === 0 || layout.h === 0) return;
    
    setTargets(prev => {
      const old = prev[key];
      // 只有當位置變動超過 2px 才更新，減少重繪
      if (old && Math.abs(old.x - layout.x) < 2 && Math.abs(old.y - layout.y) < 2 && Math.abs(old.w - layout.w) < 2) return prev;
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

  const handlePrev = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(prev => prev - 1);
    }
  };
  
  const stopTutorial = async () => {
    Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
      setActiveScenario(null);
      setSteps([]);
    });
    
    // 記錄已讀狀態
    if (activeScenario === 'HOME_GUIDE') await setTutorialState(TUTORIAL_KEYS.HAS_SEEN_HOME, true);
    else if (activeScenario === 'PROFILE_GUIDE') await setTutorialState(TUTORIAL_KEYS.HAS_SEEN_PROFILE, true);
    else if (activeScenario === 'ANALYSIS_GUIDE') await setTutorialState(TUTORIAL_KEYS.HAS_SEEN_ANALYSIS, true);
    else if (activeScenario === 'RECIPES_GUIDE') await setTutorialState(TUTORIAL_KEYS.HAS_SEEN_RECIPES, true);
  };

  const handleNext = async () => {
    const step = steps[currentStepIndex];
    const allSteps = getTutorialSteps(lang, userName);

    if (step.action === 'input_name') {
      if (!inputName.trim()) return; 
      await setUserName(inputName);
      setUserNameState(inputName);
    } else if (step.action === 'navigate_profile') {
      // 導航到 Profile，並利用 Profile 頁面的 useFocusEffect 來接續導覽
      // 這裡我們不使用 setTimeout 強制開啟，而是讓 Profile 頁面自己決定
      // 但為了確保順暢，我們可以在這裡寫入一個暫存狀態，或直接跳轉後由使用者手動探索(依據原始需求，這裡直接跳轉)
      router.push('/(tabs)/profile');
      // 這裡給一點延遲讓頁面掛載，然後直接觸發 Profile 的歡迎流程
      setTimeout(() => {
         startScenario('ONBOARDING_PROFILE', allSteps.ONBOARDING_PROFILE);
      }, 600);
      return; 
    } else if (step.action === 'end_onboarding') {
      await setTutorialState(TUTORIAL_KEYS.IS_FIRST_LAUNCH, true);
      router.replace('/(tabs)');
      setTimeout(() => {
         startScenario('HOME_GUIDE', allSteps.HOME_GUIDE);
      }, 800);
      return;
    }

    if (currentStepIndex < steps.length - 1) {
      setCurrentStepIndex(prev => prev + 1);
    } else {
      stopTutorial();
    }
  };

  const onScrollRequest = (cb: (key: string) => void) => {
      scrollCallbackRef.current = cb;
  };

  const currentStep = steps[currentStepIndex];
  const targetLayout = currentStep?.targetKey ? targets[currentStep.targetKey] : null;

  return (
    <TutorialContext.Provider value={{ registerTarget, startScenario, stopTutorial, userName, setUserNameState, activeScenario, currentStepIndex, onScrollRequest }}>
      {children}
      <Modal transparent visible={!!activeScenario} animationType="none" onRequestClose={stopTutorial}>
        <View style={styles.overlay}>
          {/* Highlight Box */}
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.6)' }]}>
             {targetLayout && (
                 <View style={{
                     position: 'absolute',
                     left: targetLayout.x - 5,
                     top: targetLayout.y - 5,
                     width: targetLayout.w + 10,
                     height: targetLayout.h + 10,
                     backgroundColor: 'rgba(255,255,255,0.05)', //稍微亮一點
                     borderRadius: 8,
                     borderWidth: 2,
                     borderColor: '#FFD700',
                     borderStyle: 'dashed'
                 }} />
             )}
          </View>

          <Animated.View style={[styles.coachContainer, { opacity: fadeAnim }]}>
             <View style={styles.avatarContainer}>
                <Image source={GuideAvatarImage} style={styles.avatarImage} resizeMode="contain" />
             </View>

             <View style={[styles.bubble, { backgroundColor: theme.cardBackground }]}>
                <Text style={[styles.bubbleText, { color: theme.text }]}>{currentStep?.text}</Text>
                
                {currentStep?.action === 'input_name' && (
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
        </View>
      </Modal>
    </TutorialContext.Provider>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1 }, // 保持 Modal 覆蓋
  coachContainer: { position: 'absolute', bottom: 50, left: 20, right: 20, flexDirection: 'row', alignItems: 'flex-end' },
  avatarContainer: { 
      marginRight: 10, 
      backgroundColor: 'transparent'
  },
  avatarImage: { width: 90, height: 90 },
  bubble: { flex: 1, padding: 16, borderRadius: 16, borderBottomLeftRadius: 4, elevation: 5, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 8, minHeight: 100, justifyContent: 'center' },
  bubbleText: { fontSize: 16, lineHeight: 24, marginBottom: 12 },
  btnRow: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 12 },
  skipBtn: { padding: 8 },
  nextBtn: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20, flexDirection: 'row', alignItems: 'center' },
  nextText: { color: 'white', fontWeight: 'bold' },
  input: { borderWidth: 1, borderRadius: 8, padding: 8, marginBottom: 12, fontSize: 16 }
});