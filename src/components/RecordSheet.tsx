import type { ReactNode } from "react";
import type { Persona } from "../lib/types";
import { country, langName } from "../lib/langs";
import { Sheet } from "./bits";

export default function RecordSheet({ persona: p, onClose }: { persona: Persona; onClose: () => void }) {
  return (
    <Sheet title={p.name} onClose={onClose}>
      <p className="muted small">
        Born {p.dob} · blood type {p.bloodType} · {country(p.home).name} · record in {langName(p.recordLanguage)}
      </p>
      <Group title="Allergies">
        {p.allergies.map((a) => (
          <Row key={a.id} title={a.substance} tone={a.severity === "severe" ? "danger" : ""} lines={[a.reaction]} />
        ))}
      </Group>
      <Group title="Medicines">
        {p.medications.map((m) => (
          <Row key={m.id} title={m.name} lines={[`${m.generic} · ${m.dose}`, m.schedule]} />
        ))}
      </Group>
      <Group title="Conditions">
        {p.conditions.map((c) => (
          <Row key={c.id} title={c.name} lines={[c.note]} />
        ))}
      </Group>
      <Group title="Lab results">
        {p.labs.map((l) => (
          <Row key={l.id} title={l.name} tone={l.flag ? "warn" : ""} lines={[`${l.value} ${l.unit} (reference ${l.ref}) · ${l.date}`]} />
        ))}
      </Group>
      <Group title="Visits and documents">
        {p.documents.map((d) => (
          <Row key={d.id} title={d.title} lines={[`${d.date} · ${d.facility}`, d.body]} />
        ))}
      </Group>
      <Group title="Emergency contacts">
        {p.contacts.map((c) => (
          <Row key={c.id} title={c.name} lines={[c.relationship, c.phone]} />
        ))}
      </Group>
    </Sheet>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="group">
      <div className="group-title">{title}</div>
      <div className="list">{children}</div>
    </section>
  );
}

function Row({ title, lines, tone }: { title: string; lines: string[]; tone?: string }) {
  return (
    <div className={`list-row ${tone || ""}`}>
      <strong>{title}</strong>
      {lines.filter(Boolean).map((l, i) => (
        <span key={i}>{l}</span>
      ))}
    </div>
  );
}
