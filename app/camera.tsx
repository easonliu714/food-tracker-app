import { useState } from 'react';
import { StyleSheet, View, Pressable, Alert, Text, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';

export default function CameraScreen() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // 使用系統相機拍照 (支援裁切)
  const takePicture = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission required", "Please allow camera access.");
      return;
    }

    setLoading(true);
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaType.Images,
      allowsEditing: true, // 啟用裁切編輯器
      quality: 0.8,
      base64: true,
    });
    setLoading(false);

    if (!result.canceled) {
      router.push({
        pathname: "/food-recognition",
        params: { imageUri: result.assets[0].uri, base64: result.assets[0].base64, mode: "AI" }
      });
    }
  };

  // 選取圖庫 (支援裁切)
  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaType.Images, // 修正 deprecated 選項
      allowsEditing: true, // 啟用裁切編輯器
      quality: 0.8,
      base64: true,
    });

    if (!result.canceled) {
      router.push({
        pathname: "/food-recognition",
        params: { imageUri: result.assets[0].uri, base64: result.assets[0].base64, mode: "AI" }
      });
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>請選擇輸入方式</Text>
        <Text style={styles.subtitle}>拍照或選取照片後可進行裁切編輯</Text>
        
        {loading ? (
          <ActivityIndicator size="large" color="white" style={{marginTop: 50}}/>
        ) : (
          <View style={styles.buttonContainer}>
            <Pressable style={styles.button} onPress={takePicture}>
              <View style={styles.iconCircle}>
                <Ionicons name="camera" size={40} color="black" />
              </View>
              <Text style={styles.btnText}>拍照 (含編輯)</Text>
            </Pressable>

            <Pressable style={styles.button} onPress={pickImage}>
              <View style={styles.iconCircle}>
                <Ionicons name="images" size={40} color="black" />
              </View>
              <Text style={styles.btnText}>從相簿選取</Text>
            </Pressable>
          </View>
        )}
      </View>
      
      <Pressable style={styles.closeBtn} onPress={() => router.back()}>
        <Ionicons name="close-circle" size={48} color="white" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'black', justifyContent: 'center', alignItems: 'center' },
  content: { alignItems: 'center', width: '100%' },
  title: { color: 'white', fontSize: 24, fontWeight: 'bold', marginBottom: 10 },
  subtitle: { color: '#ccc', fontSize: 14, marginBottom: 50 },
  buttonContainer: { flexDirection: 'row', gap: 40 },
  button: { alignItems: 'center' },
  iconCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'white', justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  btnText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
  closeBtn: { position: 'absolute', bottom: 50 }
});