import { CameraView, useCameraPermissions } from 'expo-camera';
import { useState } from 'react';
import { Button, StyleSheet, View, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { getProductByBarcode } from '@/lib/storage';
import { t, useLanguage } from '@/lib/i18n';

export default function BarcodeScannerScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const router = useRouter();
  const lang = useLanguage();

  if (!permission) return <View />;
  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <ThemedText style={{ textAlign: 'center' }}>We need your permission to show the camera</ThemedText>
        <Button onPress={requestPermission} title="grant permission" />
      </View>
    );
  }

  const handleBarCodeScanned = async ({ type, data }: any) => {
    setScanned(true);
    const product = await getProductByBarcode(data);
    
    if (product) {
      router.replace({
        pathname: "/barcode-product",
        params: { barcode: data }
      });
    } else {
      Alert.alert(
        t('scan_failed_title', lang),
        `${t('scan_failed_msg', lang)} (${data})`,
        [
          { text: "OK", onPress: () => setScanned(false) },
          { 
            text: t('use_camera', lang), 
            // 傳遞 source=barcode_fallback 參數，讓 food-recognition 知道要切換 Prompt
            onPress: () => router.replace({ pathname: '/camera', params: { source: 'barcode_fallback' } }) 
          }
        ]
      );
    }
  };

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFillObject}
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
        barcodeScannerSettings={{
          barcodeTypes: ["qr", "ean13", "ean8", "upc_a", "upc_e"],
        }}
      />
      <View style={styles.overlay}>
        <ThemedText style={{color: 'white', fontSize: 18, fontWeight: 'bold'}}>{t('scan', lang)}</ThemedText>
        <View style={styles.box} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center' },
  overlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },
  box: { width: 250, height: 250, borderWidth: 2, borderColor: 'white', backgroundColor: 'transparent' }
});