/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { Platform } from "react-native";

const tintColorLight = "#34C759"; // iOS Green for health
const tintColorDark = "#30D158"; // iOS Green (dark mode)

export const Colors = {
  light: {
    text: "#000000",
    textSecondary: "#8E8E93",
    textDisabled: "#C7C7CC",
    background: "#F2F2F7",
    cardBackground: "#FFFFFF",
    tint: tintColorLight,
    warning: "#FF9500",
    danger: "#FF3B30",
    icon: "#8E8E93",
    tabIconDefault: "#8E8E93",
    tabIconSelected: tintColorLight,
    border: "#C6C6C8",
  },
  dark: {
    text: "#FFFFFF",
    textSecondary: "#8E8E93",
    textDisabled: "#48484A",
    background: "#000000",
    cardBackground: "#1C1C1E",
    tint: tintColorDark,
    warning: "#FF9F0A",
    danger: "#FF453A",
    icon: "#8E8E93",
    tabIconDefault: "#8E8E93",
    tabIconSelected: tintColorDark,
    border: "#38383A",
  },
};

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: "system-ui",
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: "ui-serif",
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: "ui-rounded",
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: "ui-monospace",
  },
  default: {
    sans: "normal",
    serif: "serif",
    rounded: "normal",
    mono: "monospace",
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
