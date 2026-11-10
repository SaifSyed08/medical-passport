import { useEffect, useRef } from "react";
import type { ContextItem, Persona } from "../lib/types";
import { KIND_ICON, kindOf } from "./bits";

type Props = { items: ContextItem[]; alerts: number; persona: Persona; onOpen: (c: ContextItem) => void };

/** Always-visible strip of record items that matter right now, newest first. Written in the doctor's language. */
export default function ContextStrip({ items: unsorted, alerts, persona, onOpen }: Props) {
  // Alerts stay pinned at the front; within each group the newest comes first.
  const items = [...unsorted].sort((a, b) => (a.level === b.level ? b.at - a.at : a.level === "alert" ? -1 : 1));
  const row = useRef<HTMLDivElement>(null);
  const signature = items.map((i) => `${i.id}:${i.at}`).join(",");
  useEffect(() => {
    row.current?.scrollTo({ left: 0, behavior: "smooth" });
  }, [signature]);
  return (
    <section className={`context ${items.length ? "has" : ""}`} aria-label="Relevant from the patient's record">
      <div className="context-head">
        <span className="eyebrow">For the doctor · from {persona.name.split(" ")[0]}'s record</span>
        {alerts > 0 && <span className="alert-pill">{alerts} alert{alerts > 1 ? "s" : ""}</span>}
      </div>
      {items.length === 0 ? (
        <div className="context-empty">Allergies, medicines, labs and past visits appear here when the conversation touches them.</div>
      ) : (
        <div className="context-row" ref={row}>
          {items.map((c) => {
            const kind = kindOf(c.id);
            return (
              <button key={`${c.id}-${c.at}`} className={`ctx-card ${c.level} ${kind}`} onClick={() => onOpen(c)}>
                <span className="ctx-kind">
                  <span aria-hidden>{KIND_ICON[kind]}</span> {c.level === "alert" ? "Alert" : kind}
                </span>
                <strong>{c.title}</strong>
                <span className="ctx-detail">{c.detail}</span>
                <span className="ctx-why">{c.why}</span>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
