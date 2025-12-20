import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useThemeColor } from '@/hooks/use-theme-color';

export default function CameraScreen() {
  const router = useRouter();
  const backgroundColor = useThemeColor({}, 'background');

  useEffect(() => {
    // 啟動即打開相機
    openCamera();
  }, []);

  const openCamera = async () => {
    // 請求權限
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      router.back();
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
        // 取消則返回
        router.back();
      }
    } catch (e) {
      router.back();
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor, justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator size="large" />
    </View>
  );
}