import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, TextInput, Text } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';

interface ProgressRingProps {
  radius: number;
  stroke: number;
  progress: number;
  color: string;
  trackColor?: string;
  textColor?: string; // [新增]
  children?: React.ReactNode;
}

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export default function ProgressRing({
  radius,
  stroke,
  progress,
  color,
  trackColor = '#f2f2f2',
  textColor = '#000', // [新增] 預設黑色，但會被覆寫
  children,
}: ProgressRingProps) {
  const normalizedRadius = radius - stroke / 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const animatedValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(animatedValue, {
      toValue: progress,
      duration: 1000,
      useNativeDriver: true, // Circle props usually need standard animated or specialized library, ensuring compat.
      // Note: Layout animation for SVG props might behave differently on Native.
      // If native driver issues occur with SVG props, set to false.
      // For simple implementation, usually false for width/stroke props, 
      // but here we are animating strokeDashoffset via style or props? 
      // React Native SVG supports Animated props.
    }).start();
  }, [progress]);
  
  // For simpler logic without complex reanimated integration:
  const strokeDashoffset = circumference - (progress * circumference); // static for now to ensure stability, or use animatedValue with proper interpolation if setup allows.
  
  return (
    <View style={{ width: radius * 2, height: radius * 2, justifyContent: 'center', alignItems: 'center' }}>
      <Svg
        height={radius * 2}
        width={radius * 2}
        viewBox={`0 0 ${radius * 2} ${radius * 2}`}
      >
        <G rotation="-90" origin={`${radius}, ${radius}`}>
          <Circle
            cx={radius}
            cy={radius}
            r={normalizedRadius}
            stroke={trackColor}
            strokeWidth={stroke}
            fill="transparent"
          />
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
        {children} 
        {/* 如果 children 沒有傳入，可以在這裡顯示預設文字並套用 textColor */}
      </View>
    </View>
  );
}