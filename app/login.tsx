import { useState } from "react";
import { View, TextInput, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ThemedText } from "@/components/themed-text";
import { useThemeColor } from "@/hooks/use-theme-color";
import { useAuth } from "@/hooks/use-auth";

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { login } = useAuth();
  const [name, setName] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const backgroundColor = useThemeColor({}, "background");
  const tintColor = useThemeColor({}, "tint");
  const textColor = useThemeColor({}, "text");

  const handleLogin = async () => {
    if (!name.trim()) return;
    setIsLoading(true);
    await login(name); // 使用本地登入
    setIsLoading(false);
  };

  return (
    <View style={[styles.container, { backgroundColor, paddingTop: insets.top }]}>
      <View style={styles.content}>
        <ThemedText type="title" style={styles.title}>歡迎使用</ThemedText>
        <ThemedText style={styles.subtitle}>營養追蹤單機版</ThemedText>
        
        <View style={styles.inputContainer}>
          <ThemedText style={styles.label}>請輸入您的暱稱</ThemedText>
          <TextInput
            style={[styles.input, { color: textColor, borderColor: tintColor }]}
            placeholder="例如: Eason"
            value={name}
            onChangeText={setName}
            placeholderTextColor="#888"
          />
        </View>

        <Pressable
          onPress={handleLogin}
          disabled={isLoading}
          style={[styles.button, { backgroundColor: tintColor }]}
        >
          {isLoading ? (
            <ActivityIndicator color="white" />
          ) : (
            <ThemedText style={styles.buttonText}>開始使用</ThemedText>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  content: { flex: 1, justifyContent: "center", alignItems: "center", gap: 20 },
  title: { fontSize: 32 },
  subtitle: { fontSize: 18, color: "#666", marginBottom: 30 },
  inputContainer: { width: "100%", gap: 10 },
  label: { fontSize: 16 },
  input: {
    width: "100%",
    padding: 15,
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 18,
  },
  button: {
    width: "100%",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 10,
  },
  buttonText: { color: "white", fontSize: 18, fontWeight: "bold" },
});