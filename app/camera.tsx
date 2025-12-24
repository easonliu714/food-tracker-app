import { CameraView, useCameraPermissions } from 'expo-camera';
import { useState, useRef } from 'react';
import { StyleSheet, View, Pressable, Alert, Text, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';

export default function CameraScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const router = useRouter();
  const [processing, setProcessing] = useState(false);

  if (!permission) return <View />;
  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={{ textAlign: 'center', color:'white' }}>Need camera permission</Text>
        <Pressable onPress={requestPermission} style={{padding:10, backgroundColor:'white', marginTop:10}}>
           <Text>Grant Permission</Text>
        </Pressable>
      </View>
    );
  }

  const takePicture = async () => {
    // 改用系統相機以支援裁切
    // 檢查權限
    const camPermission = await ImagePicker.requestCameraPermissionsAsync();
    if (!camPermission.granted) {
      Alert.alert("Permission required", "Please allow camera access.");
      return;
    }

    if (!processing) {
      setProcessing(true);
      try {
        const result = await ImagePicker.launchCameraAsync({
          // [修正] 改回 MediaTypeOptions 以解決 undefined 錯誤
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          quality: 0.8,
          base64: true,
        });

        if (!result.canceled) {
          router.push({
            pathname: "/food-recognition",
            params: { imageUri: result.assets[0].uri, base64: result.assets[0].base64, mode: "AI" }
          });
        }
      } catch (error) {
        Alert.alert("Error", "Failed to take picture");
        console.error(error);
      } finally {
        setProcessing(false);
      }
    }
  };

  const pickImage = async () => {
    if (!processing) {
      setProcessing(true);
      try {
        const result = await ImagePicker.launchImageLibraryAsync({
          // [修正] 改回 MediaTypeOptions
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          quality: 0.8,
          base64: true,
        });

        if (!result.canceled) {
          router.push({
            pathname: "/food-recognition",
            params: { imageUri: result.assets[0].uri, base64: result.assets[0].base64, mode: "AI" }
          });
        }
      } catch (error) {
        Alert.alert("Error", "Failed to pick image");
        console.error(error);
      } finally {
        setProcessing(false);
      }
    }
  };

  return (
    <View style={styles.container}>
      <CameraView style={StyleSheet.absoluteFill} ref={cameraRef} />
      
      <View style={styles.overlay}>
        <View style={styles.buttonContainer}>
          <Pressable style={styles.button} onPress={() => router.back()} disabled={processing}>
            <Ionicons name="close" size={32} color="white" />
          </Pressable>
          
          {/* 拍照按鈕 */}
          <Pressable style={styles.captureBtn} onPress={takePicture} disabled={processing}>
            {processing ? <ActivityIndicator color="black" /> : <View style={styles.innerCircle} />}
          </Pressable>
          
          {/* 相簿按鈕 */}
          <Pressable style={styles.button} onPress={pickImage} disabled={processing}>
            <Ionicons name="images" size={32} color="white" />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'black' },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    paddingBottom: 50,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  button: { 
    alignItems: 'center', 
    padding: 10 
  },
  captureBtn: {
    width: 70, height: 70, borderRadius: 35, backgroundColor: 'rgba(255,255,255,0.8)',
    justifyContent: 'center', alignItems: 'center'
  },
  innerCircle: { width: 60, height: 60, borderRadius: 30, backgroundColor: 'white', borderWidth: 2, borderColor: '#ddd' },
});