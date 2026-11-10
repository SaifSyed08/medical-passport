import { useState } from "react";
import type { ContextItem, Persona } from "../lib/types";
import { KindIcon } from "./bits";
import Icon from "./Icon";

type Props = {
  items: ContextItem[];
  persona: Persona;
  /** Item that just became an alert: its tile flashes. */
  flashId?: string | null;
  onOpen: (c: ContextItem) => void;
  onOpenRecord: () => void;
};

/**
 * Record items that matter right now, as compact two-column tiles inside the bottom bar.
 * Collapsed: one row (alerts first, then what the latest utterance brought up). "All N" shows the rest.
 */
export default function ContextTiles({ items: unsorted, persona, flashId, onOpen, onOpenRecord }: Props) {
  const [open, setOpen] = useState(false);
  if (!unsorted.length) return null;
  const items = [...unsorted].sort((a, b) => (a.level === b.level ? b.at - a.at : a.level === "alert" ? -1 : 1));
  const latestTurn = [...unsorted].sort((a, b) => b.at - a.at)[0]?.turnId;
  const focus = items.filter((c) => c.level === "alert" || c.turnId === latestTurn).slice(0, 2);
  const shown = open ? items : focus.length ? focus : items.slice(0, 2);
  const alerts = items.filter((c) => c.level === "alert").length;
  return (
    <section className={`tiles ${open ? "open" : ""}`} aria-label="From the patient's record">
      <div className="tiles-head">
        <span className="tiles-title">{persona.name.split(" ")[0]}'s record</span>
        {alerts > 0 && (
          <span className="tiles-alerts">
            <Icon name="alert" size={15} />
            {alerts}
          </span>
        )}
        <span className="spacer" />
        {(open || items.length > shown.length) && (
          <button className="tiles-link" onClick={() => setOpen((v) => !v)}>
            {open ? "Less" : `All ${items.length}`}
          </button>
        )}
        <button className="tiles-link" onClick={onOpenRecord}>
          Full record
        </button>
      </div>
      <ul className="tile-grid">
        {shown.map((c) => (
          <li key={c.id}>
            <button className={`ctx-tile ${c.level} ${flashId === c.id ? "flash" : ""}`} onClick={() => onOpen(c)} title={c.detail}>
              <span className="tile-icon">
                <KindIcon id={c.id} size={20} />
              </span>
              <span className="tile-title">{c.title}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Only for the worst news (an allergy to something just mentioned): a banner drops in over the transcript. */
export function AlertToast({ item, onOpen, onClose }: { item: ContextItem; onOpen: () => void; onClose: () => void }) {
  return (
    <div className="toast panel" role="alert">
      <button className="toast-body" onClick={onOpen}>
        <span className="toast-icon">
          <Icon name="alert" size={26} />
        </span>
        <span className="toast-text">
          <strong>{item.title}</strong>
          <span>{item.why || item.detail}</span>
        </span>
      </button>
      <button className="icon-btn" onClick={onClose} aria-label="Dismiss">
        <Icon name="close" size={20} />
      </button>
    </div>
  );
}
