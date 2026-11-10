import { useEffect, useMemo, useState } from "react";
import { PERSONAS } from "./data/personas";
import type { Persona } from "./lib/types";
import { loadSettings, saveSettings, type Settings } from "./lib/store";
import { health } from "./lib/api";
import Home from "./components/Home";
import Conversation from "./components/Conversation";
import { unlockAudio } from "./lib/audioSession";

export function effectivePersona(settings: Settings): Persona {
  const base = PERSONAS.find((p) => p.id === settings.personaId) || PERSONAS[0];
  const pair = settings.pairs[base.id];
  if (!pair) return base;
  return { ...base, language: pair.patientLang, trip: { ...base.trip, country: pair.local, doctorLanguage: pair.doctorLang } };
}

export default function App() {
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [screen, setScreen] = useState<"home" | "talk">(() => (new URLSearchParams(location.search).has("talk") ? "talk" : "home"));
  // Bumped to start the recorded demo; 0 = a normal conversation.
  const [demoRequest, setDemoRequest] = useState(() => (new URLSearchParams(location.search).has("demo") ? 1 : 0));
  const [serverIssue, setServerIssue] = useState<string | null>(null);
  const persona = useMemo(() => effectivePersona(settings), [settings]);

  useEffect(() => saveSettings(settings), [settings]);

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
          h.locked
            ? "This server is locked. Open the link that ends in ?code=… once on this phone."
            : h.key
              ? null
              : "The server has no OPENAI_API_KEY, so live translation won't work. The demo (D) still does.",
        ),
      )
      .catch(() => setServerIssue("Can't reach the interpreter server."));
  }, []);

  // D anywhere plays the recorded demo.
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (e.metaKey || e.ctrlKey || e.altKey || (el && /^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName))) return;
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
    <div className={`app nav-${nav}`}>
      {/* Desktop only: a phone status bar with the Dynamic Island, so the screen reads like the real device. */}
      <div className="device-bar" aria-hidden>
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
      </div>
      {serverIssue && <div className="banner">{serverIssue}</div>}
      {screen === "home" ? (
        <Home
          persona={persona}
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
