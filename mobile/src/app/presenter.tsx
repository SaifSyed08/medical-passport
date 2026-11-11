import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { useState } from "react";
import { Switch, View } from "react-native";
import { pollActivity, resetActivity } from "@/lib/activity";
import { api } from "@/lib/api";
import { clearCache } from "@/lib/cache";
import { ask } from "@/lib/confirm";
import { useSession } from "@/lib/session";
import { color, space, TOUCH } from "@/lib/theme";
import { Button, Heading, Notice, Screen, Section, T } from "@/components/ui";

type Scenario = "emergency_view" | "wrong_dob" | "unverified_clinician" | "full_request";

/** Presenter tools (long-press the logo). Simulates the clinician side, which isn't built yet. */
export default function Presenter() {
  const { t, me, setMe } = useSession();
  const [busy, setBusy] = useState("");
  const [result, setResult] = useState<{ tone: "ok" | "warn" | "error"; text: string } | null>(null);

  async function run(key: string, fn: () => Promise<string>) {
    setBusy(key);
    setResult(null);
    try {
      const text = await fn();
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setResult({ tone: "ok", text });
    } catch {
      setResult({ tone: "error", text: t.errorGeneric });
    } finally {
      setBusy("");
    }
  }

  const simulate = (scenario: Scenario) =>
    run(scenario, async () => {
      const r = await api<{ ok: boolean; result: string }>("/presenter/simulate", { body: { scenario } });
      // Poll right away so the banner shows without waiting for the next interval.
      await pollActivity(true, t.notifTitle).catch(() => {});
      return r.ok ? `${t.done}: ${r.result.replaceAll("_", " ")}` : t.cardUnusable;
    });

  const setAutoApprove = (autoApprove: boolean) =>
    run("auto", async () => {
      await api("/prefs", { method: "PUT", body: { autoApprove } });
      if (me) setMe({ ...me, autoApprove });
      return `${t.autoApprove}: ${autoApprove ? "on" : "off"}`;
    });

  const reset = async () => {
    if (!(await ask(t.resetDemo, t.resetConfirm, t.resetDemo, t.cancel, true))) return;
    await run("reset", async () => {
      await api("/presenter/reset", { body: {} });
      clearCache();
      resetActivity();
      if (me) setMe({ ...me, autoApprove: false });
      return t.done;
    });
  };

  const scenarios: [Scenario, string][] = [
    ["emergency_view", t.simEmergency],
    ["full_request", t.simFull],
    ["wrong_dob", t.simWrongDob],
    ["unverified_clinician", t.simUnverified],
  ];

  return (
    <Screen>
      <Heading size={28}>{t.presenter}</Heading>
      <Notice tone="warn">{t.presenterLead}</Notice>
      {result && <Notice tone={result.tone}>{result.text}</Notice>}
      <Section title="Scenarios">
        <View style={{ gap: space.m }}>
          {scenarios.map(([s, label]) => (
            <Button key={s} secondary busy={busy === s} disabled={!!busy && busy !== s} onPress={() => simulate(s)}>{label}</Button>
          ))}
        </View>
        <T style={{ color: color.subtle, fontSize: 13, marginTop: space.m }}>
          Frozen card: freeze it on the Privacy tab, then run any scenario. Replaced card: replace it, then open the old link.
        </T>
      </Section>
      <Section>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: TOUCH, gap: space.m }}>
          <T style={{ flex: 1, fontSize: 15.5 }}>{t.autoApprove}</T>
          <Switch accessibilityLabel={t.autoApprove} value={!!me?.autoApprove} onValueChange={setAutoApprove} disabled={busy === "auto"} trackColor={{ true: color.blue }} />
        </View>
      </Section>
      <Button secondary danger busy={busy === "reset"} onPress={reset}>{t.resetDemo}</Button>
      <Button secondary onPress={() => router.back()}>{t.close}</Button>
    </Screen>
  );
}
