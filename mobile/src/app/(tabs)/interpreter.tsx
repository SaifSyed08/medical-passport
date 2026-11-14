// The Tessera Interpreter (interpreter/), embedded as-is in a WebView: same design, captions, translation and demo.
// The page gets the traveler's own record so it can flag allergies, medicines, conditions and documents as people talk.
import type { Profile, RecordItem } from "@shared/tessera";
import { useEffect, useMemo, useRef, useState } from "react";
import { Linking, Platform, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import { Button, Heading, Loading, LoadError, Notice, Screen } from "@/components/ui";
import { useResource } from "@/lib/cache";
import { INTERPRETER_URL, interpreterPage, toPersona } from "@/lib/interpreter";
import { useSession } from "@/lib/session";
import { storage } from "@/lib/storage";

const DISCLOSED_KEY = "tessera.interpreterDisclosed";
// The interpreter's own background, so the safe-area strip above it doesn't show a seam.
const PAGE_BG = "#eef2f5";
const ORIGIN = INTERPRETER_URL.match(/^https?:\/\/[^/]+/)?.[0] ?? "";
// react-native-webview types its class as `WebViewProps & P` with P = undefined, which TypeScript 6 reads as never.
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
const Web = WebView<{}>;

export default function InterpreterTab() {
  const { me, t, uiLang } = useSession();
  const insets = useSafeAreaInsets();
  const profile = useResource<Profile>("/profile");
  const records = useResource<RecordItem[]>("/records");
  const web = useRef<InstanceType<typeof Web>>(null);
  const [disclosed, setDisclosed] = useState<boolean | null>(null);
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    storage.get(DISCLOSED_KEY).then(v => setDisclosed(v === "1"), () => setDisclosed(false));
  }, []);

  const persona = useMemo(
    () => (me && profile.data ? toPersona(me, profile.data, records.data ?? [], uiLang) : null),
    [me, profile.data, records.data, uiLang],
  );
  const json = persona ? JSON.stringify(persona) : "";
  // Only the first record goes in before the page loads; later edits are posted to the running page.
  const [initial, setInitial] = useState("");
  if (json && !initial) setInitial(json);

  useEffect(() => {
    if (!loaded || !json || json === initial) return;
    web.current?.injectJavaScript(`window.postMessage({ type: "tessera:persona", persona: ${json} }, "*"); true;`);
  }, [json, loaded, initial]);

  if (!INTERPRETER_URL) {
    return (
      <Screen>
        <Heading>{t.tabInterpreter}</Heading>
        <Notice tone="warn">{t.interpreterMissing}</Notice>
      </Screen>
    );
  }
  if (disclosed === false) {
    return (
      <Screen>
        <Heading>{t.tabInterpreter}</Heading>
        <Notice>{t.interpreterDisclosure}</Notice>
        <Button
          onPress={() => {
            setDisclosed(true);
            void storage.set(DISCLOSED_KEY, "1");
          }}
        >
          {t.interpreterContinue}
        </Button>
      </Screen>
    );
  }
  if (Platform.OS === "web") {
    // The web preview can't host a WebView; open the interpreter in its own tab instead.
    return (
      <Screen>
        <Heading>{t.tabInterpreter}</Heading>
        <Notice>{t.interpreterWebOnly}</Notice>
        <Button onPress={() => void Linking.openURL(interpreterPage())}>{t.interpreterOpen}</Button>
      </Screen>
    );
  }
  if (profile.error && !profile.data) {
    return (
      <Screen>
        <LoadError onRetry={() => void profile.refresh()} />
      </Screen>
    );
  }
  if (disclosed === null || !initial) {
    return (
      <Screen>
        <Loading />
      </Screen>
    );
  }
  if (failed) {
    return (
      <Screen>
        <Heading>{t.tabInterpreter}</Heading>
        <Notice tone="error">{t.interpreterUnreachable}</Notice>
        <Button
          secondary
          onPress={() => {
            setFailed(false);
            setLoaded(false);
          }}
        >
          {t.retry}
        </Button>
      </Screen>
    );
  }

  return (
    <View style={{ flex: 1, paddingTop: insets.top, backgroundColor: PAGE_BG }}>
      <Web
        ref={web}
        source={{ uri: interpreterPage() }}
        injectedJavaScriptBeforeContentLoaded={`window.__TESSERA__ = { persona: ${initial} }; true;`}
        originWhitelist={[ORIGIN]}
        // Links that leave the interpreter open in the system browser.
        onShouldStartLoadWithRequest={req => {
          if (req.url.startsWith(ORIGIN) || req.url === "about:blank") return true;
          void Linking.openURL(req.url);
          return false;
        }}
        mediaCapturePermissionGrantType="grant"
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        domStorageEnabled
        onLoadEnd={() => setLoaded(true)}
        onError={() => setFailed(true)}
        onHttpError={e => e.nativeEvent.statusCode >= 500 && setFailed(true)}
        style={{ flex: 1, backgroundColor: PAGE_BG }}
      />
    </View>
  );
}
