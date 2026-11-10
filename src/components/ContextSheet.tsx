import { useState } from "react";
import type { ContextItem, Persona } from "../lib/types";
import { findRecordItem } from "../lib/record";
import { langName } from "../lib/langs";
import { KindIcon, Sheet } from "./bits";
import Icon from "./Icon";

/** One record item: the fact, why it's up now, and the original entry only if asked for. */
export default function ContextSheet({ item, persona, onClose }: { item: ContextItem; persona: Persona; onClose: () => void }) {
  const [showSource, setShowSource] = useState(false);
  const src = findRecordItem(persona, item.id);
  const alert = item.level === "alert";
  return (
    <Sheet title={item.title} onClose={onClose} tone={alert ? "danger" : ""}>
      <div className={`fact ${alert ? "alert" : ""}`}>
        <span className="fact-icon">
          <KindIcon id={item.id} size={28} />
        </span>
        <p>{item.detail}</p>
      </div>
      <p className="why">
        <Icon name="info" size={20} />
        {item.why}
      </p>
      {src && (
        <>
          <button className="link source-toggle" onClick={() => setShowSource((v) => !v)}>
            {showSource ? "Hide original record" : `Show original record (${langName(persona.recordLanguage)})`}
          </button>
          {showSource && (
            <div className="quote">
              <strong>{src.title}</strong>
              {src.lines.map((l, i) => (
                <p key={i}>{l}</p>
              ))}
            </div>
          )}
        </>
      )}
    </Sheet>
  );
}
