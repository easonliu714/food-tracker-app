import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSegments } from 'expo-router';
import { loginLocal, logoutLocal, getLocalUser } from '@/lib/storage';

export function useAuth() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const segments = useSegments();
  const router = useRouter();

  const checkUser = useCallback(async () => {
    try {
      const storedUser = await getLocalUser();
      setUser(storedUser);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkUser();
  }, [checkUser]);

  const login = async (name: string) => {
    const newUser = await loginLocal(name);
    setUser(newUser);
    router.replace('/(tabs)'); // 登入成功後跳轉首頁
  };

  const logout = async () => {
    await logoutLocal();
    setUser(null);
    router.replace('/login');
  };

  return {
    user,
    loading,
    isAuthenticated: !!user,
    login,
    logout,
  };
}