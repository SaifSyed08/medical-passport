import { router, type Href } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { destinationName, LANGUAGE_NAMES, SEVERITY_LABELS, type Language, type Profile, type RecordItem } from "@shared/tessera";
import { useResource } from "@/lib/cache";
import { flag } from "@/lib/flag";
import { homeCode } from "@/lib/interpreter";
import type { ItemKind } from "@/lib/profile";
import { aiField, recordText, useTranslation, type RecordText } from "@/lib/translate";
import { useSession } from "@/lib/session";
import { color, radius, space } from "@/lib/theme";
import { Icon } from "@/components/icons";
import { Badge, Footnote, ListEmpty, ListRow, ListSection, LoadError, Loading, Logo, Pill, Screen, Segmented, SmallButton, T } from "@/components/ui";

const severityTone = { severe: "error", moderate: "warn", mild: "muted" } as const;

const age = (dob: string) => {
  const d = new Date(`${dob}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  return now.getFullYear() - d.getFullYear() - (now < new Date(now.getFullYear(), d.getMonth(), d.getDate()) ? 1 : 0);
};
const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0]!.toUpperCase())
    .join("");

type Translatable = { tr?: Partial<Record<string, Partial<Record<string, string>>>> };
type Shown = { text: string; en: boolean };

/**
 * A field as a doctor reading `lang` sees it: the stored translation (the one the doctor page uses), else the AI
 * translation of the record, else the English original marked EN.
 */
function inLang(lang: Language, item: Translatable & { id: string }, field: string, original: string, ai?: { data: RecordText | null; list: keyof RecordText }): Shown {
  if (lang === "en" || !original) return { text: original, en: false };
  const stored = item.tr?.[lang]?.[field];
  if (stored) return { text: stored, en: false };
  const machine = ai && aiField(ai.data, ai.list, item.id, field);
  return machine ? { text: machine, en: false } : { text: original, en: true };
}

/** Text with a small "EN" tag when it hasn't been translated into the language being shown. */
function Tx({ v, style, weight }: { v: Shown; style?: object; weight?: "500" }) {
  return (
    <T weight={weight} style={style}>
      {v.text}
      {v.en ? <T style={styles.enTag}>{"  EN"}</T> : null}
    </T>
  );
}

export default function Health() {
  const { t, me } = useSession();
  const profile = useResource<Profile>("/profile");
  const p = profile.data;
  // The switch shows the record in English or in the language doctors on this trip read.
  const docLang: Language = me?.language ?? "en";
  const [view, setView] = useState<Language>("en");
  const lang: Language = docLang !== "en" && view === docLang ? docLang : "en";
  // The same text as the Records tab sends, so one translation serves both.
  const records = useResource<RecordItem[]>("/records");
  const tr = useTranslation(recordText(p, records.data), docLang, lang !== "en" && !!p);
  const ai = (list: keyof RecordText) => ({ data: tr.data, list });
  const add = (kind: ItemKind, label: string, tone: "allergy" | "blue" = "blue") => (
    <SmallButton tone={tone} onPress={() => router.push({ pathname: "/item/[kind]", params: { kind } })} label={`${t.add} ${label}`}>
      {t.add}
    </SmallButton>
  );
  const editButton = (href: Href, label: string) => (
    <SmallButton icon="pencil" onPress={() => router.push(href)} label={`${t.edit} ${label}`}>
      {t.edit}
    </SmallButton>
  );
  const edit = (kind: ItemKind, id: string) => () => router.push({ pathname: "/item/[kind]", params: { kind, id } });
  const name = me?.traveler.name || t.notRecorded;
  const dob = me?.traveler.dob;
  const years = dob ? age(dob) : null;
  const trip = destinationName(me?.destinationCountry);
  const home = p?.basics.homeCountry?.trim();
  const hasInsurance = !!p && Object.values(p.insurance).some(v => v.trim());
  const blood = p && p.bloodType !== "Unknown" ? `${t.bloodType} ${p.bloodType}` : null;

  return (
    <Screen onRefresh={profile.refresh} refreshing={profile.loading} stale={profile.stale}>
      <Logo />
      <View style={styles.profile}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${name}. ${t.edit} ${t.personalDetails}`}
          onPress={() => router.push("/details")}
          style={({ pressed }) => [styles.who, pressed && { opacity: 0.7 }]}
        >
          <View style={styles.avatar}>
            <T weight="500" style={{ color: "white", fontSize: 20, letterSpacing: 0.5 }}>{initials(name) || "?"}</T>
          </View>
          <View style={{ flex: 1, gap: 3 }}>
            <T serif accessibilityRole="header" style={{ fontSize: 24, lineHeight: 28, letterSpacing: -0.4, color: color.ink }}>{name}</T>
            <T style={{ fontSize: 13.5, lineHeight: 19, color: color.body }}>
              {[years != null && t.ageYears.replace("{n}", String(years)), dob ? t.bornOn.replace("{d}", dob) : `${t.dob}: ${t.notRecorded}`, blood].filter(Boolean).join(" · ")}
            </T>
            {me?.traveler.sample && <Pill tone="muted">{t.sampleBadge}</Pill>}
          </View>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${t.yourTrip}: ${trip ?? t.chooseCountry}. ${t.profileLanguage}: ${LANGUAGE_NAMES[me?.language ?? "en"]}`}
          onPress={() => router.push("/trip")}
          style={({ pressed }) => [styles.trip, pressed && { backgroundColor: "#f6f7f8" }]}
        >
          <View style={{ flex: 1, gap: 2 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
              {home ? <T style={styles.place}>{`${flag(homeCode(home))} ${home}`}</T> : null}
              {home ? <Icon name="arrowRight" color={color.subtle} size={14} /> : null}
              <T style={styles.place}>{trip ? `${flag(me?.destinationCountry)} ${trip}`.trim() : t.chooseCountry}</T>
            </View>
            <T style={{ fontSize: 12.5, color: color.muted }}>{`${t.profileLanguage}: ${LANGUAGE_NAMES[me?.language ?? "en"]}`}</T>
          </View>
          <Icon name="chevronRight" color={color.subtle} size={18} />
        </Pressable>
      </View>

      {docLang !== "en" && (
        <View style={{ gap: space.s }}>
          <View style={{ alignSelf: "flex-start", minWidth: 250 }}>
            <Segmented
              label={t.viewIn}
              value={lang}
              onChange={setView}
              options={[
                { value: "en", label: `${home ? `${flag(homeCode(home))} ` : ""}English` },
                { value: docLang, label: `${flag(me?.destinationCountry)} ${LANGUAGE_NAMES[docLang]}`.trim() },
              ]}
            />
          </View>
          {lang !== "en" && (
            <T style={{ fontSize: 13, lineHeight: 18, color: tr.error ? color.warnText : color.muted }}>
              {tr.loading ? t.trLoading : tr.error ? t.trFailed : tr.data ? t.trAi.replace("{country}", trip ?? LANGUAGE_NAMES[lang]) : t.viewAsDoctor.replace("{lang}", LANGUAGE_NAMES[lang])}
            </T>
          )}
        </View>
      )}

      {!p && profile.loading && <Loading />}
      {!p && profile.error && <LoadError onRetry={profile.refresh} />}
      {p && (
        <>
          <ListSection icon="alert" tone="allergy" title={t.allergies} count={p.allergies.length} action={add("allergy", t.allergies, "allergy")}>
            {p.allergies.length === 0 && <ListEmpty>{t.noneYet}</ListEmpty>}
            {p.allergies.map((a, i) => {
              const substance = inLang(lang, a, "substance", a.substance, ai("allergies"));
              const reaction = inLang(lang, a, "reaction", a.reaction, ai("allergies"));
              const severity = SEVERITY_LABELS[lang][a.severity];
              return (
                <ListRow
                  key={a.id}
                  last={i === p.allergies.length - 1}
                  onPress={edit("allergy", a.id)}
                  label={`${substance.text}, ${severity}. ${reaction.text}`}
                  right={<Badge tone={severityTone[a.severity]}>{severity}</Badge>}
                >
                  <Tx weight="500" style={styles.title} v={substance} />
                  {!!a.reaction && <Tx style={styles.detail} v={reaction} />}
                </ListRow>
              );
            })}
          </ListSection>

          <ListSection icon="medicines" tone="blue" title={t.medications} count={p.medications.length} action={add("medication", t.medications)}>
            {p.medications.length === 0 && <ListEmpty>{t.noneYet}</ListEmpty>}
            {p.medications.map((m, i) => {
              const generic = inLang(lang, m, "generic", m.generic, ai("medications"));
              const schedule = inLang(lang, m, "schedule", m.schedule, ai("medications"));
              const purpose = inLang(lang, m, "purpose", m.purpose, ai("medications"));
              const title = m.brand ? `${m.brand}${m.dose ? ` ${m.dose}` : ""}` : null;
              const more = [schedule, purpose].filter(x => x.text);
              const moreShown = { text: more.map(x => x.text).join(" · "), en: more.some(x => x.en) };
              return (
                <ListRow key={m.id} last={i === p.medications.length - 1} onPress={edit("medication", m.id)} label={[title, generic.text, moreShown.text].filter(Boolean).join(". ")}>
                  {title ? <T weight="500" style={styles.title}>{title}</T> : <Tx weight="500" style={styles.title} v={{ ...generic, text: `${generic.text}${m.dose ? ` ${m.dose}` : ""}` }} />}
                  {!!title && !!m.generic && <Tx style={[styles.detail, { color: color.blue }]} v={generic} />}
                  {!!moreShown.text && <Tx style={styles.detail} v={moreShown} />}
                </ListRow>
              );
            })}
          </ListSection>

          <ListSection icon="condition" title={t.conditions} count={p.conditions.length} action={add("condition", t.conditions)}>
            {p.conditions.length === 0 && <ListEmpty>{t.noneYet}</ListEmpty>}
            {p.conditions.map((c, i) => {
              const name = inLang(lang, c, "name", c.name, ai("conditions"));
              const note = inLang(lang, c, "note", c.note, ai("conditions"));
              return (
                <ListRow key={c.id} last={i === p.conditions.length - 1} onPress={edit("condition", c.id)} label={`${name.text}${note.text ? `. ${note.text}` : ""}`}>
                  <Tx weight="500" style={styles.title} v={name} />
                  {!!c.note && <Tx style={styles.detail} v={note} />}
                </ListRow>
              );
            })}
          </ListSection>

          <ListSection icon="vitals" title={t.basics} action={editButton("/basics", t.basics)}>
            <ListRow last>
              <View style={{ flexDirection: "row", justifyContent: "space-between", flexWrap: "wrap", gap: space.l }}>
                <Vital label={t.bloodType} value={p.bloodType === "Unknown" ? "—" : p.bloodType} empty={p.bloodType === "Unknown"} notRecorded={t.notRecorded} />
                <Vital label={t.heightCm} value={p.basics.heightCm == null ? "—" : `${p.basics.heightCm} cm`} empty={p.basics.heightCm == null} notRecorded={t.notRecorded} />
                <Vital label={t.weightKg} value={p.basics.weightKg == null ? "—" : `${p.basics.weightKg} kg`} empty={p.basics.weightKg == null} notRecorded={t.notRecorded} />
              </View>
              {p.basics.sex || p.basics.homeCountry || p.basics.studyLocation ? (
                <T style={[styles.detail, { marginTop: space.s }]}>
                  {[p.basics.sex, p.basics.homeCountry && `From ${p.basics.homeCountry}`, p.basics.studyLocation && `Studying in ${p.basics.studyLocation}`].filter(Boolean).join(" · ")}
                </T>
              ) : null}
            </ListRow>
          </ListSection>

          <ListSection icon="phone" title={t.contacts} count={p.contacts.length} action={add("contact", t.contacts)}>
            {p.contacts.length === 0 && <ListEmpty>{t.noneYet}</ListEmpty>}
            {p.contacts.map((c, i) => (
              <ListRow key={c.id} last={i === p.contacts.length - 1} onPress={edit("contact", c.id)} label={[c.name, inLang(lang, c, "relationship", c.relationship, ai("contacts")).text, c.phone].filter(Boolean).join(", ")}>
                <T weight="500" style={styles.title}>{c.name}</T>
                <Tx style={styles.detail} v={(() => { const r = inLang(lang, c, "relationship", c.relationship, ai("contacts")); return { text: [r.text, c.phone].filter(Boolean).join(" · "), en: r.en }; })()} />
              </ListRow>
            ))}
          </ListSection>

          <ListSection icon="insurance" title={t.insurance} action={editButton("/insurance", t.insurance)}>
            {hasInsurance ? (
              <ListRow last>
                <T weight="500" style={styles.title}>{p.insurance.plan || t.notRecorded}</T>
                <T style={styles.detail}>{[p.insurance.memberId && `Member ${p.insurance.memberId}`, p.insurance.group && `Group ${p.insurance.group}`].filter(Boolean).join(" · ")}</T>
              </ListRow>
            ) : (
              <ListEmpty>{t.noneYetInsurance}</ListEmpty>
            )}
          </ListSection>
          <Footnote>{t.untranslatedNote}</Footnote>
        </>
      )}
    </Screen>
  );
}

function Vital({ label, value, empty, notRecorded }: { label: string; value: string; empty: boolean; notRecorded: string }) {
  return (
    <View accessible accessibilityLabel={`${label}: ${empty ? notRecorded : value}`} style={{ gap: 2 }}>
      <T serif style={{ fontSize: 24, color: empty ? color.subtle : color.sectionTitle }}>{value}</T>
      <T style={{ fontSize: 12, color: color.muted }}>{label}</T>
    </View>
  );
}

const styles = StyleSheet.create({
  profile: { backgroundColor: color.surface, borderRadius: radius.section, borderWidth: 1, borderColor: color.line, overflow: "hidden" },
  who: { flexDirection: "row", alignItems: "center", gap: 14, padding: space.l },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: color.blue, alignItems: "center", justifyContent: "center" },
  trip: { flexDirection: "row", alignItems: "center", gap: space.m, paddingHorizontal: space.l, paddingVertical: 11, minHeight: 48, borderTopWidth: 1, borderTopColor: "#edf0f2" },
  place: { fontSize: 14, color: color.ink },
  title: { fontSize: 15.5, lineHeight: 21, color: color.ink },
  detail: { fontSize: 13.5, lineHeight: 19, color: color.body },
  enTag: { fontSize: 11, fontWeight: "500", color: color.subtle, letterSpacing: 0.5 },
});
