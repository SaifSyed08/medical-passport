import { useEffect, useRef } from "react";
import type { ContextItem, Persona } from "../lib/types";
import { KIND_ICON, KIND_LABEL, kindOf } from "./bits";

/** Record items that matter right now, in the doctor's language. Alerts first, newest first. */
export default function ContextDock({ items: unsorted, persona, onOpen }: { items: ContextItem[]; persona: Persona; onOpen: (c: ContextItem) => void }) {
  const items = [...unsorted].sort((a, b) => (a.level === b.level ? b.at - a.at : a.level === "alert" ? -1 : 1));
  const row = useRef<HTMLDivElement>(null);
  const signature = items.map((i) => `${i.id}:${i.at}`).join(",");
  useEffect(() => {
    row.current?.scrollTo({ left: 0, behavior: "smooth" });
  }, [signature]);
  if (!items.length) return null;
  const alerts = items.filter((i) => i.level === "alert").length;
  return (
    <section className="dock" aria-label="From the patient's record">
      <div className="dock-head">
        <span>For the doctor · {persona.name.split(" ")[0]}'s record</span>
        {alerts > 0 && <span className="alert-pill">{alerts} alert{alerts > 1 ? "s" : ""}</span>}
      </div>
      <div className="context-row" ref={row}>
        {items.map((c) => {
          const kind = kindOf(c.id);
          return (
            <button key={`${c.id}-${c.at}`} className={`ctx-card ${c.level} ${kind}`} onClick={() => onOpen(c)}>
              <span className="ctx-kind">
                <span aria-hidden>{KIND_ICON[kind]}</span> {c.level === "alert" ? "Alert" : KIND_LABEL[kind]}
              </span>
              <strong>{c.title}</strong>
              <span className="ctx-detail">{c.detail}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

/** A safety alert drops in over the stage, buzzes, and gets out of the way. */
export function AlertToast({ item, onOpen, onClose }: { item: ContextItem; onOpen: () => void; onClose: () => void }) {
  return (
    <div className="toast" role="alert" key={item.id + item.at}>
      <button className="toast-body" onClick={onOpen}>
        <span className="toast-icon">⚠</span>
        <span className="toast-text">
          <span className="toast-kicker">Alert for the doctor</span>
          <strong>{item.title}</strong>
          <span>{item.why || item.detail}</span>
        </span>
      </button>
      <button className="toast-x" onClick={onClose} aria-label="Dismiss">
        ✕
      </button>
      <span className="toast-timer" />
    </div>
  );
}
