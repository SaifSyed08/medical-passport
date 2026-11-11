import * as Haptics from "expo-haptics";
import { useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { DESTINATIONS, LANGUAGE_NAMES, OTHER_DESTINATION } from "@shared/tessera";
import { useSession } from "@/lib/session";
import { color, radius, space, TOUCH } from "@/lib/theme";
import { Field, T } from "./ui";

/**
 * Searchable list of study-abroad destinations. Each row shows the language doctors there will see.
 * "Other country" means the profile is shown in English.
 */
export function DestinationPicker({ value, onChange }: { value: string | null | undefined; onChange: (code: string) => void }) {
  const { t } = useSession();
  const [query, setQuery] = useState("");
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = DESTINATIONS.filter(d => !q || d.name.toLowerCase().includes(q) || d.code.toLowerCase() === q);
    return [...list, { code: OTHER_DESTINATION, name: t.otherCountry, language: "en" as const }];
  }, [query, t.otherCountry]);

  return (
    <View style={{ gap: space.m }}>
      <Field label={t.searchCountries} value={query} onChangeText={setQuery} autoCorrect={false} autoCapitalize="words" returnKeyType="search" />
      <View accessibilityRole="radiogroup" accessibilityLabel={t.destination} style={styles.list}>
        {rows.map((d, i) => {
          const on = d.code === value;
          const lang = LANGUAGE_NAMES[d.language];
          return (
            <Pressable
              key={d.code}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              accessibilityLabel={`${d.name}. ${lang}`}
              onPress={() => {
                void Haptics.selectionAsync();
                onChange(d.code);
              }}
              style={({ pressed }) => [styles.row, i < rows.length - 1 && styles.rowLine, on && styles.rowOn, pressed && { opacity: 0.6 }]}
            >
              <View style={{ flex: 1, gap: 2 }}>
                <T weight={on ? "500" : undefined} style={{ fontSize: 15.5, color: on ? color.blue : color.ink }}>{d.name}</T>
                {d.code === OTHER_DESTINATION && <T style={{ fontSize: 12.5, color: color.subtle }}>{t.otherCountryNote}</T>}
              </View>
              <T style={{ fontSize: 13.5, color: on ? color.blue : color.muted }}>{lang}</T>
              <T importantForAccessibility="no" style={{ width: 20, textAlign: "right", color: color.blue, fontSize: 16 }}>{on ? "✓" : ""}</T>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { backgroundColor: "white", borderRadius: radius.section, borderWidth: 1, borderColor: "#e0e5e7", overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", gap: space.m, minHeight: TOUCH + 4, paddingHorizontal: space.l, paddingVertical: 10 },
  rowLine: { borderBottomWidth: 1, borderBottomColor: "#edf0f2" },
  rowOn: { backgroundColor: "#eef3f8" },
});
