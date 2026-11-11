import { LinearGradient } from "expo-linear-gradient";
import { StyleSheet, View } from "react-native";
import QRCode from "react-native-qrcode-svg";
import type { CardStatus } from "@shared/tessera";
import { useSession } from "@/lib/session";
import { cardThemes, font, radius, type CardTheme } from "@/lib/theme";
import { Pill, T } from "./ui";

/**
 * Wallet-style card in the web card studio's look (gradient face, serif name, small caps serial).
 * The QR is rendered only from the backend-provided `qrValue`, never built on the device.
 */
export function CardFace({
  name,
  serial,
  status,
  qrValue,
  theme = "midnight",
  qrSize = 84,
}: {
  name: string;
  serial: string;
  status: CardStatus;
  qrValue?: string;
  theme?: CardTheme;
  qrSize?: number;
}) {
  const { t } = useSession();
  const th = cardThemes[theme];
  const statusLabel = status === "active" ? t.cardActive : status === "frozen" ? t.cardFrozen : t.cardVoided;
  return (
    <View
      accessible
      accessibilityLabel={`${t.cardTitle}. ${name}. ${statusLabel}. ${serial}`}
      style={styles.shadow}
    >
      <LinearGradient colors={th.fill} start={{ x: 0, y: 0.2 }} end={{ x: 1, y: 0.8 }} style={[styles.card, { borderColor: th.edge }]}>
        <T style={[styles.watermark, { color: th.ink }]} importantForAccessibility="no">+</T>
        <View style={styles.top}>
          <T style={{ color: th.ink, fontSize: 14, letterSpacing: -0.3, opacity: 0.9 }}>+  Tessera</T>
          <Pill tone={status === "active" ? "ok" : status === "frozen" ? "warn" : "muted"}>{statusLabel}</Pill>
        </View>
        <View style={styles.bottom}>
          <View style={{ flex: 1, gap: 6 }}>
            <T style={{ color: th.ink, fontSize: 9, letterSpacing: 2, opacity: 0.5 }}>MEDICAL CARD · DEMO</T>
            <T numberOfLines={2} adjustsFontSizeToFit style={{ color: th.ink, fontFamily: font.serif, fontSize: 30, letterSpacing: -0.8, lineHeight: 33 }}>{name}</T>
            <T style={{ color: th.ink, fontSize: 10, letterSpacing: 1.6, opacity: 0.6 }}>{serial}</T>
          </View>
          {qrValue ? (
            <View style={[styles.qr, status !== "active" && { opacity: 0.35 }]} importantForAccessibility="no-hide-descendants">
              <QRCode value={qrValue} size={qrSize} ecl="M" />
            </View>
          ) : null}
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  shadow: { borderRadius: radius.card, shadowColor: "#10243e", shadowOpacity: 0.3, shadowRadius: 20, shadowOffset: { width: 0, height: 14 }, elevation: 8 },
  card: { aspectRatio: 1.586, borderRadius: radius.card, borderWidth: 1, padding: 20, justifyContent: "space-between", overflow: "hidden" },
  watermark: { position: "absolute", right: -30, top: -70, fontSize: 260, opacity: 0.06, transform: [{ rotate: "12deg" }] },
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  bottom: { flexDirection: "row", alignItems: "flex-end", gap: 14 },
  qr: { backgroundColor: "white", padding: 7, borderRadius: 9 },
});
