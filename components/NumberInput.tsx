import React from 'react';
import { View, TextInput, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ThemedText } from './themed-text';

interface Props {
  value: string;
  onChange: (val: string) => void;
  label?: string;
  unit?: string;
  step?: number;
}

export function NumberInput({ value, onChange, label, unit, step = 1 }: Props) {
  const handleAdjust = (delta: number) => {
    // 如果目前是空字串，視為 0
    const current = parseFloat(value) || 0;
    const next = Math.max(0, parseFloat((current + delta).toFixed(1)));
    onChange(next.toString());
  };

  return (
    <View style={styles.container}>
      {label && <ThemedText style={styles.label}>{label}</ThemedText>}
      <View style={styles.row}>
        <Pressable onPress={() => handleAdjust(-step)} style={styles.btn}>
          <Ionicons name="remove" size={20} color="white" />
        </Pressable>
        <View style={styles.inputWrapper}>
          <TextInput
            style={styles.input}
            value={value}
            // 關鍵修改：直接傳回文字，不要在這裡做 parseFloat || 0，否則無法清空
            onChangeText={onChange}
            keyboardType="numeric"
          />
          {unit && <ThemedText style={styles.unit}>{unit}</ThemedText>}
        </View>
        <Pressable onPress={() => handleAdjust(step)} style={styles.btn}>
          <Ionicons name="add" size={20} color="white" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 12 },
  label: { fontSize: 14, color: '#666', marginBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  btn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#0a7ea4', justifyContent: 'center', alignItems: 'center' },
  // 增加高度與 Padding 避免遮蔽
  inputWrapper: { flex: 1, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#ccc', borderRadius: 8, paddingHorizontal: 12, height: 50, backgroundColor: 'white' },
  input: { flex: 1, fontSize: 18, textAlign: 'center', color: '#000', height: '100%' },
  unit: { fontSize: 14, color: '#888', marginLeft: 4 }
});