import type { ContextItem, Persona } from "../lib/types";
import { findRecordItem } from "../lib/record";
import { langNative } from "../lib/langs";
import { KIND_ICON, Sheet, kindOf } from "./bits";

export default function ContextSheet({ item, persona, onClose }: { item: ContextItem; persona: Persona; onClose: () => void }) {
  const src = findRecordItem(persona, item.id);
  const kind = kindOf(item.id);
  return (
    <Sheet
      title={
        <>
          <span aria-hidden>{KIND_ICON[kind]}</span> {item.title}
        </>
      }
      onClose={onClose}
      tone={item.level === "alert" ? "danger" : ""}
    >
      {item.level === "alert" && <div className="alert-banner">Safety alert for the doctor</div>}
      <p className="lead">{item.detail}</p>
      <div className="note">
        <div className="eyebrow">Why it's showing</div>
        <p>{item.why}</p>
      </div>
      {src && (
        <div className="note source">
          <div className="eyebrow">In the record ({langNative(persona.recordLanguage)})</div>
          <strong>{src.title}</strong>
          {src.lines.map((l, i) => (
            <p key={i}>{l}</p>
          ))}
        </div>
      )}
      <p className="fine">Pulled from the patient's own saved record and summarised by AI. Check the source before acting on it.</p>
    </Sheet>
  );
}
