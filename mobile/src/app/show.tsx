import * as Brightness from "expo-brightness";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Platform, Pressable, StyleSheet, useWindowDimensions, View } from "react-native";
import QRCode from "react-native-qrcode-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { Card } from "@shared/tessera";
import { useResource } from "@/lib/cache";
import { clinicianHint } from "@/lib/i18n";
import { CARD_KEY, useSession } from "@/lib/session";
import { color, font, space, TOUCH } from "@/lib/theme";
import { DemoBanner, T } from "@/components/ui";
import { storage } from "@/lib/storage";

/** Full-screen "Show to a doctor" mode: big QR on white, screen brightness raised, restored on exit. */
export default function Show() {
  const { me, t } = useSession();
  const card = useResource<Card>("/card");
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const size = Math.min(width - 64, height * 0.45, 360);
  const [saved, setSaved] = useState<Card | null>(null);
  useEffect(() => {
    storage.get(CARD_KEY).then(v => v && setSaved(JSON.parse(v) as Card)).catch(() => {});
  }, []);

  useEffect(() => {
    let previous: number | null = null;
    Brightness.getBrightnessAsync()
      .then(b => {
        previous = b;
        return Brightness.setBrightnessAsync(1);
      })
      .catch(() => {});
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    return () => {
      if (Platform.OS === "android") void Brightness.restoreSystemBrightnessAsync().catch(() => {});
      else if (previous !== null) void Brightness.setBrightnessAsync(previous).catch(() => {});
    };
  }, []);

  const c = card.data ?? saved;
  const url = c?.status === "active" ? c.cardUrl : null;
  return (
    <View style={[styles.wrap, { paddingTop: insets.top + space.l, paddingBottom: insets.bottom + space.l }]}>
      <DemoBanner />
      <View style={{ alignItems: "center", gap: space.xl }}>
        <T style={{ fontSize: 16, letterSpacing: -0.3, color: color.ink }}>+  Tessera</T>
        <View accessible accessibilityRole="image" accessibilityLabel={`QR code for ${me?.traveler.name ?? "your"} Tessera card`} style={styles.qr}>
          {url ? <QRCode value={url} size={size} ecl="M" /> : <View style={{ width: size, height: size }} />}
        </View>
        <T style={{ fontFamily: font.serif, fontSize: 32, color: color.ink, textAlign: "center" }}>{me?.traveler.name}</T>
        <T style={{ fontSize: 16, color: color.muted, textAlign: "center", lineHeight: 23, paddingHorizontal: space.l }}>{t.showHint}</T>
        {me && me.language !== "en" && <T style={{ fontSize: 15, color: color.muted, textAlign: "center" }}>{clinicianHint[me.language]}</T>}
        <T style={{ fontSize: 15, color: color.muted, textAlign: "center" }}>{clinicianHint.en}</T>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel={t.close} onPress={() => router.back()} style={({ pressed }) => [styles.close, pressed && { opacity: 0.6 }]}>
        <T weight="500" style={{ fontSize: 17, color: color.blue }}>{t.close}</T>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: "white", paddingHorizontal: space.xl, justifyContent: "space-between", alignItems: "center" },
  qr: { padding: 16, backgroundColor: "white", borderRadius: 16, borderWidth: 1, borderColor: color.line },
  close: { minHeight: TOUCH + 8, minWidth: 160, alignItems: "center", justifyContent: "center", borderRadius: 99, borderWidth: 1.5, borderColor: "#cdd5dd" },
});
