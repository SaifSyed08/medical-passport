import * as Haptics from "expo-haptics";
import { Redirect, router } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, View } from "react-native";
import type { Profile } from "@shared/tessera";
import { api, ApiError } from "@/lib/api";
import { primeCache } from "@/lib/cache";
import { DOB_PATTERN, languageLabelFor, saveDestination, saveIdentity } from "@/lib/identity";
import { useSession } from "@/lib/session";
import { color } from "@/lib/theme";
import { DestinationPicker } from "@/components/destination-picker";
import { Button, Field, Heading, Notice, Screen, T } from "@/components/ui";

/** First run for a blank profile: name, date of birth and destination before the card is shown. */
export default function Setup() {
  const { t, signedIn, me, refreshMe, signOut } = useSession();
  const [name, setName] = useState(me?.traveler.name ?? "");
  const [dob, setDob] = useState(me?.traveler.dob ?? "");
  const [destination, setDestination] = useState<string | null>(me?.destinationCountry ?? null);
  const [city, setCity] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (!signedIn) return <Redirect href="/login" />;

  const dobOk = DOB_PATTERN.test(dob.trim());
  const ready = !!name.trim() && dobOk && !!destination;

  async function save() {
    if (!ready || !destination) return;
    setBusy(true);
    setError("");
    try {
      await saveIdentity(name, dob);
      await saveDestination(destination);
      if (city.trim()) {
        const profile = await api<Profile>("/profile");
        primeCache("/profile", await api<Profile>("/profile", { method: "PUT", body: { ...profile, basics: { ...profile.basics, studyLocation: city.trim() } } }));
      }
      await refreshMe();
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace("/");
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
          <Heading>{t.setupTitle}</Heading>
          <T style={{ color: color.muted, lineHeight: 21 }}>{t.setupLead}</T>
        </View>
        <Field label={t.fullName} value={name} onChangeText={setName} autoComplete="off" autoCorrect={false} textContentType="none" />
        <Field
          label={t.dob}
          hint={t.dobHint}
          value={dob}
          onChangeText={v => setDob(v.replace(/[^0-9-]/g, "").slice(0, 10))}
          keyboardType="numbers-and-punctuation"
          placeholder="2003-05-01"
          error={dob.length >= 10 && !dobOk ? t.dobHint : undefined}
        />
        <View style={{ gap: 6 }}>
          <T weight="500" style={{ fontSize: 14, color: "#5b6c7b" }}>{t.destination}</T>
          <T style={{ fontSize: 13, color: color.subtle, lineHeight: 18 }}>
            {destination ? `${t.profileLanguage}: ${languageLabelFor(destination)}` : t.destinationHint}
          </T>
        </View>
        <DestinationPicker value={destination} onChange={setDestination} />
        <Field label={t.city} value={city} onChangeText={setCity} placeholder="Madrid" />
        {!!error && <Notice tone="error">{error}</Notice>}
        <Button busy={busy} disabled={!ready} onPress={save}>{t.continue}</Button>
        <Button secondary onPress={() => void signOut()}>{t.signOut}</Button>
      </Screen>
    </KeyboardAvoidingView>
  );
}
