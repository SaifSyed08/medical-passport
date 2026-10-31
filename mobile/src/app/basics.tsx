import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, View } from "react-native";
import { BLOOD_TYPES, type BloodType, type Profile } from "@shared/tessera";
import { ApiError } from "@/lib/api";
import { useResource } from "@/lib/cache";
import { saveProfile } from "@/lib/profile";
import { useSession } from "@/lib/session";
import { color, radius, space, TOUCH } from "@/lib/theme";
import { Button, Field, Heading, Notice, Screen, T } from "@/components/ui";

export default function Basics() {
  const { t } = useSession();
  const profile = useResource<Profile>("/profile");
  const p = profile.data;
  const [blood, setBlood] = useState<BloodType>(p?.bloodType ?? "Unknown");
  const [height, setHeight] = useState(p?.basics.heightCm == null ? "" : String(p.basics.heightCm));
  const [weight, setWeight] = useState(p?.basics.weightKg == null ? "" : String(p.basics.weightKg));
  // Blank means "not recorded".
  const num = (v: string) => (v.trim() === "" ? null : Number(v));
  const [sex, setSex] = useState(p?.basics.sex ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    if (!p) return;
    setBusy(true);
    setError("");
    try {
      await saveProfile({ ...p, bloodType: blood, basics: { ...p.basics, sex, heightCm: num(height), weightKg: num(weight) } });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (e) {
      setError(e instanceof ApiError && e.status === 400 ? e.message : t.errorGeneric);
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Screen>
        <Heading size={28}>{t.basics}</Heading>
        <View style={{ gap: space.s }}>
          <T weight="500" style={{ fontSize: 14, color: "#5b6c7b" }}>{t.bloodType}</T>
          <View accessibilityRole="radiogroup" accessibilityLabel={t.bloodType} style={{ flexDirection: "row", flexWrap: "wrap", gap: space.s }}>
            {BLOOD_TYPES.map(b => (
              <Pressable
                key={b}
                accessibilityRole="radio"
                accessibilityState={{ checked: blood === b }}
                accessibilityLabel={`${t.bloodType} ${b}`}
                onPress={() => setBlood(b)}
                style={{ minWidth: TOUCH + 12, minHeight: TOUCH, borderRadius: radius.button, borderWidth: 1, borderColor: blood === b ? color.blue : "#cdd5dd", backgroundColor: blood === b ? color.blue : "white", alignItems: "center", justifyContent: "center", paddingHorizontal: 10 }}
              >
                <T weight="500" style={{ color: blood === b ? "white" : "#30445e" }}>{b}</T>
              </Pressable>
            ))}
          </View>
        </View>
        <Field label={t.heightCm} keyboardType="number-pad" value={height} onChangeText={setHeight} />
        <Field label={t.weightKg} keyboardType="number-pad" value={weight} onChangeText={setWeight} />
        <Field label={t.sex} value={sex} onChangeText={setSex} />
        {!!error && <Notice tone="error">{error}</Notice>}
        <Button busy={busy} disabled={!p} onPress={save}>{busy ? t.saving : t.save}</Button>
        <Button secondary onPress={() => router.back()}>{t.cancel}</Button>
      </Screen>
    </KeyboardAvoidingView>
  );
}
