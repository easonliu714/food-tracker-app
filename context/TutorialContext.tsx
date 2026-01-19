import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { View, Modal, StyleSheet, TouchableOpacity, Text, Dimensions, TextInput, Image, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { getTutorialState, setTutorialState, getUserName, setUserName, TUTORIAL_KEYS } from '@/lib/tutorial-storage';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useLanguage } from '@/lib/i18n';
// [修改] 引入腳本產生器
import { getTutorialSteps, TutorialStep } from '@/constants/tutorial-steps';
// [新增] 引入 button 文字
import { t } from '@/lib/i18n'; 

const GuideAvatarImage = require('@/assets/images/guide_avatar.png'); 

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type TargetLayout = { x: number; y: number; w: number; h: number };

interface TutorialContextType {
  registerTarget: (key: string, layout: TargetLayout) => void;
  startScenario: (scenarioId: string, customSteps?: TutorialStep[]) => void;
  stopTutorial: () => void;
  userName: string;
  setUserNameState: (n: string) => void;
  activeScenario: string | null;
  currentStepIndex: number;
}

const TutorialContext = createContext<TutorialContextType | null>(null);

export const useTutorial = () => {
  const context = useContext(TutorialContext);
  if (!context) throw new Error("useTutorial must be used within TutorialProvider");
  return context;
};

export const TutorialProvider = ({ children }: { children: React.ReactNode }) => {
  const router = useRouter();
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

  // 初始化檢查
  useEffect(() => {
    async function init() {
      const name = await getUserName();
      if (name) setUserNameState(name);
      
      const notFirst = await getTutorialState(TUTORIAL_KEYS.IS_FIRST_LAUNCH);
      if (!notFirst) {
        // [修改] 使用集中管理的腳本
        const allSteps = getTutorialSteps(lang, name || 'User');
        startScenario('ONBOARDING_WELCOME', allSteps.ONBOARDING_WELCOME);
      }
    }
    init();
  }, [lang]);

  const registerTarget = (key: string, layout: TargetLayout) => {
    setTargets(prev => {
      const old = prev[key];
      if (old && Math.abs(old.x - layout.x) < 2 && Math.abs(old.y - layout.y) < 2) return prev;
      return { ...prev, [key]: layout };
    });
  };

  // [修改] 允許傳入 customSteps，若無則不執行（或可擴充自動抓取）
  const startScenario = (id: string, customSteps?: TutorialStep[]) => {
    if (customSteps) {
        setActiveScenario(id);
        setSteps(customSteps);
        setCurrentStepIndex(0);
        Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    }
  };

    // [新增] 上一步邏輯
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
    
    if (activeScenario === 'HOME_GUIDE') await setTutorialState(TUTORIAL_KEYS.HAS_SEEN_HOME, true);
    else if (activeScenario === 'PROFILE_GUIDE') await setTutorialState(TUTORIAL_KEYS.HAS_SEEN_PROFILE, true);
    else if (activeScenario === 'ANALYSIS_GUIDE') await setTutorialState(TUTORIAL_KEYS.HAS_SEEN_ANALYSIS, true);
  };

  const handleNext = async () => {
    const step = steps[currentStepIndex];
    // 取得最新腳本以供跳轉使用
    const allSteps = getTutorialSteps(lang, userName);

    if (step.action === 'input_name') {
      if (!inputName.trim()) return; 
      await setUserName(inputName);
      setUserNameState(inputName);
    } else if (step.action === 'navigate_profile') {
      router.push('/(tabs)/profile');
      setTimeout(() => {
         startScenario('ONBOARDING_PROFILE', allSteps.ONBOARDING_PROFILE);
      }, 500);
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

  const currentStep = steps[currentStepIndex];
  const targetLayout = currentStep?.targetKey ? targets[currentStep.targetKey] : null;

  return (
    <TutorialContext.Provider value={{ registerTarget, startScenario, stopTutorial, userName, setUserNameState, activeScenario, currentStepIndex }}>
      {children}
      <Modal transparent visible={!!activeScenario} animationType="none">
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
                     backgroundColor: 'rgba(255,255,255,0.1)',
                     borderRadius: 12,
                     borderWidth: 2,
                     borderColor: '#FFD700',
                     borderStyle: 'dashed'
                 }} />
             )}
          </View>

          <Animated.View style={[styles.coachContainer, { opacity: fadeAnim }]}>
             <View style={styles.avatarContainer}>
                {/* [修改] 確保背景透明，設定固定尺寸 100x100 (可調整) */}
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
                    {/* [新增] 上一步按鈕 (僅在非第一步時顯示) */}
                    {currentStepIndex > 0 && (
                        <TouchableOpacity onPress={handlePrev} style={styles.skipBtn}>
                            <Text style={{color: theme.tint}}>{t('prev_step', lang) || "Back"}</Text>
                        </TouchableOpacity>
                    )}

                    {!currentStep?.forceNext && (
                        <TouchableOpacity onPress={stopTutorial} style={styles.skipBtn}>
                            <Text style={{color: '#888'}}>Skip</Text>
                        </TouchableOpacity>
                    )}
                    <TouchableOpacity onPress={handleNext} style={[styles.nextBtn, { backgroundColor: theme.tint }]}>
                        <Text style={styles.nextText}>{currentStep?.action === 'input_name' ? 'Confirm' : 'Next'}</Text>
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
  coachContainer: { position: 'absolute', bottom: 50, left: 20, right: 20, flexDirection: 'row', alignItems: 'flex-end' },
  avatarContainer: { 
      marginRight: 10, 
      shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 5, shadowOffset: { width: 0, height: 3 }, elevation: 10,
      backgroundColor: 'transparent' // [修改] 確保容器透明
  },
  avatarImage: { 
      width: 100, // [修改] 調整尺寸
      height: 100, 
      backgroundColor: 'transparent' // [修改] 確保圖片本身背景透明
  },
  bubble: { flex: 1, padding: 16, borderRadius: 16, borderBottomLeftRadius: 4, elevation: 4, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, minHeight: 100, justifyContent: 'center' },
  bubbleText: { fontSize: 16, lineHeight: 24, marginBottom: 12 },
  btnRow: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 12 },
  skipBtn: { padding: 8 },
  nextBtn: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20, flexDirection: 'row', alignItems: 'center' },
  nextText: { color: 'white', fontWeight: 'bold' },
  input: { borderWidth: 1, borderRadius: 8, padding: 8, marginBottom: 12, fontSize: 16 }
});