import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Persona } from "../lib/types";
import { country, langName } from "../lib/langs";
import { recordBody, useTranslatedRecord } from "../lib/recordTranslation";
import { loadTrip, norm } from "../lib/store";
import { removeItem, restoreItem } from "../lib/edits";
import { Sheet } from "./bits";
import Icon from "./Icon";
import Flag from "./Flag";
import ScanFlow from "./ScanFlow";

type Props = {
  persona: Persona;
  onClose: () => void;
  /** The patient's own view (home): swipe a row left to delete it, and add documents by photo. */
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
  const base = showTranslated && tr.record ? tr.record : recordBody(p);
  const r = Object.fromEntries(Object.entries(base).map(([k, xs]) => [k, (xs as { id: string }[]).filter((x) => !gone.includes(x.id))])) as typeof base;
  const loading = showTranslated && !tr.record && !tr.error;
  const [open, setOpen] = useState<string | null>(null);
  const [undo, setUndo] = useState<{ id: string; title: string } | null>(null);
  const [scan, setScan] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Local names for the patient's medicines, from what the phone already matched for this trip.
  const local = p.trip.country;
  const trip = p.home !== local ? loadTrip(p.home, local) : null;
  const localFor = (id: string) => {
    const m = p.medications.find((x) => x.id === id);
    if (!m || !trip) return null;
    const e = trip.items[norm(m.name)] || trip.items[norm(m.generic)];
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

  const swipe = (id: string, title: string, children: ReactNode, className = "list-row") =>
    editable ? (
      <SwipeRow key={id} id={id} open={open === id} setOpen={setOpen} onDelete={() => del(id, title)} className={className}>
        {children}
      </SwipeRow>
    ) : (
      <div key={id} className={className}>
        {children}
      </div>
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
            <Flag code={p.home} size={18} /> {langName(p.recordLanguage)} (original)
          </button>
        </div>
      )}
      {showTranslated && tr.error && <p className="translating-note">Couldn't translate right now. Showing the original.</p>}
      {loading && (
        <p className="translating-note">
          <span className="dots3">
            <i />
            <i />
            <i />
          </span>
          {`Translating the record into ${langName(doctorLang)}…`}
        </p>
      )}
      {editable && <p className="edit-hint">Swipe left on anything to remove it.</p>}
      <div className={`record ${loading ? "dim" : ""}`} onPointerDown={(e) => open && !(e.target as Element).closest(".swipe-row.open") && setOpen(null)}>
        <Group kind="allergy" icon="alert" title="Allergies" count={r.allergies.length}>
          {r.allergies.map((a) => swipe(a.id, a.substance, <RowBody title={a.substance} badge={a.severity === "severe" ? { text: "Severe", tone: "danger" } : undefined} lines={[a.reaction]} />))}
        </Group>
        <Group kind="medication" icon="pill" title="Medicines" count={r.medications.length}>
          {r.medications.map((m) => {
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
                lines={[[m.generic, m.dose].filter(Boolean).join(" · "), m.schedule, m.purpose]}
              />,
            );
          })}
        </Group>
        <Group kind="condition" icon="heart" title="Conditions" count={r.conditions.length}>
          {r.conditions.map((c) =>
            swipe(c.id, c.name, <RowBody title={c.name} badge={c.since ? { text: /^\d{4}$/.test(c.since) ? `since ${c.since}` : c.since, tone: "plain" } : undefined} lines={[c.note]} />),
          )}
        </Group>
        <Group kind="lab" icon="lab" title="Lab results" count={r.labs.length}>
          {r.labs.map((l) =>
            swipe(
              l.id,
              l.name,
              <>
                <span className="lab-name">
                  <strong>{l.name}</strong>
                  <span>
                    {l.date} · reference {l.ref}
                  </span>
                </span>
                <span className={`lab-value ${l.flag === "H" ? "high" : l.flag === "L" ? "low" : ""}`}>
                  {l.value}
                  <small>{l.unit}</small>
                  {l.flag && <em>{l.flag === "H" ? "High" : "Low"}</em>}
                </span>
              </>,
              "list-row lab-row",
            ),
          )}
        </Group>
        <Group
          kind="document"
          icon="doc"
          title="Visits and documents"
          count={r.documents.length}
          always={editable}
          action={
            editable && (
              <button className="add-doc" onClick={() => fileRef.current?.click()}>
                <Icon name="plus" size={16} />
                Add
              </button>
            )
          }
        >
          {r.documents.map((d) => swipe(d.id, d.title, <RowBody title={d.title} badge={d.date ? { text: d.date, tone: "plain" } : undefined} lines={[d.facility, d.body]} />))}
          {editable && (
            <button className="list-row add-doc-row" onClick={() => fileRef.current?.click()}>
              <span className="add-doc-icon">
                <Icon name="camera" size={20} />
              </span>
              <span>
                <strong>Add a document</strong>
                <span>Take a photo; we read it on this phone</span>
              </span>
            </button>
          )}
        </Group>
        <Group kind="contact" icon="user" title="Emergency contacts" count={r.contacts.length}>
          {r.contacts.map((c) => swipe(c.id, c.name, <RowBody title={c.name} lines={[c.relationship, c.phone]} />))}
        </Group>
      </div>
      {editable && (
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          hidden
          data-testid="scan-input"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) setScan(f);
          }}
        />
      )}
      <p className="fine">
        {showTranslated && tr.record && !tr.error ? `Translated by AI from ${langName(p.recordLanguage)} for ${country(p.trip.country).name}. Check the original for anything critical.` : "As saved by the patient."}
      </p>
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

function Group({ kind, icon, title, count, children, action, always }: { kind: string; icon: string; title: string; count: number; children: ReactNode; action?: ReactNode; always?: boolean }) {
  if (!count && !always) return null;
  return (
    <section className={`rec-section ${kind}`}>
      <header>
        <span className="rec-icon">
          <Icon name={icon} size={18} />
        </span>
        <span className="rec-title">{title}</span>
        {count > 0 && <span className="rec-count">{count}</span>}
        {action}
      </header>
      <div className="list">{children}</div>
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
function SwipeRow({ id, open, setOpen, onDelete, className, children }: { id: string; open: boolean; setOpen: (id: string | null) => void; onDelete: () => void; className: string; children: ReactNode }) {
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
        className={className}
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
        }}
      >
        {children}
      </div>
    </div>
  );
}
