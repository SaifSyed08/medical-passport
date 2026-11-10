import type { ContextItem, Persona } from "../lib/types";
import { findRecordItem } from "../lib/record";
import { langName } from "../lib/langs";
import { Sheet } from "./bits";

export default function ContextSheet({ item, persona, onClose }: { item: ContextItem; persona: Persona; onClose: () => void }) {
  const src = findRecordItem(persona, item.id);
  return (
    <Sheet title={item.title} onClose={onClose} tone={item.level === "alert" ? "danger" : ""}>
      {item.level === "alert" && <p className="alert-line">Safety alert</p>}
      <p className="lead">{item.detail}</p>
      <div className="group">
        <div className="group-title">Why it's shown</div>
        <p className="body">{item.why}</p>
      </div>
      {src && (
        <div className="group">
          <div className="group-title">Original record ({langName(persona.recordLanguage)})</div>
          <div className="quote">
            <strong>{src.title}</strong>
            {src.lines.map((l, i) => (
              <p key={i}>{l}</p>
            ))}
          </div>
        </div>
      )}
      <p className="fine">Summarised from the patient's saved record. Check the source before acting on it.</p>
    </Sheet>
  );
}
