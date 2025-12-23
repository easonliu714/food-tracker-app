import { CameraView, useCameraPermissions } from 'expo-camera';
import { useState, useRef } from 'react';
import { Button, StyleSheet, Text, View, Pressable, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { t, useLanguage } from '@/lib/i18n';

export default function CameraScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const router = useRouter();
  const lang = useLanguage();

  if (!permission) return <View />;
  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={{ textAlign: 'center' }}>We need your permission to show the camera</Text>
        <Button onPress={requestPermission} title="grant permission" />
      </View>
    );
  }

  const takePicture = async () => {
    if (cameraRef.current) {
      try {
        const photo = await cameraRef.current.takePictureAsync({
          base64: true,
          quality: 0.5,
        });
        if (photo) {
          router.push({
            pathname: "/food-recognition",
            params: { imageUri: photo.uri, base64: photo.base64, mode: "AI" }
          });
        }
      } catch (error) {
        Alert.alert("Error", "Failed to take picture");
      }
    }
  };

  const pickImage = async () => {
    // [修正] 使用 ImagePicker.MediaType.Images 替代棄用的 MediaTypeOptions
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaType.Images,
      allowsEditing: true,
      quality: 0.5,
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
      <CameraView style={styles.camera} ref={cameraRef}>
        <View style={styles.buttonContainer}>
          <Pressable style={styles.button} onPress={() => router.back()}>
            <Ionicons name="close" size={32} color="white" />
          </Pressable>
          <Pressable style={styles.captureBtn} onPress={takePicture}>
            <View style={styles.innerCircle} />
          </Pressable>
          <Pressable style={styles.button} onPress={pickImage}>
            <Ionicons name="images" size={32} color="white" />
          </Pressable>
        </View>
      </CameraView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center' },
  camera: { flex: 1 },
  buttonContainer: {
    flex: 1, flexDirection: 'row', backgroundColor: 'transparent', margin: 64,
    justifyContent: 'space-between', alignItems: 'flex-end'
  },
  button: { alignItems: 'center' },
  captureBtn: {
    width: 70, height: 70, borderRadius: 35, backgroundColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center', alignItems: 'center'
  },
  innerCircle: { width: 60, height: 60, borderRadius: 30, backgroundColor: 'white' },
  text: { fontSize: 24, fontWeight: 'bold', color: 'white' },
});