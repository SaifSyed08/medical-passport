import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, View } from "react-native";
import type { Profile } from "@shared/tessera";
import { ApiError } from "@/lib/api";
import { useResource } from "@/lib/cache";
import { ask } from "@/lib/confirm";
import { ITEM_KINDS, saveProfile, type ItemKind } from "@/lib/profile";
import { useSession } from "@/lib/session";
import { space } from "@/lib/theme";
import { Button, Field, Heading, Notice, Screen, Segmented } from "@/components/ui";

/** Add or edit one allergy, medication, condition or emergency contact. */
export default function ItemForm() {
  const { kind, id } = useLocalSearchParams<{ kind: ItemKind; id?: string }>();
  const { t } = useSession();
  const def = ITEM_KINDS[kind] ?? ITEM_KINDS.allergy;
  const profile = useResource<Profile>("/profile");
  const list = (profile.data?.[def.list] ?? []) as unknown as Record<string, string>[];
  const existing = id ? list.find(x => x.id === id) : undefined;
  const [item, setItem] = useState<Record<string, string>>(() => ({ ...(def.blank() as unknown as Record<string, string>), ...existing }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const missing = def.fields.filter(f => f.required && !item[f.key]?.trim());

  async function commit(next: Record<string, string>[]) {
    if (!profile.data) return;
    setBusy(true);
    setError("");
    try {
      await saveProfile({ ...profile.data, [def.list]: next } as Profile);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (e) {
      setError(e instanceof ApiError && e.status === 400 ? e.message : t.errorGeneric);
    } finally {
      setBusy(false);
    }
  }

  const save = () => commit(existing ? list.map(x => (x.id === existing.id ? item : x)) : [...list, item]);
  const remove = async () => {
    if (await ask(t.delete, `${t.delete} "${existing?.[def.fields[0].key]}"?`, t.delete, t.cancel, true)) await commit(list.filter(x => x.id !== existing?.id));
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Screen>
        <Heading size={28}>{`${existing ? t.edit : t.add}: ${def.title}`}</Heading>
        {def.fields.map(f =>
          f.options ? (
            <View key={f.key} style={{ gap: space.s }}>
              <Segmented label={f.label} value={item[f.key]} options={f.options} onChange={v => setItem(s => ({ ...s, [f.key]: v }))} />
            </View>
          ) : (
            <Field
              key={f.key}
              label={f.required ? `${f.label} (${t.required.toLowerCase()})` : f.label}
              hint={f.hint}
              value={item[f.key] ?? ""}
              multiline={f.multiline}
              keyboardType={f.keyboard}
              onChangeText={v => setItem(s => ({ ...s, [f.key]: v }))}
            />
          ),
        )}
        {!!error && <Notice tone="error">{error}</Notice>}
        <Notice>{t.untranslatedNote}</Notice>
        <Button busy={busy} disabled={missing.length > 0 || !profile.data} onPress={save}>{busy ? t.saving : t.save}</Button>
        <Button secondary onPress={() => router.back()}>{t.cancel}</Button>
        {existing && <Button secondary danger onPress={remove}>{t.delete}</Button>}
      </Screen>
    </KeyboardAvoidingView>
  );
}
