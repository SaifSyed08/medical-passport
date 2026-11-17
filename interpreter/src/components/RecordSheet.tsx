import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Persona, RecordDoc } from "../lib/types";
import { country, langName } from "../lib/langs";
import { recordBody, useTranslatedRecord } from "../lib/recordTranslation";
import { loadTrip, norm } from "../lib/store";
import { removeItem, restoreItem } from "../lib/edits";
import { Sheet } from "./bits";
import Icon from "./Icon";
import Flag from "./Flag";
import ScanFlow from "./ScanFlow";
import ManualAdd, { type Section } from "./ManualAdd";
import DocPreview, { DocThumb } from "./DocPreview";
import LogoLoader from "./LogoLoader";

type Props = {
  persona: Persona;
  onClose: () => void;
  /** The patient's own view (home): swipe a row left to delete it, and add to any section. */
  editable?: boolean;
};

/** The saved record, in the clinician's language by default, colour-coded by section. */
export default function RecordSheet({ persona: p, onClose, editable = false }: Props) {
  const doctorLang = p.trip.doctorLanguage;
  const needsTranslation = p.recordLanguage !== doctorLang;
  const [view, setView] = useState<"translated" | "original">(needsTranslation ? "translated" : "original");
  const tr = useTranslatedRecord(p, doctorLang, needsTranslation && view === "translated");
  const showTranslated = needsTranslation && view === "translated";
  // A row the patient just deleted vanishes at once, even before the translated copy catches up.
  const [gone, setGone] = useState<string[]>([]);
  // The record as saved, with each row swapped for its translation once there is one (a just-added row shows
  // in the original until the new translation lands).
  const orig = recordBody(p);
  const base = showTranslated && tr.record ? (Object.fromEntries(Object.entries(orig).map(([k, xs]) => [k, (xs as { id: string }[]).map((x) => ((tr.record as Record<string, { id: string }[]>)[k] || []).find((t) => t.id === x.id) || x)])) as typeof orig) : orig;
  const r = Object.fromEntries(Object.entries(base).map(([k, xs]) => [k, (xs as { id: string }[]).filter((x) => !gone.includes(x.id))])) as typeof base;
  const loading = showTranslated && !tr.record && !tr.error;
  const [open, setOpen] = useState<string | null>(null);
  const [undo, setUndo] = useState<{ id: string; title: string } | null>(null);
  const [scan, setScan] = useState<File | null>(null);
  const [manual, setManual] = useState<Section | null>(null);
  const [preview, setPreview] = useState<RecordDoc | null>(null);
  const [adding, setAdding] = useState<Section | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Local names for the patient's medicines, from what the phone already matched for this trip.
  const local = p.trip.country;
  const trip = p.home !== local ? loadTrip(p.home, local) : null;
  const localFor = (id: string) => {
    const m = p.medications.find((x) => x.id === id);
    if (!m || !trip) return null;
    const e = trip.items[norm(m.name)] || (m.generic ? trip.items[norm(m.generic)] : undefined);
    if (!e) return null;
    if (e.status === "not_available_locally") return { text: `Not sold here · ask for ${e.generic}`, warn: true };
    const name = e.local_name || e.generic;
    const brand = e.local_brands?.find((b) => norm(b) !== norm(name));
    return { text: brand ? `${name} · ${brand}` : name, warn: false };
  };

  useEffect(() => {
    if (!undo) return;
    const t = window.setTimeout(() => setUndo(null), 5000);
    return () => window.clearTimeout(t);
  }, [undo]);

  const del = (id: string, title: string) => {
    setOpen(null);
    setGone((g) => [...g, id]);
    removeItem(p.id, id);
    setUndo({ id, title });
  };
  const restore = () => {
    if (!undo) return;
    restoreItem(p.id, undo.id);
    setGone((g) => g.filter((x) => x !== undo.id));
    setUndo(null);
  };

  if (scan) return <ScanFlow persona={p} file={scan} onDone={() => setScan(null)} onClose={onClose} />;
  if (manual) return <ManualAdd persona={p} section={manual} onDone={() => setManual(null)} onClose={onClose} />;
  if (preview) return <DocPreview doc={preview} onClose={() => setPreview(null)} />;

  const swipe = (id: string, title: string, children: ReactNode, className = "list-row", onTap?: () => void) =>
    editable ? (
      <SwipeRow key={id} id={id} open={open === id} setOpen={setOpen} onDelete={() => del(id, title)} onTap={onTap} className={className}>
        {children}
      </SwipeRow>
    ) : onTap ? (
      <button key={id} className={className} onClick={onTap}>
        {children}
      </button>
    ) : (
      <div key={id} className={className}>
        {children}
      </div>
    );

  // Every section takes additions: typed in, or read off a photo of a document.
  const group = (kind: Section, icon: string, title: string, count: number, children: ReactNode) => (
    <Group
      kind={kind}
      icon={icon}
      title={title}
      count={count}
      always={editable}
      action={
        editable && (
          <button className={`add-btn ${adding === kind ? "on" : ""}`} onClick={() => setAdding(adding === kind ? null : kind)} aria-expanded={adding === kind}>
            <Icon name={adding === kind ? "close" : "plus"} size={16} />
            Add
          </button>
        )
      }
      menu={
        adding === kind && (
          <div className="add-menu" role="menu">
            <button
              role="menuitem"
              onClick={() => {
                setAdding(null);
                setManual(kind);
              }}
            >
              <Icon name="pencil" size={20} />
              Type it in
            </button>
            <button
              role="menuitem"
              onClick={() => {
                setAdding(null);
                fileRef.current?.click();
              }}
            >
              <Icon name="upload" size={20} />
              Upload
            </button>
          </div>
        )
      }
    >
      {children}
    </Group>
  );

  return (
    <Sheet title={p.name} onClose={onClose}>
      <p className="record-meta">
        <Flag code={p.home} size={20} /> Born {p.dob} · blood type {p.bloodType}
      </p>
      {needsTranslation && (
        <div className="seg record-lang">
          <button className={view === "translated" ? "on" : ""} onClick={() => setView("translated")}>
            <Flag code={p.trip.country} size={18} /> {langName(doctorLang)}
          </button>
          <button className={view === "original" ? "on" : ""} onClick={() => setView("original")}>
            <Flag code={p.home} size={18} /> {langName(p.recordLanguage)}
          </button>
        </div>
      )}
      {showTranslated && tr.error && <p className="translating-note">Couldn't translate right now. Showing the original.</p>}
      {loading && (
        <p className="translating-note">
          <LogoLoader size={22} />
          {`Translating into ${langName(doctorLang)}…`}
        </p>
      )}
      <div className={`record ${loading ? "dim" : ""}`} onPointerDown={(e) => open && !(e.target as Element).closest(".swipe-row.open") && setOpen(null)}>
        {group(
          "allergy",
          "alert",
          "Allergies",
          r.allergies.length,
          r.allergies.map((a) => swipe(a.id, a.substance, <RowBody title={a.substance} badge={a.severity === "severe" ? { text: "Severe", tone: "danger" } : undefined} lines={[a.reaction]} />)),
        )}
        {group(
          "medication",
          "pill",
          "Medicines",
          r.medications.length,
          r.medications.map((m) => {
            const loc = localFor(m.id);
            return swipe(
              m.id,
              m.name,
              <RowBody
                title={m.name}
                extra={
                  loc && (
                    <span className={`local-name ${loc.warn ? "warn" : ""}`}>
                      <Flag code={local} size={18} />
                      {loc.text}
                    </span>
                  )
                }
                lines={[[m.generic, m.dose].filter(Boolean).join(" · "), [m.schedule, m.purpose].filter(Boolean).join(" · ")]}
              />,
            );
          }),
        )}
        {group(
          "condition",
          "heart",
          "Conditions",
          r.conditions.length,
          r.conditions.map((c) => swipe(c.id, c.name, <RowBody title={c.name} badge={c.since ? { text: /^\d{4}$/.test(c.since) ? `since ${c.since}` : c.since, tone: "plain" } : undefined} lines={[c.note]} />)),
        )}
        {group(
          "lab",
          "lab",
          "Lab results",
          r.labs.length,
          r.labs.map((l) =>
            swipe(
              l.id,
              l.name,
              <>
                <span className="lab-name">
                  <strong>{l.name}</strong>
                  <span>{[l.date, l.ref && `normal ${l.ref}`].filter(Boolean).join(" · ")}</span>
                </span>
                <span className={`lab-value ${l.flag === "H" ? "high" : l.flag === "L" ? "low" : ""}`}>
                  {l.value}
                  <small>{l.unit}</small>
                  {l.flag && <em>{l.flag === "H" ? "High" : "Low"}</em>}
                </span>
              </>,
              "list-row lab-row",
            ),
          ),
        )}
        {group(
          "document",
          "doc",
          "Visits and documents",
          r.documents.length,
          r.documents.map((d) =>
            swipe(
              d.id,
              d.title,
              <>
                <DocThumb doc={d} />
                <span className="doc-main">
                  <strong className="doc-title">{d.title}</strong>
                  {(d.facility || d.date) && (
                    <span className="doc-meta">
                      {d.facility && (
                        <span className="doc-place">
                          <Icon name="pin" size={15} />
                          <span>{d.facility}</span>
                        </span>
                      )}
                      {d.date && <time>{d.date}</time>}
                    </span>
                  )}
                  {d.body && <span className="doc-body">{d.body}</span>}
                </span>
              </>,
              "list-row doc-row",
              () => setPreview(d),
            ),
          ),
        )}
        {group(
          "contact",
          "user",
          "Emergency contacts",
          r.contacts.length,
          r.contacts.map((c) =>
            swipe(
              c.id,
              c.name,
              <RowBody
                title={c.name}
                lines={[c.relationship]}
                extra={
                  c.phone && (
                    <span className="contact-phone">
                      <Icon name="phone" size={15} />
                      {c.phone}
                    </span>
                  )
                }
              />,
            ),
          ),
        )}
      </div>
      {editable && (
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          data-testid="scan-input"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) setScan(f);
          }}
        />
      )}
      {showTranslated && tr.record && !tr.error && <p className="fine">{`Translated by AI from ${langName(p.recordLanguage)} for ${country(p.trip.country).name}. Check the original for anything critical.`}</p>}
      {undo && (
        <div className="undo-bar" role="status">
          <span>Removed {undo.title.replace(/\s*\(.*\)/, "")}</span>
          <button onClick={restore}>
            <Icon name="undo" size={16} />
            Undo
          </button>
        </div>
      )}
    </Sheet>
  );
}

function Group({ kind, icon, title, count, children, action, menu, always }: { kind: string; icon: string; title: string; count: number; children: ReactNode; action?: ReactNode; menu?: ReactNode; always?: boolean }) {
  if (!count && !always) return null;
  return (
    <section className={`rec-section ${kind}`}>
      <header>
        <Icon name={icon} size={24} className="rec-icon" />
        <span className="rec-title">{title}</span>
        {count > 0 && <span className="rec-count">{count}</span>}
        {action}
      </header>
      {menu}
      {count > 0 && <div className="list">{children}</div>}
    </section>
  );
}

function RowBody({ title, lines, badge, extra }: { title: string; lines: string[]; badge?: { text: string; tone: string }; extra?: ReactNode }) {
  return (
    <>
      <span className="row-top">
        <strong>{title}</strong>
        {badge && <span className={`tag ${badge.tone}`}>{badge.text}</span>}
      </span>
      {extra}
      {lines.filter(Boolean).map((l, i) => (
        <span key={i}>{l}</span>
      ))}
    </>
  );
}

const REVEAL = 92;

/** A row that slides left to show Delete, like iOS lists. One open at a time; tap elsewhere to close. */
function SwipeRow({ id, open, setOpen, onDelete, onTap, className, children }: { id: string; open: boolean; setOpen: (id: string | null) => void; onDelete: () => void; onTap?: () => void; className: string; children: ReactNode }) {
  const [dx, setDxState] = useState<number | null>(null);
  // The release handler can run before React re-renders the last move, so it reads the live value from a ref.
  const dxRef = useRef<number | null>(null);
  // The click that follows a drag must not close the row the drag just opened.
  const dragged = useRef(false);
  const setDx = (v: number | null) => {
    dxRef.current = v;
    setDxState(v);
  };
  const start = useRef<{ x: number; y: number; base: number; locked: "x" | "y" | null } | null>(null);
  const width = useRef(0);
  const offset = dx ?? (open ? -REVEAL : 0);
  const [leaving, setLeaving] = useState(false);

  const end = () => {
    const s = start.current;
    const d = dxRef.current;
    start.current = null;
    if (!s || s.locked !== "x" || d === null) return setDx(null);
    dragged.current = true;
    // A long swipe (past most of the row) deletes outright, like Mail.
    if (d < -width.current * 0.6) {
      setLeaving(true);
      window.setTimeout(onDelete, 220);
    } else setOpen(d < -REVEAL / 2 ? id : null);
    setDx(null);
  };

  return (
    <div className={`swipe-row ${open ? "open" : ""} ${leaving ? "leaving" : ""}`} data-id={id}>
      <button className="swipe-delete" onClick={onDelete} tabIndex={open ? 0 : -1} aria-label="Delete" style={{ width: Math.max(REVEAL, -offset), opacity: Math.min(1, -offset / 50) }}>
        <Icon name="trash" size={20} />
        Delete
      </button>
      <div
        className={`${className} ${onTap ? "tappable" : ""}`}
        style={{ transform: `translateX(${leaving ? -width.current : offset}px)`, transition: dx === null ? undefined : "none" }}
        onPointerDown={(e) => {
          width.current = e.currentTarget.offsetWidth;
          start.current = { x: e.clientX, y: e.clientY, base: open ? -REVEAL : 0, locked: null };
          dragged.current = false;
        }}
        onPointerMove={(e) => {
          const s = start.current;
          if (!s) return;
          const mx = e.clientX - s.x;
          const my = e.clientY - s.y;
          if (!s.locked) {
            if (Math.abs(mx) < 8 && Math.abs(my) < 8) return;
            s.locked = Math.abs(mx) > Math.abs(my) ? "x" : "y";
            if (s.locked === "x") e.currentTarget.setPointerCapture(e.pointerId);
          }
          if (s.locked !== "x") return;
          const v = s.base + mx;
          // Rubber-band past the button, none to the right.
          setDx(v > 0 ? v / 4 : v < -REVEAL ? -REVEAL + (v + REVEAL) * 0.6 : v);
        }}
        onPointerUp={end}
        onPointerCancel={end}
        onClick={() => {
          if (dragged.current) dragged.current = false;
          else if (open) setOpen(null);
          else onTap?.();
        }}
      >
        {children}
      </div>
    </div>
  );
}
