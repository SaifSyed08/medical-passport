// Typing an entry into the record by hand: one short form per section, saved on this phone with the other edits.
import { useState } from "react";
import type { Persona } from "../lib/types";
import { addItems } from "../lib/edits";
import { Sheet } from "./bits";
import Icon from "./Icon";

export type Section = "allergy" | "medication" | "condition" | "lab" | "document" | "contact";

type Field = { key: string; label: string; placeholder?: string; required?: boolean; type?: "text" | "date" | "tel" | "area" };

const FORMS: Record<Section, { title: string; fields: Field[] }> = {
  allergy: {
    title: "Add an allergy",
    fields: [
      { key: "substance", label: "Allergic to", placeholder: "e.g. Penicillin", required: true },
      { key: "reaction", label: "What happens", placeholder: "e.g. Hives, swelling" },
    ],
  },
  medication: {
    title: "Add a medicine",
    fields: [
      { key: "name", label: "Name on the box", placeholder: "e.g. Ventolin", required: true },
      { key: "dose", label: "Dose", placeholder: "e.g. 100 mcg, 2 puffs" },
      { key: "schedule", label: "How often", placeholder: "e.g. Twice a day" },
      { key: "purpose", label: "What it's for", placeholder: "e.g. Asthma" },
    ],
  },
  condition: {
    title: "Add a condition",
    fields: [
      { key: "name", label: "Condition", placeholder: "e.g. Type 2 diabetes", required: true },
      { key: "since", label: "Since", placeholder: "e.g. 2019" },
      { key: "note", label: "Notes", type: "area" },
    ],
  },
  lab: {
    title: "Add a lab result",
    fields: [
      { key: "name", label: "Test", placeholder: "e.g. HbA1c", required: true },
      { key: "value", label: "Result", placeholder: "e.g. 7.2", required: true },
      { key: "unit", label: "Unit", placeholder: "e.g. %" },
      { key: "ref", label: "Normal range", placeholder: "e.g. 4.0–5.6" },
      { key: "date", label: "Date", type: "date" },
    ],
  },
  document: {
    title: "Add a visit",
    fields: [
      { key: "title", label: "What it was", placeholder: "e.g. Cardiology visit", required: true },
      { key: "facility", label: "Where", placeholder: "e.g. City Hospital" },
      { key: "date", label: "Date", type: "date" },
      { key: "body", label: "Notes", type: "area" },
    ],
  },
  contact: {
    title: "Add a contact",
    fields: [
      { key: "name", label: "Name", required: true },
      { key: "relationship", label: "Relationship", placeholder: "e.g. Sister" },
      { key: "phone", label: "Phone", type: "tel" },
    ],
  },
};

const SEVERITY = ["mild", "moderate", "severe"] as const;

export default function ManualAdd({ persona, section, onDone, onClose }: { persona: Persona; section: Section; onDone: () => void; onClose: () => void }) {
  const form = FORMS[section];
  const [v, setV] = useState<Record<string, string>>({});
  const [severity, setSeverity] = useState<(typeof SEVERITY)[number]>("moderate");
  const ok = form.fields.every((f) => !f.required || (v[f.key] || "").trim());
  const val = (k: string) => (v[k] || "").trim();

  const save = () => {
    if (!ok) return;
    const id = `${{ allergy: "alg", medication: "med", condition: "cnd", lab: "lab", document: "doc", contact: "con" }[section]}_m${Date.now().toString(36)}`;
    if (section === "allergy") addItems(persona.id, { allergies: [{ id, substance: val("substance"), reaction: val("reaction"), severity }] });
    if (section === "medication") addItems(persona.id, { medications: [{ id, name: val("name"), generic: "", dose: val("dose"), schedule: val("schedule"), purpose: val("purpose") }] });
    if (section === "condition") addItems(persona.id, { conditions: [{ id, name: val("name"), since: val("since") || undefined, note: val("note") }] });
    if (section === "lab") addItems(persona.id, { labs: [{ id, name: val("name"), value: val("value"), unit: val("unit"), ref: val("ref"), flag: "", date: val("date") }] });
    if (section === "document") addItems(persona.id, { documents: [{ id, kind: "visit", title: val("title"), facility: val("facility"), date: val("date"), body: val("body") }] });
    if (section === "contact") addItems(persona.id, { contacts: [{ id, name: val("name"), relationship: val("relationship"), phone: val("phone") }] });
    onDone();
  };

  return (
    <Sheet title={form.title} onClose={onClose}>
      <form
        className="manual"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        {form.fields.map((f, i) => (
          <label key={f.key} className="scan-field">
            <span>{f.label}</span>
            {f.type === "area" ? (
              <textarea rows={3} value={v[f.key] || ""} placeholder={f.placeholder} onChange={(e) => setV({ ...v, [f.key]: e.target.value })} />
            ) : (
              <input autoFocus={i === 0} type={f.type || "text"} value={v[f.key] || ""} placeholder={f.placeholder} onChange={(e) => setV({ ...v, [f.key]: e.target.value })} />
            )}
          </label>
        ))}
        {section === "allergy" && (
          <div className="scan-field">
            <span>How bad</span>
            <div className="seg">
              {SEVERITY.map((s) => (
                <button type="button" key={s} className={severity === s ? "on" : ""} onClick={() => setSeverity(s)}>
                  {s[0].toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="scan-actions">
          <button type="button" className="btn-quiet" onClick={onDone}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={!ok}>
            <Icon name="check" />
            Add to record
          </button>
        </div>
      </form>
    </Sheet>
  );
}
