import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Text } from 'react-native'; // 移除未使用的 TextInput
import Svg, { Circle, G } from 'react-native-svg';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useColorScheme } from '@/hooks/use-color-scheme'; // 引入 hook 以偵測主題

interface ProgressRingProps {
  radius: number;
  stroke: number;
  progress: number;
  color: string;
  trackColor?: string;
  textColor?: string; 
  children?: React.ReactNode;
}

export default function ProgressRing({
  radius,
  stroke,
  progress,
  color,
  trackColor,
  textColor,
  children,
}: ProgressRingProps) {
  const normalizedRadius = radius - stroke / 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const animatedValue = useRef(new Animated.Value(0)).current;

  // [新增] 偵測主題
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  // [修改] 動態計算顏色
  // 1. 軌道顏色：若未傳入 trackColor，則依主題切換 (深色模式用深灰 #333，淺色用淺灰 #f2f2f2)
  const defaultTrackColor = isDark ? '#333333' : '#f2f2f2';
  const activeTrackColor = trackColor || defaultTrackColor;

  // 2. 文字顏色：若未傳入 textColor，則使用主題文字色
  const themeTextColor = useThemeColor({}, 'text');
  const activeTextColor = textColor || themeTextColor;

  useEffect(() => {
    Animated.timing(animatedValue, {
      toValue: progress,
      duration: 1000,
      useNativeDriver: true, 
    }).start();
  }, [progress]);
  
  const strokeDashoffset = circumference - (progress * circumference); 
  
  return (
    <View style={{ width: radius * 2, height: radius * 2, justifyContent: 'center', alignItems: 'center' }}>
      <Svg
        height={radius * 2}
        width={radius * 2}
        viewBox={`0 0 ${radius * 2} ${radius * 2}`}
      >
        <G rotation="-90" origin={`${radius}, ${radius}`}>
          {/* 軌道圓環 */}
          <Circle
            cx={radius}
            cy={radius}
            r={normalizedRadius}
            stroke={activeTrackColor} // 使用動態軌道色
            strokeWidth={stroke}
            fill="transparent"
          />
          {/* 進度圓環 */}
          <Circle
            cx={radius}
            cy={radius}
            r={normalizedRadius}
            stroke={color}
            strokeWidth={stroke}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset} 
            strokeLinecap="round"
            fill="transparent"
          />
        </G>
      </Svg>
      <View style={StyleSheet.absoluteFillObject} justifyContent="center" alignItems="center">
        {children ? children : (
            // [新增] Fallback: 若無 children，顯示百分比並套用正確顏色
            <Text style={{ color: activeTextColor, fontSize: radius * 0.4, fontWeight: 'bold' }}>
                {Math.round(progress * 100)}%
            </Text>
        )}
      </View>
    </View>
  );
}