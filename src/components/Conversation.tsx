import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ContextItem, DrugMention, Persona, Speaker, Turn } from "../lib/types";
import { Mic, type MicState } from "../lib/mic";
import { Player } from "../lib/player";
import * as api from "../lib/api";
import { recordForContext, sttTerms } from "../lib/record";
import { isCached, loadTrip, rememberMentions, uniqueEquivalents, type Settings } from "../lib/store";
import { country, dir, langNative } from "../lib/langs";
import TurnCard from "./TurnCard";
import ContextStrip from "./ContextStrip";
import DrugSheet from "./DrugSheet";
import RecordSheet from "./RecordSheet";
import ContextSheet from "./ContextSheet";

type Props = { persona: Persona; settings: Settings; setSettings: (f: (s: Settings) => Settings) => void; onBack: () => void };

const uid = () => Math.random().toString(36).slice(2, 10);

export default function Conversation({ persona, settings, setSettings, onBack }: Props) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [ctx, setCtx] = useState<ContextItem[]>([]);
  const [micState, setMicState] = useState<MicState>("off");
  const [level, setLevel] = useState(0);
  const [speaking, setSpeaking] = useState(false);
  const [micError, setMicError] = useState("");
  const [forced, setForced] = useState<Speaker | null>(null);
  const [drug, setDrug] = useState<{ d: DrugMention; speaker: Speaker | null } | null>(null);
  const [openCtx, setOpenCtx] = useState<ContextItem | null>(null);
  const [showRecord, setShowRecord] = useState(false);
  const [typing, setTyping] = useState(false);
  const [draft, setDraft] = useState("");
  const [showScript, setShowScript] = useState(true);

  const pair = useMemo<api.Pair>(
    () => ({ patientLang: persona.language, doctorLang: persona.trip.doctorLanguage, home: persona.home, local: persona.trip.country }),
    [persona],
  );
  const terms = useMemo(() => sttTerms(persona), [persona]);
  const record = useMemo(() => recordForContext(persona), [persona]);

  // Refs so the long-lived mic/player callbacks always see current values.
  const turnsRef = useRef<Turn[]>([]);
  turnsRef.current = turns;
  const ctxRef = useRef<ContextItem[]>([]);
  ctxRef.current = ctx;
  const forcedRef = useRef<Speaker | null>(null);
  forcedRef.current = forced;
  const pairRef = useRef(pair);
  pairRef.current = pair;
  const speakRef = useRef(settings.speak);
  speakRef.current = settings.speak;
  const speechChain = useRef<Promise<void>>(Promise.resolve());
  const feedRef = useRef<HTMLDivElement>(null);

  const patch = useCallback((id: string, p: Partial<Turn> | ((t: Turn) => Partial<Turn>)) => {
    setTurns((all) => all.map((t) => (t.id === id ? { ...t, ...(typeof p === "function" ? p(t) : p) } : t)));
  }, []);

  const playerRef = useRef<Player | null>(null);
  const micRef = useRef<Mic | null>(null);
  if (!playerRef.current) {
    playerRef.current = new Player((busy) => {
      setSpeaking(busy);
      const mic = micRef.current;
      if (!mic) return;
      if (busy) mic.pause("speaking");
      // A short tail so the end of our own speech isn't picked up as a new utterance.
      else setTimeout(() => mic.resume("speaking"), 300);
    });
  }

  const history = () =>
    turnsRef.current
      .filter((t) => t.status === "done" && t.speaker)
      .slice(-4)
      .map((t) => ({ speaker: t.speaker as string, text: t.cleaned }));

  const addContext = useCallback((turnId: string, items: api.ContextResult["items"]) => {
    if (!items.length) return;
    setCtx((cur) => {
      const now = Date.now();
      const fresh = items.map((i, n) => {
        const prev = cur.find((c) => c.id === i.id);
        return { ...i, level: prev?.level === "alert" ? "alert" : i.level, turnId, at: now - n } as ContextItem;
      });
      const ids = new Set(fresh.map((f) => f.id));
      return [...fresh, ...cur.filter((c) => !ids.has(c.id))];
    });
  }, []);

  /** Runs one utterance (already transcribed, or typed) through interpretation, context and speech. */
  const runText = useCallback(
    async (turnId: string, text: string, forcedSpeaker: Speaker | null, opts: { speak: boolean; context: boolean }) => {
      const p = pairRef.current;
      const hist = history();
      const trip = loadTrip(p.home, p.local);
      let release: (v: { text: string; lang: string; voice: string } | null) => void = () => {};
      if (opts.speak) {
        const ready = new Promise<{ text: string; lang: string; voice: string } | null>((r) => (release = r));
        // Speak translations in the order people talked, even if a later one finishes first.
        speechChain.current = speechChain.current.then(async () => {
          const line = await ready;
          if (line && speakRef.current) await playerRef.current!.say(line.text, line.lang, line.voice);
        });
      }
      const t0 = performance.now();
      if (opts.context) {
        api
          .context({
            text,
            speaker: forcedSpeaker || "unknown (patient or clinician)",
            record,
            doctorLang: p.doctorLang,
            local: p.local,
            history: hist,
            shown: ctxRef.current.map((c) => c.id),
          })
          .then((r) => addContext(turnId, r.items))
          .catch((e) => console.warn("context failed", e));
      }
      try {
        const r = await api.interpret({
          ...p,
          text,
          forced: forcedSpeaker,
          meds: persona.medications.map(({ id, name, generic, dose, schedule }) => ({ id, name, generic, dose, schedule })),
          equivalents: uniqueEquivalents(trip).slice(0, 30),
          history: hist,
        });
        if (r.empty) {
          setTurns((all) => all.filter((t) => t.id !== turnId));
          release(null);
          return;
        }
        const drugs = r.drugs.map((d) => ({ ...d, cached: isCached(trip, d) }));
        rememberMentions(p.home, p.local, r.drugs);
        patch(turnId, (t) => ({
          status: "done",
          raw: t.raw || r.raw,
          cleaned: r.cleaned,
          translation: r.translation,
          language: r.language,
          speaker: r.speaker,
          listenerLang: r.listenerLang,
          drugs,
          timings: { ...t.timings, llm: r.ms, total: Math.round((t.timings.total || 0) + performance.now() - t0) },
        }));
        release({ text: r.translation, lang: r.listenerLang, voice: r.speaker === "patient" ? "coral" : "sage" });
      } catch (e) {
        patch(turnId, { status: "error", error: (e as Error).message });
        release(null);
      }
    },
    [addContext, patch, persona.medications, record],
  );

  const onUtterance = useCallback(
    async (wav: Blob) => {
      const id = uid();
      const forcedNow = forcedRef.current;
      const t0 = performance.now();
      setTurns((all) => [
        ...all,
        { id, at: Date.now(), status: "transcribing", raw: "", cleaned: "", translation: "", language: "", speaker: forcedNow, listenerLang: "", forced: forcedNow, drugs: [], timings: {} },
      ]);
      try {
        const stt = await api.transcribe(wav, pairRef.current, terms);
        if (!stt.text) {
          setTurns((all) => all.filter((t) => t.id !== id));
          return;
        }
        patch(id, { raw: stt.text, status: "interpreting", timings: { stt: stt.ms, total: Math.round(performance.now() - t0) } });
        await runText(id, stt.text, forcedNow, { speak: true, context: true });
      } catch (e) {
        patch(id, { status: "error", error: (e as Error).message });
      }
    },
    [patch, runText, terms],
  );

  if (!micRef.current) {
    micRef.current = new Mic({
      onState: setMicState,
      onLevel: setLevel,
      onUtterance: (wav) => void onUtteranceRef.current(wav),
      onError: setMicError,
    });
    micRef.current.mode = settings.mode;
  }
  const onUtteranceRef = useRef(onUtterance);
  onUtteranceRef.current = onUtterance;

  useEffect(() => {
    micRef.current!.setMode(settings.mode);
  }, [settings.mode]);

  useEffect(() => {
    playerRef.current!.enabled = settings.speak;
    if (!settings.speak) playerRef.current!.stop();
  }, [settings.speak]);

  // Stop everything when leaving the screen.
  useEffect(
    () => () => {
      micRef.current?.stop();
      playerRef.current?.stop();
    },
    [],
  );

  // Keep the screen awake while the conversation is open.
  useEffect(() => {
    let lock: WakeLockSentinel | null = null;
    const get = () => navigator.wakeLock?.request("screen").then((l) => (lock = l)).catch(() => {});
    void get();
    const vis = () => document.visibilityState === "visible" && void get();
    document.addEventListener("visibilitychange", vis);
    return () => {
      document.removeEventListener("visibilitychange", vis);
      lock?.release().catch(() => {});
    };
  }, []);

  useEffect(() => {
    const el = feedRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [turns]);

  /* ---------------------------------------------------------------- the big button */

  const mic = micRef.current!;
  const muted = mic.isPaused("muted");
  const orbTap = async () => {
    setMicError("");
    if (micState === "off" || micState === "error") {
      playerRef.current!.unlock();
      setShowScript(false);
      await mic.start();
      return;
    }
    if (speaking) {
      playerRef.current!.stop();
      return;
    }
    if (muted) {
      mic.resume("muted");
      return;
    }
    if (settings.mode === "push") {
      if (micState === "speech") mic.endPush();
      else mic.beginPush();
      return;
    }
    if (micState === "speech") mic.flush();
    else {
      mic.pause("muted");
      setMicState("paused");
    }
  };

  const orbLabel = (() => {
    if (micState === "off") return "Tap to start";
    if (micState === "starting") return "Starting mic…";
    if (micState === "error") return "Mic problem — tap to retry";
    if (speaking) return "Speaking translation · tap to skip";
    if (muted) return "Muted · tap to listen";
    if (settings.mode === "push") return micState === "speech" ? "Recording · tap to send" : "Tap and talk";
    if (micState === "speech") return "Hearing you · tap to send now";
    return "Listening · just talk";
  })();

  const sendTyped = () => {
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    setShowScript(false);
    playerRef.current!.unlock();
    const id = uid();
    setTurns((all) => [
      ...all,
      { id, at: Date.now(), status: "interpreting", raw: text, cleaned: "", translation: "", language: "", speaker: forced, listenerLang: "", forced, drugs: [], timings: {} },
    ]);
    void runText(id, text, forced, { speak: true, context: true });
  };

  const flipSpeaker = (t: Turn) => {
    const next: Speaker = t.speaker === "patient" ? "clinician" : "patient";
    patch(t.id, { status: "interpreting", forced: next, speaker: next });
    void runText(t.id, t.raw, next, { speak: true, context: false });
  };

  const replay = (t: Turn) => {
    if (!t.translation) return;
    playerRef.current!.unlock();
    playerRef.current!.enabled = true;
    void playerRef.current!.say(t.translation, t.listenerLang, t.speaker === "patient" ? "coral" : "sage").then(() => {
      playerRef.current!.enabled = speakRef.current;
    });
  };

  const alerts = ctx.filter((c) => c.level === "alert").length;
  const live = micState === "listening" || micState === "speech";

  return (
    <main className="talk">
      <header className="talk-bar">
        <button className="icon-btn" onClick={onBack} aria-label="Back">
          ‹
        </button>
        <button className="talk-who" onClick={() => setShowRecord(true)}>
          <span className="avatar sm">{persona.initials}</span>
          <span>
            <strong>{persona.name}</strong>
            <small>
              {country(persona.home).flag} {langNative(persona.language)} ⇄ {country(persona.trip.country).flag} {langNative(persona.trip.doctorLanguage)}
            </small>
          </span>
        </button>
        <button
          className={`icon-btn ${settings.speak ? "on" : ""}`}
          aria-label={settings.speak ? "Spoken translation on" : "Spoken translation off"}
          title="Speak translations aloud"
          onClick={() => setSettings((s) => ({ ...s, speak: !s.speak }))}
        >
          {settings.speak ? "🔊" : "🔇"}
        </button>
      </header>

      <div className="feed" ref={feedRef}>
        {turns.length === 0 && (
          <div className="empty">
            <div className="empty-art" aria-hidden>
              <span>{langNative(persona.language).slice(0, 2)}</span>
              <span>{langNative(persona.trip.doctorLanguage).slice(0, 2)}</span>
            </div>
            <h2>Talk naturally, one at a time</h2>
            <p>
              The app hears whether {langNative(persona.language)} or {langNative(persona.trip.doctorLanguage)} is spoken, cleans it up, says it in the other language, and swaps
              medicine names for the ones used in {country(persona.trip.country).name}. Things from {persona.name.split(" ")[0]}'s record that matter show up below for the doctor.
            </p>
            {showScript && (
              <div className="script">
                <div className="eyebrow">Demo lines</div>
                {persona.script.map((s, i) => (
                  <div key={i} className={`script-line ${s.speaker}`} dir={dir(s.speaker === "patient" ? persona.language : persona.trip.doctorLanguage)}>
                    <span className="who">{s.speaker === "patient" ? "Patient" : "Doctor"}</span>
                    <span>“{s.text}”</span>
                    <small>{s.shows}</small>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {turns.map((t) => (
          <TurnCard key={t.id} turn={t} persona={persona} onDrug={(d) => setDrug({ d, speaker: t.speaker })} onFlip={() => flipSpeaker(t)} onReplay={() => replay(t)} />
        ))}
      </div>

      <ContextStrip items={ctx} alerts={alerts} persona={persona} onOpen={setOpenCtx} />

      <footer className="controls">
        {micError && <div className="mic-error">{micError}</div>}
        {typing && (
          <form
            className="typer"
            onSubmit={(e) => {
              e.preventDefault();
              sendTyped();
            }}
          >
            <input autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Type what was said…" aria-label="Type an utterance" />
            <button className="primary" type="submit" disabled={!draft.trim()}>
              Send
            </button>
          </form>
        )}
        <div className="control-row">
          <div className="seg" role="radiogroup" aria-label="Who is talking">
            {([null, "patient", "clinician"] as const).map((s) => (
              <button key={s || "auto"} role="radio" aria-checked={forced === s} className={forced === s ? "on" : ""} onClick={() => setForced(s)}>
                {s === null ? "Auto" : s === "patient" ? "Patient" : "Doctor"}
              </button>
            ))}
          </div>

          <button
            className={`orb ${micState} ${speaking ? "speaking" : ""} ${muted ? "muted" : ""} ${live ? "live" : ""}`}
            style={{ ["--lvl" as string]: micState === "speech" || micState === "listening" ? level : 0 }}
            onClick={orbTap}
            aria-label={orbLabel}
          >
            <span className="orb-ring" />
            <span className="orb-core">{speaking ? <SpeakerIcon /> : muted ? <MutedIcon /> : <MicIcon />}</span>
          </button>

          <div className="side-tools">
            <button
              className={`chip-btn ${settings.mode === "push" ? "on" : ""}`}
              onClick={() => setSettings((s) => ({ ...s, mode: s.mode === "auto" ? "push" : "auto" }))}
              title="Hands-free or tap to talk"
            >
              {settings.mode === "auto" ? "Hands-free" : "Tap to talk"}
            </button>
            <button className={`chip-btn ${typing ? "on" : ""}`} onClick={() => setTyping((v) => !v)} title="Type instead">
              ⌨ Type
            </button>
          </div>
        </div>
        <div className="orb-label" aria-live="polite">
          {orbLabel}
          {alerts > 0 && <span className="alert-count"> · {alerts} alert{alerts > 1 ? "s" : ""} for the doctor</span>}
        </div>
      </footer>

      {drug && <DrugSheet drug={drug.d} speaker={drug.speaker} persona={persona} onClose={() => setDrug(null)} />}
      {openCtx && <ContextSheet item={openCtx} persona={persona} onClose={() => setOpenCtx(null)} />}
      {showRecord && <RecordSheet persona={persona} onClose={() => setShowRecord(false)} />}
    </main>
  );
}

function MicIcon() {
  return (
    <svg viewBox="0 0 24 24" width="30" height="30" aria-hidden>
      <rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor" />
      <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" />
    </svg>
  );
}
function MutedIcon() {
  return (
    <svg viewBox="0 0 24 24" width="30" height="30" aria-hidden>
      <rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor" opacity=".45" />
      <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" opacity=".45" />
      <path d="M4 4l16 16" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}
function SpeakerIcon() {
  return (
    <svg viewBox="0 0 24 24" width="30" height="30" aria-hidden>
      <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor" />
      <path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" />
    </svg>
  );
}
