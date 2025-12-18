import React from "react";
import { View, StyleSheet } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { ThemedText } from "./themed-text";
import { useThemeColor } from "@/hooks/use-theme-color";

interface ProgressRingProps {
  progress: number; // 0 to 1
  size?: number;
  strokeWidth?: number;
  current: number;
  target: number;
  unit?: string;
}

export function ProgressRing({
  progress,
  size = 200,
  strokeWidth = 16,
  current,
  target,
  unit = "kcal",
}: ProgressRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset = circumference - Math.min(progress, 1) * circumference;

  const tintColor = useThemeColor({}, "tint");
  const textColor = useThemeColor({}, "text");
  const textSecondary = useThemeColor({}, "textSecondary");

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        {/* Background circle */}
        <Circle
          stroke="#E5E5EA"
          fill="none"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
        />
        {/* Progress circle */}
        <Circle
          stroke={tintColor}
          fill="none"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          rotation="-90"
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      <View style={styles.textContainer}>
        <ThemedText style={[styles.currentValue, { color: textColor }]}>
          {current.toLocaleString()}
        </ThemedText>
        <ThemedText style={[styles.separator, { color: textSecondary }]}>/</ThemedText>
        <ThemedText style={[styles.targetValue, { color: textSecondary }]}>
          {target.toLocaleString()}
        </ThemedText>
        <ThemedText style={[styles.unit, { color: textSecondary }]}>{unit}</ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: "center",
    alignItems: "center",
  },
  textContainer: {
    position: "absolute",
    alignItems: "center",
  },
  currentValue: {
    fontSize: 36,
    fontWeight: "bold",
    lineHeight: 42,
  },
  separator: {
    fontSize: 20,
    lineHeight: 24,
    marginTop: -4,
  },
  targetValue: {
    fontSize: 18,
    lineHeight: 22,
  },
  unit: {
    fontSize: 14,
    marginTop: 4,
    lineHeight: 18,
  },
});
