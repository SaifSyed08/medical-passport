import type { DrugMention, Persona, Speaker } from "../lib/types";
import { country } from "../lib/langs";
import { Sheet, StatusBadge } from "./bits";
import Icon from "./Icon";
import Flag from "./Flag";

export default function DrugSheet({ drug: d, speaker, persona: p, onClose }: { drug: DrugMention; speaker: Speaker | null; persona: Persona; onClose: () => void }) {
  const home = country(p.home);
  const local = country(p.trip.country);
  const med = p.medications.find((m) => m.id === d.med_id);
  const unavailable = d.status === "not_available_locally";
  const first = p.name.split(" ")[0];
  return (
    <Sheet title={d.generic} onClose={onClose}>
      <StatusBadge status={d.status} />
      <div className="eq-grid">
        <div className="eq-side">
          <span className="eyebrow side-label"><Flag code={p.home} size={18} /> {home.name}</span>
          <strong>{d.home_name || "—"}</strong>
          {d.home_strength && <small>{d.home_strength}</small>}
        </div>
        <div className="eq-arrow">
          <Icon name="chevron" size={16} />
        </div>
        <div className={`eq-side ${unavailable ? "danger" : ""}`}>
          <span className="eyebrow side-label"><Flag code={p.trip.country} size={18} /> {local.name}</span>
          <strong>{unavailable ? "Not sold here" : d.local_name || "—"}</strong>
          {d.local_brands.length > 0 && <small>{d.local_brands.join(", ")}</small>}
          {d.local_strength && <small>{d.local_strength}</small>}
        </div>
      </div>
      {(d.note_doctor || d.curated_note) && (
        <div className="group">
          <div className="group-title">For the clinician</div>
          <div className="note">
            <p>{d.note_doctor || d.curated_note}</p>
          </div>
        </div>
      )}
      {/* The listener note is in the listener's language; when the patient spoke, the listener is the clinician and it repeats the note above. */}
      {speaker === "clinician" && d.note_listener && (
        <div className="group">
          <div className="group-title">For {first}</div>
          <div className="note">
            <p>{d.note_listener}</p>
          </div>
        </div>
      )}
      {med && (
        <div className="group">
          <div className="group-title">{first} takes this</div>
          <div className="note mine">
            <p>
              {med.name} · {med.dose} · {med.schedule}
            </p>
          </div>
        </div>
      )}
      <p className="fine">
        {d.source === "curated" ? "From the app's checked reference list." : "AI suggestion. Confirm with a pharmacist."}
        {d.cached ? " Saved on this phone." : ""} The same active ingredient doesn't make two products interchangeable.
      </p>
    </Sheet>
  );
}
