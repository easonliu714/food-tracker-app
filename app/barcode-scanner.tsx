import { CameraView, useCameraPermissions } from "expo-camera";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Button, Pressable, StyleSheet, View, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useThemeColor } from "@/hooks/use-theme-color";

export default function BarcodeScannerScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
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
          <Ionicons name="barcode-outline" size={80} color={tintColor} style={{ marginBottom: 24 }} />
          <ThemedText type="title" style={{ marginBottom: 16, fontSize: 28, lineHeight: 34, textAlign: "center" }}>
            需要相機權限
          </ThemedText>
          <ThemedText style={[styles.message, { textAlign: "center", marginBottom: 32 }]}>
            我們需要您的相機權限才能掃描條碼並識別食品資訊
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

  const handleBarcodeScanned = ({ type, data }: { type: string; data: string }) => {
    if (scanned) return;
    setScanned(true);

    // Navigate to barcode product detail screen
    router.push({
      pathname: "/barcode-product",
      params: { barcode: data },
    });
  };

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <CameraView
        style={styles.camera}
        facing="back"
        onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
        barcodeScannerSettings={{
          barcodeTypes: [
            "ean13",
            "ean8",
            "upc_a",
            "upc_e",
            "code128",
            "code39",
            "qr",
          ],
        }}
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
        </View>

        {/* Scan frame */}
        <View style={styles.scanFrame}>
          <View style={styles.frameCorner} />
          <ThemedText style={styles.scanText}>將條碼對準框內</ThemedText>
        </View>

        {/* Rescan button */}
        {scanned && (
          <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 20) }]}>
            <Pressable
              onPress={() => setScanned(false)}
              style={[styles.rescanButton, { backgroundColor: tintColor }]}
            >
              <ThemedText style={styles.rescanButtonText}>重新掃描</ThemedText>
            </Pressable>
          </View>
        )}
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
  iconButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "rgba(0, 0, 0, 0.3)",
    justifyContent: "center",
    alignItems: "center",
  },
  scanFrame: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  frameCorner: {
    width: 250,
    height: 250,
    borderWidth: 2,
    borderColor: "#FFFFFF",
    borderRadius: 12,
  },
  scanText: {
    marginTop: 24,
    fontSize: 16,
    color: "#FFFFFF",
    textAlign: "center",
    lineHeight: 22,
  },
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: "center",
    paddingTop: 20,
  },
  rescanButton: {
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
    minHeight: 48,
  },
  rescanButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
    lineHeight: 22,
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
