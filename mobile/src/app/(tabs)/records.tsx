import * as DocumentPicker from "expo-document-picker";
import { File as FsFile } from "expo-file-system";
import * as Haptics from "expo-haptics";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import type { RecordItem } from "@shared/tessera";
import { api, ApiError } from "@/lib/api";
import { ensureAutofillOptIn } from "@/lib/autofill";
import { useResource } from "@/lib/cache";
import type { Strings } from "@/lib/i18n";
import { useScans, type Scan } from "@/lib/scans";
import { useSession } from "@/lib/session";
import { color, radius, space } from "@/lib/theme";
import { Icon, type IconName } from "@/components/icons";
import { Button, Footnote, Heading, ListEmpty, ListRow, ListSection, LoadError, Loading, Logo, Notice, Pill, Screen, T } from "@/components/ui";

type Pick = { uri: string; name: string; type: string };

/** What a record's background scan is doing, as the short label shown on its row. */
function scanStatus(t: Strings, scan: Scan): { text: string; tone: "ok" | "muted" | "error" } {
  if (scan.status === "reading") {
    const text = scan.pages > 0 ? t.scanReadingPage.replace("{n}", String(scan.page)).replace("{total}", String(scan.pages)) : t.scanReading;
    return { text, tone: "muted" };
  }
  if (scan.status === "error") return { text: t.scanFailed, tone: "error" };
  return scan.suggestions.length > 0 ? { text: t.scanReady, tone: "ok" } : { text: t.scanNothing, tone: "muted" };
}

/** Re-encodes an image as JPEG (iPhone photos are HEIC, which the document reader can't open). */
async function toJpeg(uri: string) {
  const rendered = await ImageManipulator.manipulate(uri).renderAsync();
  return (await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.8 })).uri;
}

export default function Records() {
  const { t } = useSession();
  const { scans, start } = useScans();
  const records = useResource<RecordItem[]>("/records");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  // "Scan or upload" opens its three choices in place (camera, photo, PDF) rather than a pop-up.
  const [choosing, setChoosing] = useState(false);

  async function upload(file: Pick): Promise<RecordItem | undefined> {
    setBusy(true);
    setMessage(null);
    try {
      const form = new FormData();
      // Expo's fetch (SDK 58) rejects the old { uri, name, type } descriptor; it accepts any part with name, type and bytes().
      const source = new FsFile(file.uri);
      form.append("file", { name: file.name, type: file.type, bytes: () => source.bytes() } as unknown as Blob);
      form.append("title", file.name.replace(/\.[a-z0-9]+$/i, ""));
      const record = await api<RecordItem>("/records", { form, timeoutMs: 60000 });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await records.refresh();
      return record;
    } catch (e) {
      setMessage({ tone: "error", text: e instanceof ApiError && e.status === 400 ? e.message : t.errorGeneric });
    } finally {
      setBusy(false);
    }
  }

  /** After an upload: ask once whether to read documents, then scan it in the background if opted in. */
  async function maybeAutofill(record: RecordItem) {
    if (await ensureAutofillOptIn(t)) start(record.id);
  }

  async function addFile(file: Pick) {
    const record = await upload(file);
    if (record) await maybeAutofill(record);
  }

  async function pickPdf() {
    const r = await DocumentPicker.getDocumentAsync({ type: "application/pdf", copyToCacheDirectory: true });
    if (r.canceled || !r.assets[0]) return;
    const a = r.assets[0];
    await addFile({ uri: a.uri, name: a.name || "Document.pdf", type: a.mimeType || "application/pdf" });
  }

  async function addImage(r: ImagePicker.ImagePickerResult) {
    if (r.canceled || !r.assets[0]) return;
    const a = r.assets[0];
    const name = a.fileName || "Photo.jpg";
    const isHeic = /hei[cf]/i.test(a.mimeType ?? "") || /\.hei[cf]$/i.test(name);
    if (isHeic) {
      try {
        await addFile({ uri: await toJpeg(a.uri), name: name.replace(/\.hei[cf]$/i, "") + ".jpg", type: "image/jpeg" });
        return;
      } catch {
        // Conversion failed: upload the original; the reader will say it can't open it.
      }
    }
    const type = a.mimeType === "image/png" || a.mimeType === "image/heic" ? a.mimeType : "image/jpeg";
    await addFile({ uri: a.uri, name, type });
  }

  // Compatible makes iOS hand over a JPEG instead of the original HEIC, which the extractor can't read.
  const pickPhoto = async () =>
    addImage(
      await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.7,
        preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
      }),
    );

  async function scan() {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return setMessage({ tone: "error", text: t.cameraDenied });
    await addImage(await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.7 }));
  }

  const list = records.data ?? [];
  const choose = (pick: () => Promise<void>) => () => {
    setChoosing(false);
    void pick();
  };
  return (
    <Screen onRefresh={records.refresh} refreshing={records.loading} stale={records.stale}>
      <Logo />
      <Heading>{t.records}</Heading>
      <View style={{ flexDirection: "row", gap: space.m }}>
        <Button style={{ flex: 1.15, paddingHorizontal: 10 }} busy={busy} onPress={() => setChoosing(c => !c)} label={t.recScanUpload}>
          <Icon name="camera" color="white" size={19} />
          <T weight="500" numberOfLines={1} style={{ fontSize: 15.5, color: "white", flexShrink: 1 }}>{t.recScanUpload}</T>
        </Button>
        <Button secondary style={{ flex: 1, paddingHorizontal: 10 }} disabled={busy} onPress={() => router.push("/type-record")} label={t.recType}>
          <Icon name="pencil" color={color.blue} size={18} />
          <T weight="500" numberOfLines={1} style={{ fontSize: 15.5, color: "#30445e", flexShrink: 1 }}>{t.recType}</T>
        </Button>
      </View>
      {choosing && (
        <View style={styles.choices}>
          <Choice icon="camera" label={t.scanCamera} onPress={choose(scan)} />
          <Choice icon="image" label={t.uploadPhoto} onPress={choose(pickPhoto)} />
          <Choice icon="records" label={t.uploadPdf} onPress={choose(pickPdf)} last />
        </View>
      )}
      {busy && <Notice>{t.uploading}</Notice>}
      {message && <Notice tone={message.tone}>{message.text}</Notice>}
      {!records.data && records.loading && <Loading />}
      {!records.data && records.error && <LoadError onRetry={records.refresh} />}
      {records.data && (
        <ListSection icon="records" tone="green" title={t.recList} count={list.length}>
          {list.length === 0 && <ListEmpty>{t.noneYet}</ListEmpty>}
          {list.map((r, i) => {
            const scan = scans[r.id];
            const status = scan && scanStatus(t, scan);
            // Ready (with suggestions) and failed scans open the review screen; the rest open the record.
            const toReview = scan?.status === "error" || (scan?.status === "ready" && scan.suggestions.length > 0);
            const tag = status ? <Pill tone={status.tone}>{status.text}</Pill> : r.simulated ? <Pill tone="warn">{t.simulated}</Pill> : null;
            return (
              <ListRow
                key={r.id}
                last={i === list.length - 1}
                label={[r.title, r.facility, r.date, status?.text].filter(Boolean).join(", ")}
                onPress={() => router.push(toReview ? { pathname: "/review", params: { recordId: r.id } } : { pathname: "/record/[id]", params: { id: r.id } })}
              >
                <View style={{ flexDirection: "row", gap: 14 }}>
                  <Paper />
                  <View style={{ flex: 1, gap: 3 }}>
                    <T weight="500" style={{ fontSize: 15.5, lineHeight: 21, color: color.ink }}>{r.title}</T>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                      {!!r.facility && <Icon name="pin" color={color.muted} size={13} />}
                      <T numberOfLines={1} style={{ flex: 1, fontSize: 12.5, color: color.muted }}>{r.facility || (r.kind === "encounter" ? "Visit" : "")}</T>
                      <T style={{ fontSize: 12.5, color: color.muted, fontVariant: ["tabular-nums"] }}>{r.date}</T>
                    </View>
                    {!!(r.summary || (!r.hasFile && r.body)) && <T numberOfLines={2} style={{ fontSize: 13.5, lineHeight: 19, color: color.body }}>{r.summary || r.body}</T>}
                    {tag && <View style={{ marginTop: 3 }}>{tag}</View>}
                  </View>
                </View>
              </ListRow>
            );
          })}
        </ListSection>
      )}
      <Footnote>{t.restrictedNote}</Footnote>
    </Screen>
  );
}

/** A small sheet of paper standing in for the document's first page. */
function Paper() {
  return (
    <View style={styles.paper}>
      <View style={[styles.paperLine, { width: "70%", backgroundColor: color.okText, opacity: 0.55 }]} />
      {[100, 85, 100, 60].map((w, i) => (
        <View key={i} style={[styles.paperLine, { width: `${w}%` }]} />
      ))}
    </View>
  );
}

function Choice({ icon, label, onPress, last }: { icon: IconName; label: string; onPress: () => void; last?: boolean }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [styles.choice, !last && styles.choiceLine, pressed && { backgroundColor: "#f6f7f8" }]}>
      <Icon name={icon} color={color.blue} size={20} />
      <T style={{ flex: 1, fontSize: 15.5, color: color.ink }}>{label}</T>
      <Icon name="chevronRight" color={color.subtle} size={18} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  choices: { backgroundColor: color.surface, borderRadius: radius.section, borderWidth: 1, borderColor: color.line, overflow: "hidden", marginTop: -4 },
  choice: { flexDirection: "row", alignItems: "center", gap: space.m, minHeight: 52, paddingHorizontal: space.l },
  choiceLine: { borderBottomWidth: 1, borderBottomColor: "#edf0f2" },
  paper: { width: 38, height: 50, borderRadius: 4, backgroundColor: "white", borderWidth: 1, borderColor: color.line, padding: 6, gap: 4, marginTop: 2 },
  paperLine: { height: 2.5, borderRadius: 1, backgroundColor: "#d5dbe0" },
});
