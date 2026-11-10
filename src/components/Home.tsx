import { useCallback, useEffect, useState } from "react";
import { PERSONAS } from "../data/personas";
import type { Equivalent, Persona } from "../lib/types";
import { equivalents } from "../lib/api";
import { COUNTRIES, LANGS, country, langName } from "../lib/langs";
import { loadTrip, norm, saveEquivalents, type Settings, type TripCache } from "../lib/store";
import { Sheet, StatusBadge } from "./bits";
import Icon from "./Icon";
import Flag from "./Flag";
import RecordSheet from "./RecordSheet";

type Props = {
  persona: Persona;
  settings: Settings;
  setSettings: (f: (s: Settings) => Settings) => void;
  onStart: () => void;
  onDemo: () => void;
};

function age(dob: string) {
  const d = new Date(dob);
  const n = new Date();
  return n.getFullYear() - d.getFullYear() - (n < new Date(n.getFullYear(), d.getMonth(), d.getDate()) ? 1 : 0);
}

export default function Home({ persona, setSettings, onStart, onDemo }: Props) {
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

  useEffect(() => {
    const t = loadTrip(home, local);
    setTrip(t);
    if (!sameCountry && persona.medications.some((m) => !t.items[norm(m.name)])) void prepare();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [home, local, persona.id]);

  const severe = persona.allergies.filter((a) => a.severity === "severe");

  return (
    <main className="home">
      <header className="home-top">
        <Wordmark />
        <button className="icon-btn" onClick={() => setSheet("settings")} aria-label="Settings">
          <Icon name="settings" />
        </button>
      </header>

      <section className="home-intro">
        <h1>Medical interpreter</h1>
        <p>Speak naturally. Each person hears the other in their own language.</p>
      </section>

      <button className="panel patient-card" onClick={() => setSheet("record")} style={{ viewTransitionName: "patient-card" }}>
        <span className="pc-head">
          <span className="avatar">{persona.initials}</span>
          <span className="pc-name">
            <strong>{persona.name}</strong>
            <span>
              {age(persona.dob)} years · blood type {persona.bloodType}
            </span>
          </span>
          <Icon name="chevron" className="muted" />
        </span>
        <span className="pc-rows">
          <span className="pc-row">
            <span className="pc-label">Patient</span>
            <span className="pc-val">
              <Flag code={home} size={22} />
              {langName(persona.language)} · from {country(home).name}
            </span>
          </span>
          <span className="pc-row">
            <span className="pc-label">Clinician</span>
            <span className="pc-val">
              <Flag code={local} size={22} />
              {langName(persona.trip.doctorLanguage)} · {persona.trip.city}
            </span>
          </span>
          <span className="pc-row">
            <span className="pc-label">Medicines</span>
            <span className={prep === "busy" ? "muted" : ""}>
              {sameCountry ? "No changes needed" : prep === "busy" ? "Matching local names…" : `${ready} of ${persona.medications.length} matched to local names`}
            </span>
          </span>
          {severe.length > 0 && (
            <span className="pc-row">
              <span className="pc-label">Allergy</span>
              <span className="danger-text">{severe.map((a) => a.substance.replace(/\s*\(.*\)/, "")).join(", ")}</span>
            </span>
          )}
        </span>
      </button>

      <div className="home-actions">
        <button className="btn-primary" onClick={onStart} style={{ viewTransitionName: "mic-btn" }}>
          <Icon name="mic" />
          Start interpreting
        </button>
        <button className="btn-quiet" onClick={onDemo}>
          <Icon name="play" size={16} />
          Play demo conversation <kbd>D</kbd>
        </button>
      </div>

      <p className="fine center">Demo with fictional patients. Not for clinical use.</p>

      {sheet === "record" && <RecordSheet persona={persona} onClose={() => setSheet("none")} />}
      {sheet === "settings" && (
        <Sheet title="Settings" onClose={() => setSheet("none")}>
          <div className="group">
            <div className="group-title">Patient</div>
            {PERSONAS.map((p) => (
              <button key={p.id} className="row" onClick={() => setSettings((s) => ({ ...s, personaId: p.id }))}>
                <span className="avatar sm">{p.initials}</span>
                <span className="row-main">
                  <strong>{p.name}</strong>
                  <span className="pc-val">
                    <Flag code={p.home} size={16} /> {langName(p.language)} → <Flag code={p.trip.country} size={16} /> {langName(p.trip.doctorLanguage)}
                  </span>
                </span>
                {p.id === persona.id && <Icon name="check" className="accent" />}
              </button>
            ))}
          </div>
          <LanguageFields persona={persona} setSettings={setSettings} />
          <div className="group">
            <div className="group-title row-between">
              <span>Medicines in {country(local).name}</span>
              {!sameCountry && (
                <button className="link" onClick={prepare} disabled={prep === "busy"}>
                  {prep === "busy" ? "Matching…" : "Refresh"}
                </button>
              )}
            </div>
            {prepError && <p className="error-text small">{prepError}</p>}
            {persona.medications.map((m) => {
              const eq = eqFor(m.name);
              return (
                <div key={m.id} className="row static">
                  <span className="row-main">
                    <strong>{m.name}</strong>
                    <span className={eq?.status === "not_available_locally" ? "danger-text" : ""}>
                      {!eq ? "…" : eq.status === "not_available_locally" ? `Not sold here (${eq.generic})` : `${eq.local_name}${eq.local_brands[0] ? ` · ${eq.local_brands[0]}` : ""}`}
                    </span>
                  </span>
                  {eq && <StatusBadge status={eq.status} compact />}
                </div>
              );
            })}
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
  const select = (value: string, onChange: (v: string) => void, options: [string, string][]) => (
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      {options.map(([c, label]) => (
        <option key={c} value={c}>
          {label}
        </option>
      ))}
    </select>
  );
  const langs = Object.entries(LANGS).map(([c, l]) => [c, l.name] as [string, string]);
  return (
    <div className="group">
      <div className="group-title">Languages</div>
      <label className="row static">
        <span className="row-main">
          <strong>Patient speaks</strong>
        </span>
        {select(persona.language, (v) => setPair({ patientLang: v }), langs)}
      </label>
      <label className="row static">
        <span className="row-main">
          <strong>Clinician speaks</strong>
        </span>
        {select(persona.trip.doctorLanguage, (v) => setPair({ doctorLang: v }), langs)}
      </label>
      <label className="row static">
        <span className="row-main">
          <strong>Current country</strong>
        </span>
        {select(persona.trip.country, (v) => setPair({ local: v }), Object.entries(COUNTRIES).map(([c, x]) => [c, x.name] as [string, string]))}
      </label>
    </div>
  );
}

export function Wordmark() {
  return (
    <span className="wordmark">
      <svg viewBox="0 0 28 28" aria-hidden>
        <rect x="1" y="1" width="12" height="12" rx="3.5" fill="var(--accent)" />
        <rect x="15" y="1" width="12" height="12" rx="3.5" fill="var(--accent)" opacity=".35" />
        <rect x="1" y="15" width="12" height="12" rx="3.5" fill="var(--accent)" opacity=".35" />
        <rect x="15" y="15" width="12" height="12" rx="6" fill="var(--accent)" />
      </svg>
      Tessera
    </span>
  );
}
