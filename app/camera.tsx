import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from 'react';
import { StyleSheet, View, Pressable, Alert, Text, ActivityIndicator } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { t, tParams, useLanguage } from '@/lib/i18n';

export default function CameraScreen() {
  const router = useRouter();
  const [processing, setProcessing] = useState(false);
  const { barcode } = useLocalSearchParams();
  const lang = useLanguage();

  const takePicture = async () => {
    const camPermission = await ImagePicker.requestCameraPermissionsAsync();
    if (!camPermission.granted) {
      Alert.alert(t('permission_required', lang), t('camera_permission_msg', lang));
      return;
    }

    if (!processing) {
      setProcessing(true);
      try {
        const result = await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          quality: 0.8,
          base64: true,
        });

        if (!result.canceled) {
          router.push({
            pathname: "/food-recognition",
            params: { 
              imageUri: result.assets[0].uri, 
              base64: result.assets[0].base64, 
              mode: "AI",
              barcode: barcode 
            }
          });
        }
      } catch (error) {
        Alert.alert(t('error_title', lang), t('capture_failed', lang));
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
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          quality: 0.8,
          base64: true,
        });

        if (!result.canceled) {
          router.push({
            pathname: "/food-recognition",
            params: { 
              imageUri: result.assets[0].uri, 
              base64: result.assets[0].base64, 
              mode: "AI",
              barcode: barcode
            }
          });
        }
      } catch (error) {
        Alert.alert(t('error_title', lang), t('pick_failed', lang));
      } finally {
        setProcessing(false);
      }
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('camera_option_title', lang)}</Text>
        <Text style={styles.subtitle}>
          {barcode 
            ? tParams('camera_option_subtitle_barcode', {barcode: barcode as string}, lang) 
            : t('camera_option_subtitle', lang)}
        </Text>
      </View>

      {processing ? (
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#2196F3" />
          <Text style={{marginTop: 20, color:'#ccc'}}>{t('processing', lang)}</Text>
        </View>
      ) : (
        <View style={styles.centerContent}>
          <Pressable style={styles.largeButton} onPress={takePicture}>
            <View style={[styles.iconCircle, {backgroundColor: '#E3F2FD'}]}>
              <Ionicons name="camera" size={48} color="#2196F3" />
            </View>
            <Text style={styles.btnTitle}>{t('open_camera', lang)}</Text>
            <Text style={styles.btnDesc}>{t('open_camera_desc', lang)}</Text>
          </Pressable>

          <View style={styles.divider} />

          <Pressable style={styles.largeButton} onPress={pickImage}>
            <View style={[styles.iconCircle, {backgroundColor: '#FFF3E0'}]}>
              <Ionicons name="images" size={48} color="#FF9800" />
            </View>
            <Text style={styles.btnTitle}>{t('open_gallery', lang)}</Text>
            <Text style={styles.btnDesc}>{t('open_gallery_desc', lang)}</Text>
          </Pressable>
        </View>
      )}

      <Pressable style={styles.closeBtn} onPress={() => router.back()} disabled={processing}>
        <Ionicons name="close-circle-outline" size={48} color="#666" />
        <Text style={{color:'#666'}}>{t('cancel', lang)}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 60 },
  header: { alignItems: 'center', marginTop: 20 },
  title: { color: 'white', fontSize: 24, fontWeight: 'bold', marginBottom: 8 },
  subtitle: { color: '#aaa', fontSize: 14 },
  centerContent: { width: '100%', alignItems: 'center', gap: 30 },
  largeButton: { alignItems: 'center', width: 200 },
  iconCircle: { width: 100, height: 100, borderRadius: 50, justifyContent: 'center', alignItems: 'center', marginBottom: 15 },
  btnTitle: { color: 'white', fontSize: 20, fontWeight: 'bold', marginBottom: 5 },
  btnDesc: { color: '#888', fontSize: 14 },
  divider: { height: 1, width: '40%', backgroundColor: '#333' },
  closeBtn: { alignItems: 'center', opacity: 0.8 }
});