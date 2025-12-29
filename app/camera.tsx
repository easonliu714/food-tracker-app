import { CameraView, useCameraPermissions } from "expo-camera";
import { useState, useRef } from "react";
import { StyleSheet, Text, TouchableOpacity, View, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";

export default function CameraScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [isCapturing, setIsCapturing] = useState(false);
  const cameraRef = useRef<CameraView>(null);
  const router = useRouter();

  if (!permission) return <View />;
  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={{ textAlign: 'center', marginBottom: 20, color: '#fff' }}>
          需要相機權限以拍攝食物
        </Text>
        <TouchableOpacity onPress={requestPermission} style={styles.permissionBtn}>
          <Text style={{ color: '#000' }}>授予權限</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const takePicture = async () => {
    if (cameraRef.current && !isCapturing) {
      setIsCapturing(true);
      try {
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.7,
          base64: true, // 若 AI 需要 Base64
        });
        
        // 修改點：直接導向 food-editor，並帶入圖片路徑
        // 注意：這裡我們假設 food-editor 會處理 imageUri 參數來進行 AI 分析
        router.push({
          pathname: "/food-editor",
          params: { imageUri: photo?.uri } 
        });
      } catch (e) {
        console.error(e);
      } finally {
        setIsCapturing(false);
      }
    }
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      base64: true,
    });

    if (!result.canceled) {
       router.push({
          pathname: "/food-editor",
          params: { imageUri: result.assets[0].uri } 
       });
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <CameraView style={styles.camera} ref={cameraRef} facing="back">
        <View style={styles.overlay}>
            <TouchableOpacity style={styles.closeBtn} onPress={() => router.back()}>
                <Ionicons name="close" size={30} color="white" />
            </TouchableOpacity>
            
            <View style={styles.controls}>
                <TouchableOpacity onPress={pickImage} style={styles.galleryBtn}>
                    <Ionicons name="images" size={28} color="white" />
                </TouchableOpacity>

                <TouchableOpacity onPress={takePicture} style={styles.captureBtn}>
                    {isCapturing ? <ActivityIndicator color="black"/> : <View style={styles.captureInner} />}
                </TouchableOpacity>

                <View style={{width: 50}} /> 
            </View>
        </View>
      </CameraView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'black' },
  camera: { flex: 1 },
  permissionBtn: { backgroundColor: 'white', padding: 15, borderRadius: 10 },
  overlay: { flex: 1, justifyContent: 'space-between', padding: 20 },
  closeBtn: { alignSelf: 'flex-start', padding: 10 },
  controls: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', marginBottom: 30 },
  galleryBtn: { padding: 10 },
  captureBtn: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'white', justifyContent: 'center', alignItems: 'center' },
  captureInner: { width: 70, height: 70, borderRadius: 35, borderWidth: 2, borderColor: 'black', backgroundColor: 'white' },
});