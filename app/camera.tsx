import { CameraView, CameraType, useCameraPermissions } from "expo-camera";
import { useRouter } from "expo-router";
import { useState, useRef } from "react";
import { Button, Pressable, StyleSheet, View, ActivityIndicator, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useThemeColor } from "@/hooks/use-theme-color";

export default function CameraScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [facing, setFacing] = useState<CameraType>("back");
  const [permission, requestPermission] = useCameraPermissions();
  const [isCapturing, setIsCapturing] = useState(false);
  const cameraRef = useRef<CameraView>(null);
  const backgroundColor = useThemeColor({}, "background");
  const tintColor = useThemeColor({}, "tint");

  if (!permission) {
    return (
      <ThemedView style={styles.container}>
        <ActivityIndicator size="large" />
      </ThemedView>
    );
  }

  if (!permission.granted) {
    return (
      <View style={[styles.container, { backgroundColor }]}>
        <View style={styles.permissionContainer}>
          <Ionicons name="camera-outline" size={80} color={tintColor} style={{ marginBottom: 24 }} />
          <ThemedText type="title" style={{ marginBottom: 16, fontSize: 28, lineHeight: 34, textAlign: "center" }}>
            需要相機權限
          </ThemedText>
          <ThemedText style={[styles.message, { textAlign: "center", marginBottom: 32 }]}>
            我們需要您的相機權限才能拍攝食物照片並識別營養資訊
          </ThemedText>
          <Pressable
            onPress={requestPermission}
            style={[styles.permissionButton, { backgroundColor: tintColor }]}
          >
            <ThemedText style={styles.permissionButtonText}>授予權限</ThemedText>
          </Pressable>
          <Pressable
            onPress={() => router.back()}
            style={styles.backLink}
          >
            <ThemedText style={[styles.backLinkText, { color: tintColor }]}>返回</ThemedText>
          </Pressable>
        </View>
      </View>
    );
  }

  function toggleCameraFacing() {
    setFacing((current) => (current === "back" ? "front" : "back"));
  }

  async function takePicture() {
    if (!cameraRef.current || isCapturing) return;

    try {
      setIsCapturing(true);
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        base64: false,
      });

      if (photo?.uri) {
        // Navigate to food recognition screen with the photo URI
        router.push({
          pathname: "/food-recognition",
          params: { imageUri: photo.uri },
        });
      }
    } catch (error) {
      console.error("Error taking picture:", error);
    } finally {
      setIsCapturing(false);
    }
  }

  async function pickImage() {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        router.push({
          pathname: "/food-recognition",
          params: { imageUri: result.assets[0].uri },
        });
      }
    } catch (error) {
      console.error("Error picking image:", error);
    }
  }

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing={facing}
        mode="picture"
      >
        {/* Top bar with back button */}
        <View
          style={[
            styles.topBar,
            {
              paddingTop: Math.max(insets.top, 20),
            },
          ]}
        >
          <Pressable onPress={() => router.back()} style={styles.iconButton}>
            <Ionicons name="close" size={32} color="#FFFFFF" />
          </Pressable>
          <View style={{ flex: 1 }} />
        </View>

        {/* Bottom controls */}
        <View
          style={[
            styles.bottomBar,
            {
              paddingBottom: Math.max(insets.bottom, 20),
            },
          ]}
        >
          {/* Gallery button */}
          <Pressable onPress={pickImage} style={styles.iconButton}>
            <Ionicons name="images-outline" size={32} color="#FFFFFF" />
          </Pressable>

          {/* Capture button */}
          <Pressable
            onPress={takePicture}
            disabled={isCapturing}
            style={({ pressed }) => [
              styles.captureButton,
              pressed && styles.captureButtonPressed,
              isCapturing && styles.captureButtonDisabled,
            ]}
          >
            <View style={styles.captureButtonInner} />
          </Pressable>

          {/* Flip camera button */}
          <Pressable onPress={toggleCameraFacing} style={styles.iconButton}>
            <Ionicons name="camera-reverse-outline" size={32} color="#FFFFFF" />
          </Pressable>
        </View>
      </CameraView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  camera: {
    flex: 1,
  },
  message: {
    textAlign: "center",
    paddingBottom: 10,
    fontSize: 16,
    lineHeight: 22,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingHorizontal: 40,
    paddingTop: 20,
  },
  iconButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "rgba(0, 0, 0, 0.3)",
    justifyContent: "center",
    alignItems: "center",
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 4,
    borderColor: "rgba(255, 255, 255, 0.5)",
  },
  captureButtonInner: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: "#FFFFFF",
  },
  captureButtonPressed: {
    transform: [{ scale: 0.95 }],
  },
  captureButtonDisabled: {
    opacity: 0.5,
  },
  permissionContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  permissionButton: {
    paddingVertical: 16,
    paddingHorizontal: 48,
    borderRadius: 12,
    minHeight: 52,
  },
  permissionButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
    lineHeight: 22,
  },
  backLink: {
    marginTop: 16,
    paddingVertical: 12,
  },
  backLinkText: {
    fontSize: 16,
    fontWeight: "500",
    lineHeight: 22,
  },
});
