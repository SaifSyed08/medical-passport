import { View } from "react-native";
import Svg, { Rect } from "react-native-svg";
import { color as palette } from "@/lib/theme";

/** The Parity logo: an equals sign, two people on equal footing. Same drawing as the web app's wordmark and components/tessera-mark.tsx. */
export function ParityMark({ size = 28, color = palette.blue, opacity = 1 }: { size?: number; color?: string; opacity?: number }) {
  return (
    // Decorative: the word "Parity" or an accessibility label always sits next to it.
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ width: size, height: size, opacity }}>
      <Svg width={size} height={size} viewBox="0 0 28 28">
        <Rect x={2} y={7} width={24} height={5.5} rx={2.75} fill={color} />
        <Rect x={2} y={15.5} width={24} height={5.5} rx={2.75} fill={color} opacity={0.55} />
      </Svg>
    </View>
  );
}
