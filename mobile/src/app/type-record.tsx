import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, View } from "react-native";
import type { RecordItem } from "@shared/tessera";
import { api, ApiError } from "@/lib/api";
import { ensureAutofillOptIn } from "@/lib/autofill";
import { useScans } from "@/lib/scans";
import { useSession } from "@/lib/session";
import { color, space } from "@/lib/theme";
import { Button, Field, Heading, Notice, Screen, T } from "@/components/ui";

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const DAY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * "Type it in": a visit note, letter or prescription copied by hand. Saved with the traveler's records and,
 * if they allow it, read for allergies and medicines exactly like a scanned document.
 */
export default function TypeRecord() {
  const { t } = useSession();
  const { start } = useScans();
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(today);
  const [facility, setFacility] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const dateOk = DAY.test(date.trim());
  const ready = !!title.trim() && !!text.trim() && dateOk;

  async function save() {
    setBusy(true);
    setError("");
    try {
      const record = await api<RecordItem>("/records", { body: { title: title.trim(), date: date.trim(), facility: facility.trim() || undefined, text: text.trim() } });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (await ensureAutofillOptIn(t)) start(record.id);
      router.back();
    } catch (e) {
      setError(e instanceof ApiError && e.status === 400 ? e.message.replace(/^\w+: /, "") : t.errorGeneric);
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Screen>
        <View style={{ gap: 6 }}>
          <Heading size={28}>{t.typeTitle}</Heading>
          <T style={{ color: color.muted, fontSize: 15, lineHeight: 21 }}>{t.typeLead}</T>
        </View>
        <Field label={t.typeName} hint={t.typeNameHint} value={title} onChangeText={setTitle} maxLength={120} autoCapitalize="sentences" />
        <View style={{ flexDirection: "row", gap: space.m }}>
          <View style={{ flex: 1 }}>
            <Field
              label={t.typeDate}
              hint="YYYY-MM-DD"
              value={date}
              onChangeText={v => setDate(v.replace(/[^0-9-]/g, "").slice(0, 10))}
              keyboardType="numbers-and-punctuation"
              error={date.length >= 10 && !dateOk ? "YYYY-MM-DD" : undefined}
            />
          </View>
          <View style={{ flex: 1.4 }}>
            <Field label={t.typeWhere} hint={t.typeWhereHint} value={facility} onChangeText={setFacility} maxLength={120} />
          </View>
        </View>
        <Field label={t.typeText} hint={t.typeTextHint} value={text} onChangeText={setText} multiline maxLength={20000} style={{ minHeight: 180 }} />
        {!!error && <Notice tone="error">{error}</Notice>}
        <Button busy={busy} disabled={!ready} onPress={save}>{busy ? t.saving : t.save}</Button>
        <Button secondary onPress={() => router.back()}>{t.cancel}</Button>
      </Screen>
    </KeyboardAvoidingView>
  );
}
