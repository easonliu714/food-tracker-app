import { CameraView, useCameraPermissions } from 'expo-camera';
import { useState } from 'react';
import { Button, StyleSheet, View, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { getProductByBarcode, saveProductLocal } from '@/lib/storage';
import { t, useLanguage } from '@/lib/i18n';

export default function BarcodeScannerScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [loading, setLoading] = useState(false);
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
    setLoading(true);

    // 1. 檢查本地資料庫
    const localProduct = await getProductByBarcode(data);
    if (localProduct) {
      setLoading(false);
      router.replace({ pathname: "/barcode-product", params: { barcode: data } });
      return;
    }

    // 2. 檢查 OpenFoodFacts
    try {
      const response = await fetch(`https://world.openfoodfacts.org/api/v0/product/${data}.json`);
      const json = await response.json();
      
      if (json.status === 1 && json.product) {
        const p = json.product;
        // 儲存到本地
        const productData = {
          barcode: data,
          foodName: p.product_name || "Unknown Product",
          calories: p.nutriments?.['energy-kcal_100g'] || 0,
          protein: p.nutriments?.proteins_100g || 0,
          carbs: p.nutriments?.carbohydrates_100g || 0,
          fat: p.nutriments?.fat_100g || 0,
          sodium: (p.nutriments?.sodium_100g || 0) * 1000,
          servingSize: 100, // 預設 100g
          unit: 'g'
        };
        await saveProductLocal(data, productData);
        setLoading(false);
        router.replace({ pathname: "/barcode-product", params: { barcode: data } });
        return;
      }
    } catch (e) {
      console.log("OpenFoodFacts error:", e);
    }

    setLoading(false);
    // 3. 查無資料，提示使用相機 OCR
    Alert.alert(
      t('scan_failed_title', lang),
      `${t('scan_failed_msg', lang)}`,
      [
        { text: "OK", onPress: () => setScanned(false) },
        { 
          text: t('use_camera', lang), 
          onPress: () => router.replace({ pathname: '/camera', params: { source: 'barcode_fallback' } }) 
        }
      ]
    );
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
        {loading && <ActivityIndicator size="large" color="white" style={{marginTop: 20}} />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center' },
  overlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },
  box: { width: 250, height: 250, borderWidth: 2, borderColor: 'white', backgroundColor: 'transparent' }
});