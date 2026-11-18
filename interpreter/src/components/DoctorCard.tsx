// What a doctor sees after scanning a patient's Parity card: a date-of-birth check, then the emergency
// information for that built-in patient, in the doctor's language when a translation exists.
// Demo only: the check runs on this page and the record ships with the app (the Tessera app's doctor page,
// app/t/[cardId], does the same check on its server).
import { useEffect, useState, type FormEvent } from "react";
import { PERSONAS } from "../data/personas";
import { langName } from "../lib/langs";
import { mergeIds, recordBody, type RecordBody } from "../lib/recordTranslation";
import type { Persona } from "../lib/types";

type Labels = {
  title: string; lead: string; dob: string; show: string; wrong: string; locked: string; unknown: string;
  allergies: string; medications: string; conditions: string; labs: string; contacts: string; blood: string; born: string; years: string; none: string;
  demo: string; translated: string; notTranslated: string; severity: Record<"severe" | "moderate" | "mild", string>;
};
const EN: Labels = {
  title: "Emergency information",
  lead: "Enter the patient's date of birth to see their emergency information.",
  dob: "Date of birth",
  show: "Show",
  wrong: "That date doesn't match. Check it with the patient.",
  locked: "Too many tries. Ask the patient to show their card again later.",
  unknown: "This card isn't recognised.",
  allergies: "Allergies",
  medications: "Medicines",
  conditions: "Conditions",
  labs: "Lab results",
  contacts: "Emergency contacts",
  blood: "Blood type",
  born: "Born",
  years: "years",
  none: "None recorded",
  demo: "Demo · fictional patient · not for clinical use",
  translated: "Translated by AI. Check the original for anything critical.",
  notTranslated: "No translation yet, so this is shown as written.",
  severity: { severe: "Severe", moderate: "Moderate", mild: "Mild" },
};
const LABELS: Record<string, Labels> = {
  en: EN,
  ja: {
    title: "緊急情報",
    lead: "患者の生年月日を入力すると、緊急情報が表示されます。",
    dob: "生年月日",
    show: "表示",
    wrong: "日付が一致しません。患者に確認してください。",
    locked: "試行回数が多すぎます。後でもう一度カードを見せてもらってください。",
    unknown: "このカードは認識できません。",
    allergies: "アレルギー",
    medications: "服用中の薬",
    conditions: "持病",
    labs: "検査結果",
    contacts: "緊急連絡先",
    blood: "血液型",
    born: "生年月日",
    years: "歳",
    none: "記録なし",
    demo: "デモ・架空の患者・臨床使用不可",
    translated: "AIによる翻訳です。重要な内容は原文で確認してください。",
    notTranslated: "まだ翻訳がないため、原文のまま表示しています。",
    severity: { severe: "重度", moderate: "中等度", mild: "軽度" },
  },
};
const labelsFor = (lang: string) => LABELS[lang] || EN;
const MAX_TRIES = 5;

export default function DoctorCard({ id }: { id: string }) {
  const persona = PERSONAS.find((p) => p.id === id);
  const triesKey = `ti.card.tries.${id}`;
  const [tries, setTries] = useState(() => Number(sessionStorage.getItem(triesKey) || 0));
  const [dob, setDob] = useState("");
  const [wrong, setWrong] = useState(false);
  const [open, setOpen] = useState(false);
  const L = labelsFor(persona?.trip.doctorLanguage || "en");

  useEffect(() => {
    document.title = "Parity";
  }, []);

  if (!persona) return <Shell><p className="dc-note">{EN.unknown}</p></Shell>;
  if (open) return <Profile persona={persona} />;

  const locked = tries >= MAX_TRIES;
  const check = (e: FormEvent) => {
    e.preventDefault();
    if (locked) return;
    if (dob.trim() === persona.dob) return setOpen(true);
    const n = tries + 1;
    sessionStorage.setItem(triesKey, String(n));
    setTries(n);
    setWrong(true);
  };
  return (
    <Shell>
      <form className="panel dc-gate" onSubmit={check}>
        <h1>{L.title}</h1>
        <p>{L.lead}</p>
        <label className="scan-field">
          <span>{L.dob}</span>
          <input type="date" value={dob} onChange={(e) => { setDob(e.target.value); setWrong(false); }} disabled={locked} required />
        </label>
        {locked ? <p className="dc-error" role="alert">{L.locked}</p> : wrong && <p className="dc-error" role="alert">{L.wrong}</p>}
        <button className="btn-primary" type="submit" disabled={locked || !dob}>
          {L.show}
        </button>
      </form>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="doctor-card">
      <header className="dc-head">
        <span className="wordmark">
          <svg viewBox="0 0 28 28" aria-hidden>
            <rect x="2" y="7" width="24" height="5.5" rx="2.75" fill="var(--accent)" />
            <rect x="2" y="15.5" width="24" height="5.5" rx="2.75" fill="var(--accent)" opacity=".55" />
          </svg>
          Parity
        </span>
      </header>
      {children}
      <p className="fine dc-demo">{EN.demo}</p>
    </main>
  );
}

const age = (dob: string) => {
  const d = new Date(`${dob}T00:00:00`);
  const now = new Date();
  return now.getFullYear() - d.getFullYear() - (now < new Date(now.getFullYear(), d.getMonth(), d.getDate()) ? 1 : 0);
};

/** The translation the patient's phone already fetched for this record, if the server has it. Never asks a model. */
function useCardTranslation(p: Persona, to: string, want: boolean) {
  const [state, setState] = useState<{ record: RecordBody | null; done: boolean }>({ record: null, done: !want });
  useEffect(() => {
    if (!want) return;
    let live = true;
    fetch("/api/card-translation", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ record: recordBody(p), to }) })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { record?: Partial<RecordBody> } | null) => {
        if (!live) return;
        try {
          setState({ record: j?.record ? mergeIds(recordBody(p), j.record) : null, done: true });
        } catch {
          setState({ record: null, done: true });
        }
      })
      .catch(() => live && setState({ record: null, done: true }));
    return () => {
      live = false;
    };
  }, [p, to, want]);
  return state;
}

function Profile({ persona: p }: { persona: Persona }) {
  const needs = p.recordLanguage !== p.trip.doctorLanguage;
  const tr = useCardTranslation(p, p.trip.doctorLanguage, needs);
  const [view, setView] = useState<"doctor" | "original">("doctor");
  const showTr = needs && view === "doctor" && !!tr.record;
  const r: RecordBody = showTr ? tr.record! : recordBody(p);
  const L = labelsFor(showTr ? p.trip.doctorLanguage : needs && view === "doctor" ? p.trip.doctorLanguage : p.recordLanguage);
  const sev = { severe: 0, moderate: 1, mild: 2 } as const;
  const allergies = [...r.allergies].sort((a, b) => sev[a.severity] - sev[b.severity]);
  const none = <div className="list-row"><span>{L.none}</span></div>;
  return (
    <Shell>
      <section className="panel id-card">
        <span className="avatar">{p.initials}</span>
        <span className="id-main">
          <strong>{p.name}</strong>
          <span>
            {L.born} {p.dob} · {age(p.dob)} {L.years} · {p.sex}
          </span>
          <span>
            {L.blood} <b>{p.bloodType}</b>
          </span>
        </span>
      </section>
      {needs && (
        <div className="seg dc-lang">
          <button className={view === "doctor" ? "on" : ""} onClick={() => setView("doctor")}>
            {langName(p.trip.doctorLanguage)}
          </button>
          <button className={view === "original" ? "on" : ""} onClick={() => setView("original")}>
            {langName(p.recordLanguage)}
          </button>
        </div>
      )}
      {needs && view === "doctor" && tr.done && <p className="fine">{tr.record ? L.translated : EN.notTranslated}</p>}
      <div className="record-page">
        <section className="rec-section allergy">
          <header>
            <span className="rec-title">{L.allergies}</span>
            <span className="rec-count">{allergies.length}</span>
          </header>
          <div className="list">
            {allergies.length === 0 && none}
            {allergies.map((a) => (
              <div className="list-row" key={a.id}>
                <span className="row-top">
                  <strong>{a.substance}</strong>
                  <span className={`tag ${a.severity === "severe" ? "danger" : "plain"}`}>{L.severity[a.severity]}</span>
                </span>
                {a.reaction && <span>{a.reaction}</span>}
              </div>
            ))}
          </div>
        </section>
        <section className="rec-section medication">
          <header>
            <span className="rec-title">{L.medications}</span>
            <span className="rec-count">{r.medications.length}</span>
          </header>
          <div className="list">
            {r.medications.length === 0 && none}
            {r.medications.map((m) => (
              <div className="list-row" key={m.id}>
                <span className="row-top">
                  <strong>{m.name}</strong>
                </span>
                <span>{[m.generic !== m.name && m.generic, m.dose, m.schedule].filter(Boolean).join(" · ")}</span>
                {m.purpose && <span>{m.purpose}</span>}
              </div>
            ))}
          </div>
        </section>
        <section className="rec-section condition">
          <header>
            <span className="rec-title">{L.conditions}</span>
            <span className="rec-count">{r.conditions.length}</span>
          </header>
          <div className="list">
            {r.conditions.length === 0 && none}
            {r.conditions.map((c) => (
              <div className="list-row" key={c.id}>
                <span className="row-top">
                  <strong>{c.name}</strong>
                </span>
                {c.note && <span>{c.note}</span>}
              </div>
            ))}
          </div>
        </section>
        {r.labs.length > 0 && (
          <section className="rec-section lab">
            <header>
              <span className="rec-title">{L.labs}</span>
              <span className="rec-count">{r.labs.length}</span>
            </header>
            <div className="list">
              {r.labs.map((l) => (
                <div className="list-row" key={l.id}>
                  <span className="row-top">
                    <strong>{l.name}</strong>
                    {l.flag && <span className={`tag ${l.flag === "H" ? "danger" : "plain"}`}>{l.flag}</span>}
                  </span>
                  <span>{[`${l.value} ${l.unit}`.trim(), l.ref && `(${l.ref})`, l.date].filter(Boolean).join(" · ")}</span>
                </div>
              ))}
            </div>
          </section>
        )}
        <section className="rec-section contact">
          <header>
            <span className="rec-title">{L.contacts}</span>
            <span className="rec-count">{r.contacts.length}</span>
          </header>
          <div className="list">
            {r.contacts.length === 0 && none}
            {r.contacts.map((c) => (
              <div className="list-row" key={c.id}>
                <span className="row-top">
                  <strong>{c.name}</strong>
                </span>
                <span>{[c.relationship, c.phone].filter(Boolean).join(" · ")}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </Shell>
  );
}
