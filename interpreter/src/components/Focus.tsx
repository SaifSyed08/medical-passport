// Focus: an experimental conversation layout (press L). No cards and no scrolling transcript. The screen holds one
// line at a time in very large type, and what the record says about it is pinned underneath as margin notes, so
// an alert sits next to the sentence that caused it. Earlier lines live in a ribbon of dots at the top: tap one,
// or swipe the stage sideways, to go back. The two people sit either side of the mic as chips; tapping a chip
// says who is talking next.
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { ContextItem, DrugMention, Persona, Speaker, Turn } from "../lib/types";
import { dir, langName } from "../lib/langs";
import { KindIcon, Reveal, StatusBadge, swapLabel } from "./bits";
import { IdleHero, LiveCaption, sizeFor } from "./Stage";
import Icon from "./Icon";
import Flag from "./Flag";
import LogoLoader from "./LogoLoader";

type ViewProps = {
  turns: Turn[];
  ctx: ContextItem[];
  persona: Persona;
  live: boolean;
  speak: boolean;
  onBack: () => void;
  onMenu: () => void;
  onRecord: () => void;
  onToggleSpeak: () => void;
  onDrug: (d: DrugMention, speaker: Turn["speaker"]) => void;
  onFlip: (t: Turn) => void;
  onReplay: (t: Turn) => void;
  onOpenCtx: (c: ContextItem) => void;
};

const whoOf = (t: Turn) => t.speaker || t.forced;

export function FocusView({ turns, ctx, persona, live, speak, onBack, onMenu, onRecord, onToggleSpeak, onDrug, onFlip, onReplay, onOpenCtx }: ViewProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const latest = turns[turns.length - 1];
  const shownIdx = selected ? turns.findIndex((t) => t.id === selected) : turns.length - 1;
  const shown = turns[shownIdx];
  // While the next person is still talking, the last translation stays readable above their caption.
  const prev = shown && shown === latest && shown.status !== "done" ? [...turns].reverse().find((t) => t.status === "done") : undefined;
  const notesFor = (t?: Turn) => (t ? ctx.filter((c) => c.turnId === t.id).sort((a, b) => (a.level === b.level ? 0 : a.level === "alert" ? -1 : 1)) : []);
  const alertTurns = new Set(ctx.filter((c) => c.level === "alert").map((c) => c.turnId));
  const ribbonRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selected && !turns.some((t) => t.id === selected)) setSelected(null);
  }, [turns, selected]);
  useEffect(() => {
    const el = ribbonRef.current?.querySelector(".f-dot.on");
    el?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [shownIdx, turns.length]);

  const go = (i: number) => {
    if (i < 0 || i >= turns.length) return;
    setSelected(i === turns.length - 1 ? null : turns[i].id);
  };
  const swipe = useRef<{ x: number; y: number } | null>(null);

  return (
    <>
      <header className="f-top">
        <button className="icon-btn" onClick={onBack} aria-label="Back">
          <Icon name="back" />
        </button>
        <div className="f-ribbon" ref={ribbonRef} aria-label="Earlier lines">
          {turns.length === 0 ? (
            <button className="f-pair" onClick={onRecord}>
              <Flag code={persona.home} size={20} />
              <span>{langName(persona.language)}</span>
              <Icon name="swap" size={15} />
              <Flag code={persona.trip.country} size={20} />
              <span>{langName(persona.trip.doctorLanguage)}</span>
            </button>
          ) : (
            turns.map((t, i) => (
              <button
                key={t.id}
                className={`f-dot ${whoOf(t) || "unknown"} ${i === shownIdx ? "on" : ""} ${alertTurns.has(t.id) ? "alert" : ""} ${t.status}`}
                onClick={() => go(i)}
                aria-label={`Line ${i + 1}`}
              >
                {i === shownIdx && whoOf(t) && <Flag code={whoOf(t) === "clinician" ? persona.trip.country : persona.home} size={16} />}
              </button>
            ))
          )}
        </div>
        <button className="icon-btn" onClick={onToggleSpeak} aria-label={speak ? "Mute spoken translation" : "Speak translations aloud"}>
          <Icon name={speak ? "speaker" : "mute"} />
        </button>
        <button className="icon-btn" onClick={onMenu} aria-label="Options">
          <Icon name="more" />
        </button>
      </header>

      <div
        className="f-stage-wrap"
        onPointerDown={(e) => (swipe.current = { x: e.clientX, y: e.clientY })}
        onPointerUp={(e) => {
          const s = swipe.current;
          swipe.current = null;
          if (!s) return;
          const dx = e.clientX - s.x;
          if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(e.clientY - s.y) * 1.5) go(shownIdx + (dx > 0 ? -1 : 1));
        }}
      >
        {!shown ? (
          <IdleHero persona={persona} live={live} />
        ) : (
          <Line
            key={shown.id}
            turn={shown}
            prev={prev}
            persona={persona}
            current={shown === latest}
            notes={shown.status === "done" ? notesFor(shown) : []}
            prevNotes={notesFor(prev)}
            onDrug={(d) => onDrug(d, shown.speaker)}
            onFlip={() => onFlip(shown)}
            onReplay={() => onReplay(shown)}
            onOpenCtx={onOpenCtx}
          />
        )}
        {selected && (
          <button className="f-live" onClick={() => setSelected(null)}>
            <i />
            Back to now
          </button>
        )}
      </div>
    </>
  );
}

function Line({
  turn: t,
  prev,
  persona,
  current,
  notes,
  prevNotes,
  onDrug,
  onFlip,
  onReplay,
  onOpenCtx,
}: {
  turn: Turn;
  prev?: Turn;
  persona: Persona;
  current: boolean;
  notes: ContextItem[];
  /** The previous line's notes, shrunk to chips while the next person talks. */
  prevNotes: ContextItem[];
  onDrug: (d: DrugMention) => void;
  onFlip: () => void;
  onReplay: () => void;
  onOpenCtx: (c: ContextItem) => void;
}) {
  const who = whoOf(t);
  const spokenLang = t.language || (who === "clinician" ? persona.trip.doctorLanguage : who === "patient" ? persona.language : "");
  const listenerLang = t.listenerLang || (who === "clinician" ? persona.language : persona.trip.doctorLanguage);
  const name = who === "clinician" ? "Clinician" : who === "patient" ? persona.name.split(" ")[0] : "Listening";
  const done = t.status === "done";
  const drugNotes = done ? t.drugs.filter((d) => d.status === "not_available_locally" || d.status === "different_strength" || d.status === "uncertain") : [];
  const swapToward = who === "clinician" ? "home" : "local";
  let n = 0;

  return (
    <section className={`f-line ${who || "unknown"} ${t.status}`}>
      {prev && (
        <div className="f-prev">
          <p dir={dir(prev.listenerLang)} lang={prev.listenerLang}>
            {prev.translation}
          </p>
          {prevNotes.length > 0 && (
            <span className="f-prev-notes">
              {prevNotes.map((c) => (
                <button key={c.id} className={`f-mini ${c.level}`} onClick={() => onOpenCtx(c)}>
                  <KindIcon id={c.id} size={15} />
                  {c.title}
                </button>
              ))}
            </span>
          )}
        </div>
      )}
      <div className="f-who">
        {who ? <Flag code={who === "clinician" ? persona.trip.country : persona.home} size={30} className="f-flag" /> : <span className="f-listening" aria-hidden />}
        <span className="f-name">
          <strong>{name}</strong>
          {spokenLang && (
            <span>
              {langName(spokenLang)}
              {done && ` → ${langName(listenerLang)}`}
            </span>
          )}
        </span>
        {done && (
          <span className="f-acts">
            <button className="mini" onClick={onFlip} aria-label="Swap speaker" title="Wrong speaker? Swap">
              <Icon name="swap" size={18} />
            </button>
            <button className="mini" onClick={onReplay} aria-label="Play again">
              <Icon name="speaker" size={18} />
            </button>
          </span>
        )}
      </div>

      {(t.status === "live" || t.status === "transcribing") && <LiveCaption text={t.raw} lang={spokenLang} />}

      {t.status === "interpreting" && (
        <>
          <p className="f-original" dir={dir(spokenLang)}>
            {t.raw}
          </p>
          <div className="f-pending">
            <LogoLoader size={36} label={`Translating to ${langName(listenerLang)}`} />
          </div>
        </>
      )}

      {done && (
        <>
          <p className={`f-translation ${sizeFor(t.translation)}`} dir={dir(listenerLang)} lang={listenerLang}>
            <Reveal key={t.translation} text={t.translation} lang={listenerLang} drugs={t.drugs} field="translated" onDrug={onDrug} start={current ? 150 : 0} step={current ? 70 : 0} budget={current ? 1300 : 0} />
          </p>
          <p className="f-original" dir={dir(spokenLang)} lang={spokenLang}>
            <Reveal key={t.cleaned} text={t.cleaned} lang={spokenLang} drugs={t.drugs} field="mentioned" swap={who === "clinician" ? undefined : swapToward} onDrug={onDrug} step={0} budget={0} />
          </p>
        </>
      )}

      {t.status === "error" && <p className="error-text">Couldn't translate this. {t.error}</p>}

      {(notes.length > 0 || drugNotes.length > 0) && (
        <ul className="f-notes" aria-label="From the record">
          {notes.map((c) => (
            <li key={c.id} style={{ "--i": n++ } as React.CSSProperties}>
              <button className={`f-note ${c.level}`} onClick={() => onOpenCtx(c)}>
                <span className="f-note-icon">
                  <KindIcon id={c.id} size={20} />
                </span>
                <span className="f-note-text">
                  <strong>{c.title}</strong>
                  <span>{c.why || c.detail}</span>
                </span>
              </button>
            </li>
          ))}
          {drugNotes.map((d) => (
            <li key={d.key} style={{ "--i": n++ } as React.CSSProperties}>
              <button className="f-note drug" onClick={() => onDrug(d)}>
                <span className="f-note-icon">
                  <StatusBadge status={d.status} compact />
                </span>
                <span className="f-note-text">
                  <strong>{d.mentioned || d.home_name}</strong>
                  <span>{d.status === "not_available_locally" && who !== "clinician" ? "Not sold here" : swapLabel(d, swapToward)}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

type DockProps = {
  persona: Persona;
  /** Who the app is hearing right now, or who spoke last. */
  active: Speaker | null;
  forced: Speaker | null;
  setForced: (s: Speaker | null) => void;
  orb: ReactNode;
  label: ReactNode;
  children?: ReactNode;
};

/** The two people either side of the mic. A chip lights up for whoever is talking; tap one to say who's next. */
export function FocusDock({ persona, active, forced, setForced, orb, label, children }: DockProps) {
  const chip = (s: Speaker) => (
    <button className={`f-chip ${s} ${active === s ? "on" : ""} ${forced === s ? "pinned" : ""}`} onClick={() => setForced(forced === s ? null : s)} aria-pressed={forced === s}>
      <Flag code={s === "clinician" ? persona.trip.country : persona.home} size={26} />
      <span>
        <strong>{s === "clinician" ? "Clinician" : persona.name.split(" ")[0]}</strong>
        <small>{forced === s ? "Next to speak" : langName(s === "clinician" ? persona.trip.doctorLanguage : persona.language)}</small>
      </span>
    </button>
  );
  return (
    <footer className={`f-dock ${active || ""}`}>
      {children}
      <div className="f-dock-row">
        {chip("patient")}
        <div className="mic-wrap">{orb}</div>
        {chip("clinician")}
      </div>
      <div className="orb-label" aria-live="polite">
        {label}
      </div>
    </footer>
  );
}
