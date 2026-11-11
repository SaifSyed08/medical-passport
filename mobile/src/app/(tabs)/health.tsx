import { router, type Href } from "expo-router";
import { View } from "react-native";
import { destinationName, LANGUAGE_NAMES, type Profile } from "@shared/tessera";
import { useResource } from "@/lib/cache";
import type { ItemKind } from "@/lib/profile";
import { useSession } from "@/lib/session";
import { color, space } from "@/lib/theme";
import { Button, Heading, LoadError, Loading, Logo, Notice, Pill, Row, Screen, Section, T } from "@/components/ui";

const severityTone = { severe: "error", moderate: "warn", mild: "muted" } as const;
const small = { minHeight: 44, paddingHorizontal: 14, paddingVertical: 8 };

export default function Health() {
  const { t, me } = useSession();
  const profile = useResource<Profile>("/profile");
  const p = profile.data;
  const add = (kind: ItemKind, label: string) => (
    <Button secondary onPress={() => router.push({ pathname: "/item/[kind]", params: { kind } })} label={`${t.add} ${label}`} style={small}>
      {t.add}
    </Button>
  );
  const editButton = (href: Href, label: string) => (
    <Button secondary onPress={() => router.push(href)} label={`${t.edit} ${label}`} style={small}>
      {t.edit}
    </Button>
  );
  const edit = (kind: ItemKind, id: string) => () => router.push({ pathname: "/item/[kind]", params: { kind, id } });
  const empty = <T style={{ color: color.subtle, paddingVertical: 6 }}>{t.noneYet}</T>;
  const trip = destinationName(me?.destinationCountry);
  const hasInsurance = !!p && Object.values(p.insurance).some(v => v.trim());

  return (
    <Screen onRefresh={profile.refresh} refreshing={profile.loading} stale={profile.stale}>
      <Logo />
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.m, flexWrap: "wrap" }}>
        <Heading>{t.health}</Heading>
        {me?.traveler.sample && <Pill tone="muted">{t.sampleBadge}</Pill>}
      </View>
      {!p && profile.loading && <Loading />}
      {!p && profile.error && <LoadError onRetry={profile.refresh} />}
      {p && (
        <>
          <Section title={t.personalDetails} action={editButton("/details", t.personalDetails)}>
            <Row title={me?.traveler.name || t.notRecorded} detail={`${t.dob}: ${me?.traveler.dob || t.notRecorded}`} last={false} />
            <Row
              title={trip ?? t.chooseCountry}
              detail={`${t.profileLanguage}: ${LANGUAGE_NAMES[me?.language ?? "en"]}`}
              onPress={() => router.push("/trip")}
              label={`${t.yourTrip}: ${trip ?? t.chooseCountry}`}
              last
            />
          </Section>
          <Section title={t.allergies} tone="allergy" action={add("allergy", t.allergies)}>
            {p.allergies.length === 0 && empty}
            {p.allergies.map((a, i) => (
              <Row key={a.id} title={a.substance} detail={a.reaction} last={i === p.allergies.length - 1} onPress={edit("allergy", a.id)} right={<Pill tone={severityTone[a.severity]}>{a.severity[0].toUpperCase() + a.severity.slice(1)}</Pill>} />
            ))}
          </Section>
          <Section title={t.medications} action={add("medication", t.medications)}>
            {p.medications.length === 0 && empty}
            {p.medications.map((m, i) => (
              <Row key={m.id} title={`${m.generic}${m.brand ? ` (${m.brand})` : ""}`} detail={[m.dose, m.schedule].filter(Boolean).join(" · ")} last={i === p.medications.length - 1} onPress={edit("medication", m.id)} />
            ))}
          </Section>
          <Section title={t.conditions} action={add("condition", t.conditions)}>
            {p.conditions.length === 0 && empty}
            {p.conditions.map((c, i) => (
              <Row key={c.id} title={c.name} detail={c.note} last={i === p.conditions.length - 1} onPress={edit("condition", c.id)} />
            ))}
          </Section>
          <Section title={t.basics} action={editButton("/basics", t.basics)}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 8, flexWrap: "wrap", gap: space.l }}>
              <Vital label={t.bloodType} value={p.bloodType === "Unknown" ? "—" : p.bloodType} empty={p.bloodType === "Unknown"} notRecorded={t.notRecorded} />
              <Vital label={t.heightCm} value={p.basics.heightCm == null ? "—" : `${p.basics.heightCm} cm`} empty={p.basics.heightCm == null} notRecorded={t.notRecorded} />
              <Vital label={t.weightKg} value={p.basics.weightKg == null ? "—" : `${p.basics.weightKg} kg`} empty={p.basics.weightKg == null} notRecorded={t.notRecorded} />
            </View>
            {(p.basics.sex || p.basics.homeCountry || p.basics.studyLocation) ? (
              <T style={{ color: color.body, marginTop: space.m, lineHeight: 21 }}>
                {[p.basics.sex, p.basics.homeCountry && `From ${p.basics.homeCountry}`, p.basics.studyLocation && `Studying in ${p.basics.studyLocation}`].filter(Boolean).join(" · ")}
              </T>
            ) : null}
          </Section>
          <Section title={t.contacts} action={add("contact", t.contacts)}>
            {p.contacts.length === 0 && empty}
            {p.contacts.map((c, i) => (
              <Row key={c.id} title={c.name} detail={[c.relationship, c.phone].filter(Boolean).join(" · ")} last={i === p.contacts.length - 1} onPress={edit("contact", c.id)} />
            ))}
          </Section>
          <Section title={t.insurance} action={editButton("/insurance", t.insurance)}>
            {hasInsurance ? (
              <Row title={p.insurance.plan || t.notRecorded} detail={[p.insurance.memberId && `Member ${p.insurance.memberId}`, p.insurance.group && `Group ${p.insurance.group}`].filter(Boolean).join(" · ")} last />
            ) : (
              <T style={{ color: color.subtle, paddingVertical: 6 }}>{t.noneYetInsurance}</T>
            )}
          </Section>
          <Notice>{t.untranslatedNote}</Notice>
        </>
      )}
    </Screen>
  );
}

function Vital({ label, value, empty, notRecorded }: { label: string; value: string; empty: boolean; notRecorded: string }) {
  return (
    <View accessible accessibilityLabel={`${label}: ${empty ? notRecorded : value}`} style={{ gap: 4 }}>
      <T serif style={{ fontSize: 26, color: empty ? color.subtle : color.sectionTitle }}>{value}</T>
      <T style={{ fontSize: 12, color: "#94a0a8" }}>{label}</T>
    </View>
  );
}
