// Design tokens ported from the web app (app/passport.css) so both surfaces read as one product.
import { Platform } from "react-native";

export const color = {
  ink: "#17243a",
  blue: "#315f98",
  blueDark: "#244e80",
  muted: "#697482",
  subtle: "#8b959e",
  line: "#dde2e5",
  fieldLine: "#d8dfe4",
  bg: "#f2f2ef",
  surface: "#ffffff",
  readerBg: "#f5f6f4",
  notice: "#f3f6f8",
  noticeText: "#6a7a8b",
  sectionTitle: "#38546a",
  body: "#566c7b",
  allergyBg: "#fff9f3",
  allergyLine: "#eadfd2",
  allergyTitle: "#986d49",
  errorBg: "#fff7f5",
  errorLine: "#ecd1cb",
  errorText: "#a94d40",
  okBg: "#edf5f0",
  okText: "#5b806b",
  warnBg: "#fdf3e6",
  warnText: "#8a5a1f",
  focus: "#749fc9",
} as const;

/** The four card themes from the web card studio. */
export const cardThemes = {
  midnight: { fill: ["#12273e", "#203d58"], ink: "#e8eef2", edge: "#3d5468" },
  pearl: { fill: ["#efebe1", "#fcfaf4"], ink: "#505c63", edge: "#d8d6cd" },
  cobalt: { fill: ["#325f98", "#4e83be"], ink: "#f1f7ff", edge: "#6596c5" },
  sage: { fill: ["#697e74", "#9baa9b"], ink: "#f6faf4", edge: "#a7b4a4" },
} as const;
export type CardTheme = keyof typeof cardThemes;

// Web: --serif "Iowan Old Style", Palatino… / --sans system UI. Iowan ships with iOS.
export const font = {
  serif: Platform.select({ ios: "Iowan Old Style", default: "serif" }),
  sans: undefined as string | undefined,
  ja: "NotoSansJP_400Regular",
  // Only Regular and Bold are bundled (each weight is ~5.6 MB); medium falls back to Regular.
  jaMedium: "NotoSansJP_400Regular",
  jaBold: "NotoSansJP_700Bold",
};

export const radius = { card: 17, section: 12, button: 8, field: 7, pill: 99 };
export const space = { xs: 4, s: 8, m: 12, l: 16, xl: 24, xxl: 32 };
/** Minimum touch target (spec: 48pt+). */
export const TOUCH = 48;
