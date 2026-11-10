import type { ReactNode } from "react";
import type { Persona } from "../lib/types";
import { country, langNative } from "../lib/langs";
import { KIND_ICON, Sheet } from "./bits";

export default function RecordSheet({ persona: p, onClose }: { persona: Persona; onClose: () => void }) {
  return (
    <Sheet title={`${p.name}`} onClose={onClose}>
      <p className="muted small">
        Born {p.dob} · {p.sex} · blood type {p.bloodType} · {country(p.home).flag} {country(p.home).name} · record in {langNative(p.recordLanguage)}
      </p>
      <Group title="Allergies" icon={KIND_ICON.allergy}>
        {p.allergies.map((a) => (
          <Row key={a.id} title={a.substance} tone={a.severity === "severe" ? "danger" : ""} lines={[a.reaction]} />
        ))}
      </Group>
      <Group title="Medicines" icon={KIND_ICON.medication}>
        {p.medications.map((m) => (
          <Row key={m.id} title={m.name} lines={[m.generic, `${m.dose} · ${m.schedule}`, m.purpose]} />
        ))}
      </Group>
      <Group title="Conditions" icon={KIND_ICON.condition}>
        {p.conditions.map((c) => (
          <Row key={c.id} title={c.name} lines={[c.since ? `Since ${c.since}` : "", c.note].filter(Boolean)} />
        ))}
      </Group>
      <Group title="Labs" icon={KIND_ICON.lab}>
        {p.labs.map((l) => (
          <Row key={l.id} title={l.name} tone={l.flag ? "warn" : ""} lines={[`${l.value} ${l.unit}  (ref ${l.ref})${l.flag ? `  ${l.flag}` : ""} · ${l.date}`]} />
        ))}
      </Group>
      <Group title="Visits and documents" icon={KIND_ICON.document}>
        {p.documents.map((d) => (
          <Row key={d.id} title={d.title} lines={[`${d.date} · ${d.facility}`, d.body]} />
        ))}
      </Group>
      <Group title="Contacts" icon="☎">
        {p.contacts.map((c) => (
          <Row key={c.id} title={c.name} lines={[c.relationship, c.phone]} />
        ))}
      </Group>
    </Sheet>
  );
}

function Group({ title, icon, children }: { title: string; icon: string; children: ReactNode }) {
  return (
    <section className="rec-group">
      <h4>
        <span aria-hidden>{icon}</span> {title}
      </h4>
      {children}
    </section>
  );
}

function Row({ title, lines, tone }: { title: string; lines: string[]; tone?: string }) {
  return (
    <div className={`rec-row ${tone || ""}`}>
      <strong>{title}</strong>
      {lines.map((l, i) => (
        <span key={i}>{l}</span>
      ))}
    </div>
  );
}
