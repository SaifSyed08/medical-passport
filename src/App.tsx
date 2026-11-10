import { useEffect, useMemo, useState } from "react";
import { PERSONAS } from "./data/personas";
import type { Persona } from "./lib/types";
import { loadSettings, saveSettings, type Settings } from "./lib/store";
import { health } from "./lib/api";
import Home from "./components/Home";
import Conversation from "./components/Conversation";

export function effectivePersona(settings: Settings): Persona {
  const base = PERSONAS.find((p) => p.id === settings.personaId) || PERSONAS[0];
  const pair = settings.pairs[base.id];
  if (!pair) return base;
  return { ...base, language: pair.patientLang, trip: { ...base.trip, country: pair.local, doctorLanguage: pair.doctorLang } };
}

export default function App() {
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [screen, setScreen] = useState<"home" | "talk">(() => (new URLSearchParams(location.search).has("talk") ? "talk" : "home"));
  const [serverIssue, setServerIssue] = useState<string | null>(null);
  const persona = useMemo(() => effectivePersona(settings), [settings]);

  useEffect(() => saveSettings(settings), [settings]);
  useEffect(() => {
    health()
      .then((h) =>
        setServerIssue(
          h.locked
            ? "This server is locked. Open the link that ends in ?code=… once on this phone."
            : h.key
              ? null
              : "The server has no OPENAI_API_KEY, so speech and translation won't work.",
        ),
      )
      .catch(() => setServerIssue("Can't reach the interpreter server."));
  }, []);

  return (
    <div className="app">
      {serverIssue && <div className="banner">{serverIssue}</div>}
      {screen === "home" ? (
        <Home persona={persona} settings={settings} setSettings={setSettings} onStart={() => setScreen("talk")} />
      ) : (
        <Conversation persona={persona} settings={settings} setSettings={setSettings} onBack={() => setScreen("home")} />
      )}
    </div>
  );
}
