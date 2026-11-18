import { useEffect, useMemo, useState } from "react";
import { Keyboard, Pressable, StyleSheet, TextInput, useWindowDimensions, View } from "react-native";
import { OTHER_DESTINATION, type Profile } from "@shared/tessera";
import { useResource } from "@/lib/cache";
import { countryName } from "@/lib/countries";
import { flag } from "@/lib/flag";
import { homeCode } from "@/lib/interpreter";
import { findEquivalents, MEDICINES_AVAILABLE, type DrugStatus, type Equivalent } from "@/lib/medicines";
import { useSession } from "@/lib/session";
import { color, radius, space, TOUCH } from "@/lib/theme";
import { CountryPicker } from "@/components/country-picker";
import { Icon, type IconName } from "@/components/icons";
import { Button, Footnote, Heading, ListEmpty, ListSection, Loading, Logo, Notice, Screen, T } from "@/components/ui";

/** The mark at the end of each medicine row: same name, different name, check the strength, not sold, not sure. */
const MARK: Record<DrugStatus, [IconName, string]> = {
  same_name: ["check", color.okText],
  different_name: ["swap", color.blue],
  different_strength: ["alert", color.warnText],
  not_available_locally: ["ban", color.errorText],
  uncertain: ["question", color.muted],
};

type Lookup = { name: string; from: string; to: string };
// The last few lookups, for this session only (like the rest of the app's data, never written to the phone).
let recent: Lookup[] = [];
const same = (a: Lookup, b: Lookup) => a.name.toLowerCase() === b.name.toLowerCase() && a.from === b.from && a.to === b.to;

function useStatusText() {
  const { t } = useSession();
  return {
    same_name: t.medSame, different_name: t.medDifferent, different_strength: t.medStrength, not_available_locally: t.medNotSold, uncertain: t.medUncertain,
  } as Record<DrugStatus, string>;
}

/** How to say the local name and brands, when any of them is in a script the traveler can't read; "" otherwise. */
function soundsLike(eq: Equivalent, brands: number) {
  const parts = [eq.local_name, ...eq.local_brands.slice(0, brands)];
  const reads = [eq.local_reading ?? "", ...(eq.local_brands_reading ?? []).slice(0, brands)];
  if (eq.status === "not_available_locally" || !reads.some(Boolean)) return "";
  return parts.map((p, i) => reads[i] || p).filter(Boolean).join(" · ");
}

/** "Sounds like karonāru · …": the reading under a name written in another script. */
function Sounds({ text, size = 15 }: { text: string; size?: number }) {
  const { t } = useSession();
  if (!text) return null;
  return (
    <T style={{ fontSize: size, lineHeight: size + 5, color: color.ink }}>
      <T weight="500" style={{ fontSize: size - 2, color: color.blue }}>{`${t.medSounds}  `}</T>
      {text}
    </T>
  );
}

/** The answer to a lookup, on its own card: what it's called at home, then big, what to ask for there. */
function ResultCard({ eq, q }: { eq: Equivalent; q: Lookup }) {
  const { t } = useSession();
  const status = useStatusText();
  const gone = eq.status === "not_available_locally";
  const [mark, tint] = MARK[eq.status];
  const to = countryName(q.to);
  const sounds = soundsLike(eq, 4);
  return (
    <View
      accessible
      accessibilityLabel={`${q.name}, ${countryName(q.from)}. ${to}: ${gone ? t.medNotSold : eq.local_name}.${sounds ? ` ${t.medSounds}: ${sounds}.` : ""} ${status[eq.status]}. ${eq.note}`}
      style={[styles.card, styles.result, gone && { borderColor: color.errorText, borderWidth: 1.5 }]}
    >
      <T style={{ fontSize: 14.5, color: color.muted }}>{`${flag(q.from)} ${q.name}${eq.generic && eq.generic.toLowerCase() !== q.name.toLowerCase() ? ` · ${eq.generic}` : ""}`}</T>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <T style={{ fontSize: 26 }}>{flag(q.to)}</T>
        <View style={{ flex: 1, gap: 2 }}>
          <T weight="700" style={{ fontSize: 26, lineHeight: 31, letterSpacing: -0.3, color: gone ? color.errorText : color.ink }}>{gone ? t.medNotSold : eq.local_name || "—"}</T>
          {!gone && eq.local_brands.length > 0 && <T style={{ fontSize: 15, color: color.body }}>{eq.local_brands.slice(0, 4).join(", ")}</T>}
        </View>
      </View>
      <Sounds text={sounds} />
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <Icon name={mark} color={tint} size={16} />
        <T weight="500" style={{ fontSize: 13.5, color: tint }}>{status[eq.status]}</T>
      </View>
      {!!eq.local_strength && <T style={styles.line}>{eq.local_strength}</T>}
      {!!eq.note && <T style={styles.line}>{eq.note}</T>}
      <T style={{ fontSize: 12.5, color: color.subtle }}>{eq.source === "curated" ? t.medChecked : t.medAi}</T>
    </View>
  );
}

/** One of the traveler's own medicines, converted, on its own card. */
function MedRow({ eq, to }: { eq: Equivalent; to: string }) {
  const { t } = useSession();
  const status = useStatusText();
  const gone = eq.status === "not_available_locally";
  const brands = eq.local_brands.slice(0, 3).join(", ");
  const localName = gone ? t.medNotSold : [eq.local_name || "—", brands].filter(Boolean).join(" · ");
  const [mark, tint] = MARK[eq.status];
  const name = eq.input || eq.home_name;
  const sounds = soundsLike(eq, 3);
  return (
    <View
      accessible
      accessibilityLabel={`${name}. ${countryName(to)}: ${localName}.${sounds ? ` ${t.medSounds}: ${sounds}.` : ""} ${status[eq.status]}${eq.note ? `. ${eq.note}` : ""}`}
      style={[styles.card, styles.medBox, gone && { borderColor: color.errorText, borderWidth: 1.5 }]}
    >
      <View style={{ flex: 1, gap: 3 }}>
        <T weight="500" style={{ fontSize: 17, lineHeight: 22, color: color.ink }}>{name}</T>
        {!!eq.generic && eq.generic.toLowerCase() !== name.toLowerCase() && <T style={styles.small}>{eq.generic}</T>}
        <T weight="500" style={{ fontSize: 14.5, lineHeight: 20, color: gone ? color.errorText : color.ink }}>{gone ? localName : `${flag(to)} ${localName}`.trim()}</T>
        <Sounds text={sounds} size={14} />
        {!!eq.local_strength && <T style={styles.small}>{eq.local_strength}</T>}
        {!!eq.note && <T style={styles.small}>{eq.note}</T>}
        <T style={{ fontSize: 12, color: color.subtle }}>{eq.source === "curated" ? t.medChecked : t.medAi}</T>
      </View>
      <View style={{ alignItems: "center", gap: 3, maxWidth: 74 }}>
        <Icon name={mark} color={tint} size={19} />
        {eq.status !== "same_name" && <T style={{ fontSize: 11, lineHeight: 13, color: tint, textAlign: "center" }}>{status[eq.status]}</T>}
      </View>
    </View>
  );
}

/** Medicine names abroad: any medicine between any two countries, and the traveler's own medicines for the trip. */
export default function Medicines() {
  const { t, me } = useSession();
  const profile = useResource<Profile>("/profile");
  const homeName = profile.data?.basics.homeCountry?.trim() || "United States";
  const home = homeCode(homeName);
  const trip = me?.destinationCountry && me.destinationCountry !== OTHER_DESTINATION ? me.destinationCountry : null;

  // From defaults to home and To to the trip; either can be changed here without changing the profile.
  const [fromPick, setFrom] = useState<string | null>(null);
  const [toPick, setTo] = useState<string | null>(null);
  const from = fromPick ?? home;
  const to = toPick ?? (trip && trip !== from ? trip : null);
  const [picking, setPicking] = useState<"from" | "to" | null>(null);
  const narrow = useWindowDimensions().width < 380;

  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [found, setFound] = useState<{ q: Lookup; eq: Equivalent | null } | null>(null);
  const [error, setError] = useState(false);
  const [, bump] = useState(0);

  const meds = profile.data?.medications;
  const mine = useMemo(() => (meds ?? []).map(m => ({ id: m.id, name: m.brand || m.generic, generic: m.generic })).filter(m => m.name), [meds]);
  const mineKey = to && to !== home ? `${home}>${to}:${mine.map(m => m.name).join("|")}` : "";
  const [own, setOwn] = useState<{ key: string; items: Equivalent[] | null; failed?: boolean }>({ key: "", items: null });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!MEDICINES_AVAILABLE || !to || !mineKey || !mine.length) return;
    let live = true;
    findEquivalents(home, to, mine)
      .then(items => live && setOwn({ key: mineKey, items }))
      .catch(() => live && setOwn({ key: mineKey, items: null, failed: true }));
    return () => {
      live = false;
    };
    // `mine` is covered by mineKey.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mineKey, home, to, attempt]);

  async function run(q: Lookup) {
    if (!q.name.trim() || q.from === q.to) return;
    Keyboard.dismiss();
    setPicking(null);
    setBusy(true);
    setError(false);
    try {
      const [eq] = await findEquivalents(q.from, q.to, [{ id: "lookup", name: q.name.trim(), generic: "" }]);
      setFound({ q, eq: eq ?? null });
      recent = [q, ...recent.filter(r => !same(r, q))].slice(0, 6);
      bump(n => n + 1);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }
  const current: Lookup | null = to ? { name: query.trim(), from, to } : null;
  // A result only shows while the box and countries still say what it was looked up for.
  const result = found && current && same(found.q, current) ? found : null;
  const ownNow = own.key === mineKey ? own : null;
  // Short names fit beside the swap button; long ones ("United States") show as their code on a phone.
  const label = (code: string) => {
    const name = countryName(code);
    return `${flag(code)} ${name.length <= (narrow ? 6 : 7) ? name : code}`.trim();
  };

  return (
    <Screen>
      <Logo />
      <View style={{ gap: 6 }}>
        <Heading>{t.medTitle}</Heading>
        <T style={{ color: color.muted, fontSize: 15, lineHeight: 21 }}>{t.medLead}</T>
      </View>

      {!MEDICINES_AVAILABLE ? (
        <Notice tone="warn">{t.medUnavailable}</Notice>
      ) : (
        <>
          <View style={styles.card}>
            <T weight="500" style={{ fontSize: 13, letterSpacing: 0.3, color: color.muted }}>{t.medName}</T>
            <TextInput
              accessibilityLabel={t.medName}
              accessibilityHint={t.medNameHint}
              value={query}
              onChangeText={setQuery}
              placeholder={t.medNamePlaceholder}
              placeholderTextColor={color.subtle}
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="search"
              onSubmitEditing={() => current && void run(current)}
              maxLength={120}
              maxFontSizeMultiplier={1.6}
              style={styles.input}
            />
            <View style={{ flexDirection: "row", alignItems: "center", gap: space.s }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${t.medFromCountry}: ${countryName(from)}`}
                accessibilityState={{ expanded: picking === "from" }}
                onPress={() => setPicking(p => (p === "from" ? null : "from"))}
                style={({ pressed }) => [styles.country, picking === "from" && styles.countryOn, pressed && styles.pressed]}
              >
                <T numberOfLines={1} style={styles.countryText}>{label(from)}</T>
                <Icon name="chevronDown" color={color.muted} size={16} />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t.medSwap}
                disabled={!to}
                hitSlop={4}
                onPress={() => {
                  if (!to) return;
                  setFrom(to);
                  setTo(from);
                }}
                style={({ pressed }) => [styles.swap, pressed && styles.pressed, !to && { opacity: 0.4 }]}
              >
                <Icon name="swap" color={color.blue} size={18} />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${t.medToCountry}: ${to ? countryName(to) : t.chooseCountry}`}
                accessibilityState={{ expanded: picking === "to" }}
                onPress={() => setPicking(p => (p === "to" ? null : "to"))}
                style={({ pressed }) => [styles.country, picking === "to" && styles.countryOn, pressed && styles.pressed]}
              >
                <T numberOfLines={1} style={styles.countryText}>{to ? label(to) : t.chooseCountry}</T>
                <Icon name="chevronDown" color={color.muted} size={16} />
              </Pressable>
            </View>
            {picking && (
              <CountryPicker
                label={picking === "from" ? t.medFromCountry : t.medToCountry}
                value={picking === "from" ? from : to}
                onChange={code => {
                  if (picking === "from") setFrom(code);
                  else setTo(code);
                  setPicking(null);
                }}
              />
            )}
            {!to && <Notice>{t.medPickCountry}</Notice>}
            {to === from && <Notice tone="warn">{t.medSameCountry}</Notice>}
            <Button busy={busy} disabled={!query.trim() || !to || to === from} onPress={() => current && void run(current)} label={t.medConvert}>
              <Icon name="swap" color="white" size={18} />
              <T weight="500" style={{ fontSize: 16, color: "white" }}>{t.medConvert}</T>
            </Button>
            {recent.length > 0 && (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                {recent.map(r => (
                  <Pressable
                    key={`${r.name}|${r.from}|${r.to}`}
                    accessibilityRole="button"
                    accessibilityLabel={`${r.name}, ${countryName(r.from)} to ${countryName(r.to)}`}
                    onPress={() => {
                      setQuery(r.name);
                      setFrom(r.from);
                      setTo(r.to);
                      void run(r);
                    }}
                    style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
                  >
                    <T style={{ fontSize: 13.5, color: color.body }}>{`${r.name} ${flag(r.from)}→${flag(r.to)}`}</T>
                  </Pressable>
                ))}
              </View>
            )}
            {error && <Notice tone="error">{t.medFailed}</Notice>}
          </View>

          {result && (result.eq ? <ResultCard eq={result.eq} q={result.q} /> : <Notice>{t.medNothing}</Notice>)}

          {to && to !== home && (
            <ListSection
              icon="medicines"
              tone="blue"
              boxed
              title={t.medYoursIn.replace("{country}", countryName(to))}
              action={
                mine.length > 0 && ownNow ? (
                  <Pressable accessibilityRole="button" accessibilityLabel={t.medRefresh} hitSlop={10} onPress={() => { setOwn({ key: "", items: null }); setAttempt(n => n + 1); }}>
                    <T weight="500" style={{ fontSize: 14, color: color.blue }}>{t.medRefresh}</T>
                  </Pressable>
                ) : undefined
              }
            >
              {((!profile.data && profile.loading) || (mine.length > 0 && !ownNow)) && <View style={styles.card}><Loading /></View>}
              {profile.data && mine.length === 0 && <View style={[styles.card, { padding: 0 }]}><ListEmpty>{t.medNoneYours}</ListEmpty></View>}
              {ownNow?.failed && (
                <View style={[styles.card, { gap: space.m }]}>
                  <Notice tone="error">{t.medFailed}</Notice>
                  <Button secondary onPress={() => { setOwn({ key: "", items: null }); setAttempt(n => n + 1); }}>{t.retry}</Button>
                </View>
              )}
              {ownNow?.items?.map((eq, i) => <MedRow key={eq.id ?? i} eq={eq} to={to} />)}
            </ListSection>
          )}
          <Footnote>{t.medDisclaimer}</Footnote>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: color.surface, borderRadius: radius.section, borderWidth: 1, borderColor: color.line, padding: space.l, gap: 10 },
  result: { gap: 10, paddingHorizontal: 18 },
  input: { minHeight: 52, borderWidth: 1.5, borderColor: color.line, borderRadius: 12, backgroundColor: color.bg, paddingHorizontal: 14, paddingVertical: 11, fontSize: 19, color: color.ink },
  country: { flex: 1, flexDirection: "row", alignItems: "center", gap: 6, minHeight: 44, paddingHorizontal: 12, borderRadius: radius.pill, borderWidth: 1, borderColor: color.fieldLine, backgroundColor: color.surface },
  countryOn: { borderColor: color.blue },
  countryText: { flex: 1, fontSize: 14.5, color: color.ink },
  swap: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: color.line, backgroundColor: color.surface },
  chip: { minHeight: 34, justifyContent: "center", paddingHorizontal: 11, borderRadius: radius.pill, borderWidth: 1, borderColor: color.line },
  pressed: { backgroundColor: "#f6f7f8" },
  line: { fontSize: 14.5, lineHeight: 20, color: color.body },
  medBox: { flexDirection: "row", alignItems: "flex-start", gap: space.m, minHeight: TOUCH, paddingHorizontal: 18 },
  small: { fontSize: 13, lineHeight: 18, color: color.muted },
});
