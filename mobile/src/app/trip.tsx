import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { LANGUAGE_NAMES, LANGUAGES, type Language } from "@shared/tessera";
import { api } from "@/lib/api";
import { saveDestination } from "@/lib/identity";
import { useSession } from "@/lib/session";
import { color, space } from "@/lib/theme";
import { DestinationPicker } from "@/components/destination-picker";
import { Button, Chips, Heading, Notice, Screen, T } from "@/components/ui";

/** Destination country (sets the doctor-facing language) plus a manual language override. */
export default function Trip() {
  const { t, me, setMe } = useSession();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try {
      await fn();
      void Haptics.selectionAsync();
    } catch {
      setError(t.errorGeneric);
    } finally {
      setBusy(false);
    }
  };

  const pickCountry = (code: string) =>
    run(async () => {
      const r = await saveDestination(code);
      if (me) setMe({ ...me, language: r.language, destinationCountry: r.destinationCountry });
    });

  const pickLanguage = (language: Language) =>
    run(async () => {
      await api("/prefs", { method: "PUT", body: { language } });
      if (me) setMe({ ...me, language });
    });

  return (
    <Screen>
      <Heading size={28}>{t.yourTrip}</Heading>
      <T style={{ color: color.muted, lineHeight: 21 }}>{t.tripLead}</T>
      {!!error && <Notice tone="error">{error}</Notice>}
      <View style={{ gap: space.s }}>
        <T weight="500" style={{ fontSize: 14, color: "#5b6c7b" }}>{t.profileLanguage}</T>
        <Chips<Language>
          label={t.profileLanguage}
          value={me?.language ?? "en"}
          onChange={pickLanguage}
          options={LANGUAGES.map(l => ({ value: l, label: LANGUAGE_NAMES[l] }))}
        />
      </View>
      <T weight="500" style={{ fontSize: 14, color: "#5b6c7b" }}>{t.destination}</T>
      <DestinationPicker value={me?.destinationCountry} onChange={pickCountry} />
      <Button secondary disabled={busy} onPress={() => router.back()}>{t.done}</Button>
    </Screen>
  );
}
