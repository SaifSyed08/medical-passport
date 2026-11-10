import { useState } from "react";
import type { ContextItem, Persona } from "../lib/types";
import { KindIcon } from "./bits";
import Icon from "./Icon";

/** Record items that matter right now, in the clinician's language. Alerts first, newest first. */
export default function ContextDock({ items: unsorted, persona, onOpen }: { items: ContextItem[]; persona: Persona; onOpen: (c: ContextItem) => void }) {
  const [open, setOpen] = useState(false);
  if (!unsorted.length) return null;
  const items = [...unsorted].sort((a, b) => (a.level === b.level ? b.at - a.at : a.level === "alert" ? -1 : 1));
  const shown = open ? items : items.slice(0, 2);
  return (
    <section className={`panel dock ${open ? "open" : ""}`} aria-label="From the patient's record">
      <button className="dock-head" onClick={() => setOpen((v) => !v)}>
        <span>From {persona.name.split(" ")[0]}'s record</span>
        <span className="count">{items.length}</span>
        <Icon name="chevron" size={16} className={`chev ${open ? "up" : ""}`} />
      </button>
      <ul className="dock-list">
        {shown.map((c) => (
          <li key={c.id}>
            <button className={`ctx-row ${c.level}`} onClick={() => onOpen(c)}>
              <span className="ctx-icon">
                <KindIcon id={c.id} />
              </span>
              <span className="ctx-main">
                <strong>{c.title}</strong>
                <span>{c.detail}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** A safety alert slides in over the transcript and leaves after a few seconds. */
export function AlertToast({ item, onOpen, onClose }: { item: ContextItem; onOpen: () => void; onClose: () => void }) {
  return (
    <div className="toast panel" role="alert">
      <button className="toast-body" onClick={onOpen}>
        <span className="toast-icon">
          <Icon name="alert" size={20} />
        </span>
        <span className="toast-text">
          <strong>{item.title}</strong>
          <span>{item.why || item.detail}</span>
        </span>
      </button>
      <button className="icon-btn" onClick={onClose} aria-label="Dismiss">
        <Icon name="close" size={16} />
      </button>
    </div>
  );
}
