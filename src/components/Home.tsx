import { useCallback, useEffect, useState } from "react";
import { PERSONAS } from "../data/personas";
import type { Equivalent, Persona } from "../lib/types";
import { equivalents } from "../lib/api";
import { COUNTRIES, LANGS, country, langNative } from "../lib/langs";
import { loadTrip, norm, saveEquivalents, type Settings, type TripCache } from "../lib/store";
import { StatusBadge } from "./bits";
import RecordSheet from "./RecordSheet";

type Props = { persona: Persona; settings: Settings; setSettings: (f: (s: Settings) => Settings) => void; onStart: () => void };

export default function Home({ persona, settings, setSettings, onStart }: Props) {
  const home = persona.home;
  const local = persona.trip.country;
  const [trip, setTrip] = useState<TripCache>(() => loadTrip(home, local));
  const [prep, setPrep] = useState<"idle" | "busy" | "error">("idle");
  const [prepError, setPrepError] = useState("");
  const [showRecord, setShowRecord] = useState(false);

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

  const setPair = (patch: Partial<{ patientLang: string; doctorLang: string; local: string }>) =>
    setSettings((s) => {
      const cur = s.pairs[persona.id] || { patientLang: persona.language, doctorLang: persona.trip.doctorLanguage, local: persona.trip.country };
      return { ...s, pairs: { ...s.pairs, [persona.id]: { ...cur, ...patch } } };
    });

  return (
    <main className="home">
      <header className="brand">
        <Logo />
        <div>
          <div className="brand-name">Tessera</div>
          <div className="brand-sub">Interpreter</div>
        </div>
        <span className="demo-tag">Demo · fictional patients</span>
      </header>

      <section className="persona-switch" aria-label="Patient">
        {PERSONAS.map((p) => (
          <button
            key={p.id}
            className={`persona ${p.id === persona.id ? "on" : ""}`}
            onClick={() => setSettings((s) => ({ ...s, personaId: p.id }))}
          >
            <span className="avatar">{p.initials}</span>
            <span className="persona-text">
              <strong>{p.name}</strong>
              <small>
                {country(p.home).flag} {langNative(p.language)} → {country(p.trip.country).flag} {langNative(p.trip.doctorLanguage)}
              </small>
            </span>
          </button>
        ))}
      </section>

      <section className="card trip">
        <div className="trip-row">
          <div>
            <div className="eyebrow">Patient speaks</div>
            <select value={persona.language} onChange={(e) => setPair({ patientLang: e.target.value })}>
              {Object.entries(LANGS).map(([c, l]) => (
                <option key={c} value={c}>{l.native}</option>
              ))}
            </select>
          </div>
          <div className="swap" aria-hidden>⇄</div>
          <div>
            <div className="eyebrow">Doctor speaks</div>
            <select value={persona.trip.doctorLanguage} onChange={(e) => setPair({ doctorLang: e.target.value })}>
              {Object.entries(LANGS).map(([c, l]) => (
                <option key={c} value={c}>{l.native}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="trip-row">
          <div>
            <div className="eyebrow">Medicines from</div>
            <div className="fixed">{country(home).flag} {country(home).name}</div>
          </div>
          <div className="swap" aria-hidden>→</div>
          <div>
            <div className="eyebrow">Now in</div>
            <select value={local} onChange={(e) => setPair({ local: e.target.value })}>
              {Object.entries(COUNTRIES).map(([c, x]) => (
                <option key={c} value={c}>{x.flag} {x.name}</option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <section className="card meds">
        <div className="section-head">
          <div>
            <h2>Medicines ready for {country(local).flag} {country(local).name}</h2>
            <p className="muted">
              {sameCountry
                ? "Same country: names don't change."
                : prep === "busy"
                  ? "Looking up local names…"
                  : `${ready} of ${persona.medications.length} saved on this phone · works offline`}
            </p>
          </div>
          {!sameCountry && (
            <button className="ghost small" onClick={prepare} disabled={prep === "busy"}>
              {prep === "busy" ? <span className="spinner" /> : "Refresh"}
            </button>
          )}
        </div>
        {prepError && <p className="error-text">{prepError}</p>}
        <ul className="med-list">
          {persona.medications.map((m) => {
            const eq = eqFor(m.name);
            return (
              <li key={m.id}>
                <div className="med-home">
                  <strong>{m.name}</strong>
                  <small>{m.generic}</small>
                </div>
                <div className="med-arrow">→</div>
                <div className="med-local">
                  {eq ? (
                    <>
                      <strong className={eq.status === "not_available_locally" ? "danger-text" : ""}>
                        {eq.status === "not_available_locally" ? "Not sold here" : eq.local_name}
                      </strong>
                      <small>{eq.status === "not_available_locally" ? eq.generic : eq.local_brands.slice(0, 2).join(", ") || eq.local_strength}</small>
                    </>
                  ) : (
                    <small className="muted">{sameCountry ? "—" : prep === "busy" ? "…" : "not saved"}</small>
                  )}
                </div>
                {eq && <StatusBadge status={eq.status} compact />}
              </li>
            );
          })}
        </ul>
      </section>

      <button className="link-row" onClick={() => setShowRecord(true)}>
        <span>
          <strong>{persona.name.split(" ")[0]}'s health record</strong>
          <small>
            {persona.allergies.length} allergies · {persona.medications.length} medicines · {persona.conditions.length} conditions · {persona.labs.length} labs ·{" "}
            {persona.documents.length} documents
          </small>
        </span>
        <span aria-hidden>›</span>
      </button>

      <div className="home-cta">
        <button className="primary big" onClick={onStart}>
          Start conversation
        </button>
        <p className="fine">
          Put the phone between you and the doctor. Either of you can just talk: it hears which language is spoken and translates for the other person.
          Not for clinical use. Local names don't mean two products are interchangeable.
        </p>
      </div>

      {showRecord && <RecordSheet persona={persona} onClose={() => setShowRecord(false)} />}
    </main>
  );
}

export function Logo() {
  return (
    <svg className="logo" viewBox="0 0 40 40" aria-hidden>
      <rect x="2" y="2" width="36" height="36" rx="10" fill="var(--brand)" />
      <path d="M12 15h16M20 15v14" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" />
      <circle cx="29" cy="27" r="3.2" fill="var(--accent)" />
    </svg>
  );
}
