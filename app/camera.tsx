import { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet, Alert, Pressable, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useThemeColor } from '@/hooks/use-theme-color';
import { ThemedText } from '@/components/themed-text';
import { Ionicons } from '@expo/vector-icons';

export default function CameraScreen() {
  const router = useRouter();
  const backgroundColor = useThemeColor({}, 'background');
  const [loading, setLoading] = useState(false);

  // 1. 拍照
  const takePhoto = async () => {
    setLoading(true);
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert("權限不足", "需要相機權限");
      setLoading(false);
      return;
    }
    await launchPicker(ImagePicker.launchCameraAsync);
  };

  // 2. 選取相簿
  const pickImage = async () => {
    setLoading(true);
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert("權限不足", "需要相簿權限");
      setLoading(false);
      return;
    }
    await launchPicker(ImagePicker.launchImageLibraryAsync);
  };

  const launchPicker = async (launcher: any) => {
    try {
      const result = await launcher({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true, // 開啟遮罩裁切
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        router.replace({ 
          pathname: "/food-recognition", 
          params: { imageUri: result.assets[0].uri, mode: 'AI' } 
        });
      } else {
        setLoading(false);
      }
    } catch (e) {
      Alert.alert("錯誤", "操作失敗");
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor }]}>
      {loading ? (
        <ActivityIndicator size="large" color="#2196F3" />
      ) : (
        <View style={styles.center}>
          <ThemedText type="title" style={{marginBottom: 40}}>選擇圖片來源</ThemedText>
          
          <Pressable onPress={takePhoto} style={styles.btn}>
             <Ionicons name="camera" size={32} color="white" />
             <ThemedText style={styles.btnText}>拍照</ThemedText>
          </Pressable>

          <Pressable onPress={pickImage} style={[styles.btn, {marginTop: 20, backgroundColor: '#FF9800'}]}>
             <Ionicons name="images" size={32} color="white" />
             <ThemedText style={styles.btnText}>從相簿選取</ThemedText>
          </Pressable>

          <Pressable onPress={() => router.back()} style={{marginTop: 50}}>
             <ThemedText style={{color: '#999', textDecorationLine: 'underline'}}>返回上一頁</ThemedText>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  center: { alignItems: 'center', width: '100%' },
  btn: { backgroundColor: '#2196F3', padding: 20, borderRadius: 16, alignItems: 'center', width: 200, flexDirection:'row', justifyContent:'center', gap:10 },
  btnText: { color:'white', fontWeight:'bold', fontSize: 18 }
});