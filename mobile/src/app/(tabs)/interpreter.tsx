// The Parity Interpreter (interpreter/), embedded as-is in a WebView: same design, captions, translation and demo.
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
// Runs before the page's own scripts: forwards any script error to the app, so a crash shows up instead of a blank tab.
const REPORT_ERRORS = `(function () {
  function send(m) { try { window.ReactNativeWebView.postMessage(JSON.stringify({ type: "tessera:error", message: String(m).slice(0, 300) })); } catch (e) {} }
  window.addEventListener("error", function (e) { send((e.message || "Script error") + (e.filename ? " (" + e.filename.split("/").pop() + ":" + e.lineno + ")" : "")); });
  window.addEventListener("unhandledrejection", function (e) { send("Unhandled: " + ((e.reason && e.reason.message) || e.reason)); });
})();`;
const READY_TIMEOUT_MS = 10000;

export default function InterpreterTab() {
  const { me, t, uiLang } = useSession();
  const insets = useSafeAreaInsets();
  const profile = useResource<Profile>("/profile");
  const records = useResource<RecordItem[]>("/records");
  const web = useRef<InstanceType<typeof Web>>(null);
  const [disclosed, setDisclosed] = useState<boolean | null>(null);
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  // "ready" = the page has drawn (it posts tessera:ready). Until then, a stall or script error is shown, not a blank tab.
  const [ready, setReady] = useState(false);
  const [problem, setProblem] = useState("");
  const [lastEvent, setLastEvent] = useState("not started");
  const [attempt, setAttempt] = useState(0);

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

  const showWeb = !!INTERPRETER_URL && disclosed === true && Platform.OS !== "web" && !!initial && !failed;
  useEffect(() => {
    if (!showWeb || ready) return;
    const timer = setTimeout(() => setProblem(p => p || "The page didn't draw within 10 seconds."), READY_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [showWeb, ready, attempt]);

  const reload = () => {
    setReady(false);
    setProblem("");
    setLoaded(false);
    setAttempt(n => n + 1);
  };
  const track = (what: string) => {
    setLastEvent(what);
    console.log(`[interpreter tab] ${what}`);
  };

  useEffect(() => {
    if (!loaded || !json || json === initial) return;
    web.current?.injectJavaScript(`window.postMessage({ type: "tessera:persona", persona: ${json} }, "*"); true;`);
  }, [json, loaded, initial]);

  if (!INTERPRETER_URL) {
    return (
      <Screen>
        <Heading>{t.interpreterTitle}</Heading>
        <Notice tone="warn">{t.interpreterMissing}</Notice>
      </Screen>
    );
  }
  if (disclosed === false) {
    return (
      <Screen>
        <Heading>{t.interpreterTitle}</Heading>
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
        <Heading>{t.interpreterTitle}</Heading>
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
        <Heading>{t.interpreterTitle}</Heading>
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
        key={attempt}
        ref={web}
        source={{ uri: interpreterPage() }}
        injectedJavaScriptBeforeContentLoaded={`${REPORT_ERRORS}\nwindow.__TESSERA__ = { persona: ${initial} }; true;`}
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
        onLoadStart={e => track(`loading ${e.nativeEvent.url}`)}
        onLoadEnd={e => {
          track(`loaded ${e.nativeEvent.url} (still loading: ${e.nativeEvent.loading})`);
          setLoaded(true);
        }}
        onError={e => {
          track(`error ${e.nativeEvent.code}: ${e.nativeEvent.description}`);
          setFailed(true);
        }}
        onHttpError={e => {
          track(`HTTP ${e.nativeEvent.statusCode} for ${e.nativeEvent.url}`);
          if (e.nativeEvent.statusCode >= 500) setFailed(true);
        }}
        onMessage={e => {
          let m: { type?: string; message?: string } = {};
          try {
            m = JSON.parse(e.nativeEvent.data);
          } catch {
            return;
          }
          if (m.type === "tessera:ready") {
            track("page drew");
            setReady(true);
            setProblem("");
          } else if (m.type === "tessera:error" && !ready) {
            console.warn(`[interpreter tab] page error: ${m.message}`);
            setProblem(m.message ?? "Script error");
          }
        }}
        // The phone can kill the page's process to save memory; bring it back instead of leaving it blank.
        onContentProcessDidTerminate={() => {
          track("iOS ended the page's process");
          reload();
        }}
        onRenderProcessGone={() => {
          track("Android ended the page's process");
          reload();
        }}
        style={{ flex: 1, backgroundColor: PAGE_BG }}
      />
      {problem ? (
        <View style={{ position: "absolute", left: 0, right: 0, top: insets.top, padding: 20, gap: 12, backgroundColor: PAGE_BG }}>
          <Notice tone="error">{`${t.interpreterBlank}\n\n${problem}\nLast step: ${lastEvent}`}</Notice>
          <Button secondary onPress={reload}>{t.interpreterReload}</Button>
        </View>
      ) : null}
    </View>
  );
}
