import { CameraView, useCameraPermissions } from 'expo-camera';
import { useState, useRef } from 'react';
import { StyleSheet, View, Pressable, Alert, ActivityIndicator, Text } from 'react-native';
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
    if (cameraRef.current && !processing) {
      setProcessing(true);
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
        setProcessing(false);
      }
    }
  };

  const pickImage = async () => {
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
      <CameraView style={StyleSheet.absoluteFill} ref={cameraRef} />
      
      {/* 覆蓋層：控制按鈕 (移出 CameraView 以解決警告) */}
      <View style={styles.overlay}>
        <View style={styles.buttonContainer}>
          <Pressable style={styles.button} onPress={() => router.back()} disabled={processing}>
            <Ionicons name="close" size={32} color="white" />
          </Pressable>
          
          <Pressable style={styles.captureBtn} onPress={takePicture} disabled={processing}>
            {processing ? <ActivityIndicator color="black" /> : <View style={styles.innerCircle} />}
          </Pressable>
          
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