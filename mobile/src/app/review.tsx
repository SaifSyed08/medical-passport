import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import Feather from "@expo/vector-icons/Feather";
import { KeyboardAvoidingView, Platform, Pressable, View } from "react-native";
import { classify, initialState, mergeAccepted, readyToAdd, type ReviewState, type Suggestion } from "@shared/autofill";
import { BLOOD_TYPES, type Profile } from "@shared/tessera";
import { ApiError } from "@/lib/api";
import { reportAccepted } from "@/lib/autofill";
import { useResource } from "@/lib/cache";
import type { Strings } from "@/lib/i18n";
import { ITEM_KINDS, newId, saveProfile } from "@/lib/profile";
import { useScans, type Scan } from "@/lib/scans";
import { useSession } from "@/lib/session";
import { color, radius, space, TOUCH } from "@/lib/theme";
import { Button, Chips, Field, Heading, LoadError, Loading, Notice, Pill, Screen, Section, Segmented, T } from "@/components/ui";

type IconName = "check" | "x";

/** Square icon-only button with the app's button radius and the minimum touch size. Active = filled: blue for confirm, gray for remove. */
function IconButton({ icon, label, onPress, tone, active, disabled }: {
  icon: IconName;
  label: string;
  onPress: () => void;
  tone: "confirm" | "remove";
  active?: boolean;
  disabled?: boolean;
}) {
  const accent = tone === "remove" ? color.errorText : color.blue;
  const edge = active ? (tone === "remove" ? color.muted : color.blue) : tone === "remove" ? color.errorLine : color.blue;
  const fill = tone === "remove" ? color.muted : color.blue;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled, selected: !!active }}
      disabled={disabled}
      hitSlop={4}
      onPress={() => {
        void Haptics.selectionAsync();
        onPress();
      }}
      style={({ pressed }) => [
        {
          width: TOUCH,
          height: TOUCH,
          borderRadius: radius.button,
          borderWidth: 1,
          borderColor: edge,
          backgroundColor: active ? fill : pressed ? "#eef3f7" : color.surface,
          alignItems: "center",
          justifyContent: "center",
        },
        disabled && { opacity: 0.4 },
      ]}
    >
      <Feather name={icon} size={22} color={active ? "white" : accent} />
    </Pressable>
  );
}

const MAIN: Record<Suggestion["kind"], string> = { condition: "name", allergy: "substance", medication: "generic", bloodType: "value" };
const BLOOD_OPTIONS = BLOOD_TYPES.filter(b => b !== "Unknown").map(b => ({ value: b as string, label: b }));
const kindLabel = (t: Strings, k: Suggestion["kind"]) =>
  ({ condition: t.kindCondition, allergy: t.kindAllergy, medication: t.kindMedication, bloodType: t.bloodType })[k];

function loadMessage(t: Strings, e: ApiError) {
  if (e.code === "unsupported_type") return t.reviewUnsupported;
  if (e.code === "rate_limited") return t.reviewRateLimited;
  return t.reviewFailed;
}

/** "Reading page 1 of 3" with a slim progress bar, instead of a spinner. Falls back to the spinner for the moment between steps. */
function ScanProgress({ scan, t }: { scan: Scan | undefined; t: Strings }) {
  if (scan?.status !== "reading") {
    return (
      <>
        <Notice>{t.reviewReading}</Notice>
        <Loading />
      </>
    );
  }
  const label = scan.pages > 0 ? t.scanReadingPage.replace("{n}", String(scan.page)).replace("{total}", String(scan.pages)) : t.reviewReading;
  // Half a page counts for the page being read, so the bar moves even for a single page.
  const percent = scan.pages > 0 ? Math.round(Math.min(1, Math.max(0.05, (scan.page - 0.5) / scan.pages)) * 100) : 5;
  return (
    <View style={{ gap: space.m }}>
      <Notice>{label}</Notice>
      <View
        accessibilityRole="progressbar"
        accessibilityLabel={label}
        accessibilityValue={{ min: 0, max: 100, now: percent }}
        style={{ height: 6, borderRadius: 3, backgroundColor: color.line, overflow: "hidden" }}
      >
        <View style={{ width: `${percent}%`, height: "100%", backgroundColor: color.blue }} />
      </View>
      <T style={{ color: color.muted, lineHeight: 20 }}>{t.scanBackground}</T>
    </View>
  );
}

/** Review suggestions read from one uploaded document before any are added to the profile. */
export default function Review() {
  const { recordId } = useLocalSearchParams<{ recordId: string }>();
  const { t } = useSession();
  const profile = useResource<Profile>("/profile");
  const { scans, start, clear } = useScans();
  const scan = scans[recordId];
  // Edits are made on a copy, so leaving and coming back starts again from the scan's own suggestions.
  const [edited, setEdited] = useState<Suggestion[] | null>(null);
  const items = edited ?? (scan?.status === "ready" ? scan.suggestions : null);
  const [states, setStates] = useState<ReviewState[] | null>(null);
  const [editing, setEditing] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const savingRef = useRef(false);
  // Set once the suggestions are added, so clearing the finished scan doesn't start a new one while this screen closes.
  const finished = useRef(false);

  // The scan usually started when the file was uploaded. Opened from a record, or after "Try again", there is none yet: start it.
  useEffect(() => {
    if (!scan && !finished.current) start(recordId);
  }, [scan, recordId, start]);

  const loadError = scan?.status === "error" ? scan.error : null;
  const retry = () => {
    setEdited(null);
    setStates(null);
    clear(recordId);
  };

  // Initial states need both the suggestions and the profile (duplicates start removed).
  const p = profile.data;
  const st = states ?? (items && p ? items.map(s => initialState(p, s)) : null);
  const setState = (i: number, v: ReviewState) => st && setStates(st.map((x, j) => (j === i ? v : x)));
  const setField = (i: number, key: string, v: string) => {
    setEdited(list => (list ?? items)?.map((s, j) => (j === i ? { ...s, fields: { ...s.fields, [key]: v } } : s)) ?? null);
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
      finished.current = true;
      clear(recordId);
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
            <ScanProgress scan={scan} t={t} />
            <Button secondary onPress={() => router.back()}>{t.back}</Button>
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
                <Section key={s.id} title={label} tone={state === "checked" ? "selected" : state === "removed" ? "removed" : undefined} action={kind === "duplicate" ? <Pill tone="muted">{t.alreadyOnPassport}</Pill> : s.confidence < 0.6 ? <Pill tone="warn">{t.checkCarefully}</Pill> : undefined}>
                  <View style={{ gap: space.s, opacity: state === "removed" ? 0.5 : 1 }}>
                    <T weight="500" style={{ fontSize: 17 }}>{main}</T>
                    {!!detail && <T style={{ color: color.body }}>{detail}</T>}
                    {kind === "replaces" && <T style={{ color: color.body }}>{`${t.currentValue}: ${p.bloodType}`}</T>}
                    {!!s.quote && <T style={{ color: color.muted, fontStyle: "italic", lineHeight: 20 }}>{`“${s.quote}”`}</T>}
                  </View>
                  {editing === i && (
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
                  {/* Confirm, remove and Edit are always shown. Checked fills the check (blue card); removed fills the X (gray card). */}
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.s, marginTop: space.m }}>
                    <View style={{ flexDirection: "row", gap: space.s }}>
                      {kind !== "duplicate" && (
                        <IconButton
                          icon="check"
                          tone="confirm"
                          active={state === "checked"}
                          disabled={!main.trim()}
                          label={`${t.confirmCorrect}: ${label}, ${main}`}
                          onPress={() => setState(i, state === "checked" ? "pending" : "checked")}
                        />
                      )}
                      {/* A duplicate that starts removed has no controls. An item edited into a duplicate can still be removed. */}
                      {!(kind === "duplicate" && state === "removed") && (
                        <IconButton
                          icon="x"
                          tone="remove"
                          active={state === "removed"}
                          label={`${state === "removed" ? t.restore : t.dontAdd}: ${label}, ${main}`}
                          onPress={() => setState(i, state === "removed" ? "pending" : "removed")}
                        />
                      )}
                    </View>
                    {kind !== "duplicate" && (
                      <Button style={{ minWidth: 96 }} secondary label={`${t.edit}: ${label}, ${main}`} onPress={() => setEditing(editing === i ? null : i)}>
                        {editing === i ? t.done : t.edit}
                      </Button>
                    )}
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
