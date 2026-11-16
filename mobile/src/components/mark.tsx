import { View } from "react-native";
import Svg, { Rect } from "react-native-svg";
import { color as palette } from "@/lib/theme";

/** The Tessera logo: four mosaic tiles. Same drawing as components/tessera-mark.tsx on the web. */
export function TesseraMark({ size = 28, color = palette.blue, opacity = 1 }: { size?: number; color?: string; opacity?: number }) {
  return (
    // Decorative: the word "Tessera" or an accessibility label always sits next to it.
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ width: size, height: size, opacity }}>
      <Svg width={size} height={size} viewBox="0 0 28 28">
        <Rect x={1} y={1} width={12} height={12} rx={3.5} fill={color} />
        <Rect x={15} y={1} width={12} height={12} rx={3.5} fill={color} opacity={0.35} />
        <Rect x={1} y={15} width={12} height={12} rx={3.5} fill={color} opacity={0.35} />
        <Rect x={15} y={15} width={12} height={12} rx={6} fill={color} />
      </Svg>
    </View>
  );
}
