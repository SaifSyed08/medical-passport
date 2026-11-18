// The medicine converter: what a medicine from one country is called (and sold as) in another. Any name, any two
// countries, through the same lookup the interpreter uses (the checked table first, an AI suggestion otherwise,
// each labelled), then the patient's own medicines for this trip.
import { useState, type FormEvent } from "react";
import type { Equivalent, Persona } from "../lib/types";
import { equivalents } from "../lib/api";
import { COUNTRIES, country } from "../lib/langs";
import { norm, type TripCache } from "../lib/store";
import { useOnDevice } from "../lib/onDevice";
import { StatusBadge } from "./bits";
import Flag from "./Flag";
import Icon from "./Icon";
import LogoLoader from "./LogoLoader";
import Picker, { type PickerOption } from "./Picker";

const COUNTRY_OPTIONS: PickerOption[] = Object.entries(COUNTRIES).map(([c, x]) => ({ value: c, label: x.name, icon: <Flag code={c} size={20} /> }));
const RECENT_KEY = "ti.medLookups";

type Lookup = { name: string; from: string; to: string };
function loadRecent(): Lookup[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]") as Lookup[];
  } catch {
    return [];
  }
}
function saveRecent(l: Lookup) {
  const next = [l, ...loadRecent().filter((x) => !(norm(x.name) === norm(l.name) && x.from === l.from && x.to === l.to))].slice(0, 6);
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable */
  }
  return next;
}

type Props = {
  persona: Persona;
  trip: TripCache;
  prep: "idle" | "busy" | "error";
  prepError: string;
  onRefresh: () => void;
};

export default function Medicines({ persona, trip, prep, prepError, onRefresh }: Props) {
  const [name, setName] = useState("");
  const [from, setFrom] = useState(persona.home);
  const [to, setTo] = useState(persona.trip.country === persona.home ? "US" : persona.trip.country);
  const [state, setState] = useState<{ kind: "idle" } | { kind: "busy" } | { kind: "done"; q: Lookup; eq: Equivalent | null } | { kind: "error"; msg: string }>({ kind: "idle" });
  const [recent, setRecent] = useState<Lookup[]>(loadRecent);
  const onDevice = useOnDevice();

  const run = async (q: Lookup) => {
    if (!q.name.trim()) return;
    setState({ kind: "busy" });
    try {
      const r = await equivalents({ home: q.from, local: q.to, items: [{ id: "lookup", name: q.name.trim(), generic: "" }] });
      setState({ kind: "done", q, eq: r.items[0] || null });
      setRecent(saveRecent(q));
    } catch (e) {
      setState({ kind: "error", msg: (e as Error).message });
    }
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    void run({ name, from, to });
  };

  const local = persona.trip.country;
  const sameCountry = persona.home === local;

  return (
    <div className="meds-page">
      <form className="panel conv" onSubmit={submit}>
        <label className="conv-label" htmlFor="conv-name">
          Medicine
        </label>
        <input id="conv-name" className="conv-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ventolin, Neo-Melubrina, Lantus…" autoComplete="off" />
        <div className="conv-route">
          <Picker label="From country" value={from} options={COUNTRY_OPTIONS} onChange={setFrom} className="inline" />
          <button
            type="button"
            className="icon-btn conv-swap"
            aria-label="Swap countries"
            onClick={() => {
              setFrom(to);
              setTo(from);
            }}
          >
            <Icon name="swap" />
          </button>
          <Picker label="To country" value={to} options={COUNTRY_OPTIONS} onChange={setTo} className="inline" />
        </div>
        <button className="btn-primary conv-go" type="submit" disabled={!name.trim() || state.kind === "busy" || from === to}>
          {state.kind === "busy" ? <LogoLoader size={20} mono /> : <Icon name="swap" size={18} />}
          Convert
        </button>
        {recent.length > 0 && (
          <div className="conv-recent" aria-label="Recent">
            {recent.map((r) => (
              <button
                key={`${r.name}|${r.from}|${r.to}`}
                type="button"
                onClick={() => {
                  setName(r.name);
                  setFrom(r.from);
                  setTo(r.to);
                  void run(r);
                }}
              >
                <Flag code={r.from} size={14} />
                {r.name}
              </button>
            ))}
          </div>
        )}
      </form>

      {state.kind === "error" && <p className="error-text conv-msg">{state.msg}</p>}
      {state.kind === "done" && !state.eq && (
        <p className="conv-msg">
          {`No match for “${state.q.name}”.`}
          {onDevice ? " Private mode only uses the checked list; press P for the cloud's suggestion." : " Check the spelling, or try the generic name."}
        </p>
      )}
      {state.kind === "done" && state.eq && <Result eq={state.eq} q={state.q} />}

      <section className="meds-mine">
        <div className="group-title row-between">
          <span>{sameCountry ? `${persona.name.split(" ")[0]}'s medicines` : `${persona.name.split(" ")[0]}'s medicines in ${country(local).name}`}</span>
          {!sameCountry && (
            <button className="link" onClick={onRefresh} disabled={prep === "busy"}>
              {prep === "busy" ? "Matching…" : "Refresh"}
            </button>
          )}
        </div>
        {prepError && <p className="error-text small">{prepError}</p>}
        <div className="list">
          {persona.medications.map((m) => {
            const eq = trip.items[norm(m.name)] || (m.generic ? trip.items[norm(m.generic)] : undefined);
            return (
              <div key={m.id} className="list-row med-row">
                <span className="row-main">
                  <strong>{m.name}</strong>
                  <span>{m.generic}</span>
                  {!sameCountry && (
                    <span className={`local-name ${eq?.status === "not_available_locally" ? "warn" : ""}`}>
                      <Flag code={local} size={18} />
                      {!eq ? "…" : eq.status === "not_available_locally" ? `Not sold here · ask for ${eq.generic}` : [eq.local_name, eq.local_brands[0]].filter(Boolean).join(" · ")}
                    </span>
                  )}
                </span>
                {eq && !sameCountry && <StatusBadge status={eq.status} compact />}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function Result({ eq, q }: { eq: Equivalent; q: Lookup }) {
  const unavailable = eq.status === "not_available_locally";
  return (
    <section className={`panel conv-result ${unavailable ? "danger" : ""}`} aria-live="polite">
      <div className="conv-from">
        <Flag code={q.from} size={20} />
        <span>
          {q.name} in {country(q.from).name}
        </span>
      </div>
      <div className="conv-to">
        <Flag code={q.to} size={28} />
        <span>
          <strong>{unavailable ? "Not sold here" : eq.local_name || eq.generic}</strong>
          {!unavailable && eq.local_brands.length > 0 && <span>{eq.local_brands.join(" · ")}</span>}
          {unavailable && <span>{`Generic: ${eq.generic}`}</span>}
        </span>
      </div>
      {!unavailable && <StatusBadge status={eq.status} />}
      {(eq.local_strength || eq.home_strength) && (
        <p className="conv-line">
          <Icon name="pill" size={16} />
          {[eq.home_strength && `${country(q.from).name}: ${eq.home_strength}`, eq.local_strength && `${country(q.to).name}: ${eq.local_strength}`].filter(Boolean).join(" · ")}
        </p>
      )}
      {eq.note && <p className="conv-note">{eq.note}</p>}
      <p className="fine">{eq.source === "curated" ? "From the checked list." : "AI suggestion: check with a pharmacist."} A local name doesn't mean the products are interchangeable.</p>
    </section>
  );
}
