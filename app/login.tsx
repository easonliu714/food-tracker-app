import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useState } from "react";
import { ActivityIndicator, Platform, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { getLoginUrl } from "@/constants/oauth";
import { useAuth } from "@/hooks/use-auth";
import { useThemeColor } from "@/hooks/use-theme-color";

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, isAuthenticated } = useAuth();
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const backgroundColor = useThemeColor({}, "background");
  const tintColor = useThemeColor({}, "tint");
  const textSecondary = useThemeColor({}, "textSecondary");

  // If already logged in, redirect to home
  if (isAuthenticated && user) {
    router.replace("/");
    return null;
  }

  const handleLogin = async () => {
    try {
      console.log("[Auth] Login button clicked");
      setIsLoggingIn(true);
      const loginUrl = getLoginUrl();
      console.log("[Auth] Generated login URL:", loginUrl);

      // On web, use direct redirect in same tab
      // On mobile, use WebBrowser to open OAuth in a separate context
      if (Platform.OS === "web") {
        console.log("[Auth] Web platform: redirecting to OAuth in same tab...");
        window.location.href = loginUrl;
        return;
      }

      // Mobile: Open OAuth URL in browser
      console.log("[Auth] Opening OAuth URL in browser...");
      const result = await WebBrowser.openAuthSessionAsync(loginUrl, undefined, {
        preferEphemeralSession: false,
        showInRecents: true,
      });

      console.log("[Auth] WebBrowser result:", result);
      if (result.type === "cancel") {
        console.log("[Auth] OAuth cancelled by user");
      } else if (result.type === "dismiss") {
        console.log("[Auth] OAuth dismissed");
      } else if (result.type === "success" && result.url) {
        console.log("[Auth] OAuth session successful, navigating to callback:", result.url);
        // Extract code and state from the URL
        try {
          let url: URL;
          if (result.url.startsWith("exp://") || result.url.startsWith("exps://")) {
            const urlStr = result.url.replace(/^exp(s)?:\/\//, "http://");
            url = new URL(urlStr);
          } else {
            url = new URL(result.url);
          }

          const code = url.searchParams.get("code");
          const state = url.searchParams.get("state");
          const error = url.searchParams.get("error");

          console.log("[Auth] Extracted params from callback URL:", {
            code: code?.substring(0, 20) + "...",
            state: state?.substring(0, 20) + "...",
            error,
          });

          if (error) {
            console.error("[Auth] OAuth error in callback:", error);
            return;
          }

          if (code && state) {
            console.log("[Auth] Navigating to callback route with params...");
            router.push({
              pathname: "/oauth/callback" as any,
              params: { code, state },
            });
          } else {
            console.error("[Auth] Missing code or state in callback URL");
          }
        } catch (err) {
          console.error("[Auth] Failed to parse callback URL:", err, result.url);
          const codeMatch = result.url.match(/[?&]code=([^&]+)/);
          const stateMatch = result.url.match(/[?&]state=([^&]+)/);

          if (codeMatch && stateMatch) {
            const code = decodeURIComponent(codeMatch[1]);
            const state = decodeURIComponent(stateMatch[1]);
            console.log("[Auth] Fallback: extracted params via regex, navigating...");
            router.push({
              pathname: "/oauth/callback" as any,
              params: { code, state },
            });
          } else {
            console.error("[Auth] Could not extract code/state from URL");
          }
        }
      }
    } catch (error) {
      console.error("[Auth] Login error:", error);
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <View
        style={[
          styles.content,
          {
            paddingTop: Math.max(insets.top, 40),
            paddingBottom: Math.max(insets.bottom, 40),
          },
        ]}
      >
        {/* Back button */}
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={tintColor} />
        </Pressable>

        {/* Logo and title */}
        <View style={styles.header}>
          <Ionicons name="nutrition" size={100} color={tintColor} style={{ marginBottom: 24 }} />
          <ThemedText type="title" style={styles.title}>
            營養追蹤
          </ThemedText>
          <ThemedText style={[styles.subtitle, { color: textSecondary }]}>
            追蹤您的飲食,達成健康目標
          </ThemedText>
        </View>

        {/* Features */}
        <View style={styles.features}>
          <View style={styles.feature}>
            <Ionicons name="camera" size={32} color={tintColor} />
            <ThemedText style={styles.featureText}>拍照識別食物營養</ThemedText>
          </View>
          <View style={styles.feature}>
            <Ionicons name="barcode-outline" size={32} color={tintColor} />
            <ThemedText style={styles.featureText}>掃描條碼快速記錄</ThemedText>
          </View>
          <View style={styles.feature}>
            <Ionicons name="stats-chart" size={32} color={tintColor} />
            <ThemedText style={styles.featureText}>追蹤卡路里與營養</ThemedText>
          </View>
          <View style={styles.feature}>
            <Ionicons name="restaurant" size={32} color={tintColor} />
            <ThemedText style={styles.featureText}>個人化食譜建議</ThemedText>
          </View>
        </View>

        {/* Login button */}
        <Pressable
          onPress={handleLogin}
          disabled={isLoggingIn}
          style={[
            styles.loginButton,
            { backgroundColor: tintColor },
            isLoggingIn && styles.loginButtonDisabled,
          ]}
        >
          {isLoggingIn ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <ThemedText style={styles.loginButtonText}>開始使用</ThemedText>
          )}
        </Pressable>

        <ThemedText style={[styles.hint, { color: textSecondary }]}>
          使用 Manus 帳號登入
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 32,
    justifyContent: "space-between",
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "flex-start",
  },
  header: {
    alignItems: "center",
    marginTop: -40,
  },
  title: {
    fontSize: 36,
    marginBottom: 12,
    lineHeight: 42,
  },
  subtitle: {
    fontSize: 16,
    textAlign: "center",
    lineHeight: 22,
  },
  features: {
    gap: 24,
  },
  feature: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  featureText: {
    fontSize: 16,
    lineHeight: 22,
  },
  loginButton: {
    paddingVertical: 18,
    borderRadius: 14,
    alignItems: "center",
    minHeight: 56,
  },
  loginButtonText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "600",
    lineHeight: 24,
  },
  loginButtonDisabled: {
    opacity: 0.6,
  },
  hint: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 18,
  },
});
