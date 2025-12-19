import { CameraView, CameraType, useCameraPermissions } from "expo-camera";
import { useRouter } from "expo-router";
import { useState, useRef } from "react";
import { Pressable, StyleSheet, View, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { ThemedText } from "@/components/themed-text";
import { useThemeColor } from "@/hooks/use-theme-color";

export default function CameraScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [facing, setFacing] = useState<CameraType>("back");
  const [permission, requestPermission] = useCameraPermissions();
  const [isCapturing, setIsCapturing] = useState(false);
  const cameraRef = useRef<CameraView>(null);
  const backgroundColor = useThemeColor({}, "background");
  const tintColor = useThemeColor({}, "tint");

  if (!permission) return <View style={[styles.container, {backgroundColor}]}><ActivityIndicator size="large" /></View>;
  if (!permission.granted) {
    return (
      <View style={[styles.container, { backgroundColor, justifyContent: 'center', alignItems: 'center', padding: 20 }]}>
        <Ionicons name="camera-outline" size={80} color={tintColor} />
        <ThemedText type="title" style={{ marginVertical: 20 }}>需要相機權限</ThemedText>
        <Pressable onPress={requestPermission} style={[styles.btn, { backgroundColor: tintColor }]}>
          <ThemedText style={{ color: 'white' }}>授予權限</ThemedText>
        </Pressable>
        <Pressable onPress={() => router.back()} style={{ marginTop: 20 }}><ThemedText style={{ color: tintColor }}>返回</ThemedText></Pressable>
      </View>
    );
  }

  function toggleCameraFacing() { setFacing(c => (c === "back" ? "front" : "back")); }

  async function takePicture() {
    if (!cameraRef.current || isCapturing) return;
    try {
      setIsCapturing(true);
      // 重要：設定品質和跳過 base64
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.8, base64: false, skipProcessing: true });
      if (photo?.uri) {
        router.push({ pathname: "/food-recognition", params: { imageUri: photo.uri } });
      }
    } catch (error) {
      console.error("Error taking picture:", error);
    } finally {
      setIsCapturing(false);
    }
  }

  async function pickImage() {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, aspect: [4, 3], quality: 0.8 });
      if (!result.canceled && result.assets[0]) {
        router.push({ pathname: "/food-recognition", params: { imageUri: result.assets[0].uri } });
      }
    } catch (error) {
      console.error("Error picking image:", error);
    }
  }

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing={facing}
        mode="picture"
        autofocus="on" // 確保有這行
      >
        <View style={[styles.topBar, { paddingTop: Math.max(insets.top, 20) }]}>
          <Pressable onPress={() => router.back()} style={styles.iconBtn}><Ionicons name="close" size={28} color="white" /></Pressable>
        </View>

        <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 20) }]}>
          <Pressable onPress={pickImage} style={styles.iconBtn}><Ionicons name="images" size={28} color="white" /></Pressable>
          <Pressable onPress={takePicture} disabled={isCapturing} style={[styles.captureBtn, isCapturing && {opacity: 0.5}]}>
            {isCapturing ? <ActivityIndicator color="black" /> : <View style={styles.captureBtnInner} />}
          </Pressable>
          <Pressable onPress={toggleCameraFacing} style={styles.iconBtn}><Ionicons name="camera-reverse" size={28} color="white" /></Pressable>
        </View>
      </CameraView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  camera: { flex: 1 },
  btn: { padding: 16, borderRadius: 12, minWidth: 120, alignItems: 'center' },
  topBar: { position: 'absolute', top: 0, left: 0, padding: 20 },
  bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', padding: 30 },
  iconBtn: { width: 50, height: 50, borderRadius: 25, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  captureBtn: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'white', justifyContent: 'center', alignItems: 'center', borderWidth: 4, borderColor: 'rgba(255,255,255,0.5)' },
  captureBtnInner: { width: 64, height: 64, borderRadius: 32, backgroundColor: 'white' }
});