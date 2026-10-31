import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform } from "react-native";
import { ApiError } from "@/lib/api";
import { DOB_PATTERN, saveIdentity } from "@/lib/identity";
import { useSession } from "@/lib/session";
import { Button, Field, Heading, Notice, Screen } from "@/components/ui";

/** Edit the name and date of birth printed on the card. */
export default function Details() {
  const { t, me, refreshMe } = useSession();
  const [name, setName] = useState(me?.traveler.name ?? "");
  const [dob, setDob] = useState(me?.traveler.dob ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const dobOk = DOB_PATTERN.test(dob.trim());

  async function save() {
    setBusy(true);
    setError("");
    try {
      await saveIdentity(name, dob);
      await refreshMe();
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
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
        <Heading size={28}>{t.personalDetails}</Heading>
        <Field label={t.fullName} value={name} onChangeText={setName} autoComplete="off" autoCorrect={false} />
        <Field
          label={t.dob}
          hint={t.dobHint}
          value={dob}
          onChangeText={v => setDob(v.replace(/[^0-9-]/g, "").slice(0, 10))}
          keyboardType="numbers-and-punctuation"
          error={dob.length >= 10 && !dobOk ? t.dobHint : undefined}
        />
        {!!error && <Notice tone="error">{error}</Notice>}
        <Button busy={busy} disabled={!name.trim() || !dobOk} onPress={save}>{busy ? t.saving : t.save}</Button>
        <Button secondary onPress={() => router.back()}>{t.cancel}</Button>
      </Screen>
    </KeyboardAvoidingView>
  );
}
