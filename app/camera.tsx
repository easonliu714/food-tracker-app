import { useState } from "react";
import { StyleSheet, View, TouchableOpacity, Alert, ActivityIndicator } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { ThemedText } from "@/components/themed-text";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { t, useLanguage } from "@/lib/i18n";

export default function CameraScreen() {
  const router = useRouter();
  // 接收上一個頁面 (Scanner) 傳來的 barcode，以便稍後綁定
  const { barcode, mode } = useLocalSearchParams(); 

  const colorScheme = useColorScheme() ?? "light";
  const theme = Colors[colorScheme];
  const lang = useLanguage(); 
  const [isLoading, setIsLoading] = useState(false);

  const handleImageSelection = async (source: 'camera' | 'gallery') => {
    setIsLoading(true);
    try {
      let result;
      const options: ImagePicker.ImagePickerOptions = {
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true, // 開啟裁切
        quality: 0.8,
        base64: true,
      };

      if (source === 'camera') {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
          Alert.alert(t('error', lang), "Camera permission needed");
          setIsLoading(false);
          return;
        }
        result = await ImagePicker.launchCameraAsync(options);
      } else {
        result = await ImagePicker.launchImageLibraryAsync(options);
      }

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        
        // [修正] 拍攝後直接跳轉到 food-editor (統一介面)
        // 帶入 analyze: "true" 參數，讓編輯器知道要自動觸發 Gemini
        router.push({
          pathname: "/food-editor",
          params: {
            imageUri: asset.uri,
            imageBase64: asset.base64, // 傳遞 base64 給 AI 分析
            analyze: "true",           // 標記需要自動分析
            barcode: barcode           // 傳遞條碼以建立關聯
          }
        });
      }
    } catch (e) {
      console.error(e);
      Alert.alert(t('error', lang), "Failed to pick image");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
          <Ionicons name="close" size={30} color={theme.text} />
        </TouchableOpacity>
        <ThemedText type="subtitle">{t('camera', lang)}</ThemedText>
        <View style={{ width: 30 }} />
      </View>

      <View style={styles.content}>
        {isLoading ? (
          <ActivityIndicator size="large" color={theme.tint} style={{marginTop: 50}} />
        ) : (
          <View style={styles.actionContainer}>
            <View style={{alignItems:'center', marginBottom: 40}}>
                <Ionicons name="scan-outline" size={80} color={theme.text} style={{opacity:0.2}}/>
                {barcode && <ThemedText style={{marginTop:10, color:theme.tint}}>Linked Barcode: {barcode}</ThemedText>}
            </View>

            <TouchableOpacity style={[styles.btn, { backgroundColor: theme.tint }]} onPress={() => handleImageSelection('camera')}>
              <Ionicons name="camera" size={24} color="#FFF" style={{marginRight: 10}}/>
              <ThemedText style={styles.btnText}>{t('camera', lang)}</ThemedText>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.btn, { backgroundColor: theme.cardBackground, borderWidth: 1, borderColor: theme.icon }]} onPress={() => handleImageSelection('gallery')}>
              <Ionicons name="images" size={24} color={theme.text} style={{marginRight: 10}}/>
              <ThemedText style={[styles.btnText, {color: theme.text}]}>{t('gallery', lang)}</ThemedText>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20 },
  closeBtn: { padding: 5 },
  content: { flex: 1, justifyContent: 'center', paddingHorizontal: 30 },
  actionContainer: { gap: 20 },
  btn: { flexDirection: 'row', padding: 18, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  btnText: { fontSize: 16, fontWeight: 'bold', color: '#FFF' }
});