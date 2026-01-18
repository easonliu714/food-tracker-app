import React, { useRef, useEffect } from 'react';
import { View, LayoutChangeEvent, ViewStyle } from 'react-native';
import { useTutorial } from '@/context/TutorialContext';

interface Props {
  targetKey: string;
  children: React.ReactNode;
  style?: ViewStyle;
}

export const TutorialTarget = ({ targetKey, children, style }: Props) => {
  const { registerTarget } = useTutorial();
  const viewRef = useRef<View>(null);

  const onLayout = () => {
    viewRef.current?.measureInWindow((x, y, w, h) => {
        if (w > 0 && h > 0) {
            registerTarget(targetKey, { x, y, w, h });
        }
    });
  };

  // 監聽 layout 變化
  return (
    <View 
        ref={viewRef} 
        onLayout={onLayout} 
        style={style}
        collapsable={false} // Android 必須
    >
      {children}
    </View>
  );
};