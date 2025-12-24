import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from 'react';
import { StyleSheet, View, Pressable, Alert, Text, ActivityIndicator } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';

export default function CameraScreen() {
  const router = useRouter();
  const [processing, setProcessing] = useState(false);
  
  // [修正] 接收上頁傳來的 barcode (若有)
  const { barcode } = useLocalSearchParams();

  const takePicture = async () => {
    // 檢查系統相機權限
    const camPermission = await ImagePicker.requestCameraPermissionsAsync();
    if (!camPermission.granted) {
      Alert.alert("需要權限", "請允許使用相機以進行拍照");
      return;
    }

    if (!processing) {
      setProcessing(true);
      try {
        // 呼叫系統相機
        const result = await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true, // 啟用裁切
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
              barcode: barcode // [修正] 將條碼繼續傳遞下去
            }
          });
        }
      } catch (error) {
        Alert.alert("錯誤", "拍照失敗");
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
              barcode: barcode // [修正] 將條碼繼續傳遞下去
            }
          });
        }
      } catch (error) {
        Alert.alert("錯誤", "選取圖片失敗");
        console.error(error);
      } finally {
        setProcessing(false);
      }
    }
  };

  return (
    <View style={styles.container}>
      {/* 頂部標題區 */}
      <View style={styles.header}>
        <Text style={styles.title}>選擇輸入方式</Text>
        <Text style={styles.subtitle}>
          {barcode ? `正在為條碼 ${barcode} 建立資料` : "透過 AI 分析影像中的營養成分"}
        </Text>
      </View>

      {/* 中間功能按鈕區 */}
      {processing ? (
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#2196F3" />
          <Text style={{marginTop: 20, color:'#ccc'}}>處理中...</Text>
        </View>
      ) : (
        <View style={styles.centerContent}>
          <Pressable style={styles.largeButton} onPress={takePicture}>
            <View style={[styles.iconCircle, {backgroundColor: '#E3F2FD'}]}>
              <Ionicons name="camera" size={48} color="#2196F3" />
            </View>
            <Text style={styles.btnTitle}>開啟相機</Text>
            <Text style={styles.btnDesc}>拍照並裁切營養標示</Text>
          </Pressable>

          <View style={styles.divider} />

          <Pressable style={styles.largeButton} onPress={pickImage}>
            <View style={[styles.iconCircle, {backgroundColor: '#FFF3E0'}]}>
              <Ionicons name="images" size={48} color="#FF9800" />
            </View>
            <Text style={styles.btnTitle}>讀取相簿</Text>
            <Text style={styles.btnDesc}>從現有照片中選取</Text>
          </Pressable>
        </View>
      )}

      {/* 底部關閉按鈕 */}
      <Pressable style={styles.closeBtn} onPress={() => router.back()} disabled={processing}>
        <Ionicons name="close-circle-outline" size={48} color="#666" />
        <Text style={{color:'#666'}}>取消</Text>
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