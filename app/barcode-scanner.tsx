import { CameraView, useCameraPermissions } from "expo-camera";
import { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View, Dimensions } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { t, useLanguage } from "@/lib/i18n";

const { width } = Dimensions.get("window");
const SCAN_SIZE = width * 0.7;

export default function BarcodeScannerScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const router = useRouter();
  const lang = useLanguage();

  if (!permission) return <View />;
  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={{ textAlign: 'center', marginBottom: 20, color: '#fff' }}>
          {t('camera', lang)} Permission Required
        </Text>
        <TouchableOpacity onPress={requestPermission} style={styles.permissionBtn}>
          <Text style={{ color: '#000' }}>Allow</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const handleBarCodeScanned = ({ type, data }: { type: string; data: string }) => {
    if (scanned) return;
    setScanned(true);
    router.push({
        pathname: "/food-editor",
        params: { barcode: data }
    });
    setTimeout(() => setScanned(false), 2000);
  };

  return (
    <SafeAreaView style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFillObject}
        facing="back"
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
        barcodeScannerSettings={{
            barcodeTypes: ["ean13", "ean8", "upc_a", "upc_e", "qr"],
        }}
      />
      <View style={styles.overlay}>
          <TouchableOpacity style={styles.closeBtn} onPress={() => router.back()}>
             <Ionicons name="close" size={30} color="white" />
          </TouchableOpacity>
          <View style={styles.scanFrameContainer}>
              <View style={styles.scanFrame} />
              <Text style={styles.hintText}>{t('scan_hint', lang)}</Text>
          </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "black" },
  permissionBtn: { backgroundColor: 'white', padding: 15, borderRadius: 10 },
  overlay: { flex: 1, justifyContent: "space-between", padding: 20 },
  closeBtn: { alignSelf: 'flex-start', marginTop: 10, padding: 10, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20 },
  scanFrameContainer: { alignItems: 'center', justifyContent: 'center', flex: 1 },
  scanFrame: {
    width: SCAN_SIZE,
    height: SCAN_SIZE / 1.5,
    borderWidth: 2,
    borderColor: '#34C759',
    borderRadius: 20,
    backgroundColor: 'transparent',
  },
  hintText: { color: 'white', marginTop: 20, fontSize: 16, fontWeight: 'bold', textShadowColor: 'black', textShadowRadius: 5 },
});