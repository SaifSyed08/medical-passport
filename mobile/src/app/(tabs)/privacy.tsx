import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import type { AccessRequest, Card, Language, Privacy } from "@shared/tessera";
import { pollActivity } from "@/lib/activity";
import { api } from "@/lib/api";
import { primeCache, useResource } from "@/lib/cache";
import { confirmWithBiometrics } from "@/lib/confirm";
import { useSession } from "@/lib/session";
import { color, space } from "@/lib/theme";
import { Button, Heading, Logo, Notice, Pill, Screen, Section, Segmented, T } from "@/components/ui";

// Categories a clinician can see in emergency scope. Insurance, visits and documents are
// always restricted to an approved full-record request.
const EMERGENCY_CATEGORIES = ["allergies", "medications", "conditions", "bloodType", "contacts"] as const;

export default function PrivacyScreen() {
  const { t, me, setMe, uiLang, setUiLang, signOut } = useSession();
  const privacy = useResource<Privacy>("/privacy");
  const requests = useResource<AccessRequest[]>("/requests");
  const card = useResource<Card>("/card");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    setError("");
    try {
      await fn();
    } catch {
      setError(t.errorGeneric);
    } finally {
      setBusy("");
    }
  };

  const setCategory = (c: keyof Privacy, v: Privacy[keyof Privacy]) =>
    run("privacy", async () => {
      if (!privacy.data) return;
      primeCache("/privacy", await api<Privacy>("/privacy", { method: "PUT", body: { ...privacy.data, [c]: v } }));
    });

  const setDoctorLanguage = (language: Language) =>
    run("lang", async () => {
      await api("/prefs", { method: "PUT", body: { language } });
      if (me) setMe({ ...me, language });
    });

  const decide = (r: AccessRequest, decision: "approved" | "denied") =>
    run(r.id, async () => {
      const label = `${decision === "approved" ? t.approve : t.deny}: ${r.clinician}`;
      if (!(await confirmWithBiometrics(label, t.cancel))) return;
      await api(`/requests/${r.id}`, { body: { decision } });
      await requests.refresh();
      await pollActivity(false, "").catch(() => {});
    });

  const toggleFreeze = () =>
    run("freeze", async () => {
      const frozen = card.data?.status === "active";
      primeCache("/card", await api<Card>("/card/freeze", { body: { frozen } }));
      void Haptics.notificationAsync(frozen ? Haptics.NotificationFeedbackType.Warning : Haptics.NotificationFeedbackType.Success);
    });

  const pending = (requests.data ?? []).filter(r => r.status === "pending");
  const past = (requests.data ?? []).filter(r => r.status !== "pending").slice(0, 5);
  const labels: Record<(typeof EMERGENCY_CATEGORIES)[number], string> = {
    allergies: t.allergies, medications: t.medications, conditions: t.conditions, bloodType: t.bloodType, contacts: t.contacts,
  };

  return (
    <Screen
      onRefresh={() => void Promise.all([privacy.refresh(), requests.refresh(), card.refresh()])}
      refreshing={privacy.loading || requests.loading}
      stale={privacy.stale || requests.stale}
    >
      <Logo />
      <Heading>{t.privacy}</Heading>
      {!!error && <Notice tone="error">{error}</Notice>}

      <Section title={t.requests}>
        {pending.length === 0 && <T style={{ color: color.body }}>{t.noRequests}</T>}
        {pending.map(r => (
          <View key={r.id} style={{ gap: space.m, paddingVertical: space.s }} accessibilityLabel={`${r.clinician}, ${r.facility}: ${r.reason}`}>
            <Pill tone="warn">{t.pending}</Pill>
            <T weight="500" style={{ fontSize: 16 }}>{`${r.clinician} · ${r.facility}`}</T>
            <T style={{ color: color.body, lineHeight: 21 }}>{r.reason}</T>
            <View style={{ flexDirection: "row", gap: space.m }}>
              <Button style={{ flex: 1 }} busy={busy === r.id} onPress={() => decide(r, "approved")} label={`${t.approve} ${r.clinician}`}>{t.approve}</Button>
              <Button secondary danger style={{ flex: 1 }} disabled={busy === r.id} onPress={() => decide(r, "denied")} label={`${t.deny} ${r.clinician}`}>{t.deny}</Button>
            </View>
          </View>
        ))}
        {past.map(r => (
          <View key={r.id} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingTop: space.s, gap: space.m }}>
            <T style={{ flex: 1, color: color.body }}>{r.clinician}</T>
            <Pill tone={r.status === "approved" ? "ok" : "muted"}>{r.status === "approved" ? t.approved : t.denied}</Pill>
          </View>
        ))}
      </Section>

      <Section title={t.emergencyShows}>
        <T style={{ color: color.body, lineHeight: 21, marginBottom: space.s }}>{t.emergencyLead}</T>
        {privacy.data &&
          EMERGENCY_CATEGORIES.map(c => (
            <View key={c} style={{ gap: 6, paddingVertical: 8 }}>
              <T weight="500">{labels[c]}</T>
              <Segmented
                label={labels[c]}
                value={privacy.data![c]}
                onChange={v => setCategory(c, v)}
                options={[{ value: "emergency", label: t.emergency }, { value: "restricted", label: t.restricted }]}
              />
            </View>
          ))}
        <T style={{ color: color.subtle, fontSize: 13, marginTop: space.s }}>{`${t.insurance} · ${t.records}: ${t.restricted}`}</T>
        <Button secondary style={{ marginTop: space.m }} onPress={() => router.push("/emergency-preview")}>{t.previewProfile}</Button>
      </Section>

      <Section title={t.doctorLanguage}>
        <T style={{ color: color.body, marginBottom: space.s }}>{t.doctorLanguageLead}</T>
        <Segmented<Language> label={t.doctorLanguage} value={me?.language ?? "ja"} onChange={setDoctorLanguage} options={[{ value: "ja", label: "日本語" }, { value: "en", label: "English" }]} />
      </Section>

      <Section title={card.data?.status === "frozen" ? t.cardFrozen : t.freezeCard}>
        <T style={{ color: color.body, marginBottom: space.s }}>{t.freezeLead}</T>
        <Button secondary={card.data?.status !== "frozen"} danger={card.data?.status === "active"} busy={busy === "freeze"} disabled={!card.data} onPress={toggleFreeze}>
          {card.data?.status === "frozen" ? t.unfreezeCard : t.freezeCard}
        </Button>
      </Section>

      <Section title={t.account}>
        <T weight="500" style={{ marginBottom: 6 }}>{t.appLanguage}</T>
        <Segmented<Language> label={t.appLanguage} value={uiLang} onChange={setUiLang} options={[{ value: "en", label: "English" }, { value: "ja", label: "日本語" }]} />
        <Button secondary style={{ marginTop: space.l }} onPress={() => void signOut()}>{t.signOut}</Button>
      </Section>
    </Screen>
  );
}

