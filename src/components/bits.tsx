import { useEffect, type ReactNode } from "react";
import type { DrugMention, DrugStatus } from "../lib/types";
import { nearlySame } from "../lib/names";

const STATUS: Record<DrugStatus, { label: string; tone: string; icon: string }> = {
  same_name: { label: "Same name", tone: "ok", icon: "✓" },
  different_name: { label: "Different name", tone: "info", icon: "⇄" },
  different_strength: { label: "Strength differs", tone: "warn", icon: "≠" },
  not_available_locally: { label: "Not sold here", tone: "danger", icon: "!" },
  uncertain: { label: "Check with pharmacist", tone: "warn", icon: "?" },
};

export function StatusBadge({ status, compact }: { status: DrugStatus; compact?: boolean }) {
  const s = STATUS[status] || STATUS.uncertain;
  return (
    <span className={`badge ${s.tone}`} title={s.label}>
      <span aria-hidden>{s.icon}</span>
      {!compact && <span>{s.label}</span>}
    </span>
  );
}

export function Sheet({ title, onClose, children, tone }: { title: ReactNode; onClose: () => void; children: ReactNode; tone?: string }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className={`sheet ${tone || ""}`} role="dialog" aria-modal onClick={(e) => e.stopPropagation()}>
        <div className="sheet-grip" aria-hidden />
        <div className="sheet-head">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  );
}

/** What the listener's side calls a drug, short form for an inline swap. */
export function swapLabel(d: DrugMention, toward: "local" | "home") {
  if (toward === "local") {
    if (d.status === "not_available_locally") return d.generic.replace(/\s*\(.*\)$/, "");
    return d.local_name || d.generic;
  }
  return (d.home_name || d.generic).replace(/\s*\(.*\)$/, "");
}

type Span = { start: number; end: number; drug: DrugMention };

function findSpans(text: string, drugs: DrugMention[], field: "mentioned" | "translated"): Span[] {
  const lower = text.toLowerCase();
  const spans: Span[] = [];
  for (const d of drugs) {
    const needle = d[field];
    if (!needle) continue;
    let i = text.indexOf(needle);
    if (i < 0) i = lower.indexOf(needle.toLowerCase());
    if (i < 0) continue;
    const end = i + needle.length;
    if (spans.some((s) => i < s.end && end > s.start)) continue;
    spans.push({ start: i, end, drug: d });
  }
  return spans.sort((a, b) => a.start - b.start);
}

/**
 * Text with drug names highlighted. In the speaker's own words (`swap` set) the word
 * lights up and then turns into the name the listener uses, keeping the original underneath.
 */
export function Marked({
  text,
  drugs,
  field,
  swap,
  onDrug,
}: {
  text: string;
  drugs: DrugMention[];
  field: "mentioned" | "translated";
  swap?: "local" | "home";
  onDrug: (d: DrugMention) => void;
}) {
  const spans = findSpans(text, drugs, field);
  if (!spans.length) return <>{text}</>;
  const out: ReactNode[] = [];
  let at = 0;
  spans.forEach((s, i) => {
    if (s.start > at) out.push(text.slice(at, s.start));
    const original = text.slice(s.start, s.end);
    const to = swap ? swapLabel(s.drug, swap) : "";
    const changes = swap && to && !nearlySame(to, original) && s.drug.status !== "same_name";
    const tone = s.drug.status === "not_available_locally" ? "danger" : s.drug.status === "different_strength" || s.drug.status === "uncertain" ? "warn" : "";
    out.push(
      <button key={i} className={`drug ${tone} ${changes ? "swaps" : ""}`} onClick={() => onDrug(s.drug)} style={{ animationDelay: `${i * 180}ms` }}>
        {changes ? (
          <>
            <span className="drug-stack">
              <span className="drug-from">{original}</span>
              <span className="drug-to">
                {to}
                {s.drug.status === "not_available_locally" && <span className="drug-flag">!</span>}
              </span>
            </span>
            <span className="drug-caption">{original}</span>
          </>
        ) : (
          original
        )}
      </button>,
    );
    at = s.end;
  });
  if (at < text.length) out.push(text.slice(at));
  return <>{out}</>;
}

export const KIND_ICON: Record<string, string> = {
  allergy: "⚠",
  medication: "℞",
  condition: "♥",
  lab: "⚗",
  document: "▤",
};

export function kindOf(id: string) {
  if (id.startsWith("alg_")) return "allergy";
  if (id.startsWith("med_")) return "medication";
  if (id.startsWith("cnd_")) return "condition";
  if (id.startsWith("lab_")) return "lab";
  return "document";
}
