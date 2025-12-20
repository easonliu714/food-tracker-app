import { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet, Alert, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useThemeColor } from '@/hooks/use-theme-color';
import { ThemedText } from '@/components/themed-text';
import { Ionicons } from '@expo/vector-icons';

export default function CameraScreen() {
  const router = useRouter();
  const backgroundColor = useThemeColor({}, 'background');
  const [loading, setLoading] = useState(false);

  const openCamera = async () => {
    setLoading(true);
    // 請求權限
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert("權限不足", "需要相機權限才能拍照");
      setLoading(false);
      return;
    }

    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true, // [關鍵] 開啟遮罩裁切
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        // 拍完並裁切後，跳轉到分析頁
        router.replace({ 
          pathname: "/food-recognition", 
          params: { imageUri: result.assets[0].uri, mode: 'AI' } 
        });
      } else {
        // 取消則留在本頁，或可以選擇 router.back()
        // 這裡選擇留在本頁並顯示重試按鈕，避免無限迴圈
        setLoading(false);
      }
    } catch (e) {
      Alert.alert("錯誤", "相機啟動失敗");
      setLoading(false);
    }
  };

  // 一進來就開，但如果被取消，可以手動再開
  useEffect(() => {
    openCamera();
  }, []);

  return (
    <View style={[styles.container, { backgroundColor }]}>
      {loading ? (
        <ActivityIndicator size="large" color="#2196F3" />
      ) : (
        <View style={styles.center}>
          <ThemedText style={{marginBottom: 20}}>相機已關閉</ThemedText>
          <Pressable onPress={openCamera} style={styles.btn}>
             <Ionicons name="camera" size={32} color="white" />
             <ThemedText style={{color:'white', fontWeight:'bold', marginTop:8}}>開啟相機</ThemedText>
          </Pressable>
          <Pressable onPress={() => router.back()} style={{marginTop: 30}}>
             <ThemedText style={{color: '#999'}}>返回上一頁</ThemedText>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  center: { alignItems: 'center' },
  btn: { backgroundColor: '#2196F3', padding: 20, borderRadius: 16, alignItems: 'center', minWidth: 150 }
});