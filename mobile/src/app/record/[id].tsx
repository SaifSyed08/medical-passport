import { File, Paths } from "expo-file-system";
import { router, useLocalSearchParams } from "expo-router";
import * as Sharing from "expo-sharing";
import { useEffect, useState } from "react";
import { Image, StyleSheet, useWindowDimensions, View } from "react-native";
import type { RecordItem } from "@shared/tessera";
import { api, API_URL, authHeader } from "@/lib/api";
import { ensureAutofillOptIn, EXTRACTOR_URL, getAutofillPref } from "@/lib/autofill";
import { useResource } from "@/lib/cache";
import { ask } from "@/lib/confirm";
import { useSession } from "@/lib/session";
import { color, space } from "@/lib/theme";
import { fileSource, isPhoto } from "@/components/doc-thumb";
import { Icon } from "@/components/icons";
import { Button, Notice, Pill, Screen, T } from "@/components/ui";

export default function RecordDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useSession();
  const records = useResource<RecordItem[]>("/records");
  const r = records.data?.find(x => x.id === id);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [canSuggest, setCanSuggest] = useState(false);
  const [photoFailed, setPhotoFailed] = useState(false);
  const width = useWindowDimensions().width - space.xl * 2;
  useEffect(() => {
    if (EXTRACTOR_URL) void getAutofillPref().then(v => setCanSuggest(v !== "off"));
  }, []);

  async function remove() {
    if (!r || !(await ask(t.deleteDocument, t.deleteDocumentConfirm, t.delete, t.cancel, true))) return;
    setBusy(true);
    setError("");
    try {
      await api(`/records/${r.id}`, { method: "DELETE" });
      await records.refresh();
      router.back();
    } catch {
      setError(t.errorGeneric);
      setBusy(false);
    }
  }

  async function openFile() {
    if (!r) return;
    setBusy(true);
    setError("");
    try {
      const ext = r.contentType === "application/pdf" ? "pdf" : r.contentType === "image/png" ? "png" : "jpg";
      const dest = new File(Paths.cache, `tessera-${r.id}.${ext}`);
      if (dest.exists) dest.delete();
      const task = File.createDownloadTask(`${API_URL}/api/v1/records/${r.id}/file`, dest, { headers: authHeader() });
      const file = await task.downloadAsync();
      if (!file) throw new Error("download");
      // The cached copy is removed on sign-out (see clearDownloadedFiles).
      await Sharing.shareAsync(file.uri, { mimeType: r.contentType ?? undefined });
    } catch {
      setError(t.errorGeneric);
    } finally {
      setBusy(false);
    }
  }

  if (!r) return <Screen><Notice>{t.loading}</Notice></Screen>;
  // Like the web app's document view (interpreter/src/components/DocPreview.tsx): the photo when there is one,
  // then the document laid out as a page.
  const paragraphs = [r.summary, r.body].filter(Boolean).join("\n\n").split(/\n+/).map(x => x.trim()).filter(Boolean);
  return (
    <Screen>
      {isPhoto(r) && !photoFailed && (
        <Image
          source={fileSource(r)}
          onError={() => setPhotoFailed(true)}
          accessibilityLabel={`Photo of ${r.title}`}
          resizeMode="contain"
          style={[styles.photo, { width, height: Math.round(width * 1.25) }]}
        />
      )}
      <View style={styles.paper}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: space.s }}>
          {!!r.facility && <Icon name="pin" color={color.muted} size={15} />}
          <T numberOfLines={1} style={{ flex: 1, fontSize: 13.5, color: color.muted }}>{r.facility ?? ""}</T>
          <T style={{ fontSize: 13.5, color: color.muted, fontVariant: ["tabular-nums"] }}>{r.date}</T>
        </View>
        <T serif weight="700" accessibilityRole="header" style={{ fontSize: 21, lineHeight: 27, color: "#1d252d" }}>{r.title}</T>
        {r.simulated && <Pill tone="warn">{t.simulated}</Pill>}
        {paragraphs.map((para, i) => (
          <T key={i} style={{ fontSize: 15.5, lineHeight: 25, color: "#1d252d" }}>{para}</T>
        ))}
        {paragraphs.length === 0 && <T style={{ fontSize: 15, color: color.subtle }}>{t.noText}</T>}
      </View>
      {r.hasFile && <Button secondary busy={busy} onPress={openFile}>{t.openOriginal}</Button>}
      {r.kind === "upload" && canSuggest && (
        <Button secondary disabled={busy} onPress={async () => { if (await ensureAutofillOptIn(t)) router.push({ pathname: "/review", params: { recordId: r.id } }); else setCanSuggest(false); }}>{t.suggestUpdates}</Button>
      )}
      {!!error && <Notice tone="error">{error}</Notice>}
      <Notice>{t.restrictedNote}</Notice>
      {r.kind === "upload" && <Button secondary danger disabled={busy} onPress={remove}>{t.deleteDocument}</Button>}
    </Screen>
  );
}

const styles = StyleSheet.create({
  photo: { alignSelf: "center", borderRadius: 6, backgroundColor: "#e9ecee" },
  paper: {
    backgroundColor: "white", borderRadius: 4, paddingHorizontal: 22, paddingTop: 20, paddingBottom: 26, gap: 12,
    borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(23,36,58,0.12)",
    shadowColor: color.ink, shadowOpacity: 0.12, shadowRadius: 15, shadowOffset: { width: 0, height: 10 }, elevation: 4,
  },
});
