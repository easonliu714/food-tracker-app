import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { View, Modal, StyleSheet, TouchableOpacity, Text, Dimensions, TextInput, Image, Animated, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, usePathname } from 'expo-router';
import { getTutorialState, setTutorialState, getUserName, setUserName, TUTORIAL_KEYS } from '@/lib/tutorial-storage';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useLanguage, t } from '@/lib/i18n';
import { getTutorialSteps, TutorialStep } from '@/constants/tutorial-steps';

const GuideAvatarImage = require('@/assets/images/guide_avatar.png'); 

// [新增] 定義微調參數介面
export interface TargetAdjustment {
  padding?: number;        // 四周留白增加 (預設基礎值為 5)
  offsetX?: number;        // X 軸偏移 (+右 -左)
  offsetY?: number;        // Y 軸偏移 (+下 -上)
  widthAdd?: number;       // 寬度增加 
  heightAdd?: number;      // 高度增加
}

// [修改] 擴充 TargetLayout 包含 adjustment
type TargetLayout = { 
  x: number; 
  y: number; 
  w: number; 
  h: number; 
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

  // 初始化檢查
  useEffect(() => {
    async function init() {
      const name = await getUserName();
      if (name) setUserNameState(name);
      
      const notFirst = await getTutorialState(TUTORIAL_KEYS.IS_FIRST_LAUNCH);
      if (!notFirst) {
        const allSteps = getTutorialSteps(lang, name || 'User');
        // 確保在首頁才觸發歡迎流程
        if (pathname === '/' || pathname === '/(tabs)') {
            startScenario('ONBOARDING_WELCOME', allSteps.ONBOARDING_WELCOME);
        }
      }
    }
    init();
  }, [lang]);

  // [新增] 當步驟改變時，嘗試觸發頁面捲動
  useEffect(() => {
      const step = steps[currentStepIndex];
      if (step?.targetKey && activeScenario && scrollCallbackRef.current) {
          // 呼叫頁面註冊的捲動函數
          scrollCallbackRef.current(step.targetKey);
      }
  }, [currentStepIndex, activeScenario, steps]);

  // [新增] 註冊 Scroll Callback
  const onScrollRequest = (cb: (key: string) => void) => {
      scrollCallbackRef.current = cb;
  };

  // [修改] registerTarget 支援 adjustment 與數值檢查
  const registerTarget = (key: string, layout: TargetLayout) => {
    // 防呆：避免 Android 轉場時取得無效座標
    if (layout.w === 0 || layout.h === 0) return;
    
    setTargets(prev => {
      const old = prev[key];
      // 只有當位置變動超過 2px 才更新，減少重繪 (忽略 adjustment 的深層比對)
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
    Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(async () => {
      setActiveScenario(null);
      setSteps([]);
      
      // 記錄已讀狀態
      if (activeScenario === 'HOME_GUIDE') await setTutorialState(TUTORIAL_KEYS.HAS_SEEN_HOME, true);
      else if (activeScenario === 'PROFILE_GUIDE') await setTutorialState(TUTORIAL_KEYS.HAS_SEEN_PROFILE, true);
      else if (activeScenario === 'ANALYSIS_GUIDE') await setTutorialState(TUTORIAL_KEYS.HAS_SEEN_ANALYSIS, true);
      else if (activeScenario === 'RECIPES_GUIDE') await setTutorialState(TUTORIAL_KEYS.HAS_SEEN_RECIPES, true); // [新增]
    });
  };

  const handleNext = async () => {
    const step = steps[currentStepIndex];
    const allSteps = getTutorialSteps(lang, userName);

    if (step.action === 'input_name') {
      if (!inputName.trim()) return; 
      await setUserName(inputName);
      setUserNameState(inputName);
    } else if (step.action === 'navigate_profile') {
      // 導航到 Profile 並接續導覽
      router.push('/(tabs)/profile');
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

  const currentStep = steps[currentStepIndex];
  const rawLayout = currentStep?.targetKey ? targets[currentStep.targetKey] : null;

  // [修改] 計算最終顯示的 layout (套用 adjustment)
  let finalLayout = null;
  if (rawLayout) {
      const adj = rawLayout.adjustment || {};
      const padding = adj.padding || 0;
      const offX = adj.offsetX || 0;
      const offY = adj.offsetY || 0;
      const wAdd = adj.widthAdd || 0;
      const hAdd = adj.heightAdd || 0;

      const basePadding = 5; // 基礎留白
      
      finalLayout = {
          x: rawLayout.x - basePadding - padding + offX,
          y: rawLayout.y - basePadding - padding + offY,
          w: rawLayout.w + (basePadding * 2) + (padding * 2) + wAdd,
          h: rawLayout.h + (basePadding * 2) + (padding * 2) + hAdd
      };
  }

  return (
    <TutorialContext.Provider value={{ registerTarget, startScenario, stopTutorial, userName, setUserNameState, activeScenario, currentStepIndex, onScrollRequest }}>
      {children}
      <Modal transparent visible={!!activeScenario} animationType="none" onRequestClose={stopTutorial}>
        <View style={styles.overlay}>
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
  overlay: { flex: 1 },
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