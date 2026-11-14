import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, View } from "react-native";
import { classify, initialState, mergeAccepted, readyToAdd, type ReviewState, type Suggestion } from "@shared/autofill";
import { BLOOD_TYPES, type Profile } from "@shared/tessera";
import { ApiError } from "@/lib/api";
import { reportAccepted, requestSuggestions } from "@/lib/autofill";
import { useResource } from "@/lib/cache";
import type { Strings } from "@/lib/i18n";
import { ITEM_KINDS, newId, saveProfile } from "@/lib/profile";
import { useSession } from "@/lib/session";
import { color, space } from "@/lib/theme";
import { Button, Chips, Field, Heading, LoadError, Loading, Notice, Pill, Screen, Section, Segmented, T } from "@/components/ui";

const MAIN: Record<Suggestion["kind"], string> = { condition: "name", allergy: "substance", medication: "generic", bloodType: "value" };
const BLOOD_OPTIONS = BLOOD_TYPES.filter(b => b !== "Unknown").map(b => ({ value: b as string, label: b }));
const kindLabel = (t: Strings, k: Suggestion["kind"]) =>
  ({ condition: t.kindCondition, allergy: t.kindAllergy, medication: t.kindMedication, bloodType: t.bloodType })[k];

function loadMessage(t: Strings, e: ApiError) {
  if (e.code === "unsupported_type") return t.reviewUnsupported;
  if (e.code === "rate_limited") return t.reviewRateLimited;
  return t.reviewFailed;
}

/** Review suggestions read from one uploaded document before any are added to the profile. */
export default function Review() {
  const { recordId } = useLocalSearchParams<{ recordId: string }>();
  const { t } = useSession();
  const profile = useResource<Profile>("/profile");
  const [items, setItems] = useState<Suggestion[] | null>(null);
  const [states, setStates] = useState<ReviewState[] | null>(null);
  const [loadError, setLoadError] = useState<ApiError | null>(null);
  const [editing, setEditing] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const savingRef = useRef(false);

  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    requestSuggestions(recordId).then(
      s => live && setItems(s),
      e => live && setLoadError(e instanceof ApiError ? e : new ApiError(0, String(e))),
    );
    return () => {
      live = false;
    };
  }, [recordId, attempt]);

  const retry = () => {
    setLoadError(null);
    setItems(null);
    setStates(null);
    setAttempt(n => n + 1);
  };

  // Initial states need both the suggestions and the profile (duplicates start removed).
  const p = profile.data;
  const st = states ?? (items && p ? items.map(s => initialState(p, s)) : null);
  const setState = (i: number, v: ReviewState) => st && setStates(st.map((x, j) => (j === i ? v : x)));
  const setField = (i: number, key: string, v: string) => {
    setItems(list => list && list.map((s, j) => (j === i ? { ...s, fields: { ...s.fields, [key]: v } } : s)));
    setState(i, "pending");
  };
  const count = (p && items?.filter((s, i) => st?.[i] === "checked" && classify(p, s) !== "duplicate").length) || 0;

  async function add() {
    if (!items || !st || !p || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setSaveError("");
    try {
      // An item edited into a duplicate is skipped by mergeAccepted, so leave it out of the count too.
      const accepted = items.filter((s, i) => st[i] === "checked" && classify(p, s) !== "duplicate");
      await saveProfile(mergeAccepted(p, accepted, recordId, newId));
      // Only a count for the audit log; a failure here must not undo the saved profile.
      if (accepted.length) await reportAccepted(recordId, Math.min(accepted.length, 60)).catch(() => {});
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (e) {
      setSaveError(e instanceof ApiError && e.status === 400 ? e.message : t.errorGeneric);
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Screen>
        <Heading size={28}>{t.reviewTitle}</Heading>
        {loadError ? (
          <>
            <Notice tone="error">{loadMessage(t, loadError)}</Notice>
            <Button secondary onPress={retry}>{t.retry}</Button>
            <Button secondary onPress={() => router.back()}>{t.back}</Button>
          </>
        ) : !p && profile.error ? (
          <LoadError onRetry={() => void profile.refresh()} />
        ) : !st || !items || !p ? (
          <>
            <Notice>{t.reviewReading}</Notice>
            <Loading />
          </>
        ) : items.length === 0 ? (
          <>
            <Notice>{t.reviewNothing}</Notice>
            <Button secondary onPress={() => router.back()}>{t.back}</Button>
          </>
        ) : (
          <>
            <T style={{ color: color.body, lineHeight: 21 }}>{t.reviewLead}</T>
            {items.map((s, i) => {
              const state = st[i];
              const kind = classify(p, s);
              const main = s.fields[MAIN[s.kind]] ?? "";
              const detail = Object.entries(s.fields).filter(([k, v]) => k !== MAIN[s.kind] && v.trim()).map(([, v]) => v).join(" · ");
              const label = kindLabel(t, s.kind);
              return (
                <Section key={s.id} title={label} action={kind === "duplicate" ? <Pill tone="muted">{t.alreadyOnPassport}</Pill> : s.confidence < 0.6 ? <Pill tone="warn">{t.checkCarefully}</Pill> : undefined}>
                  <View style={{ gap: space.s, opacity: state === "removed" ? 0.5 : 1 }}>
                    <T weight="500" style={{ fontSize: 17 }}>{main}</T>
                    {!!detail && <T style={{ color: color.body }}>{detail}</T>}
                    {kind === "replaces" && <T style={{ color: color.body }}>{`${t.currentValue}: ${p.bloodType}`}</T>}
                    {!!s.quote && <T style={{ color: color.muted, fontStyle: "italic", lineHeight: 20 }}>{`“${s.quote}”`}</T>}
                  </View>
                  {editing === i && state !== "removed" && (
                    <View style={{ gap: space.m, marginTop: space.m }}>
                      {s.kind === "bloodType" ? (
                        <Chips label={t.bloodType} value={s.fields.value ?? ""} options={BLOOD_OPTIONS} onChange={v => setField(i, "value", v)} />
                      ) : (
                        ITEM_KINDS[s.kind].fields.map(f =>
                          f.options ? (
                            <Segmented key={f.key} label={f.label} value={s.fields[f.key] ?? ""} options={f.options} onChange={v => setField(i, f.key, v)} />
                          ) : (
                            <Field key={f.key} label={f.label} value={s.fields[f.key] ?? ""} multiline={f.multiline} onChangeText={v => setField(i, f.key, v)} />
                          ),
                        )
                      )}
                    </View>
                  )}
                  <View style={{ flexDirection: "row", gap: space.s, marginTop: space.m }}>
                    {state !== "removed" && kind !== "duplicate" && (
                      <>
                        <Button
                          style={{ flex: 1 }}
                          secondary={state !== "checked"}
                          disabled={!main.trim()}
                          label={`${t.confirmCorrect}: ${label}, ${main}`}
                          onPress={() => setState(i, state === "checked" ? "pending" : "checked")}
                        >
                          {state === "checked" ? `✓ ${t.confirmed}` : t.confirm}
                        </Button>
                        <Button style={{ flex: 1 }} secondary label={`${t.edit}: ${label}, ${main}`} onPress={() => setEditing(editing === i ? null : i)}>
                          {editing === i ? t.done : t.edit}
                        </Button>
                      </>
                    )}
                    <Button
                      style={{ flex: 1 }}
                      secondary
                      danger={state !== "removed"}
                      label={`${state === "removed" ? t.restore : t.dontAdd}: ${label}, ${main}`}
                      onPress={() => setState(i, state === "removed" ? "pending" : "removed")}
                    >
                      {state === "removed" ? t.restore : t.dontAdd}
                    </Button>
                  </View>
                </Section>
              );
            })}
            {!!saveError && <Notice tone="error">{saveError}</Notice>}
            <Button busy={saving} disabled={!readyToAdd(st)} onPress={add}>{t.addToPassport.replace("{n}", String(count))}</Button>
            <Button secondary onPress={() => router.back()}>{t.cancel}</Button>
          </>
        )}
      </Screen>
    </KeyboardAvoidingView>
  );
}
