import { useState } from "react";
import type { ContextItem, Persona } from "../lib/types";
import { KindIcon } from "./bits";
import Icon from "./Icon";

/** Shorten to whole words; the row fades out at the end so it reads as "there's more". */
function brief(s: string, max = 46) {
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  return cut.slice(0, Math.max(cut.lastIndexOf(" "), 24)).replace(/[,;:.\s]+$/, "");
}

/** Record items that matter right now, in the clinician's language. Alerts first, newest first. */
export default function ContextDock({ items: unsorted, persona, onOpen }: { items: ContextItem[]; persona: Persona; onOpen: (c: ContextItem) => void }) {
  const [open, setOpen] = useState(false);
  if (!unsorted.length) return null;
  const items = [...unsorted].sort((a, b) => (a.level === b.level ? b.at - a.at : a.level === "alert" ? -1 : 1));
  // Collapsed: alerts, then only what the latest utterance brought up. Older context waits behind "N earlier".
  const latestTurn = [...unsorted].sort((a, b) => b.at - a.at)[0]?.turnId;
  const focus = items.filter((c) => c.level === "alert" || c.turnId === latestTurn).slice(0, 2);
  const shown = open ? items : focus.length ? focus : items.slice(0, 1);
  const hidden = items.length - shown.length;
  return (
    <section className={`panel dock ${open ? "open" : ""}`} aria-label="From the patient's record">
      <button className="dock-head" onClick={() => setOpen((v) => !v)}>
        <span>From {persona.name.split(" ")[0]}'s record</span>
        <span className="count">{items.length}</span>
        <Icon name="chevron" size={20} className={`chev ${open ? "up" : ""}`} />
      </button>
      <ul className="dock-list">
        {shown.map((c) => (
          <li key={c.id}>
            <button className={`ctx-row ${c.level}`} onClick={() => onOpen(c)}>
              <span className="ctx-icon">
                <KindIcon id={c.id} size={24} />
              </span>
              <span className="ctx-main">
                <strong>{c.title}</strong>
                <span className="ctx-brief">{brief(c.detail)}</span>
              </span>
              <Icon name="chevron" size={20} className="ctx-go" />
            </button>
          </li>
        ))}
      </ul>
      {hidden > 0 && (
        <button className="dock-more" onClick={() => setOpen(true)}>
          {hidden} earlier
        </button>
      )}
    </section>
  );
}

/** A safety alert slides in over the transcript and leaves after a few seconds. */
export function AlertToast({ item, onOpen, onClose }: { item: ContextItem; onOpen: () => void; onClose: () => void }) {
  return (
    <div className="toast panel" role="alert">
      <button className="toast-body" onClick={onOpen}>
        <span className="toast-icon">
          <Icon name="alert" size={26} />
        </span>
        <span className="toast-text">
          <strong>{item.title}</strong>
          <span>{brief(item.why || item.detail, 64)}</span>
        </span>
      </button>
      <button className="icon-btn" onClick={onClose} aria-label="Dismiss">
        <Icon name="close" size={20} />
      </button>
    </div>
  );
}
