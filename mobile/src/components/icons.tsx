import type { ReactNode } from "react";
import { View } from "react-native";
import Svg, { Circle, Path, Rect } from "react-native-svg";

// One thin line icon set for the whole app (paths from Lucide, ISC licence): the tab bar, section headers,
// buttons and status marks all share the same stroke.
const paths = {
  // Tabs
  card: (
    <>
      <Path d="M16 10h2" />
      <Path d="M16 14h2" />
      <Path d="M6.17 15a3 3 0 0 1 5.66 0" />
      <Circle cx="9" cy="11" r="2" />
      <Rect x="2" y="5" width="20" height="14" rx="2" />
    </>
  ),
  health: (
    <>
      <Path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
      <Path d="M3.22 12H9.5l.5-1 2 4.5 2-7 1.5 3.5h5.27" />
    </>
  ),
  medicines: (
    <>
      <Path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z" />
      <Path d="m8.5 8.5 7 7" />
    </>
  ),
  interpret: (
    <>
      <Path d="M14 9a2 2 0 0 1-2 2H6l-4 4V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2z" />
      <Path d="M18 9h2a2 2 0 0 1 2 2v11l-4-4h-6a2 2 0 0 1-2-2v-1" />
    </>
  ),
  records: (
    <>
      <Path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
      <Path d="M14 2v4a2 2 0 0 0 2 2h4" />
      <Path d="M10 9H8" />
      <Path d="M16 13H8" />
      <Path d="M16 17H8" />
    </>
  ),
  privacy: (
    <>
      <Path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
      <Path d="m9 12 2 2 4-4" />
    </>
  ),
  // Sections
  alert: (
    <>
      <Path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
      <Path d="M12 9v4" />
      <Path d="M12 17h.01" />
    </>
  ),
  condition: (
    <>
      <Path d="M11 2v2" />
      <Path d="M5 2v2" />
      <Path d="M5 3H4a2 2 0 0 0-2 2v4a6 6 0 0 0 12 0V5a2 2 0 0 0-2-2h-1" />
      <Path d="M8 15a6 6 0 0 0 12 0v-3" />
      <Circle cx="20" cy="10" r="2" />
    </>
  ),
  vitals: <Path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2" />,
  phone: <Path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.63A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />,
  insurance: (
    <>
      <Rect x="2" y="5" width="20" height="14" rx="2" />
      <Path d="M2 10h20" />
    </>
  ),
  // Actions and marks
  plus: (
    <>
      <Path d="M5 12h14" />
      <Path d="M12 5v14" />
    </>
  ),
  camera: (
    <>
      <Path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
      <Circle cx="12" cy="13" r="3" />
    </>
  ),
  upload: (
    <>
      <Path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <Path d="m17 8-5-5-5 5" />
      <Path d="M12 3v12" />
    </>
  ),
  image: (
    <>
      <Rect x="3" y="3" width="18" height="18" rx="2" />
      <Circle cx="9" cy="9" r="2" />
      <Path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
    </>
  ),
  pin: (
    <>
      <Path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0" />
      <Circle cx="12" cy="10" r="3" />
    </>
  ),
  pencil: (
    <>
      <Path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z" />
      <Path d="m15 5 4 4" />
    </>
  ),
  swap: (
    <>
      <Path d="M8 3 4 7l4 4" />
      <Path d="M4 7h16" />
      <Path d="m16 21 4-4-4-4" />
      <Path d="M20 17H4" />
    </>
  ),
  arrowRight: (
    <>
      <Path d="M5 12h14" />
      <Path d="m12 5 7 7-7 7" />
    </>
  ),
  check: <Path d="M20 6 9 17l-5-5" />,
  chevronDown: <Path d="m6 9 6 6 6-6" />,
  chevronRight: <Path d="m9 18 6-6-6-6" />,
  question: (
    <>
      <Circle cx="12" cy="12" r="10" />
      <Path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <Path d="M12 17h.01" />
    </>
  ),
  ban: (
    <>
      <Circle cx="12" cy="12" r="10" />
      <Path d="m4.9 4.9 14.2 14.2" />
    </>
  ),
} satisfies Record<string, ReactNode>;

export type IconName = keyof typeof paths;

/** Decorative: the text beside it (or the control's own label) says what it means. */
export function Icon({ name, color, size = 20, stroke = 1.6 }: { name: IconName; color: string; size?: number; stroke?: number }) {
  return (
    <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
        {paths[name]}
      </Svg>
    </View>
  );
}
