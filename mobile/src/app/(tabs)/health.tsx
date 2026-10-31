import { router } from "expo-router";
import { View } from "react-native";
import type { Profile } from "@shared/tessera";
import { useResource } from "@/lib/cache";
import type { ItemKind } from "@/lib/profile";
import { useSession } from "@/lib/session";
import { color, space } from "@/lib/theme";
import { Button, Heading, LoadError, Loading, Logo, Notice, Pill, Row, Screen, Section, T } from "@/components/ui";

const severityTone = { severe: "error", moderate: "warn", mild: "muted" } as const;

export default function Health() {
  const { t } = useSession();
  const profile = useResource<Profile>("/profile");
  const p = profile.data;
  const add = (kind: ItemKind, label: string) => (
    <Button secondary onPress={() => router.push({ pathname: "/item/[kind]", params: { kind } })} label={`${t.add} ${label}`} style={{ minHeight: 44, paddingHorizontal: 14, paddingVertical: 8 }}>
      {t.add}
    </Button>
  );
  const edit = (kind: ItemKind, id: string) => () => router.push({ pathname: "/item/[kind]", params: { kind, id } });

  return (
    <Screen onRefresh={profile.refresh} refreshing={profile.loading} stale={profile.stale}>
      <Logo />
      <Heading>{t.health}</Heading>
      {!p && profile.loading && <Loading />}
      {!p && profile.error && <LoadError onRetry={profile.refresh} />}
      {p && (
        <>
          <Section title={t.allergies} tone="allergy" action={add("allergy", t.allergies)}>
            {p.allergies.map((a, i) => (
              <Row key={a.id} title={a.substance} detail={a.reaction} last={i === p.allergies.length - 1} onPress={edit("allergy", a.id)} right={<Pill tone={severityTone[a.severity]}>{a.severity[0].toUpperCase() + a.severity.slice(1)}</Pill>} />
            ))}
          </Section>
          <Section title={t.medications} action={add("medication", t.medications)}>
            {p.medications.map((m, i) => (
              <Row key={m.id} title={`${m.generic}${m.brand ? ` (${m.brand})` : ""}`} detail={[m.dose, m.schedule].filter(Boolean).join(" · ")} last={i === p.medications.length - 1} onPress={edit("medication", m.id)} />
            ))}
          </Section>
          <Section title={t.conditions} action={add("condition", t.conditions)}>
            {p.conditions.map((c, i) => (
              <Row key={c.id} title={c.name} detail={c.note} last={i === p.conditions.length - 1} onPress={edit("condition", c.id)} />
            ))}
          </Section>
          <Section title={t.basics} action={<Button secondary onPress={() => router.push("/basics")} label={`${t.edit} ${t.basics}`} style={{ minHeight: 44, paddingHorizontal: 14, paddingVertical: 8 }}>{t.edit}</Button>}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 8, flexWrap: "wrap", gap: space.l }}>
              <Vital label={t.bloodType} value={p.bloodType} />
              <Vital label="Height" value={`${p.basics.heightCm} cm`} />
              <Vital label="Weight" value={`${p.basics.weightKg} kg`} />
            </View>
            <T style={{ color: color.body, marginTop: space.m, lineHeight: 21 }}>{`${p.basics.sex} · From ${p.basics.homeCountry} · Studying in ${p.basics.studyLocation}`}</T>
          </Section>
          <Section title={t.contacts} action={add("contact", t.contacts)}>
            {p.contacts.map((c, i) => (
              <Row key={c.id} title={c.name} detail={`${c.relationship} · ${c.phone}`} last={i === p.contacts.length - 1} onPress={edit("contact", c.id)} />
            ))}
          </Section>
          <Section title={t.insurance}>
            <Row title={p.insurance.plan} detail={`Member ${p.insurance.memberId} · Group ${p.insurance.group}`} last />
          </Section>
          <Notice>{t.untranslatedNote}</Notice>
        </>
      )}
    </Screen>
  );
}

function Vital({ label, value }: { label: string; value: string }) {
  return (
    <View accessible accessibilityLabel={`${label}: ${value}`} style={{ gap: 4 }}>
      <T serif style={{ fontSize: 26, color: color.sectionTitle }}>{value}</T>
      <T style={{ fontSize: 12, color: "#94a0a8" }}>{label}</T>
    </View>
  );
}
