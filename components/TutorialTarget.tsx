import React, { useRef } from 'react';
import { View, ViewStyle, LayoutChangeEvent } from 'react-native';
import { useTutorial, TargetAdjustment } from '@/context/TutorialContext';

interface Props {
  targetKey: string;
  children: React.ReactNode;
  style?: ViewStyle;
  adjustment?: TargetAdjustment;
  // [新增] 讓父層取得 ScrollView 相對位置的 callback
  onMeasure?: (y: number) => void;
}

export const TutorialTarget = ({ targetKey, children, style, adjustment, onMeasure }: Props) => {
  const { registerTarget } = useTutorial();
  const viewRef = useRef<View>(null);

  const onLayout = (event: LayoutChangeEvent) => {
    // 1. 取得相對於父層 (通常是 ScrollView) 的 Y 座標，用於自動捲動
    if (onMeasure) {
        onMeasure(event.nativeEvent.layout.y);
    }

    // 2. 取得絕對螢幕座標，用於繪製亮框
    viewRef.current?.measureInWindow((x, y, w, h) => {
        if (w > 0 && h > 0) {
            registerTarget(targetKey, { x, y, w, h, adjustment });
        }
    });
  };

  return (
    <View 
        ref={viewRef} 
        onLayout={onLayout} 
        style={style}
        collapsable={false} 
    >
      {children}
    </View>
  );
};