import type { DrugMention, Persona, Speaker } from "../lib/types";
import { country } from "../lib/langs";
import { Sheet, StatusBadge } from "./bits";

export default function DrugSheet({ drug: d, speaker, persona: p, onClose }: { drug: DrugMention; speaker: Speaker | null; persona: Persona; onClose: () => void }) {
  const home = country(p.home);
  const local = country(p.trip.country);
  const med = p.medications.find((m) => m.id === d.med_id);
  const unavailable = d.status === "not_available_locally";
  return (
    <Sheet title={d.generic} onClose={onClose} tone={unavailable ? "danger" : ""}>
      <StatusBadge status={d.status} />
      <div className="eq-grid">
        <div className="eq-side">
          <div className="eyebrow">
            {home.flag} In {home.name}
          </div>
          <strong>{d.home_name || "—"}</strong>
          {d.home_strength && <small>{d.home_strength}</small>}
        </div>
        <div className="eq-arrow" aria-hidden>
          →
        </div>
        <div className={`eq-side ${unavailable ? "danger" : ""}`}>
          <div className="eyebrow">
            {local.flag} In {local.name}
          </div>
          <strong>{unavailable ? "Not sold here" : d.local_name || "—"}</strong>
          {d.local_brands.length > 0 && <small>{d.local_brands.join(", ")}</small>}
          {d.local_strength && <small>{d.local_strength}</small>}
        </div>
      </div>
      {d.drug_class && <p className="small">Class: {d.drug_class}</p>}
      {(d.note_doctor || d.curated_note) && (
        <div className="note">
          <div className="eyebrow">For the doctor</div>
          <p>{d.note_doctor || d.curated_note}</p>
        </div>
      )}
      {/* The listener note is in the listener's language; when the patient spoke, the listener is the doctor and it repeats the note above. */}
      {speaker === "clinician" && d.note_listener && (
        <div className="note soft">
          <div className="eyebrow">For {p.name.split(" ")[0]}</div>
          <p>{d.note_listener}</p>
        </div>
      )}
      {med && (
        <div className="note mine">
          <div className="eyebrow">{p.name.split(" ")[0]} takes this</div>
          <p>
            {med.name} · {med.dose} · {med.schedule}
          </p>
        </div>
      )}
      <p className="fine">
        {d.source === "curated" ? "From the app's checked reference list." : "AI suggestion: confirm with a pharmacist."}
        {d.cached ? " Saved on this phone, so it works offline." : ""} Same active ingredient does not guarantee the products are interchangeable.
      </p>
    </Sheet>
  );
}
