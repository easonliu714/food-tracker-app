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
    const current = parseFloat(value) || 0;
    const next = Math.max(0, current + delta);
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
  container: { marginBottom: 16 },
  label: { fontSize: 12, color: '#666', marginBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  btn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#0a7ea4', justifyContent: 'center', alignItems: 'center' },
  inputWrapper: { flex: 1, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#ddd', borderRadius: 8, paddingHorizontal: 10, height: 40, backgroundColor: 'white' },
  input: { flex: 1, fontSize: 16, textAlign: 'center' },
  unit: { fontSize: 12, color: '#888', marginLeft: 4 }
});