import { useEffect, useMemo, useState } from "react";
import { PERSONAS } from "./data/personas";
import type { Persona } from "./lib/types";
import { loadSettings, saveSettings, type Settings } from "./lib/store";
import { health } from "./lib/api";
import Home from "./components/Home";
import Conversation from "./components/Conversation";
import { toggleDemoVoices, toggleFastDemo, unlockAudio } from "./lib/audioSession";
import { embedded, hostPersona, notifyHost, onHostPersona } from "./lib/host";
import { TANDEM_ICON } from "./components/TandemLogo";
import Icon from "./components/Icon";
import { applyEdits, useEdits } from "./lib/edits";
import { onDevice, setOnDevice, useOnDevice, warmLocal } from "./lib/onDevice";

export function effectivePersona(settings: Settings, personas: Persona[] = PERSONAS): Persona {
  const base = personas.find((p) => p.id === settings.personaId) || personas[0];
  const pair = settings.pairs[base.id];
  const edited = applyEdits(base);
  if (!pair) return edited;
  return { ...edited, language: pair.patientLang, trip: { ...base.trip, country: pair.local, doctorLanguage: pair.doctorLang } };
}

export default function App() {
  // Inside the Tessera app the signed-in traveler's own record comes first, and each visit starts on it.
  const [host, setHost] = useState<Persona | null>(hostPersona);
  useEffect(() => onHostPersona(setHost), []);
  // The app shows a diagnostic instead of a blank tab until it hears this.
  useEffect(() => notifyHost({ type: "tessera:ready" }), []);
  const personas = useMemo(() => (host ? [host, ...PERSONAS] : PERSONAS), [host]);
  const [settings, setSettings] = useState<Settings>(() => {
    const s = loadSettings();
    const h = hostPersona();
    return h ? { ...s, personaId: h.id } : s;
  });
  const [screen, setScreen] = useState<"home" | "talk">(() => (new URLSearchParams(location.search).has("talk") ? "talk" : "home"));
  // Bumped to start the recorded demo; 0 = a normal conversation.
  const [demoRequest, setDemoRequest] = useState(() => (new URLSearchParams(location.search).has("demo") ? 1 : 0));
  const [serverIssue, setServerIssue] = useState<string | null>(null);
  // Private mode (P): a short note says what changed; the lock in each header says it's on.
  const private_ = useOnDevice();
  const [deviceNote, setDeviceNote] = useState<string | null>(null);
  // Which icon the note carries: the lock for private mode, a speaker for the demo voices (V).
  const [noteIcon, setNoteIcon] = useState<"device" | "speaker" | "mute">("device");
  // The patient's own edits (swipe to delete, scanned documents) re-derive the record everywhere.
  const edits = useEdits(settings.personaId);
  const persona = useMemo(() => effectivePersona(settings, personas), [settings, personas, edits]);

  useEffect(() => saveSettings(settings), [settings]);

  // Tandem: a second visual identity over the same app. The page-level bits (tab title, icon, desktop backdrop)
  // live outside React's tree, so they follow the setting here.
  const brand = settings.brand;
  useEffect(() => {
    document.documentElement.dataset.brand = brand;
    document.title = brand === "tandem" ? "Tandem" : "Parity";
    const icon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (icon) icon.href = brand === "tandem" ? TANDEM_ICON : "/icon.svg";
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", brand === "tandem" ? "#0b2452" : "#f2f2ef");
  }, [brand]);

  // Screen changes animate inside the phone (the incoming screen and its header/mic glide in, clipped by the frame).
  const [nav, setNav] = useState<"forward" | "back" | "none">("none");
  const go = (next: "home" | "talk", before?: () => void) => {
    before?.();
    setNav(next === "talk" ? "forward" : "back");
    setScreen(next);
  };

  useEffect(() => {
    if (demoRequest && screen === "home") go("talk");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demoRequest, screen]);
  useEffect(() => {
    health()
      .then((h) =>
        setServerIssue(
          // Locked servers say so on the line that fails; no red bar over the app.
          h.locked
            ? null
            : h.key
              ? null
              : "The server has no OPENAI_API_KEY, so live translation won't work. The demo (D) still does.",
        ),
      )
      .catch(() => setServerIssue("Can't reach the interpreter server."));
  }, []);

  // Load the local models for this patient's two languages whenever private mode is on.
  const langs = `${persona.language},${persona.trip.doctorLanguage}`;
  useEffect(() => {
    if (!private_) return;
    let live = true;
    warmLocal(langs.split(",")).then((s) => {
      if (live && !s?.ready) setNoteIcon("device");
      if (live && !s?.ready) setDeviceNote("Private mode can't load its models. On the laptop, run npm run local:setup.");
    });
    return () => {
      live = false;
    };
  }, [private_, langs]);
  useEffect(() => {
    if (!deviceNote) return;
    const t = window.setTimeout(() => setDeviceNote(null), 3200);
    return () => window.clearTimeout(t);
  }, [deviceNote]);

  // D anywhere plays the recorded demo.
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey || (el && /^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName))) return;
      if (e.key === "f" || e.key === "F") {
        toggleFastDemo();
        return;
      }
      if (e.key === "l" || e.key === "L") {
        // Experimental conversation layout (Focus): one line at a time, record notes pinned under it.
        setSettings((s) => ({ ...s, layout: s.layout === "focus" ? "classic" : "focus" }));
        return;
      }
      if (e.key === "p" || e.key === "P") {
        const next = !onDevice();
        setOnDevice(next);
        setNoteIcon("device");
        setDeviceNote(next ? "Private mode: speech, translation and record checks stay on this device." : "Cloud mode: the full models, online.");
        return;
      }
      if (e.key === "v" || e.key === "V") {
        const on = toggleDemoVoices();
        setNoteIcon(on ? "speaker" : "mute");
        setDeviceNote(on ? "Demo: the speakers' recorded voices play." : "Demo: speakers' voices off. Captions still roll and translations are still spoken.");
        return;
      }
      if (e.key === "3") {
        // Don't leave a focus ring on whatever was clicked last.
        (document.activeElement as HTMLElement | null)?.blur?.();
        setSettings((s) => ({ ...s, brand: s.brand === "tandem" ? "parity" : "tandem" }));
        return;
      }
      if (e.key === "d" || e.key === "D") {
        // Unlock audio inside the key press itself: iOS/Chrome block playback that starts later otherwise.
        unlockAudio();
        setDemoRequest((n) => n + 1);
      }
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, []);

  return (
    <div className={`app nav-${nav}${embedded() ? " embedded" : ""}`} data-brand={brand}>
      {/* Desktop only: a phone status bar with the Dynamic Island, so the screen reads like the real device. */}
      {!embedded() && <div className="device-bar" aria-hidden>
        <span className="device-time">9:41</span>
        <span className="island" />
        <span className="device-icons">
          <svg viewBox="0 0 18 12" width="18" height="12">
            <rect x="0" y="8" width="3" height="4" rx="1" fill="currentColor" />
            <rect x="5" y="5.5" width="3" height="6.5" rx="1" fill="currentColor" />
            <rect x="10" y="3" width="3" height="9" rx="1" fill="currentColor" />
            <rect x="15" y="0" width="3" height="12" rx="1" fill="currentColor" />
          </svg>
          <svg viewBox="0 0 16 12" width="16" height="12">
            <path d="M8 11.5 5.6 9a3.4 3.4 0 0 1 4.8 0zM3.4 6.8a6.5 6.5 0 0 1 9.2 0l-1.4 1.4a4.5 4.5 0 0 0-6.4 0zM1 4.4a9.9 9.9 0 0 1 14 0l-1.4 1.4a7.9 7.9 0 0 0-11.2 0z" fill="currentColor" />
          </svg>
          <svg viewBox="0 0 27 12" width="27" height="12">
            <rect x=".5" y=".5" width="23" height="11" rx="3.5" fill="none" stroke="currentColor" opacity=".4" />
            <rect x="2" y="2" width="17" height="8" rx="2" fill="currentColor" />
            <rect x="24.5" y="4" width="2" height="4" rx="1" fill="currentColor" opacity=".4" />
          </svg>
        </span>
      </div>}
      {serverIssue && !(private_ && /OPENAI_API_KEY/.test(serverIssue)) && <div className="banner">{serverIssue}</div>}
      {deviceNote && (
        <div className={`device-note${noteIcon === "device" && private_ ? " on" : ""}`} role="status">
          <Icon name={noteIcon === "device" ? (private_ ? "lock" : "sparkle") : noteIcon} size={18} />
          {deviceNote}
        </div>
      )}
      {screen === "home" ? (
        <Home
          persona={persona}
          personas={personas}
          settings={settings}
          setSettings={setSettings}
          onStart={() => {
            unlockAudio();
            go("talk", () => setDemoRequest(0));
          }}
          onDemo={() => {
            unlockAudio();
            setDemoRequest((n) => n + 1);
          }}
        />
      ) : (
        <Conversation
          key={persona.id}
          persona={persona}
          settings={settings}
          setSettings={setSettings}
          demoRequest={demoRequest}
          onBack={() => {
            go("home", () => setDemoRequest(0));
          }}
        />
      )}
    </div>
  );
}
