import * as Haptics from "expo-haptics";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { COUNTRIES } from "@/lib/countries";
import { flag } from "@/lib/flag";
import { useSession } from "@/lib/session";
import { color, radius, space, TOUCH } from "@/lib/theme";
import { Icon } from "./icons";
import { Field, T } from "./ui";

/** Searchable list of every country the medicine converter knows, with flags. */
export function CountryPicker({ value, onChange, label }: { value: string | null | undefined; onChange: (code: string) => void; label: string }) {
  const { t } = useSession();
  const [query, setQuery] = useState("");
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return COUNTRIES.filter(c => !q || c.name.toLowerCase().includes(q) || c.code.toLowerCase() === q);
  }, [query]);
  return (
    <View style={{ gap: space.s }}>
      <Field label={t.searchCountries} value={query} onChangeText={setQuery} autoCorrect={false} autoCapitalize="words" returnKeyType="search" />
      <View accessibilityRole="radiogroup" accessibilityLabel={label} style={styles.list}>
        <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled" style={{ maxHeight: 290 }}>
          {rows.map((c, i) => {
            const on = c.code === value;
            return (
              <Pressable
                key={c.code}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                accessibilityLabel={c.name}
                onPress={() => {
                  void Haptics.selectionAsync();
                  onChange(c.code);
                }}
                style={({ pressed }) => [styles.row, i < rows.length - 1 && styles.rowLine, on && styles.rowOn, pressed && { opacity: 0.6 }]}
              >
                <T style={{ fontSize: 17 }}>{flag(c.code)}</T>
                <T weight={on ? "500" : undefined} style={{ flex: 1, fontSize: 15.5, color: on ? color.blue : color.ink }}>{c.name}</T>
                {on && <Icon name="check" color={color.blue} size={18} />}
              </Pressable>
            );
          })}
          {rows.length === 0 && <T style={{ padding: space.l, color: color.subtle }}>{t.noneYet}</T>}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { backgroundColor: "white", borderRadius: radius.section, borderWidth: 1, borderColor: color.line, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", gap: space.m, minHeight: TOUCH, paddingHorizontal: space.l, paddingVertical: 8 },
  rowLine: { borderBottomWidth: 1, borderBottomColor: "#edf0f2" },
  rowOn: { backgroundColor: "#eef3f8" },
});
