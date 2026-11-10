import { useState, type ReactNode } from "react";
import type { Persona } from "../lib/types";
import { country, langName } from "../lib/langs";
import { recordBody, useTranslatedRecord } from "../lib/recordTranslation";
import { Sheet } from "./bits";
import Icon from "./Icon";
import Flag from "./Flag";

/** The saved record, in the clinician's language by default, colour-coded by section. */
export default function RecordSheet({ persona: p, onClose }: { persona: Persona; onClose: () => void }) {
  const doctorLang = p.trip.doctorLanguage;
  const needsTranslation = p.recordLanguage !== doctorLang;
  const [view, setView] = useState<"translated" | "original">(needsTranslation ? "translated" : "original");
  const tr = useTranslatedRecord(p, doctorLang, needsTranslation && view === "translated");
  const showTranslated = needsTranslation && view === "translated";
  const r = showTranslated && tr.record ? tr.record : recordBody(p);
  const loading = showTranslated && !tr.record;

  return (
    <Sheet title={p.name} onClose={onClose}>
      <p className="record-meta">
        <Flag code={p.home} size={20} /> Born {p.dob} · blood type {p.bloodType}
      </p>
      {needsTranslation && (
        <div className="seg record-lang">
          <button className={view === "translated" ? "on" : ""} onClick={() => setView("translated")}>
            <Flag code={p.trip.country} size={18} /> {langName(doctorLang)}
          </button>
          <button className={view === "original" ? "on" : ""} onClick={() => setView("original")}>
            <Flag code={p.home} size={18} /> {langName(p.recordLanguage)} (original)
          </button>
        </div>
      )}
      {loading && (
        <p className="translating-note">
          <span className="dots3">
            <i />
            <i />
            <i />
          </span>
          {tr.error ? `Couldn't translate (${tr.error}). Showing the original.` : `Translating the record into ${langName(doctorLang)}…`}
        </p>
      )}
      <div className={`record ${loading ? "dim" : ""}`}>
        <Group kind="allergy" icon="alert" title="Allergies" count={r.allergies.length}>
          {r.allergies.map((a) => (
            <Row key={a.id} title={a.substance} badge={a.severity === "severe" ? { text: "Severe", tone: "danger" } : undefined} lines={[a.reaction]} />
          ))}
        </Group>
        <Group kind="medication" icon="pill" title="Medicines" count={r.medications.length}>
          {r.medications.map((m) => (
            <Row key={m.id} title={m.name} lines={[`${m.generic} · ${m.dose}`, m.schedule, m.purpose]} />
          ))}
        </Group>
        <Group kind="condition" icon="heart" title="Conditions" count={r.conditions.length}>
          {r.conditions.map((c) => (
            <Row key={c.id} title={c.name} badge={c.since ? { text: `since ${c.since}`, tone: "plain" } : undefined} lines={[c.note]} />
          ))}
        </Group>
        <Group kind="lab" icon="lab" title="Lab results" count={r.labs.length}>
          {r.labs.map((l) => (
            <div key={l.id} className="list-row lab-row">
              <span className="lab-name">
                <strong>{l.name}</strong>
                <span>
                  {l.date} · reference {l.ref}
                </span>
              </span>
              <span className={`lab-value ${l.flag === "H" ? "high" : l.flag === "L" ? "low" : ""}`}>
                {l.value}
                <small>{l.unit}</small>
                {l.flag && <em>{l.flag === "H" ? "High" : "Low"}</em>}
              </span>
            </div>
          ))}
        </Group>
        <Group kind="document" icon="doc" title="Visits and documents" count={r.documents.length}>
          {r.documents.map((d) => (
            <Row key={d.id} title={d.title} badge={{ text: d.date, tone: "plain" }} lines={[d.facility, d.body]} />
          ))}
        </Group>
        <Group kind="contact" icon="user" title="Emergency contacts" count={r.contacts.length}>
          {r.contacts.map((c) => (
            <Row key={c.id} title={c.name} lines={[c.relationship, c.phone]} />
          ))}
        </Group>
      </div>
      <p className="fine">
        {showTranslated && tr.record ? `Translated by AI from ${langName(p.recordLanguage)} for ${country(p.trip.country).name}. Check the original for anything critical.` : "As saved by the patient."}
      </p>
    </Sheet>
  );
}

function Group({ kind, icon, title, count, children }: { kind: string; icon: string; title: string; count: number; children: ReactNode }) {
  if (!count) return null;
  return (
    <section className={`rec-section ${kind}`}>
      <header>
        <span className="rec-icon">
          <Icon name={icon} size={18} />
        </span>
        <span className="rec-title">{title}</span>
        <span className="rec-count">{count}</span>
      </header>
      <div className="list">{children}</div>
    </section>
  );
}

function Row({ title, lines, badge }: { title: string; lines: string[]; badge?: { text: string; tone: string } }) {
  return (
    <div className="list-row">
      <span className="row-top">
        <strong>{title}</strong>
        {badge && <span className={`tag ${badge.tone}`}>{badge.text}</span>}
      </span>
      {lines.filter(Boolean).map((l, i) => (
        <span key={i}>{l}</span>
      ))}
    </div>
  );
}
