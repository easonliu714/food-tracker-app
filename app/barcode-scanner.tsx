import { CameraView, useCameraPermissions } from 'expo-camera';
import { useState } from 'react';
import { Button, StyleSheet, Text, View, Alert, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { getProductByBarcode } from '@/lib/storage';
import { t, useLanguage } from '@/lib/i18n';
import { Ionicons } from '@expo/vector-icons';

export default function BarcodeScannerScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const router = useRouter();
  const lang = useLanguage();

  if (!permission) return <View />;
  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={{ textAlign: 'center' }}>We need your permission to show the camera</Text>
        <Button onPress={requestPermission} title="grant permission" />
      </View>
    );
  }

  const handleBarCodeScanned = async ({ type, data }: { type: string, data: string }) => {
    setScanned(true);
    
    // 1. 檢查本地資料庫
    const localProduct = await getProductByBarcode(data);
    if (localProduct) {
      // 確保將條碼傳遞過去
      router.push({ pathname: "/food-recognition", params: { mode: "BARCODE", barcode: data } });
      return;
    }

    // 2. 查詢 OpenFoodFacts
    try {
      const response = await fetch(`https://world.openfoodfacts.org/api/v0/product/${data}.json`);
      const json = await response.json();
      
      if (json.status === 1 && json.product) {
        const p = json.product;
        const externalData = {
          foodName: p.product_name || p.product_name_en || "Unknown Product",
          calories_100g: p.nutriments?.["energy-kcal_100g"] || 0,
          protein_100g: p.nutriments?.proteins_100g || 0,
          carbs_100g: p.nutriments?.carbohydrates_100g || 0,
          fat_100g: p.nutriments?.fat_100g || 0,
          sodium_100g: (p.nutriments?.salt_100g || 0) * 400,
        };
        
        router.push({ 
          pathname: "/food-recognition", 
          params: { 
            mode: "EXTERNAL_DB", 
            barcode: data, // 確保傳遞 barcode
            initialData: JSON.stringify(externalData) 
          } 
        });
        return;
      }
    } catch (e) {
      console.log("External DB Error", e);
    }

    // 3. 查無資料
    Alert.alert(
      t('scan_failed', lang),
      `${t('scan_failed_msg', lang)}\n(條碼: ${data})`, // 顯示條碼
      [
        { text: t('input_manual', lang), onPress: () => router.push({ pathname: "/food-recognition", params: { mode: "MANUAL", barcode: data } }) },
        { text: t('scan_ai_label', lang), onPress: () => router.push({ pathname: "/camera" }) },
        { text: "Cancel", style: "cancel", onPress: () => setScanned(false) }
      ]
    );
  };

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFillObject}
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
        barcodeScannerSettings={{
          barcodeTypes: ["qr", "ean13", "ean8", "upc_a"],
        }}
      />
      <View style={styles.overlay}>
        <Text style={styles.text}>{t('scan', lang)}</Text>
        <Pressable onPress={() => router.back()} style={{marginTop: 20}}>
          <Ionicons name="close-circle" size={48} color="white"/>
        </Pressable>
      </View>
      {scanned && <Button title={'Tap to Scan Again'} onPress={() => setScanned(false)} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center' },
  overlay: { position: 'absolute', top: 50, width: '100%', alignItems: 'center' },
  text: { color: 'white', fontSize: 20, fontWeight: 'bold', backgroundColor: 'rgba(0,0,0,0.5)', padding: 10, borderRadius: 8 }
});