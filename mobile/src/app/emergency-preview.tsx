import { router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { LANGUAGE_NAMES, LANGUAGES, type EmergencyView, type Language } from "@shared/tessera";
import { useResource } from "@/lib/cache";
import { useSession } from "@/lib/session";
import { color, space } from "@/lib/theme";
import { Button, Chips, Heading, LoadError, Loading, Notice, Pill, Screen, Section, T } from "@/components/ui";

/**
 * The traveler's preview of what a verified clinician will see in emergency scope.
 * Built by the same server function the future clinician page will use.
 */
export default function EmergencyPreview() {
  const { t, me } = useSession();
  const [lang, setLang] = useState<Language>(me?.language ?? "en");
  const view = useResource<EmergencyView>(`/profile/emergency-preview?lang=${lang}`);
  const v = view.data;

  return (
    <Screen stale={view.stale}>
      <Heading size={28}>{t.previewProfile}</Heading>
      <Chips<Language> label={t.profileLanguage} value={lang} onChange={setLang} options={LANGUAGES.map(l => ({ value: l, label: LANGUAGE_NAMES[l] }))} />
      {!v && view.loading && <Loading />}
      {!v && view.error && <LoadError onRetry={view.refresh} />}
      {v && (
        <View style={{ gap: space.l }}>
          <T serif style={{ fontSize: 30, color: color.ink }}>{v.name}</T>
          {v.sections.map(s => (
            <Section key={s.category} title={s.title} tone={s.category === "allergies" ? "allergy" : undefined}>
              {s.items.map((it, i) => (
                <View key={i} style={{ paddingVertical: 8, gap: 4, borderBottomWidth: i === s.items.length - 1 ? 0 : 1, borderBottomColor: "#edf0f2" }}>
                  <View style={{ flexDirection: "row", gap: space.s, alignItems: "center", flexWrap: "wrap" }}>
                    <T weight={it.severe ? "700" : undefined} style={{ fontSize: 16, color: it.severe ? color.errorText : it.empty ? color.subtle : color.ink, fontStyle: it.empty ? "italic" : "normal" }}>{it.text}</T>
                    {it.untranslated && <Pill tone="muted">EN</Pill>}
                  </View>
                  {it.detail && <T style={{ color: color.body, lineHeight: 21 }}>{it.detail}</T>}
                </View>
              ))}
            </Section>
          ))}
          <Notice>{me?.demoNotice ?? t.demoBanner}</Notice>
        </View>
      )}
      <Button secondary onPress={() => router.back()}>{t.close}</Button>
    </Screen>
  );
}
