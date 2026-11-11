import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform } from "react-native";
import type { Insurance, Profile } from "@shared/tessera";
import { ApiError } from "@/lib/api";
import { useResource } from "@/lib/cache";
import { saveProfile } from "@/lib/profile";
import { useSession } from "@/lib/session";
import { Button, Field, Heading, Notice, Screen } from "@/components/ui";

export default function InsuranceForm() {
  const { t } = useSession();
  const profile = useResource<Profile>("/profile");
  const [form, setForm] = useState<Insurance>(() => profile.data?.insurance ?? { plan: "", memberId: "", group: "", phone: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (k: keyof Insurance) => (v: string) => setForm(f => ({ ...f, [k]: v }));

  async function save() {
    if (!profile.data) return;
    setBusy(true);
    setError("");
    try {
      await saveProfile({ ...profile.data, insurance: form });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (e) {
      setError(e instanceof ApiError && e.status === 400 ? e.message : t.errorGeneric);
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Screen>
        <Heading size={28}>{t.insurance}</Heading>
        <Field label={t.plan} value={form.plan} onChangeText={set("plan")} />
        <Field label={t.memberId} value={form.memberId} onChangeText={set("memberId")} autoCapitalize="characters" autoCorrect={false} />
        <Field label={t.group} value={form.group} onChangeText={set("group")} autoCapitalize="characters" autoCorrect={false} />
        <Field label={t.insurancePhone} value={form.phone} onChangeText={set("phone")} keyboardType="phone-pad" />
        <Notice>{t.restrictedNote}</Notice>
        {!!error && <Notice tone="error">{error}</Notice>}
        <Button busy={busy} disabled={!profile.data} onPress={save}>{busy ? t.saving : t.save}</Button>
        <Button secondary onPress={() => router.back()}>{t.cancel}</Button>
      </Screen>
    </KeyboardAvoidingView>
  );
}
