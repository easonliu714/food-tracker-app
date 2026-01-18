import AsyncStorage from '@react-native-async-storage/async-storage';

export const TUTORIAL_KEYS = {
  USER_NAME: 'tutorial_user_name',
  IS_FIRST_LAUNCH: 'tutorial_is_first_launch_v2', // 使用 v2 確保舊用戶也能看到新教學
  HAS_SEEN_HOME: 'tutorial_seen_home',
  HAS_SEEN_ANALYSIS: 'tutorial_seen_analysis',
  HAS_SEEN_RECIPES: 'tutorial_seen_recipes', // 若您有此頁面
  HAS_SEEN_PROFILE: 'tutorial_seen_profile',
};

export async function getTutorialState(key: string): Promise<boolean> {
  try {
    const val = await AsyncStorage.getItem(key);
    return val === 'true'; // 字串轉布林
  } catch { return false; }
}

export async function setTutorialState(key: string, value: boolean) {
  try { await AsyncStorage.setItem(key, String(value)); } catch {}
}

export async function getUserName(): Promise<string | null> {
  try { return await AsyncStorage.getItem(TUTORIAL_KEYS.USER_NAME); } catch { return null; }
}

export async function setUserName(name: string) {
  try { await AsyncStorage.setItem(TUTORIAL_KEYS.USER_NAME, name); } catch {}
}