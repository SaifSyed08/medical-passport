import * as Haptics from "expo-haptics";
import { Redirect } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { API_URL, ApiError } from "@/lib/api";
import { useSession } from "@/lib/session";
import { color, space } from "@/lib/theme";
import { Button, Heading, Logo, Notice, Screen, Segmented, T } from "@/components/ui";

export default function Login() {
  const { signedIn, signIn, t, uiLang, setUiLang } = useSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (signedIn) return <Redirect href="/" />;

  async function go() {
    setBusy(true);
    setError("");
    try {
      await signIn();
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      setError(e instanceof ApiError && e.offline ? t.offline.split(".")[0] + "." : t.errorGeneric);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Logo presenter={false} />
      <View style={{ gap: space.l, marginTop: space.xxl }}>
        <Heading size={40}>{t.loginTitle}</Heading>
        <T style={{ fontSize: 17, lineHeight: 25, color: color.muted }}>{t.loginLead}</T>
      </View>
      <View style={{ gap: space.m, marginTop: space.xl }}>
        {!API_URL && <Notice tone="error">{t.apiMissing}</Notice>}
        {!!error && <Notice tone="error">{error}</Notice>}
        <Button onPress={go} busy={busy} disabled={!API_URL}>{t.loginButton}</Button>
        <Notice>{t.loginNote}</Notice>
      </View>
      <View style={{ gap: space.s, marginTop: space.l }}>
        <T weight="500" style={{ fontSize: 14, color: "#5b6c7b" }}>{t.appLanguage}</T>
        <Segmented label={t.appLanguage} value={uiLang} onChange={setUiLang} options={[{ value: "en", label: "English" }, { value: "ja", label: "日本語" }]} />
      </View>
      {!!API_URL && <T style={{ fontSize: 12, color: color.subtle }}>API: {API_URL}</T>}
    </Screen>
  );
}
