// [START OF FILE app/barcode-scanner.tsx]
import { CameraView, useCameraPermissions } from "expo-camera";
import { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View, Dimensions, ActivityIndicator, Alert } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { t, useLanguage } from "@/lib/i18n";
// [FIX] 改用 SQLite 相關引用，而非 storage.ts
import { db } from "@/lib/db";
import { foodItems } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

const { width } = Dimensions.get("window");
const SCAN_SIZE = width * 0.7;

export default function BarcodeScannerScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
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

  const handleBarCodeScanned = async ({ type, data }: { type: string; data: string }) => {
    if (scanned || isLoading) return;
    setScanned(true);
    setIsLoading(true);

    try {
        // 1. [FIX] 優先查詢 SQLite 本機資料庫
        // 這確保了使用者剛編輯儲存的資料能被立刻叫出來
        const localItems = await db.select().from(foodItems).where(eq(foodItems.barcode, data)).limit(1);
        
        if (localItems.length > 0) {
            const localProd = localItems[0];
            // 整理格式 (Mapping DB schema to ProductData)
            const productData = {
                id: localProd.id, // 帶入 ID 以便編輯時更新同一筆
                name: localProd.name || "",
                brand: localProd.brand || "",
                stdWeight: "100", // DB 預設儲存每 100g 數值，所以基準為 100
                cal: String(localProd.calories || 0),
                pro: String(localProd.proteinG || 0),
                carb: String(localProd.carbsG || 0),
                fat: String(localProd.fatG || 0),
                sod: String(localProd.sodiumMg || 0),
                sugar: String(localProd.sugarG || 0),
                fiber: String(localProd.fiberG || 0),
                saturatedFat: String(localProd.saturatedFatG || 0),
                transFat: String(localProd.transFatG || 0),
                source: "local"
            };
            goToEditor(data, productData);
            return;
        }

        // 2. 若本機無資料，查詢 OpenFoodFacts (網路)
        const res = await fetch(`https://world.openfoodfacts.org/api/v0/product/${data}.json`);
        const result = await res.json();

        if (result.status === 1 && result.product) {
            const p = result.product;
            const n = p.nutriments || {};
            let w = 100;
            const match = (p.serving_size || "").match(/(\d+(\.\d+)?)/);
            if (match) w = parseFloat(match[0]);

            const productData = {
                name: p.product_name || t('unknown_product', lang),
                brand: p.brands || "",
                stdWeight: String(w),
                // OFF 回傳的是每 100g 數值
                cal: (n["energy-kcal_100g"] || 0).toString(),
                pro: (n.proteins_100g || 0).toString(),
                carb: (n.carbohydrates_100g || 0).toString(),
                fat: (n.fat_100g || 0).toString(),
                sod: ((n.sodium_100g || 0) * 1000).toString(), // g to mg
                sugar: (n.sugars_100g || 0).toString(),
                fiber: (n.fiber_100g || 0).toString(),
                source: "off"
            };
            goToEditor(data, productData);
            return;
        }

        // 3. 查無資料 -> 跳出選項
        showNotFoundAlert(data);

    } catch (e) {
        console.error("Scan Error:", e);
        showNotFoundAlert(data);
    } finally {
        setIsLoading(false);
    }
  };

  const goToEditor = (barcode: string, productData: any) => {
      router.replace({
          pathname: "/food-editor",
          params: { 
              barcode: barcode,
              productData: JSON.stringify(productData)
          }
      });
  };

  const showNotFoundAlert = (barcode: string) => {
      Alert.alert(
          t('product_not_found', lang) || "Product Not Found",
          t('product_not_found_msg', lang) || "Choose how to proceed:",
          [
              { 
                  text: t('cancel', lang), 
                  style: "cancel", 
                  onPress: () => setScanned(false) 
              },
              { 
                  text: t('ai_analysis', lang) || "AI Scan", 
                  onPress: () => {
                      router.replace({ pathname: "/camera", params: { mode: "ai_food" } });
                  } 
              },
              { 
                  text: t('manual_input', lang) || "Manual Input", 
                  onPress: () => {
                      // 跳轉到編輯器，只帶 barcode，不帶 productData (讓用戶自己填)
                      router.replace({ pathname: "/food-editor", params: { barcode: barcode } });
                  } 
              }
          ]
      );
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
      {isLoading && (
        <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#34C759" />
            <Text style={{color:'white', marginTop:10}}>Searching...</Text>
        </View>
      )}
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
  loadingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', zIndex: 10 }
});
// [END OF FILE app/barcode-scanner.tsx]