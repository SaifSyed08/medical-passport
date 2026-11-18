import { useCallback, useEffect, useState } from "react";
import { hasDemo } from "../data/personas";
import type { Equivalent, Persona } from "../lib/types";
import { equivalents } from "../lib/api";
import { COUNTRIES, LANGS, country, langName } from "../lib/langs";
import { loadTrip, norm, saveEquivalents, type Settings, type TripCache } from "../lib/store";
import { DeviceTag, Sheet } from "./bits";
import { useOnDevice } from "../lib/onDevice";
import Icon from "./Icon";
import { TandemWordmark } from "./TandemLogo";
import Flag from "./Flag";
import RecordSheet from "./RecordSheet";
import Picker, { type PickerOption } from "./Picker";
import LogoLoader from "./LogoLoader";
import { loadTranslatedRecord, useTranslatedRecord } from "../lib/recordTranslation";
import type { Tab } from "../lib/store";
import Medicines from "./Medicines";
import { embedded } from "../lib/host";
import { CardFace, CardQr, hasCard, ProfileExtras } from "./ParityCard";

type Props = {
  persona: Persona;
  /** Everyone selectable under Settings: the Tessera app's traveler (when embedded), then the demo patients. */
  personas: Persona[];
  settings: Settings;
  setSettings: (f: (s: Settings) => Settings) => void;
  onStart: () => void;
  onDemo: () => void;
};

const LANG_OPTIONS: PickerOption[] = Object.entries(LANGS).map(([c, l]) => ({ value: c, label: l.name, hint: l.native !== l.name ? l.native : undefined }));
const COUNTRY_OPTIONS: PickerOption[] = Object.entries(COUNTRIES).map(([c, x]) => ({ value: c, label: x.name, icon: <Flag code={c} size={20} /> }));

function age(dob: string) {
  const d = new Date(dob);
  const n = new Date();
  return n.getFullYear() - d.getFullYear() - (n < new Date(n.getFullYear(), d.getMonth(), d.getDate()) ? 1 : 0);
}

export default function Home({ persona, personas, settings, setSettings, onStart, onDemo }: Props) {
  const home = persona.home;
  const local = persona.trip.country;
  const [trip, setTrip] = useState<TripCache>(() => loadTrip(home, local));
  const [prep, setPrep] = useState<"idle" | "busy" | "error">("idle");
  const [prepError, setPrepError] = useState("");
  const [sheet, setSheet] = useState<"none" | "settings" | "record">("none");
  const onDevice = useOnDevice();

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
    // Fetch again for medicines saved before the server gave readings (how to say a name in another script).
    if (!sameCountry && persona.medications.some((m) => t.items[norm(m.name)]?.local_reading === undefined)) void prepare();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [home, local, persona.id, persona.medications.map((m) => m.name).join("|")]);

  // The app's labels are in English, so show the allergy in the clinician's language once the record is translated.
  const translated = useTranslatedRecord(persona, persona.trip.doctorLanguage, persona.recordLanguage !== persona.trip.doctorLanguage);
  const allergies = translated.record?.allergies || persona.allergies;
  const severe = allergies.filter((a) => a.severity === "severe");

  // Get the record's translation for the clinician ready before anyone opens it.
  useEffect(() => {
    if (persona.recordLanguage !== persona.trip.doctorLanguage) loadTranslatedRecord(persona, persona.trip.doctorLanguage).catch(() => {});
  }, [persona]);

  // Inside the Tessera app's own Interpreter tab, this page is only the interpreter: no second tab bar.
  const inApp = embedded();
  const tab: Tab = inApp ? "talk" : settings.tab;
  const setTab = (t: Tab) => {
    (document.activeElement as HTMLElement | null)?.blur?.();
    setSettings((s) => ({ ...s, tab: t }));
  };

  const setDoctorLang = (doctorLang: string) =>
    setSettings((s) => {
      const cur = s.pairs[persona.id] || { patientLang: persona.language, doctorLang: persona.trip.doctorLanguage, local: persona.trip.country };
      return { ...s, pairs: { ...s.pairs, [persona.id]: { ...cur, doctorLang } } };
    });

  return (
    <div className="shell">
    <main className={`home tab-${tab}`}>
      <header className="home-top">
        <span className="home-top-side">{onDevice && <DeviceTag />}</span>
        {settings.brand === "tandem" ? <TandemWordmark /> : <Wordmark />}
        <button className="icon-btn" onClick={() => setSheet("settings")} aria-label="Settings">
          <Icon name="settings" />
        </button>
      </header>

      {/* Four parts: the health card, documents, the medicine converter, the interpreter. */}
      {tab === "card" && <CardTab persona={persona} />}
      {tab === "docs" && (
        <>
          <h2 className="tab-title">Documents</h2>
          <RecordSheet persona={persona} editable page sections={["document"]} addBar="document" onClose={() => {}} />
        </>
      )}
      {tab === "meds" && (
        <>
          <h2 className="tab-title">Medicines</h2>
          <Medicines persona={persona} trip={trip} prep={prep} prepError={prepError} onRefresh={prepare} />
        </>
      )}
      {tab === "talk" && (
      <>
      <section className="panel patient-card">
      <button className="pc-open" onClick={() => setSheet("record")}>
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
            <span className="pc-label">Now in</span>
            <span className="pc-val">
              <Flag code={local} size={22} />
              {persona.trip.city}
            </span>
          </span>
          <span className="pc-row">
            <span className="pc-label">Medicines</span>
            <span className={`pc-val ${prep === "busy" ? "muted" : ""}`}>
              {prep === "busy" && <LogoLoader size={18} />}
              {sameCountry ? "No changes needed" : prep === "busy" ? "Matching local names…" : `${ready} of ${persona.medications.length} matched locally`}
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
        {/* Which language the clinician hears, picked right on the card. */}
        <div className="pc-row pc-lang">
          <span className="pc-label">Clinician</span>
          <span className="pc-val">
            <Flag code={local} size={22} />
            <Picker label="Clinician's language" value={persona.trip.doctorLanguage} options={LANG_OPTIONS} onChange={setDoctorLang} className="inline" />
          </span>
        </div>
      </section>

      <div className="home-actions">
        <button className="btn-primary btn-start" onClick={onStart}>
          <span className="btn-start-icon">
            <Icon name="mic" />
          </span>
          <span className="btn-start-text">
            <strong>Start interpreting</strong>
            <span>
              {langName(persona.language)} <Icon name="swap" size={14} /> {langName(persona.trip.doctorLanguage)}
            </span>
          </span>
          <Icon name="chevron" className="btn-start-chev" />
        </button>
        {hasDemo(persona.id) && (
          <button className="btn-outline" onClick={onDemo}>
            <Icon name="play" size={16} />
            Play demo conversation <kbd>D</kbd>
          </button>
        )}
      </div>
      </>
      )}


      {sheet === "record" && <RecordSheet persona={persona} editable onClose={() => setSheet("none")} />}
      {sheet === "settings" && (
        <Sheet title="Settings" onClose={() => setSheet("none")}>
          <div className="group">
            <div className="group-title">Patient</div>
            {personas.map((p) => (
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
            <div className="group-title">Look</div>
            <div className="seg">
              <button className={settings.brand !== "tandem" ? "on" : ""} onClick={() => setSettings((s) => ({ ...s, brand: "parity" }))}>
                Parity
              </button>
              <button className={settings.brand === "tandem" ? "on" : ""} onClick={() => setSettings((s) => ({ ...s, brand: "tandem" }))}>
                Tandem <kbd>3</kbd>
              </button>
            </div>
          </div>
          <div className="group">
            <div className="group-title">Conversation layout</div>
            <div className="seg">
              <button className={settings.layout !== "focus" ? "on" : ""} onClick={() => setSettings((s) => ({ ...s, layout: "classic" }))}>
                Transcript
              </button>
              <button className={settings.layout === "focus" ? "on" : ""} onClick={() => setSettings((s) => ({ ...s, layout: "focus" }))}>
                Focus <kbd>L</kbd>
              </button>
            </div>
          </div>
        </Sheet>
      )}
    </main>
    {!inApp && <TabBar tab={tab} onTab={setTab} />}
    </div>
  );
}

const TAB_ITEMS: { id: Tab; label: string; icon: string }[] = [
  { id: "card", label: "Card", icon: "card" },
  { id: "docs", label: "Documents", icon: "doc" },
  { id: "meds", label: "Medicines", icon: "pill" },
  { id: "talk", label: "Interpret", icon: "chat" },
];

function TabBar({ tab, onTab }: { tab: Tab; onTab: (t: Tab) => void }) {
  return (
    <nav className="tabbar" aria-label="Sections">
      {TAB_ITEMS.map((t) => (
        <button key={t.id} data-tab={t.id} className={t.id === tab ? "on" : ""} aria-current={t.id === tab ? "page" : undefined} onClick={() => onTab(t.id)}>
          <Icon name={t.icon} size={24} />
          <span>{t.label}</span>
        </button>
      ))}
    </nav>
  );
}

/** The health card: who the patient is and what a doctor needs to know, in the doctor's language when it differs. */
function CardTab({ persona }: { persona: Persona }) {
  const [qr, setQr] = useState(false);
  return (
    <>
      {hasCard(persona.id) && <CardFace persona={persona} onOpen={() => setQr(true)} />}
      {qr && <CardQr persona={persona} onClose={() => setQr(false)} />}
      <section className="panel id-card">
        <span className="avatar">{persona.initials}</span>
        <span className="id-main">
          <strong>{persona.name}</strong>
          <span>
            {age(persona.dob)} years · born {persona.dob} · blood type {persona.bloodType}
          </span>
          <span className="id-trip">
            <Flag code={persona.home} size={18} /> {langName(persona.language)}
            <Icon name="swap" size={14} />
            <Flag code={persona.trip.country} size={18} /> {persona.trip.city}
          </span>
        </span>
      </section>
      <RecordSheet persona={persona} editable page sections={["allergy", "medication", "condition", "lab", "contact"]} onClose={() => {}} />
      <div className="record-page">
        <ProfileExtras persona={persona} />
      </div>
    </>
  );
}

function LanguageFields({ persona, setSettings }: { persona: Persona; setSettings: Props["setSettings"] }) {
  const setPair = (patch: Partial<{ patientLang: string; doctorLang: string; local: string }>) =>
    setSettings((s) => {
      const cur = s.pairs[persona.id] || { patientLang: persona.language, doctorLang: persona.trip.doctorLanguage, local: persona.trip.country };
      return { ...s, pairs: { ...s.pairs, [persona.id]: { ...cur, ...patch } } };
    });

  return (
    <div className="group">
      <div className="group-title">Languages</div>
      <div className="row static">
        <span className="row-main">
          <strong>Patient speaks</strong>
        </span>
        <Picker label="Patient speaks" value={persona.language} options={LANG_OPTIONS} onChange={(v) => setPair({ patientLang: v })} />
      </div>
      <div className="row static">
        <span className="row-main">
          <strong>Clinician speaks</strong>
        </span>
        <Picker label="Clinician speaks" value={persona.trip.doctorLanguage} options={LANG_OPTIONS} onChange={(v) => setPair({ doctorLang: v })} />
      </div>
      <div className="row static">
        <span className="row-main">
          <strong>Current country</strong>
        </span>
        <Picker label="Current country" value={persona.trip.country} options={COUNTRY_OPTIONS} onChange={(v) => setPair({ local: v })} />
      </div>
    </div>
  );
}

export function Wordmark() {
  return (
    <span className="wordmark">
      {/* Parity: an equals sign, two people on equal footing in the conversation. */}
      <svg viewBox="0 0 28 28" aria-hidden>
        <rect x="2" y="7" width="24" height="5.5" rx="2.75" fill="var(--accent)" />
        <rect x="2" y="15.5" width="24" height="5.5" rx="2.75" fill="var(--accent)" opacity=".55" />
      </svg>
      Parity
    </span>
  );
}
