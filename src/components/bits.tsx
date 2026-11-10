import { useEffect, type CSSProperties, type ReactNode } from "react";
import type { DrugMention, DrugStatus } from "../lib/types";
import { nearlySame } from "../lib/names";
import Icon from "./Icon";

const STATUS: Record<DrugStatus, { label: string; tone: string; icon: string }> = {
  same_name: { label: "Same name here", tone: "ok", icon: "check" },
  different_name: { label: "Different name here", tone: "info", icon: "swap" },
  different_strength: { label: "Strength labelled differently", tone: "warn", icon: "alert" },
  not_available_locally: { label: "Not sold here", tone: "danger", icon: "alert" },
  uncertain: { label: "Check with a pharmacist", tone: "warn", icon: "alert" },
};

export function StatusBadge({ status, compact }: { status: DrugStatus; compact?: boolean }) {
  const s = STATUS[status] || STATUS.uncertain;
  return (
    <span className={`status ${s.tone}`} title={s.label}>
      <Icon name={s.icon} size={compact ? 16 : 15} />
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
            <Icon name="close" size={18} />
          </button>
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  );
}

export function Tag({ code }: { code: string }) {
  return <span className="cc">{code}</span>;
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

const segmenters = new Map<string, Intl.Segmenter | null>();
function words(text: string, lang: string): string[] {
  if (!segmenters.has(lang)) {
    try {
      segmenters.set(lang, typeof Intl.Segmenter === "function" ? new Intl.Segmenter(lang || undefined, { granularity: "word" }) : null);
    } catch {
      segmenters.set(lang, null);
    }
  }
  const seg = segmenters.get(lang);
  if (!seg) return text.split(/(\s+)/).filter(Boolean);
  // Glue punctuation onto the word before it so "dolor?" arrives as one piece.
  const out: string[] = [];
  for (const s of seg.segment(text)) {
    if (!s.isWordLike && out.length && !/^\s+$/.test(s.segment) && !/\s$/.test(out[out.length - 1])) out[out.length - 1] += s.segment;
    else out.push(s.segment);
  }
  return out;
}

/**
 * Text that arrives one word at a time. Medicine names glow, and in the speaker's own words
 * (`swap` set) they flip into the name the listener uses, keeping the original underneath.
 */
export function Reveal({
  text,
  lang = "",
  drugs = [],
  field = "mentioned",
  swap,
  onDrug,
  start = 0,
  step = 70,
  budget = 1800,
}: {
  text: string;
  lang?: string;
  drugs?: DrugMention[];
  field?: "mentioned" | "translated";
  swap?: "local" | "home";
  onDrug?: (d: DrugMention) => void;
  start?: number;
  step?: number;
  budget?: number;
}) {
  const spans = findSpans(text, drugs, field);
  type Piece = { kind: "w"; s: string } | { kind: "d"; s: string; drug: DrugMention };
  const pieces: Piece[] = [];
  let at = 0;
  for (const sp of spans) {
    if (sp.start > at) for (const w of words(text.slice(at, sp.start), lang)) pieces.push({ kind: "w", s: w });
    pieces.push({ kind: "d", s: text.slice(sp.start, sp.end), drug: sp.drug });
    at = sp.end;
  }
  if (at < text.length) for (const w of words(text.slice(at), lang)) pieces.push({ kind: "w", s: w });

  const visible = pieces.filter((p) => p.kind === "d" || !/^\s+$/.test(p.s)).length || 1;
  const gap = Math.min(step, budget / visible);
  let n = 0;
  return (
    <>
      {pieces.map((p, i) => {
        if (p.kind === "w" && /^\s+$/.test(p.s)) return p.s;
        const delay = Math.round(start + n++ * gap);
        if (p.kind === "w")
          return (
            <span key={i} className="w" style={{ animationDelay: `${delay}ms` }}>
              {p.s}
            </span>
          );
        const to = swap ? swapLabel(p.drug, swap) : "";
        const changes = Boolean(swap && to && !nearlySame(to, p.s) && p.drug.status !== "same_name");
        const tone = p.drug.status === "not_available_locally" ? "danger" : p.drug.status === "different_strength" || p.drug.status === "uncertain" ? "warn" : "";
        if (!changes)
          // A <span>, not a <button>: buttons always render as blocks, and this has to wrap like a marker stroke.
          return (
            <span
              key={i}
              role="button"
              tabIndex={0}
              className={`drug ${tone}`}
              onClick={() => onDrug?.(p.drug)}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onDrug?.(p.drug)}
              style={{ "--d": `${delay}ms` } as CSSProperties}
            >
              {p.s}
            </span>
          );
        return (
          <button key={i} className={`drug ${tone} swaps`} onClick={() => onDrug?.(p.drug)} style={{ "--d": `${delay}ms` } as CSSProperties}>
            <span className="drug-stack">
              <span className="drug-from">{p.s}</span>
              <span className="drug-to">{to}</span>
            </span>
            <span className="drug-caption">{p.s}</span>
          </button>
        );
      })}
    </>
  );
}

export function KindIcon({ id, size = 16 }: { id: string; size?: number }) {
  const kind = kindOf(id);
  return <Icon name={{ allergy: "alert", medication: "pill", condition: "heart", lab: "lab", document: "doc" }[kind] || "doc"} size={size} />;
}

export const KIND_LABEL: Record<string, string> = {
  allergy: "Allergy",
  medication: "Medicine",
  condition: "Condition",
  lab: "Lab result",
  document: "Record",
};

export function kindOf(id: string) {
  if (id.startsWith("alg_")) return "allergy";
  if (id.startsWith("med_")) return "medication";
  if (id.startsWith("cnd_")) return "condition";
  if (id.startsWith("lab_")) return "lab";
  return "document";
}
