import { useEffect, useMemo, useState } from "react";
import { Keyboard, Pressable, StyleSheet, useWindowDimensions, View } from "react-native";
import { destinationName, OTHER_DESTINATION, type Profile } from "@shared/tessera";
import { useResource } from "@/lib/cache";
import { flag } from "@/lib/flag";
import { homeCode } from "@/lib/interpreter";
import { findEquivalents, MEDICINES_AVAILABLE, type DrugStatus, type Equivalent } from "@/lib/medicines";
import { useSession } from "@/lib/session";
import { color, radius, space } from "@/lib/theme";
import { DestinationPicker } from "@/components/destination-picker";
import { Icon, type IconName } from "@/components/icons";
import { Button, Field, Footnote, Heading, ListEmpty, ListSection, Loading, Logo, Notice, Screen, T } from "@/components/ui";

/** The mark at the end of each medicine row: same name, different name, check the strength, not sold, not sure. */
const MARK: Record<DrugStatus, [IconName, string]> = {
  same_name: ["check", color.okText],
  different_name: ["swap", color.blue],
  different_strength: ["alert", color.warnText],
  not_available_locally: ["ban", color.errorText],
  uncertain: ["question", color.muted],
};

/** One medicine: what it's called at home, and what to ask for in the other country. */
function Result({ eq, country, code, last = true, inCard }: { eq: Equivalent; country: string; code: string; last?: boolean; inCard?: boolean }) {
  const { t } = useSession();
  const status: Record<DrugStatus, string> = {
    same_name: t.medSame, different_name: t.medDifferent, different_strength: t.medStrength, not_available_locally: t.medNotSold, uncertain: t.medUncertain,
  };
  const gone = eq.status === "not_available_locally";
  const brands = eq.local_brands.slice(0, 3).join(", ");
  const localName = gone ? t.medNotSold : [eq.local_name || "—", brands].filter(Boolean).join(" · ");
  const [mark, tint] = MARK[eq.status];
  return (
    <View
      accessible
      accessibilityLabel={`${eq.input ?? eq.home_name}. ${country}: ${localName}. ${status[eq.status]}${eq.note ? `. ${eq.note}` : ""}`}
      style={[styles.row, !last && styles.rowLine, inCard && { paddingHorizontal: space.l }]}
    >
      <View style={{ flex: 1, gap: 3 }}>
        <T weight="500" style={{ fontSize: 15.5, lineHeight: 21, color: color.ink }}>{eq.input || eq.home_name}</T>
        {!!eq.generic && eq.generic.toLowerCase() !== (eq.input || eq.home_name).toLowerCase() && <T style={styles.small}>{eq.generic}</T>}
        <T weight="500" style={{ fontSize: 14, lineHeight: 20, color: gone ? color.errorText : color.ink }}>{gone ? localName : `${flag(code)} ${localName}`.trim()}</T>
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

/** Medicine names abroad: look up any medicine, and see the traveler's own medicines converted. */
export default function Medicines() {
  const { t, me } = useSession();
  const profile = useResource<Profile>("/profile");
  const trip = me?.destinationCountry && me.destinationCountry !== OTHER_DESTINATION ? me.destinationCountry : null;
  // The trip country is the default; another country can be checked here without changing the trip.
  const [chosen, setChosen] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const local = chosen ?? trip;
  const country = destinationName(local) ?? "";
  const homeName = profile.data?.basics.homeCountry?.trim() || "United States";
  const home = homeCode(homeName);

  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [found, setFound] = useState<{ key: string; eq: Equivalent | null } | null>(null);
  const [error, setError] = useState(false);

  const meds = profile.data?.medications;
  const mine = useMemo(() => (meds ?? []).map(m => ({ id: m.id, name: m.brand || m.generic, generic: m.generic })).filter(m => m.name), [meds]);
  const mineKey = local ? `${home}>${local}:${mine.map(m => m.name).join("|")}` : "";
  const [own, setOwn] = useState<{ key: string; items: Equivalent[] | null; failed?: boolean }>({ key: "", items: null });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!MEDICINES_AVAILABLE || !local || !mineKey || !mine.length) return;
    let live = true;
    findEquivalents(home, local, mine)
      .then(items => live && setOwn({ key: mineKey, items }))
      .catch(() => live && setOwn({ key: mineKey, items: null, failed: true }));
    return () => {
      live = false;
    };
    // `mine` is covered by mineKey.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mineKey, home, local, attempt]);

  const lookupKey = `${home}>${local}:${query.trim().toLowerCase()}`;
  async function lookup() {
    const name = query.trim();
    if (!name || !local) return;
    Keyboard.dismiss();
    setBusy(true);
    setError(false);
    try {
      const [eq] = await findEquivalents(home, local, [{ id: "lookup", name, generic: "" }]);
      setFound({ key: lookupKey, eq: eq ?? null });
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }
  // A result only shows for the medicine and country it was looked up for.
  const result = found?.key === lookupKey ? found : null;
  const ownNow = own.key === mineKey ? own : null;

  const homeFlag = flag(home);
  // On narrow phones the home country shortens to its code so the destination keeps its full name.
  const narrow = useWindowDimensions().width < 380;
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
            <Field
              label={t.medName}
              hint={t.medNameHint}
              value={query}
              onChangeText={setQuery}
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="search"
              onSubmitEditing={lookup}
              maxLength={120}
            />
            <View style={{ flexDirection: "row", alignItems: "center", gap: space.s }}>
              <View accessible accessibilityLabel={`${t.medFrom}: ${homeName}`} style={[styles.country, { flexShrink: 1, backgroundColor: color.bg }]}>
                <T numberOfLines={1} style={styles.countryText}>{`${homeFlag} ${narrow ? home : homeName}`.trim()}</T>
              </View>
              <Icon name="arrowRight" color={color.subtle} size={16} />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${t.medTo}: ${country || t.chooseCountry}`}
                accessibilityState={{ expanded: picking }}
                onPress={() => setPicking(p => !p)}
                style={({ pressed }) => [styles.country, { flex: 1, minWidth: 130, borderColor: picking ? color.blue : color.fieldLine }, pressed && { backgroundColor: "#f6f7f8" }]}
              >
                <T numberOfLines={1} style={[styles.countryText, { flex: 1 }]}>{local ? `${flag(local)} ${country}`.trim() : t.chooseCountry}</T>
                <Icon name="chevronDown" color={color.muted} size={16} />
              </Pressable>
            </View>
            {picking && (
              <DestinationPicker
                value={local}
                onChange={code => {
                  setChosen(code === OTHER_DESTINATION ? null : code);
                  setPicking(false);
                }}
              />
            )}
            {!local ? (
              <Notice>{t.medPickCountry}</Notice>
            ) : (
              <Button busy={busy} disabled={!query.trim()} onPress={lookup} label={t.medFind}>
                <Icon name="swap" color="white" size={18} />
                <T weight="500" style={{ fontSize: 16, color: "white" }}>{t.medFind}</T>
              </Button>
            )}
            {error && <Notice tone="error">{t.medFailed}</Notice>}
            {result && local && (
              <View style={styles.found}>
                {result.eq ? <Result eq={result.eq} country={country} code={local} inCard /> : <Notice>{t.medNothing}</Notice>}
              </View>
            )}
          </View>

          {local && (
            <ListSection
              icon="medicines"
              tone="blue"
              title={t.medYoursIn.replace("{country}", country)}
              action={
                mine.length > 0 && ownNow ? (
                  <Pressable accessibilityRole="button" accessibilityLabel={t.medRefresh} hitSlop={10} onPress={() => { setOwn({ key: "", items: null }); setAttempt(n => n + 1); }}>
                    <T weight="500" style={{ fontSize: 14, color: color.blue }}>{t.medRefresh}</T>
                  </Pressable>
                ) : undefined
              }
            >
              {!profile.data && profile.loading && <Loading />}
              {profile.data && mine.length === 0 && <ListEmpty>{t.medNoneYours}</ListEmpty>}
              {mine.length > 0 && !ownNow && <Loading />}
              {ownNow?.failed && (
                <View style={{ gap: space.m, padding: space.xl }}>
                  <Notice tone="error">{t.medFailed}</Notice>
                  <Button secondary onPress={() => { setOwn({ key: "", items: null }); setAttempt(n => n + 1); }}>{t.retry}</Button>
                </View>
              )}
              {ownNow?.items?.map((eq, i) => <Result key={eq.id ?? i} eq={eq} country={country} code={local} last={i === ownNow.items!.length - 1} />)}
            </ListSection>
          )}
          <Footnote>{t.medDisclaimer}</Footnote>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: color.surface, borderRadius: radius.section, borderWidth: 1, borderColor: color.line, padding: space.l, gap: space.m },
  country: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 44, paddingHorizontal: 12, borderRadius: radius.pill, borderWidth: 1, borderColor: color.fieldLine },
  countryText: { fontSize: 14.5, color: color.ink },
  found: { marginHorizontal: -space.l, marginBottom: -space.l, borderTopWidth: 1, borderTopColor: "#edf0f2" },
  row: { flexDirection: "row", alignItems: "flex-start", gap: space.m, paddingHorizontal: space.xl, paddingVertical: 13 },
  rowLine: { borderBottomWidth: 1, borderBottomColor: "#edf0f2" },
  small: { fontSize: 13, lineHeight: 18, color: color.muted },
});
