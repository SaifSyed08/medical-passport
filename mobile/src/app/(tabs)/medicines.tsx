import { useEffect, useMemo, useState } from "react";
import { Keyboard, View } from "react-native";
import { destinationName, OTHER_DESTINATION, type Profile } from "@shared/tessera";
import { useResource } from "@/lib/cache";
import { homeCode } from "@/lib/interpreter";
import { findEquivalents, MEDICINES_AVAILABLE, type DrugStatus, type Equivalent } from "@/lib/medicines";
import { useSession } from "@/lib/session";
import { color, space } from "@/lib/theme";
import { DestinationPicker } from "@/components/destination-picker";
import { Button, Field, Heading, Loading, Logo, Notice, Pill, Row, Screen, Section, T } from "@/components/ui";

const TONE: Record<DrugStatus, "ok" | "warn" | "muted" | "error"> = {
  same_name: "ok", different_name: "warn", different_strength: "warn", not_available_locally: "error", uncertain: "muted",
};

/** One medicine: what it's called at home, and what to ask for in the other country. */
function Result({ eq, country, last = true }: { eq: Equivalent; country: string; last?: boolean }) {
  const { t } = useSession();
  const status: Record<DrugStatus, string> = {
    same_name: t.medSame, different_name: t.medDifferent, different_strength: t.medStrength, not_available_locally: t.medNotSold, uncertain: t.medUncertain,
  };
  const gone = eq.status === "not_available_locally";
  const localName = gone ? t.medNotSold : eq.local_name || "—";
  return (
    <View
      accessible
      accessibilityLabel={`${eq.input ?? eq.home_name}. ${country}: ${localName}. ${status[eq.status]}${eq.note ? `. ${eq.note}` : ""}`}
      style={{ paddingVertical: space.m, gap: 6, borderBottomWidth: last ? 0 : 1, borderBottomColor: "#edf0f2" }}
    >
      <View style={{ flexDirection: "row", gap: space.s, alignItems: "center", flexWrap: "wrap" }}>
        <T style={{ fontSize: 13.5, color: color.muted }}>{eq.input || eq.home_name}</T>
        <Pill tone={TONE[eq.status]}>{status[eq.status]}</Pill>
      </View>
      <T serif style={{ fontSize: 24, lineHeight: 29, color: gone ? color.errorText : color.ink }}>{localName}</T>
      {!gone && eq.local_brands.length > 0 && <T style={{ color: color.body, lineHeight: 20 }}>{`${t.medBrands}: ${eq.local_brands.join(", ")}`}</T>}
      {!!eq.local_strength && <T style={{ color: color.body, lineHeight: 20 }}>{eq.local_strength}</T>}
      {!!eq.generic && <T style={{ fontSize: 13.5, color: color.muted }}>{`${t.medGeneric}: ${eq.generic}`}</T>}
      {!!eq.note && <T style={{ color: color.body, lineHeight: 20 }}>{eq.note}</T>}
      <T style={{ fontSize: 12.5, color: color.subtle }}>{eq.source === "curated" ? t.medChecked : t.medAi}</T>
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
          <Section>
            <Row title={homeName} detail={t.medFrom} last={false} />
            <Row
              title={country || t.chooseCountry}
              detail={t.medTo}
              onPress={() => setPicking(p => !p)}
              label={`${t.medTo}: ${country || t.chooseCountry}`}
              last
            />
          </Section>
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
            <>
              <Section title={t.medLookup}>
                <View style={{ gap: space.m }}>
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
                  <Button busy={busy} disabled={!query.trim()} onPress={lookup}>{t.medFind}</Button>
                  {error && <Notice tone="error">{t.medFailed}</Notice>}
                  {result && (result.eq ? <Result eq={result.eq} country={country} /> : <Notice>{t.medNothing}</Notice>)}
                </View>
              </Section>

              <Section title={t.medYours}>
                {!profile.data && profile.loading && <Loading />}
                {profile.data && mine.length === 0 && <T style={{ color: color.body, lineHeight: 21 }}>{t.medNoneYours}</T>}
                {mine.length > 0 && !ownNow && <Loading />}
                {ownNow?.failed && (
                  <View style={{ gap: space.m }}>
                    <Notice tone="error">{t.medFailed}</Notice>
                    <Button secondary onPress={() => { setOwn({ key: "", items: null }); setAttempt(n => n + 1); }}>{t.retry}</Button>
                  </View>
                )}
                {ownNow?.items?.map((eq, i) => <Result key={eq.id ?? i} eq={eq} country={country} last={i === ownNow.items!.length - 1} />)}
              </Section>
            </>
          )}
          <Notice>{t.medDisclaimer}</Notice>
        </>
      )}
    </Screen>
  );
}
