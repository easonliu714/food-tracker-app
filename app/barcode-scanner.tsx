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
    if (scanned) return;
    
    // [修正] 忽略 URL 格式 (防止誤掃 QR Code)
    if (data.startsWith('http') || data.startsWith('www')) {
      return; 
    }

    setScanned(true);
    console.log(`[Scanner] Scanned: ${data} (${type})`);
    
    // 1. 檢查本地資料庫
    const localProduct = await getProductByBarcode(data);
    if (localProduct) {
      router.push({ pathname: "/food-recognition", params: { mode: "BARCODE", barcode: data } });
      return;
    }

    // 2. 查詢 Open Food Facts
    try {
      const response = await fetch(`https://world.openfoodfacts.org/api/v0/product/${data}.json`);
      const json = await response.json();
      
      if (json.status === 1 && json.product) {
        const p = json.product;
        const n = p.nutriments || {};
        
        // [修正] 加強 OFF 資料對應，防止 undefined
        const externalData = {
          foodName: p.product_name || p.product_name_en || "Unknown Product",
          calories_100g: n["energy-kcal_100g"] || n["energy-kcal"] || 0,
          protein_100g: n.proteins_100g || n.proteins || 0,
          carbs_100g: n.carbohydrates_100g || n.carbohydrates || 0,
          fat_100g: n.fat_100g || n.fat || 0,
          sodium_100g: (n.salt_100g || n.salt || 0) * 400, // salt g to sodium mg
          sugar_100g: n.sugars_100g || n.sugars || 0,
          saturated_fat_100g: n["saturated-fat_100g"] || 0,
          trans_fat_100g: n["trans-fat_100g"] || 0,
          cholesterol_100g: n.cholesterol_100g ? n.cholesterol_100g * 1000 : 0, 
        };
        
        router.push({ 
          pathname: "/food-recognition", 
          params: { 
            mode: "EXTERNAL_DB", 
            barcode: data, 
            initialData: JSON.stringify(externalData) 
          } 
        });
        return;
      }
    } catch (e) {
      console.log("OFF Error", e);
    }

    // 3. 查無資料，引導手動/AI
    Alert.alert(
      t('scan_failed', lang),
      `${t('scan_failed_msg', lang)}\n(條碼: ${data})`, 
      [
        { text: t('input_manual', lang), onPress: () => router.push({ pathname: "/food-recognition", params: { mode: "MANUAL", barcode: data } }) },
        { text: t('scan_ai_label', lang), onPress: () => router.push({ pathname: "/camera", params: { barcode: data } }) },
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
          barcodeTypes: ["ean13", "ean8", "upc_a", "upc_e"], // 僅掃描商品條碼
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