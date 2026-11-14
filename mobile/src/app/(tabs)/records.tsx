import * as DocumentPicker from "expo-document-picker";
import { File as FsFile } from "expo-file-system";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import type { RecordItem } from "@shared/tessera";
import { api, ApiError } from "@/lib/api";
import { ensureAutofillOptIn } from "@/lib/autofill";
import { useResource } from "@/lib/cache";
import { useSession } from "@/lib/session";
import { space } from "@/lib/theme";
import { Button, Heading, LoadError, Loading, Logo, Notice, Pill, Row, Screen, Section } from "@/components/ui";

type Pick = { uri: string; name: string; type: string };

export default function Records() {
  const { t } = useSession();
  const records = useResource<RecordItem[]>("/records");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

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

  /** After an upload: ask once whether to read documents, then open the review if opted in. */
  async function maybeAutofill(record: RecordItem) {
    if (await ensureAutofillOptIn(t)) router.push({ pathname: "/review", params: { recordId: record.id } });
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
    const type = a.mimeType === "image/png" || a.mimeType === "image/heic" ? a.mimeType : "image/jpeg";
    await addFile({ uri: a.uri, name: a.fileName || "Photo.jpg", type });
  }

  const pickPhoto = async () => addImage(await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.7 }));

  async function scan() {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return setMessage({ tone: "error", text: t.cameraDenied });
    await addImage(await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.7 }));
  }

  const list = records.data ?? [];
  return (
    <Screen onRefresh={records.refresh} refreshing={records.loading} stale={records.stale}>
      <Logo />
      <Heading>{t.records}</Heading>
      <Notice>{t.restrictedNote}</Notice>
      <View style={{ flexDirection: "row", gap: space.m }}>
        <Button style={{ flex: 1 }} busy={busy} onPress={pickPdf}>{t.uploadPdf}</Button>
        <Button secondary style={{ flex: 1 }} disabled={busy} onPress={pickPhoto}>{t.uploadPhoto}</Button>
      </View>
      <Button secondary disabled={busy} onPress={scan}>{t.scanCamera}</Button>
      {busy && <Notice>{t.uploading}</Notice>}
      {message && <Notice tone={message.tone}>{message.text}</Notice>}
      {!records.data && records.loading && <Loading />}
      {!records.data && records.error && <LoadError onRetry={records.refresh} />}
      {list.length > 0 && (
        <Section>
          {list.map((r, i) => (
            <Row
              key={r.id}
              title={r.title}
              detail={[r.date, r.facility].filter(Boolean).join(" · ")}
              last={i === list.length - 1}
              onPress={() => router.push({ pathname: "/record/[id]", params: { id: r.id } })}
              right={r.simulated ? <Pill tone="warn">{t.simulated}</Pill> : r.kind === "encounter" ? <Pill tone="muted">Visit</Pill> : undefined}
            />
          ))}
        </Section>
      )}
    </Screen>
  );
}
