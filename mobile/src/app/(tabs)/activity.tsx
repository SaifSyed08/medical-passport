import { useFocusEffect } from "expo-router";
import { useCallback } from "react";
import { View } from "react-native";
import type { AccessEvent } from "@shared/tessera";
import { markActivityRead } from "@/lib/activity";
import { useResource } from "@/lib/cache";
import { useSession } from "@/lib/session";
import { color, space } from "@/lib/theme";
import { Heading, LoadError, Loading, Logo, Pill, Screen, Section, T } from "@/components/ui";

const when = (iso: string) => new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

/** Access log: who, when, facility and what was viewed. Newest first. */
export default function Activity() {
  const { t } = useSession();
  const log = useResource<AccessEvent[]>("/access-log");
  useFocusEffect(useCallback(() => markActivityRead(), []));

  return (
    <Screen onRefresh={log.refresh} refreshing={log.loading} stale={log.stale}>
      <Logo />
      <View style={{ gap: 6 }}>
        <Heading>{t.accessLog}</Heading>
        <T style={{ color: color.muted }}>{t.accessLogLead}</T>
      </View>
      {!log.data && log.loading && <Loading />}
      {!log.data && log.error && <LoadError onRetry={log.refresh} />}
      {log.data?.length === 0 && <T style={{ color: color.body }}>{t.noActivity}</T>}
      {!!log.data?.length && (
        <Section>
          {log.data.map((e, i) => {
            const blocked = e.outcome === "denied" || e.outcome === "failure";
            return (
              <View
                key={e.seq}
                accessible
                accessibilityLabel={`${when(e.at)}. ${e.message}${e.scope ? `. Scope: ${e.scope}` : ""}${e.seeded ? `. ${t.seeded}` : ""}`}
                style={{ paddingVertical: 12, gap: 5, borderBottomWidth: i === log.data!.length - 1 ? 0 : 1, borderBottomColor: "#edf0f2" }}
              >
                <View style={{ flexDirection: "row", gap: space.s, alignItems: "center", flexWrap: "wrap" }}>
                  <T style={{ fontSize: 12.5, color: color.subtle }}>{when(e.at)}</T>
                  {blocked && <Pill tone="error">Blocked</Pill>}
                  {e.scope && <Pill tone="muted">{e.scope}</Pill>}
                  {e.seeded && <Pill tone="muted">{t.seeded}</Pill>}
                </View>
                <T style={{ fontSize: 15, lineHeight: 21, color: color.ink }}>{e.message}</T>
                {e.detail && !e.seeded && <T style={{ fontSize: 13, color: color.body }}>{e.detail}</T>}
              </View>
            );
          })}
        </Section>
      )}
    </Screen>
  );
}
