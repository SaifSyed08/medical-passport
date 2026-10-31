import { router } from "expo-router";
import { StyleSheet, View } from "react-native";
import QRCode from "react-native-qrcode-svg";
import type { Card } from "@shared/tessera";
import { useResource } from "@/lib/cache";
import { useSession } from "@/lib/session";
import { color, font, space } from "@/lib/theme";
import { Button, Heading, Notice, Pill, Screen, T } from "@/components/ui";

// Mirrors CLINICIAN_INSTRUCTIONS in lib/tessera/wallet.ts (the pass content allow-list).
const INSTRUCTIONS =
  "Clinicians: scan the QR code to request access. You'll confirm the patient's identity and your own authorization. Demo only, not for clinical use.";

/** Mockup of the future Apple Wallet pass. Nothing is generated or signed. */
export default function WalletPreview() {
  const { t, me } = useSession();
  const card = useResource<Card>("/card");
  return (
    <Screen>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.m, flexWrap: "wrap" }}>
        <Heading size={28}>{t.walletPreview}</Heading>
        <Pill tone="warn">{t.comingSoon}</Pill>
      </View>
      <View accessible accessibilityLabel={`${t.walletPreview}. Tessera. ${me?.traveler.name}. QR code.`} style={styles.pass}>
        <View style={styles.passTop}>
          <T style={{ color: "white", fontSize: 17, fontWeight: "600" }}>+  Tessera</T>
          <T style={{ color: "#c9d6e3", fontSize: 11, letterSpacing: 1.5 }}>MEDICAL CARD</T>
        </View>
        <View style={{ gap: 2 }}>
          <T style={{ color: "#9fb3c8", fontSize: 11, letterSpacing: 1.5 }}>PATIENT</T>
          <T style={{ color: "white", fontFamily: font.serif, fontSize: 28 }}>{me?.traveler.name}</T>
        </View>
        <View style={styles.qr}>
          {card.data ? <QRCode value={card.data.cardUrl} size={170} ecl="M" /> : <View style={{ width: 170, height: 170 }} />}
        </View>
        <T style={{ color: "#c9d6e3", fontSize: 12.5, lineHeight: 18, textAlign: "center" }}>{INSTRUCTIONS}</T>
        <View style={styles.preview}>
          <T style={{ color: color.warnText, fontSize: 12, fontWeight: "600", letterSpacing: 1 }}>PREVIEW · NOT A REAL PASS</T>
        </View>
      </View>
      <Notice>{t.walletPreviewNote}</Notice>
      <Button disabled label={`${t.addToWallet}, ${t.comingSoon}`}>{`${t.addToWallet} · ${t.comingSoon}`}</Button>
      <Button secondary onPress={() => router.back()}>{t.close}</Button>
    </Screen>
  );
}

const styles = StyleSheet.create({
  pass: { backgroundColor: "#17243a", borderRadius: 16, padding: 20, gap: space.l, alignItems: "stretch" },
  passTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  qr: { alignSelf: "center", backgroundColor: "white", padding: 12, borderRadius: 10 },
  preview: { alignSelf: "center", backgroundColor: color.warnBg, borderRadius: 99, paddingHorizontal: 12, paddingVertical: 5 },
});
