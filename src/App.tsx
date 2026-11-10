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
  useEffect(() => {
    if (demoRequest && screen === "home") setScreen("talk");
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
    <div className="app">
      {serverIssue && <div className="banner">{serverIssue}</div>}
      {screen === "home" ? (
        <Home
          persona={persona}
          settings={settings}
          setSettings={setSettings}
          onStart={() => {
            unlockAudio();
            setDemoRequest(0);
            setScreen("talk");
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
            setDemoRequest(0);
            setScreen("home");
          }}
        />
      )}
    </div>
  );
}
