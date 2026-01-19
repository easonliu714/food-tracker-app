import React, { useRef } from 'react';
import { View, ViewStyle, LayoutChangeEvent } from 'react-native';
import { useTutorial } from '@/context/TutorialContext';

// [新增] 定義微調參數介面
export interface TargetAdjustment {
  padding?: number;        // 四周留白增加
  offsetX?: number;        // X 軸偏移
  offsetY?: number;        // Y 軸偏移
  widthAdd?: number;       // 寬度增加 (或減少)
  heightAdd?: number;      // 高度增加 (或減少)
}

interface Props {
  targetKey: string;
  children: React.ReactNode;
  style?: ViewStyle;
  adjustment?: TargetAdjustment; // [新增] 傳入微調設定
  onMeasure?: (y: number) => void; // [新增] 讓父層取得 ScrollView 相對位置
}

export const TutorialTarget = ({ targetKey, children, style, adjustment, onMeasure }: Props) => {
  const { registerTarget } = useTutorial();
  const viewRef = useRef<View>(null);

  const onLayout = (event: LayoutChangeEvent) => {
    // 1. 取得相對於 ScrollView 的 Y 座標 (用於自動捲動)
    if (onMeasure) {
        onMeasure(event.nativeEvent.layout.y);
    }

    // 2. 取得絕對螢幕座標 (用於繪製亮框)
    viewRef.current?.measureInWindow((x, y, w, h) => {
        if (w > 0 && h > 0) {
            // 將 adjustment 一併註冊進去
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