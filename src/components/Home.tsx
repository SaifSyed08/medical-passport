import { useCallback, useEffect, useState } from "react";
import { PERSONAS } from "../data/personas";
import type { Equivalent, Persona } from "../lib/types";
import { equivalents } from "../lib/api";
import { COUNTRIES, LANGS, country, dir, langNative } from "../lib/langs";
import { loadTrip, norm, saveEquivalents, type Settings, type TripCache } from "../lib/store";
import { Sheet, StatusBadge, Tag } from "./bits";
import RecordSheet from "./RecordSheet";

type Props = {
  persona: Persona;
  settings: Settings;
  setSettings: (f: (s: Settings) => Settings) => void;
  onStart: () => void;
  onDemo: () => void;
};

const HELLO: Record<string, string> = {
  es: "Hola", en: "Hi", ja: "こんにちは", fr: "Bonjour", de: "Hallo", it: "Ciao", pt: "Olá", zh: "你好", ko: "안녕하세요",
  hi: "नमस्ते", ur: "سلام", ar: "مرحبا", vi: "Xin chào", ru: "Привет", tl: "Kumusta", tr: "Merhaba", fa: "سلام",
};

export default function Home({ persona, settings, setSettings, onStart, onDemo }: Props) {
  const home = persona.home;
  const local = persona.trip.country;
  const [trip, setTrip] = useState<TripCache>(() => loadTrip(home, local));
  const [prep, setPrep] = useState<"idle" | "busy" | "error">("idle");
  const [prepError, setPrepError] = useState("");
  const [sheet, setSheet] = useState<"none" | "settings" | "record">("none");

  const prepare = useCallback(async () => {
    setPrep("busy");
    setPrepError("");
    try {
      const r = await equivalents({ home, local, items: persona.medications.map((m) => ({ id: m.id, name: m.name, generic: m.generic })) });
      setTrip(saveEquivalents(home, local, r.items));
      setPrep("idle");
    } catch (e) {
      setPrep("error");
      setPrepError((e as Error).message);
    }
  }, [home, local, persona.medications]);

  const sameCountry = home === local;
  const eqFor = (name: string): Equivalent | undefined => trip.items[norm(name)];
  const ready = persona.medications.filter((m) => eqFor(m.name)).length;
  const renamed = persona.medications.filter((m) => {
    const e = eqFor(m.name);
    return e && e.status !== "same_name";
  }).length;

  useEffect(() => {
    const t = loadTrip(home, local);
    setTrip(t);
    if (!sameCountry && persona.medications.some((m) => !t.items[norm(m.name)])) void prepare();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [home, local, persona.id]);

  const first = persona.name.split(" ")[0];
  const severe = persona.allergies.filter((a) => a.severity === "severe").length;

  return (
    <main className="home">
      <header className="home-top">
        <Wordmark />
        <button className="icon-btn glass" onClick={() => setSheet("settings")} aria-label="Settings">
          <GearIcon />
        </button>
      </header>

      <section className="hero">
        <h1 className="hello" dir={dir(persona.language)} lang={persona.language}>
          {HELLO[persona.language] || "Hi"}, {first}.
        </h1>
        <p className="hero-sub">
          Your interpreter in {persona.trip.city}. Hand the phone to the doctor and just talk.
        </p>
      </section>

      <button className="passport" onClick={() => setSheet("record")}>
        <span className="pp-shine" aria-hidden />
        <span className="pp-top">
          <span className="avatar">{persona.initials}</span>
          <span className="pp-name">
            <strong>{persona.name}</strong>
            <small>
              {persona.dob} · blood {persona.bloodType}
            </small>
          </span>
          <span className="pp-mark">TESSERA</span>
        </span>
        <span className="pp-route">
          <span className="pp-end">
            <Tag code={home} />
            <small>{langNative(persona.language)}</small>
          </span>
          <span className="route-line" aria-hidden>
            <span className="route-dot" />
          </span>
          <span className="pp-end right">
            <Tag code={local} />
            <small>{langNative(persona.trip.doctorLanguage)}</small>
          </span>
        </span>
        <span className="pp-stats">
          <span className={`stat ${prep === "busy" ? "busy" : ""}`}>
            {sameCountry ? "Medicines: same country" : prep === "busy" ? "Saving local medicine names…" : `✓ ${ready}/${persona.medications.length} medicines ready offline`}
          </span>
          {renamed > 0 && <span className="stat">⇄ {renamed} named differently here</span>}
          {severe > 0 && <span className="stat danger">⚠ {severe} severe allerg{severe > 1 ? "ies" : "y"}</span>}
        </span>
      </button>

      <div className="how">
        <div>
          <b aria-hidden>⇄</b>
          <strong>Just talk</strong>
          Knows who's speaking.
        </div>
        <div>
          <b aria-hidden>℞</b>
          <strong>Local medicines</strong>
          Names switch to what's sold here.
        </div>
        <div>
          <b aria-hidden>!</b>
          <strong>Warns the doctor</strong>
          Allergies and labs, when they matter.
        </div>
      </div>

      <div className="start-wrap">
        <button className="start-orb" onClick={onStart} aria-label="Start conversation">
          <span className="start-glow" aria-hidden />
          <span className="start-core">
            <MicGlyph />
            <span>Start</span>
          </span>
        </button>
        <button className="demo-link" onClick={onDemo}>
          ▶ Watch the demo <kbd>D</kbd>
        </button>
      </div>

      <p className="fine center">Demo with fictional patients · not for clinical use</p>

      {sheet === "record" && <RecordSheet persona={persona} onClose={() => setSheet("none")} />}
      {sheet === "settings" && (
        <Sheet title="Settings" onClose={() => setSheet("none")}>
          <div className="field">
            <div className="eyebrow">Patient</div>
            <div className="persona-switch">
              {PERSONAS.map((p) => (
                <button key={p.id} className={`persona ${p.id === persona.id ? "on" : ""}`} onClick={() => setSettings((s) => ({ ...s, personaId: p.id }))}>
                  <span className="avatar sm">{p.initials}</span>
                  <span>
                    <strong>{p.name}</strong>
                    <small>
                      {p.home} → {p.trip.country}
                    </small>
                  </span>
                </button>
              ))}
            </div>
          </div>
          <LanguageFields persona={persona} setSettings={setSettings} />
          <div className="field">
            <div className="row-between">
              <div className="eyebrow">
                Medicines in {country(local).name}
              </div>
              {!sameCountry && (
                <button className="chip-btn" onClick={prepare} disabled={prep === "busy"}>
                  {prep === "busy" ? "Saving…" : "Refresh"}
                </button>
              )}
            </div>
            {prepError && <p className="error-text small">{prepError}</p>}
            <ul className="med-list">
              {persona.medications.map((m) => {
                const eq = eqFor(m.name);
                return (
                  <li key={m.id}>
                    <span className="med-home">
                      <strong>{m.name}</strong>
                      <small>{m.generic}</small>
                    </span>
                    <span className="med-arrow">→</span>
                    <span className="med-local">
                      <strong className={eq?.status === "not_available_locally" ? "danger-text" : ""}>
                        {!eq ? "…" : eq.status === "not_available_locally" ? "Not sold here" : eq.local_name}
                      </strong>
                      <small>{eq ? (eq.status === "not_available_locally" ? eq.generic : eq.local_brands.slice(0, 2).join(", ")) : ""}</small>
                    </span>
                    {eq && <StatusBadge status={eq.status} compact />}
                  </li>
                );
              })}
            </ul>
          </div>
        </Sheet>
      )}
    </main>
  );
}

function LanguageFields({ persona, setSettings }: { persona: Persona; setSettings: Props["setSettings"] }) {
  const setPair = (patch: Partial<{ patientLang: string; doctorLang: string; local: string }>) =>
    setSettings((s) => {
      const cur = s.pairs[persona.id] || { patientLang: persona.language, doctorLang: persona.trip.doctorLanguage, local: persona.trip.country };
      return { ...s, pairs: { ...s.pairs, [persona.id]: { ...cur, ...patch } } };
    });
  return (
    <div className="field grid3">
      <label>
        <span className="eyebrow">Patient speaks</span>
        <select value={persona.language} onChange={(e) => setPair({ patientLang: e.target.value })}>
          {Object.entries(LANGS).map(([c, l]) => (
            <option key={c} value={c}>
              {l.native}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span className="eyebrow">Doctor speaks</span>
        <select value={persona.trip.doctorLanguage} onChange={(e) => setPair({ doctorLang: e.target.value })}>
          {Object.entries(LANGS).map(([c, l]) => (
            <option key={c} value={c}>
              {l.native}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span className="eyebrow">Now in</span>
        <select value={persona.trip.country} onChange={(e) => setPair({ local: e.target.value })}>
          {Object.entries(COUNTRIES).map(([c, x]) => (
            <option key={c} value={c}>
              {x.name}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

export function Wordmark() {
  return (
    <span className="wordmark">
      <svg viewBox="0 0 32 32" aria-hidden>
        <defs>
          <linearGradient id="wm" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#ff8a5b" />
            <stop offset="1" stopColor="#6c7bff" />
          </linearGradient>
        </defs>
        <rect x="2" y="2" width="12" height="12" rx="3.5" fill="url(#wm)" />
        <rect x="18" y="2" width="12" height="12" rx="3.5" fill="currentColor" opacity=".9" />
        <rect x="2" y="18" width="12" height="12" rx="3.5" fill="currentColor" opacity=".9" />
        <rect x="18" y="18" width="12" height="12" rx="6" fill="url(#wm)" />
      </svg>
      <span>tessera</span>
    </span>
  );
}

function GearIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden>
      <path d="M4 7h10M18 7h2M4 17h4M12 17h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="16" cy="7" r="2.4" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="10" cy="17" r="2.4" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

export function MicGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="30" height="30" aria-hidden>
      <rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor" />
      <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" />
    </svg>
  );
}
