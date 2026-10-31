import * as Haptics from "expo-haptics";
import { Asset, requestPermissionsAsync } from "expo-media-library";
import { router } from "expo-router";
import { useEffect, useRef, useState, type ComponentRef } from "react";
import { Share, View } from "react-native";
import { captureRef } from "react-native-view-shot";
import type { Card } from "@shared/tessera";
import { api } from "@/lib/api";
import { primeCache, useResource } from "@/lib/cache";
import { ask, confirmWithBiometrics } from "@/lib/confirm";
import { CARD_KEY, useSession } from "@/lib/session";
import { color, space } from "@/lib/theme";
import { CardFace } from "@/components/card-face";
import { Button, Heading, LoadError, Loading, Logo, Notice, Screen, T } from "@/components/ui";
import { storage } from "@/lib/storage";

export default function CardScreen() {
  const { me, t } = useSession();
  const card = useResource<Card>("/card");
  const [offlineCard, setOfflineCard] = useState<Card | null>(null);
  const [busy, setBusy] = useState<"" | "save" | "replace">("");
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const faceRef = useRef<ComponentRef<typeof View>>(null);

  // Keep the last card (a random link, no PII) on the device so the QR can be shown offline.
  useEffect(() => {
    if (card.data) void storage.set(CARD_KEY, JSON.stringify(card.data));
    else
      storage.get(CARD_KEY)
        .then(v => v && setOfflineCard(JSON.parse(v) as Card))
        .catch(() => {});
  }, [card.data]);

  const c = card.data ?? offlineCard;
  const name = me?.traveler.name ?? "";

  async function saveToPhotos() {
    setBusy("save");
    setMessage(null);
    try {
      const { granted } = await requestPermissionsAsync(true);
      if (!granted) throw new Error("permission");
      const uri = await captureRef(faceRef, { format: "png", quality: 1, result: "tmpfile" });
      await Asset.create(uri);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setMessage({ tone: "ok", text: t.saved });
    } catch {
      setMessage({ tone: "error", text: t.errorGeneric });
    } finally {
      setBusy("");
    }
  }

  async function replace() {
    if (!(await ask(t.replaceCard, t.replaceConfirm, t.replaceCard, t.cancel, true))) return;
    if (!(await confirmWithBiometrics(t.replaceCard, t.cancel))) return;
    setBusy("replace");
    setMessage(null);
    try {
      primeCache("/card", await api<Card>("/card/replace", { body: {} }));
      setMessage({ tone: "ok", text: t.replaced });
    } catch {
      setMessage({ tone: "error", text: t.errorGeneric });
    } finally {
      setBusy("");
    }
  }

  return (
    <Screen onRefresh={card.refresh} refreshing={card.loading} stale={card.stale || (!card.data && !!offlineCard)}>
      <Logo />
      <View style={{ gap: 6 }}>
        <Heading>{t.cardTitle}</Heading>
        <T style={{ color: color.muted, fontSize: 15 }}>{t.cardUrlNote}</T>
      </View>
      {!c && card.loading && <Loading />}
      {!c && card.error && !card.loading && <LoadError onRetry={card.refresh} />}
      {c && (
        <>
          <View ref={faceRef} collapsable={false} style={{ paddingVertical: space.s }}>
            <CardFace name={name} serial={c.serialNumber} status={c.status} qrValue={c.cardUrl} />
          </View>
          {c.status === "frozen" && <Notice tone="warn">{t.frozenNote}</Notice>}
          {message && <Notice tone={message.tone}>{message.text}</Notice>}
          <Button haptic disabled={c.status !== "active"} onPress={() => router.push("/show")} hint={t.showHint}>{t.showToDoctor}</Button>
          <View style={{ flexDirection: "row", gap: space.m }}>
            <Button secondary style={{ flex: 1 }} busy={busy === "save"} onPress={saveToPhotos}>{t.saveToPhotos}</Button>
            <Button secondary style={{ flex: 1 }} onPress={() => void Share.share({ message: c.cardUrl, url: c.cardUrl })}>{t.share}</Button>
          </View>
          <WalletButton enabled={!!me?.walletEnabled} />
          <Button secondary danger busy={busy === "replace"} onPress={replace} disabled={!card.data}>{t.replaceCard}</Button>
        </>
      )}
    </Screen>
  );
}

function WalletButton({ enabled }: { enabled: boolean }) {
  const { t } = useSession();
  // Flag-gated: WALLET_ENABLED is off, so this only opens the preview.
  return (
    <Button
      secondary
      onPress={() => router.push("/wallet-preview")}
      label={`${t.addToWallet}, ${enabled ? "" : t.comingSoon}`}
      hint={t.walletPreview}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <T weight="500" style={{ fontSize: 16, color: enabled ? "#30445e" : color.subtle }}> {t.addToWallet}</T>
        {!enabled && (
          <View style={{ backgroundColor: color.notice, borderRadius: 99, paddingHorizontal: 8, paddingVertical: 3 }}>
            <T style={{ fontSize: 11.5, color: color.noticeText }}>{t.comingSoon}</T>
          </View>
        )}
      </View>
    </Button>
  );
}
