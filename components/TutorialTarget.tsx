// components/TutorialTarget.tsx
import React, { useRef } from 'react';
import { View, ViewStyle, LayoutChangeEvent, StyleSheet } from 'react-native';
import { useTutorial, TargetAdjustment } from '@/context/TutorialContext';

interface Props {
  targetKey: string;
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[]; // 允許傳入陣列樣式
  adjustment?: TargetAdjustment; // 保留但通常不再需要
  onMeasure?: (y: number) => void;
}

export const TutorialTarget = ({ targetKey, children, style, adjustment, onMeasure }: Props) => {
  const { registerTarget, activeTargetKey } = useTutorial();
  const viewRef = useRef<View>(null);

  const isActive = activeTargetKey === targetKey;

  const onLayout = (event: LayoutChangeEvent) => {
    // 1. 取得 ScrollView 相對位置 (用於自動捲動)
    if (onMeasure) {
        onMeasure(event.nativeEvent.layout.y);
    }

    // 2. 註冊位置 (用於判斷氣泡要在上方還是下方)
    viewRef.current?.measureInWindow((x, y, w, h) => {
        if (w > 0 && h > 0) {
            registerTarget(targetKey, { x, y, w, h });
        }
    });
  };

  return (
    <View 
        ref={viewRef} 
        onLayout={onLayout} 
        style={[
            style,
            // [修正 4] 當此元件是導覽目標時，直接改變邊框樣式
            isActive && styles.activeTarget
        ]}
        collapsable={false} 
    >
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
    activeTarget: {
        borderWidth: 4,          // 粗框
        borderColor: '#FFD700',  // 金黃色
        borderStyle: 'dashed',   // 虛線
        borderRadius: 8,         // 稍微圓角
        backgroundColor: 'rgba(255, 215, 0, 0.1)' // 淡淡的黃色背景強調
    }
});