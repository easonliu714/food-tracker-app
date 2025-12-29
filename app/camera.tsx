import { useState } from "react";
import { StyleSheet, View, TouchableOpacity, Alert, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { ThemedText } from "@/components/themed-text";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { t, useLanguage } from "@/lib/i18n"; // 引入 i18n

export default function CameraScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? "light";
  const theme = Colors[colorScheme];
  const lang = useLanguage(); // 取得當前語言
  const [isLoading, setIsLoading] = useState(false);

  const handleImageSelection = async (mode: 'camera' | 'gallery') => {
    setIsLoading(true);
    try {
      let result;
      // [修正] 移除 aspect 選項，允許自由裁切
      const options: ImagePicker.ImagePickerOptions = {
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true, // 開啟系統圖框
        // aspect: undefined, // 預設就是 undefined (自由比例)
        quality: 0.8,
        base64: true,
      };

      if (mode === 'camera') {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
          Alert.alert(t('camera', lang), "需要權限");
          setIsLoading(false);
          return;
        }
        result = await ImagePicker.launchCameraAsync(options);
      } else {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
          Alert.alert(t('gallery', lang), "需要權限");
          setIsLoading(false);
          return;
        }
        result = await ImagePicker.launchImageLibraryAsync(options);
      }

      if (!result.canceled && result.assets && result.assets.length > 0) {
        router.push({
          pathname: "/food-editor",
          params: { 
            imageUri: result.assets[0].uri,
            imageBase64: result.assets[0].base64,
            analyze: "true" 
          } 
        });
      }
    } catch (e) {
      console.error(e);
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
        <ThemedText type="subtitle">{t('ai_analysis', lang)}</ThemedText>
        <View style={{ width: 30 }} />
      </View>

      <View style={styles.content}>
        <View style={styles.illustration}>
           <Ionicons name="scan-outline" size={100} color={theme.icon} />
           <ThemedText style={{marginTop: 20, textAlign:'center', color: theme.icon}}>
             {t('camera', lang)} / {t('gallery', lang)}
           </ThemedText>
        </View>

        {isLoading ? (
          <ActivityIndicator size="large" color={theme.tint} style={{marginTop: 50}} />
        ) : (
          <View style={styles.actionContainer}>
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
  illustration: { alignItems: 'center', marginBottom: 60 },
  actionContainer: { gap: 20 },
  btn: { flexDirection: 'row', padding: 18, borderRadius: 16, alignItems: 'center', justifyContent: 'center', elevation: 2 },
  btnText: { fontSize: 18, fontWeight: '600', color: '#FFF' }
});