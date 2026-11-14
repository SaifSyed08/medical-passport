import { File, Paths } from "expo-file-system";
import { router, useLocalSearchParams } from "expo-router";
import * as Sharing from "expo-sharing";
import { useEffect, useState } from "react";
import type { RecordItem } from "@shared/tessera";
import { api, API_URL, authHeader } from "@/lib/api";
import { EXTRACTOR_URL, getAutofillPref } from "@/lib/autofill";
import { useResource } from "@/lib/cache";
import { ask } from "@/lib/confirm";
import { useSession } from "@/lib/session";
import { color } from "@/lib/theme";
import { Button, Heading, Notice, Pill, Screen, Section, T } from "@/components/ui";

export default function RecordDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useSession();
  const records = useResource<RecordItem[]>("/records");
  const r = records.data?.find(x => x.id === id);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [canSuggest, setCanSuggest] = useState(false);
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
  return (
    <Screen>
      <Heading size={28}>{r.title}</Heading>
      <T style={{ color: color.muted }}>{[r.date, r.facility].filter(Boolean).join(" · ")}</T>
      {r.simulated && <Pill tone="warn">{t.simulated}</Pill>}
      {r.summary && (
        <Section title={r.simulated ? "Extracted summary (simulated)" : "Summary"}>
          <T style={{ color: color.body, lineHeight: 22 }}>{r.summary}</T>
        </Section>
      )}
      {r.body && (
        <Section>
          <T style={{ color: color.body, lineHeight: 22 }}>{r.body}</T>
        </Section>
      )}
      {r.hasFile && <Button secondary busy={busy} onPress={openFile}>Open original file</Button>}
      {r.kind === "upload" && canSuggest && (
        <Button secondary disabled={busy} onPress={() => router.push({ pathname: "/review", params: { recordId: r.id } })}>{t.suggestUpdates}</Button>
      )}
      {!!error && <Notice tone="error">{error}</Notice>}
      <Notice>{t.restrictedNote}</Notice>
      {r.kind === "upload" && <Button secondary danger disabled={busy} onPress={remove}>{t.deleteDocument}</Button>}
    </Screen>
  );
}
