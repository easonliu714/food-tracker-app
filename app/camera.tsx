import { useState } from "react";
import { StyleSheet, View, TouchableOpacity, Alert, ActivityIndicator, Image } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { ThemedText } from "@/components/themed-text";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";

export default function CameraScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? "light";
  const theme = Colors[colorScheme];
  const [isLoading, setIsLoading] = useState(false);

  // 處理影像選擇與裁切
  const handleImageSelection = async (mode: 'camera' | 'gallery') => {
    setIsLoading(true);
    try {
      let result;
      const options: ImagePicker.ImagePickerOptions = {
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true, // 開啟系統圖框編輯
        aspect: [4, 3],      // 預設比例，用戶可調整
        quality: 0.8,
        base64: true,        // 為了 AI 分析準備
      };

      if (mode === 'camera') {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
          Alert.alert("權限不足", "需要相機權限才能拍攝食物");
          setIsLoading(false);
          return;
        }
        result = await ImagePicker.launchCameraAsync(options);
      } else {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
          Alert.alert("權限不足", "需要相簿權限才能選取照片");
          setIsLoading(false);
          return;
        }
        result = await ImagePicker.launchImageLibraryAsync(options);
      }

      if (!result.canceled && result.assets && result.assets.length > 0) {
        // 取得圖片後，導向編輯頁面，並標記需要進行 AI 分析
        router.push({
          pathname: "/food-editor",
          params: { 
            imageUri: result.assets[0].uri,
            imageBase64: result.assets[0].base64, // 傳遞 base64 給 AI
            analyze: "true" // 標記進入後自動分析
          } 
        });
      }
    } catch (e) {
      console.error(e);
      Alert.alert("錯誤", "無法處理影像");
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
        <ThemedText type="subtitle">新增飲食紀錄</ThemedText>
        <View style={{ width: 30 }} />
      </View>

      <View style={styles.content}>
        <View style={styles.illustration}>
           <Ionicons name="fast-food-outline" size={100} color={theme.icon} />
           <ThemedText style={{marginTop: 20, textAlign:'center', color: theme.icon}}>
             拍攝食物或從相簿選取{'\n'}AI 將自動分析營養成分
           </ThemedText>
        </View>

        {isLoading ? (
          <ActivityIndicator size="large" color={theme.tint} style={{marginTop: 50}} />
        ) : (
          <View style={styles.actionContainer}>
            <TouchableOpacity 
              style={[styles.btn, { backgroundColor: theme.tint }]} 
              onPress={() => handleImageSelection('camera')}
            >
              <Ionicons name="camera" size={24} color="#FFF" style={{marginRight: 10}}/>
              <ThemedText style={styles.btnText}>開啟相機</ThemedText>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.btn, { backgroundColor: theme.cardBackground, borderWidth: 1, borderColor: theme.icon }]} 
              onPress={() => handleImageSelection('gallery')}
            >
              <Ionicons name="images" size={24} color={theme.text} style={{marginRight: 10}}/>
              <ThemedText style={[styles.btnText, {color: theme.text}]}>讀取相簿</ThemedText>
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